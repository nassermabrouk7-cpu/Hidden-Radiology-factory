import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import channelsConfig from "@/channels.config.json";
import { getFacebookCredentialError } from "@/lib/facebook-credentials";
import { getMetaTokenHealth, isMetaTokenPublishAllowed, type MetaTokenHealth } from "@/lib/meta-token-health";
import { getInstagramBusinessAccountId } from "@/lib/meta-credentials";
import { getMetaPublishCredentials } from "@/lib/meta-token-vault";
import { publishToFacebook } from "@/lib/channels/facebook";
import { publishToInstagram } from "@/lib/channels/instagram";
import { publishToLinkedIn } from "@/lib/channels/linkedin";
import { publishToThreads } from "@/lib/channels/threads";
import { isCronBearerAuthorized } from "@/lib/marketing-auth";
import { getTrustedProductCoverUrl } from "@/lib/marketing-media";
import {
  getCampaignStatus,
  canRetryCampaign,
  claimDailyProductPublishRun,
  countsTowardProductCooldown,
  getRequiredCampaignChannels,
  getChannelsToPublish,
  getRetryMetadata,
  makeSalesCaption,
  type ChannelPublishRecords,
} from "@/lib/product-publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;
const COOLDOWN_DAYS = 7;
type Product = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price: number | string;
  category?: string | null;
  cover_url: string | null;
};
type PublishOutcome = { success: boolean; externalId?: string; error?: string; status?: "not_configured" };
type Channel = "telegram" | "facebook" | "instagram" | "threads" | "linkedin";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase runtime configuration is missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function safeError(value: unknown): string {
  let message = typeof value === "string" ? value : "Provider request failed.";
  for (const key of [
    "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN",
    "THREADS_ACCESS_TOKEN", "LINKEDIN_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET",
  ]) {
    const secret = process.env[key];
    if (secret) message = message.split(secret).join("[REDACTED]");
  }
  return message.slice(0, 300);
}

function enabledChannels(): Channel[] {
  return (["telegram", "facebook", "instagram", "threads", "linkedin"] as Channel[])
    .filter((channel) => Boolean(channelsConfig[channel]?.enabled));
}

function requiredChannels(metadata: Record<string, unknown> | null | undefined, enabled: Channel[]): Channel[] {
  return getRequiredCampaignChannels(metadata, enabled).filter((channel): channel is Channel => {
    return ["telegram", "facebook", "instagram", "threads", "linkedin"].includes(channel);
  });
}

function channelConfigured(channel: Channel, metaHealth: Partial<Record<"facebook" | "instagram", MetaTokenHealth>>): boolean {
  if (channel === "telegram") return Boolean(process.env.TELEGRAM_BOT_TOKEN && channelsConfig.telegram.chat_id);
  if (channel === "facebook") return (metaHealth.facebook !== undefined && isMetaTokenPublishAllowed(metaHealth.facebook.status)) &&
    (process.env.META_TOKEN_VAULT_ENABLED === "true" || !getFacebookCredentialError(process.env.FACEBOOK_PAGE_ID, process.env.FACEBOOK_PAGE_ACCESS_TOKEN));
  if (channel === "instagram") return (metaHealth.instagram !== undefined && isMetaTokenPublishAllowed(metaHealth.instagram.status)) &&
    (process.env.META_TOKEN_VAULT_ENABLED === "true" || Boolean(getInstagramBusinessAccountId() && process.env.INSTAGRAM_ACCESS_TOKEN));
  if (channel === "threads") return Boolean(process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN);
  return Boolean(process.env.LINKEDIN_ORGANIZATION_ID && process.env.LINKEDIN_ACCESS_TOKEN);
}

async function isReachableCover(product: Product): Promise<string | null> {
  const coverUrl = getTrustedProductCoverUrl(product.cover_url, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!coverUrl) return null;
  try {
    const response = await fetch(coverUrl, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    return contentType.toLowerCase().startsWith("image/") ? coverUrl : null;
  } catch {
    return null;
  }
}

function validateProduct(product: Product): string | null {
  if (!product.id || typeof product.id !== "string" || !product.id.trim()) return "Product ID is invalid.";
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0) return "Product price must be a positive number.";
  if (!(product.title_en?.trim() || product.title_ar?.trim())) return "Product title is missing.";
  return null;
}

