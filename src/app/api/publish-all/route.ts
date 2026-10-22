import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import channelsConfig from "@/channels.config.json";
import { getFacebookCredentialError } from "@/lib/facebook-credentials";
import { publishToFacebook } from "@/lib/channels/facebook";
import { publishToInstagram } from "@/lib/channels/instagram";
import { publishToLinkedIn } from "@/lib/channels/linkedin";
import { publishToThreads } from "@/lib/channels/threads";
import { isCronBearerAuthorized } from "@/lib/marketing-auth";
import { getTrustedProductCoverUrl } from "@/lib/marketing-media";
import {
  getCampaignStatus,
  canRetryCampaign,
  countsTowardProductCooldown,
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
type PublishOutcome = { success: boolean; externalId?: string; error?: string };
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

function channelConfigured(channel: Channel): boolean {
  if (channel === "telegram") return Boolean(process.env.TELEGRAM_BOT_TOKEN && channelsConfig.telegram.chat_id);
  if (channel === "facebook") return !getFacebookCredentialError(
    process.env.FACEBOOK_PAGE_ID,
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  );
  if (channel === "instagram") return Boolean(
    /^\d{10,20}$/.test(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "") && process.env.INSTAGRAM_ACCESS_TOKEN,
  );
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

async function publishOne(channel: Channel, imageUrl: string, caption: string, buyUrl: string): Promise<PublishOutcome> {
  if (!channelConfigured(channel)) return { success: false, error: `${channel} is enabled but required credentials are not configured.` };
  try {
    if (channel === "telegram") return publishTelegram(process.env.TELEGRAM_BOT_TOKEN!, imageUrl, caption, buyUrl);
    if (channel === "facebook") {
      const result = await publishToFacebook(process.env.FACEBOOK_PAGE_ID!, process.env.FACEBOOK_PAGE_ACCESS_TOKEN!, {
        message: caption, image_url: imageUrl,
      });
      return { success: result.success && Boolean(result.postId), externalId: result.postId, error: result.success ? undefined : safeError(result.error) };
    }
    if (channel === "instagram") {
      const result = await publishToInstagram(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!, process.env.INSTAGRAM_ACCESS_TOKEN!, { imageUrl, caption });
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

async function findRetryableCampaign(supabase: ReturnType<typeof getSupabase>) {
  const { data, error } = await supabase.from("marketing_campaigns")
    .select("id, product_id, metadata, status, created_at")
    .in("status", ["ready", "active"])
    .order("updated_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Could not inspect existing publishing campaigns.");
  return (data || []).find((campaign) => {
    const meta = campaign.metadata && typeof campaign.metadata === "object" ? campaign.metadata as Record<string, unknown> : {};
    return meta.auto_publish === true && canRetryCampaign(meta, MAX_ATTEMPTS);
  }) || null;
}

async function loadValidProducts(supabase: ReturnType<typeof getSupabase>): Promise<Array<{ product: Product; imageUrl: string }>> {
  const { data, error } = await supabase.from("products")
    .select("id, title_ar, title_en, description_ar, description_en, price, category, cover_url")
    .eq("is_active", true)
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

async function handlePublish(request: NextRequest, payload: Record<string, unknown>) {
  const supabase = getSupabase();
  const autoMode = request.nextUrl.searchParams.get("auto") === "true" || payload.auto === true;
  const dryRun = request.nextUrl.searchParams.get("dry_run") === "true" || payload.dryRun === true;
  const channels = enabledChannels();
  if (!channels.length) return NextResponse.json({ success: false, error: "No direct publisher channels are enabled." }, { status: 503 });

  const retryCampaign = autoMode && !dryRun ? await findRetryableCampaign(supabase) : null;
  const products = await loadValidProducts(supabase);
  let selected: { product: Product; imageUrl: string } | undefined;
  let campaignId: string | null = retryCampaign?.id || null;

  if (retryCampaign) {
    selected = products.find(({ product }) => String(product.id) === String(retryCampaign.product_id));
    if (!selected) return NextResponse.json({ success: false, error: "The product for a pending campaign is no longer active or has an invalid cover." }, { status: 409 });
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

  if (!selected) return NextResponse.json({ success: false, error: "No active product with a valid price and public cover is available." }, { status: 404 });
  const { product, imageUrl } = selected;
  const invalid = validateProduct(product);
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 422 });

  const buyUrl = purchaseUrl(String(product.id));
  const caption = makeSalesCaption({ ...product, price: Number(product.price) }, buyUrl);
  const retryMetadata = retryCampaign
    ? getRetryMetadata(retryCampaign.metadata as Record<string, unknown>)
    : { attempts: 0, results: {} as ChannelPublishRecords };
  const channelsToRun = getChannelsToPublish(channels, retryMetadata.results);

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
        configured: channelConfigured(channel),
        status: !channelConfigured(channel) ? "not_configured" : channelsToRun.includes(channel) ? "would_publish" : "already_published",
      })),
      campaignId,
      externalPostsCreated: false,
    });
  }

  const priorMeta = retryCampaign?.metadata && typeof retryCampaign.metadata === "object"
    ? retryCampaign.metadata as Record<string, unknown>
    : {};
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
      metadata: { auto_publish: autoMode, attempts: 0, channel_results: {}, retry_exhausted: false, image_url: imageUrl, destination_url: buyUrl },
    }).select("id").single();
    if (error || !inserted) return NextResponse.json({ success: false, error: "Could not create the campaign record; no social posts were sent.", publishing: { success: false }, persistence: { success: false } }, { status: 500 });
    campaignId = inserted.id;
  }
  if (!campaignId) return NextResponse.json({ success: false, error: "Could not identify the campaign record; no social posts were sent." }, { status: 500 });

  const startedAt = new Date().toISOString();
  const startMetadata = {
    ...priorMeta,
    auto_publish: autoMode || priorMeta.auto_publish === true,
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
  for (const channel of channelsToRun as Channel[]) {
    results[channel] = await publishOne(channel, imageUrl, caption, buyUrl);
  }
  const status = getCampaignStatus(channels, results);
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
  const socialSuccess = channels.every((channel) => results[channel]?.success);
  return NextResponse.json({
    success: socialSuccess,
    campaignId,
    status,
    attempts: nextAttempt,
    retryExhausted: attemptMetadata.retry_exhausted,
    product: { id: String(product.id), title: product.title_en || product.title_ar, price: Number(product.price) },
    imageUrl,
    destination: buyUrl,
    results: channels.map((channel) => ({ channel, ...results[channel] })),
    publishing: { success: channels.some((channel) => results[channel]?.success), allEnabledSucceeded: socialSuccess },
    persistence,
  }, { status: persistenceError ? 502 : 200 });
}

export async function GET(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    return await handlePublish(request, {});
  } catch (error) {
    return NextResponse.json({ success: false, error: safeError(error instanceof Error ? error.message : undefined) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 });
    return await handlePublish(request, payload as Record<string, unknown>);
  } catch (error) {
    return NextResponse.json({ success: false, error: safeError(error instanceof Error ? error.message : undefined) }, { status: 500 });
  }
}