function purchaseUrl(productId: string): string {
  const baseUrl = channelsConfig.website.base_url.replace(/\/+$/, "");
  return `${baseUrl}/library?book=${encodeURIComponent(productId)}`;
}

async function publishTelegram(token: string, imageUrl: string, caption: string, buyUrl: string): Promise<PublishOutcome> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelsConfig.telegram.chat_id,
        photo: imageUrl,
        caption: caption.slice(0, 1024),
        reply_markup: { inline_keyboard: [[{ text: "Buy now", url: buyUrl }]] },
      }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    const messageId = data?.result?.message_id;
    if (!response.ok || data?.ok !== true || (typeof messageId !== "string" && typeof messageId !== "number")) {
      return { success: false, error: safeError(data?.description || `Telegram returned HTTP ${response.status}.`) };
    }
    return { success: true, externalId: String(messageId) };
  } catch (error) {
    return { success: false, error: safeError(error instanceof Error ? error.message : undefined) };
  }
}

async function publishOne(channel: Channel, imageUrl: string, caption: string, buyUrl: string, metaHealth: Partial<Record<"facebook" | "instagram", MetaTokenHealth>>): Promise<PublishOutcome> {
  if (!channelConfigured(channel, metaHealth)) return { success: false, error: `${channel} is enabled but required credentials are not configured or verified.` };
  try {
    if (channel === "telegram") return publishTelegram(process.env.TELEGRAM_BOT_TOKEN!, imageUrl, caption, buyUrl);
    if (channel === "facebook") {
      const credentials = await getMetaPublishCredentials("facebook");
      if (!credentials || getFacebookCredentialError(credentials.id, credentials.accessToken)) {
        return { success: false, status: "not_configured", error: "Facebook Page credentials are missing or malformed." };
      }
      const result = await publishToFacebook(credentials.id, credentials.accessToken, {
        message: caption, image_url: imageUrl,
      });
      return { success: result.success && Boolean(result.postId), externalId: result.postId, error: result.success ? undefined : safeError(result.error) };
    }
    if (channel === "instagram") {
      const credentials = await getMetaPublishCredentials("instagram");
      if (!credentials || !/^\d{10,20}$/.test(credentials.id)) {
        return { success: false, status: "not_configured", error: "Instagram business account credentials are missing or malformed." };
      }
      const result = await publishToInstagram(credentials.id, credentials.accessToken, { imageUrl, caption });
      return { success: result.success && Boolean(result.postId), externalId: result.postId, error: result.success ? undefined : safeError(result.error) };
    }
    if (channel === "threads") {
      const result = await publishToThreads(process.env.THREADS_USER_ID!, process.env.THREADS_ACCESS_TOKEN!, { text: caption, mediaUrl: imageUrl });
      return { success: result.success && Boolean(result.postId), externalId: result.postId, error: result.success ? undefined : safeError(result.error) };
    }
    const result = await publishToLinkedIn(process.env.LINKEDIN_ORGANIZATION_ID!, process.env.LINKEDIN_ACCESS_TOKEN!, { text: caption, link: buyUrl });
    return { success: result.success && Boolean(result.postId), externalId: result.postId, error: result.success ? undefined : safeError(result.error) };
  } catch (error) {
    return { success: false, error: safeError(error instanceof Error ? error.message : undefined) };
  }
}

async function findRetryableCampaign(
  supabase: ReturnType<typeof getSupabase>,
  channels: Channel[],
  readyChannels: Channel[],
  products: Array<{ product: Product; imageUrl: string }>,
) {
  const { data, error } = await supabase.from("marketing_campaigns")
    .select("id, product_id, metadata, status, created_at")
    .in("status", ["ready", "active"])
    .order("updated_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Could not inspect existing publishing campaigns.");
  return (data || []).find((campaign) => {
    const meta = campaign.metadata && typeof campaign.metadata === "object" ? campaign.metadata as Record<string, unknown> : {};
    if (meta.auto_publish !== true || !canRetryCampaign(meta, MAX_ATTEMPTS, channels)) return false;
    if (!products.some(({ product }) => String(product.id) === String(campaign.product_id))) return false;
    const pending = getChannelsToPublish(requiredChannels(meta, channels), getRetryMetadata(meta).results);
    return pending.some((channel) => readyChannels.includes(channel));
  }) || null;
}

async function loadValidProducts(supabase: ReturnType<typeof getSupabase>): Promise<Array<{ product: Product; imageUrl: string }>> {
  const { data, error } = await supabase.from("products")
    .select("id, title_ar, title_en, description_ar, description_en, price, category, cover_url")
    .limit(50);
  if (error) throw new Error("Could not load active products.");
  const valid: Array<{ product: Product; imageUrl: string }> = [];
  const validated = await Promise.all((data || []).map(async (product: Product) => {
    if (validateProduct(product)) return null;
    const imageUrl = await isReachableCover(product);
    return imageUrl ? { product, imageUrl } : null;
  }));
  valid.push(...validated.filter((item): item is { product: Product; imageUrl: string } => Boolean(item)));
  return valid;
}

async function handlePublish(request: NextRequest, payload: Record<string, unknown>, supabase = getSupabase()) {
  const autoMode = request.nextUrl.searchParams.get("auto") === "true" || payload.auto === true;
  const dryRun = request.nextUrl.searchParams.get("dry_run") === "true" || payload.dryRun === true;
  const metaHealth = {
    facebook: await getMetaTokenHealth("facebook"),
    instagram: await getMetaTokenHealth("instagram"),
  };
  const channels = enabledChannels();
  if (!channels.length) return NextResponse.json({ success: false, error: "No direct publisher channels are enabled." }, { status: 503 });

  const products = await loadValidProducts(supabase);
  const readyChannels = channels.filter((channel) => channelConfigured(channel, metaHealth));
  const retryCampaign = autoMode && !dryRun
    ? await findRetryableCampaign(supabase, channels, readyChannels, products)
    : null;
  let selected: { product: Product; imageUrl: string } | undefined;
  let campaignId: string | null = retryCampaign?.id || null;

  if (retryCampaign) {
    selected = products.find(({ product }) => String(product.id) === String(retryCampaign.product_id));
  } else if (payload.bookId) {
    selected = products.find(({ product }) => String(product.id) === String(payload.bookId));
  } else {
    let candidates = products;
    if (autoMode) {
      const since = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent, error } = await supabase.from("marketing_campaigns")
        .select("product_id, status, metadata")
        .gte("created_at", since)
        .in("status", ["active", "completed"]);
      if (error) throw new Error("Could not inspect recently successful campaigns.");
      const cooled = new Set((recent || []).filter((row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
        return countsTowardProductCooldown(row.status, metadata);
      }).map((row) => String(row.product_id)));
      candidates = candidates.filter(({ product }) => !cooled.has(String(product.id)));
    }
    selected = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const retryMetadata = retryCampaign
    ? getRetryMetadata(retryCampaign.metadata as Record<string, unknown>)
    : { attempts: 0, results: {} as ChannelPublishRecords };
  const priorMeta = retryCampaign?.metadata && typeof retryCampaign.metadata === "object"
    ? retryCampaign.metadata as Record<string, unknown>
    : {};
  const campaignChannels = requiredChannels(priorMeta, channels);

  if (!selected && readyChannels.length === 0) {
    return NextResponse.json({
      success: false,
      status: "skipped",
      reason: "No enabled publishing channel is currently ready.",
      channels: campaignChannels.map((channel) => ({
        channel,
        success: false,
        status: "not_configured",
        error: "The channel is enabled, but its required credentials or verified token are unavailable.",
      })),
      campaignId: null,
      publicationAttempted: false,
    }, { status: 503 });
  }
  if (!selected) return NextResponse.json({ success: false, error: "No active product with a valid price and public cover is available." }, { status: 404 });
  const { product, imageUrl } = selected;
  const invalid = validateProduct(product);
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 422 });

  const buyUrl = purchaseUrl(String(product.id));
  const caption = makeSalesCaption({ ...product, price: Number(product.price) }, buyUrl);
  const channelsToRun = getChannelsToPublish(campaignChannels, retryMetadata.results);

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      product: { id: String(product.id), title: product.title_en || product.title_ar, price: Number(product.price) },
      imageUrl,
      destination: buyUrl,
      caption,
      channels: channels.map((channel) => ({
        channel,
        enabled: true,
        configured: channelConfigured(channel, metaHealth),
        success: retryMetadata.results[channel]?.success === true,
        status: !channelConfigured(channel, metaHealth)
          ? "not_configured"
          : retryMetadata.results[channel]?.success === true ? "already_published" : "would_publish",
      })),
      campaignId,
      externalPostsCreated: false,
    });
  }

  const channelsReadyToRun = channelsToRun.filter((channel) => readyChannels.includes(channel));
  if (channelsReadyToRun.length === 0) {
    return NextResponse.json({
      success: false,
      status: "skipped",
      reason: "All remaining channels are waiting for configuration or token recovery.",
      channels: campaignChannels.map((channel) => ({
        channel,
        success: retryMetadata.results[channel]?.success === true,
        status: retryMetadata.results[channel]?.success === true ? "published" : "not_configured",
        ...(retryMetadata.results[channel]?.success === true ? {} : { error: "The channel is not currently ready to publish." }),
      })),
      campaignId,
      publicationAttempted: false,
    }, { status: 503 });
  }
  const nextAttempt = retryMetadata.attempts + 1;
  if (!retryCampaign) {
    const title = product.title_en?.trim() || product.title_ar?.trim() || "Product promotion";
    const { data: inserted, error } = await supabase.from("marketing_campaigns").insert({
      product_id: String(product.id),
      name: `${title} — product promotion`,
      objective: "sales",
      audience: "radiology students and professionals",
      positioning: "educational product",
      theme: `${title} product promotion`,
      language_strategy: "ar+en",
      status: "ready",
      metadata: { auto_publish: autoMode, attempts: 0, required_channels: channels, channel_results: {}, retry_exhausted: false, image_url: imageUrl, destination_url: buyUrl },
    }).select("id").single();
    if (error || !inserted) return NextResponse.json({ success: false, error: "Could not create the campaign record; no social posts were sent.", publishing: { success: false }, persistence: { success: false } }, { status: 500 });
    campaignId = inserted.id;
  }
  if (!campaignId) return NextResponse.json({ success: false, error: "Could not identify the campaign record; no social posts were sent." }, { status: 500 });

  const startedAt = new Date().toISOString();
  const startMetadata = {
    ...priorMeta,
    auto_publish: autoMode || priorMeta.auto_publish === true,
    required_channels: campaignChannels,
    attempts: nextAttempt,
    channel_results: retryMetadata.results,
    retry_exhausted: false,
    attempt_in_progress: true,
    last_attempt_at: startedAt,
    image_url: imageUrl,
    destination_url: buyUrl,
  };
  const { error: startError } = await supabase.from("marketing_campaigns")
    .update({ metadata: startMetadata, updated_at: startedAt })
    .eq("id", campaignId);
  if (startError) {
    return NextResponse.json({ success: false, error: "Could not record the publishing attempt; no social posts were sent.", campaignId, publishing: { success: false }, persistence: { success: false } }, { status: 500 });
  }

  const results: ChannelPublishRecords = { ...retryMetadata.results };
  for (const channel of channelsToRun) {
    results[channel] = readyChannels.includes(channel) && channelConfigured(channel, metaHealth)
      ? await publishOne(channel, imageUrl, caption, buyUrl, metaHealth)
      : { success: false, status: "not_configured", error: "The channel is enabled, but its credentials or verified token are unavailable." };
  }
  const status = getCampaignStatus(campaignChannels, results);
  const attemptMetadata = {
    ...priorMeta,
    auto_publish: autoMode || priorMeta.auto_publish === true,
    attempts: nextAttempt,
    channel_results: results,
    retry_exhausted: status !== "completed" && nextAttempt >= MAX_ATTEMPTS,
    attempt_in_progress: false,
    last_attempt_at: new Date().toISOString(),
    image_url: imageUrl,
    destination_url: buyUrl,
  };
  const { error: persistenceError } = await supabase.from("marketing_campaigns")
    .update({ status, metadata: attemptMetadata, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  const persistence = persistenceError
    ? { success: false, error: "Social outcomes were collected, but campaign logging failed. Reconcile provider posts before retrying." }
    : { success: true, campaignId, status };
  const socialSuccess = campaignChannels.length > 0 && campaignChannels.every((channel) => results[channel]?.success === true);
  return NextResponse.json({
    success: socialSuccess,
    campaignId,
    status,
    attempts: nextAttempt,
    retryExhausted: attemptMetadata.retry_exhausted,
    product: { id: String(product.id), title: product.title_en || product.title_ar, price: Number(product.price) },
    imageUrl,
    destination: buyUrl,
    results: campaignChannels.map((channel) => ({ channel, ...results[channel] })),
    publishing: { success: campaignChannels.some((channel) => results[channel]?.success === true), allEnabledSucceeded: socialSuccess },
    persistence,
  }, { status: persistenceError ? 502 : 200 });
}

async function handleRequest(request: NextRequest, payload: Record<string, unknown>) {
  const autoMode = request.nextUrl.searchParams.get("auto") === "true" || payload.auto === true;
  const dryRun = request.nextUrl.searchParams.get("dry_run") === "true" || payload.dryRun === true;
  const supabase = getSupabase();
  if (!autoMode || dryRun) return handlePublish(request, payload, supabase);

  const { claimed, runDate, idempotencyKey } = await claimDailyProductPublishRun(supabase);
  if (!claimed) {
    return NextResponse.json({
      success: true,
      skipped: true,
      publicationAttempted: false,
      reason: "The daily publishing run was already claimed.",
      idempotencyKey,
    });
  }

  let response: NextResponse;
  let outcome: "completed" | "failed" | "skipped";
  try {
    response = await handlePublish(request, payload, supabase);
    const responseBody = await response.clone().json().catch(() => null) as { success?: unknown; status?: unknown } | null;
    outcome = responseBody?.success === true
      ? "completed"
      : responseBody?.status === "skipped" ? "skipped" : "failed";
  } catch (error) {
    const { error: persistError } = await supabase.from("product_publish_daily_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), result: { outcome: "failed" } })
      .eq("run_date", runDate)
      .eq("idempotency_key", idempotencyKey);
    if (persistError) throw new Error("Daily publishing failed and its outcome could not be recorded.");
    throw error;
  }
  const { error: persistError } = await supabase.from("product_publish_daily_runs")
    .update({
      status: outcome,
      completed_at: new Date().toISOString(),
      result: { http_status: response.status, outcome },
    })
    .eq("run_date", runDate)
    .eq("idempotency_key", idempotencyKey);
  if (persistError) {
    return NextResponse.json({
      success: false,
      error: "The daily outcome could not be recorded. Reconcile campaign results before any manual retry.",
      idempotencyKey,
    }, { status: 502 });
  }
  return response;
}

export async function GET(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    return await handleRequest(request, {});
  } catch (error) {
    return NextResponse.json({ success: false, error: safeError(error instanceof Error ? error.message : undefined) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 });
    return await handleRequest(request, payload as Record<string, unknown>);
  } catch (error) {
    return NextResponse.json({ success: false, error: safeError(error instanceof Error ? error.message : undefined) }, { status: 500 });
  }
}
