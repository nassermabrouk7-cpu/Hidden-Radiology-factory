import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import channelsConfig from "@/channels.config.json";
import { publishToFacebook } from "@/lib/channels/facebook";
import { publishToInstagram } from "@/lib/channels/instagram";
import { getFacebookCredentialError } from "@/lib/facebook-credentials";
import { isCronBearerAuthorized } from "@/lib/marketing-auth";
import { getTrustedProductCoverUrl } from "@/lib/marketing-media";
import { makeSalesCaption } from "@/lib/product-publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Channel = "telegram" | "facebook" | "instagram";
type Product = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price: number | string;
  cover_url: string | null;
};
type PublishResult = { success: boolean; externalId?: string; error?: string };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase runtime configuration is missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function safeError(value: unknown): string {
  let message = typeof value === "string" ? value : "Provider request failed.";
  for (const key of [
    "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET",
  ]) {
    const secret = process.env[key];
    if (secret) message = message.split(secret).join("[REDACTED]");
  }
  return message.slice(0, 300);
}

function isChannel(value: unknown): value is Channel {
  return value === "telegram" || value === "facebook" || value === "instagram";
}

function channelConfigured(channel: Channel): boolean {
  if (!channelsConfig[channel]?.enabled) return false;
  if (channel === "telegram") {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && channelsConfig.telegram.chat_id);
  }
  if (channel === "facebook") {
    return !getFacebookCredentialError(process.env.FACEBOOK_PAGE_ID, process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
  }
  return Boolean(
    /^\d{10,20}$/.test(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "") &&
    process.env.INSTAGRAM_ACCESS_TOKEN,
  );
}

function validateProduct(product: Product): string | null {
  if (!product.id || !String(product.id).trim()) return "Product ID is invalid.";
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) return "Product price must be positive.";
  if (!(product.title_en?.trim() || product.title_ar?.trim())) return "Product title is missing.";
  return null;
}

function purchaseUrl(productId: string): string {
  const siteUrl = new URL(channelsConfig.website.base_url);
  if (siteUrl.protocol !== "https:" || siteUrl.username || siteUrl.password) {
    throw new Error("The product destination URL is not configured securely.");
  }
  const destination = new URL("/library", siteUrl.origin);
  destination.searchParams.set("book", productId);
  return destination.toString();
}

async function publishTelegram(imageUrl: string, caption: string, buyUrl: string): Promise<PublishResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
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
    const result = await response.json().catch(() => ({}));
    const messageId = result?.result?.message_id;
    if (!response.ok || result?.ok !== true || (typeof messageId !== "string" && typeof messageId !== "number")) {
      return { success: false, error: safeError(result?.description || `Telegram returned HTTP ${response.status}.`) };
    }
    return { success: true, externalId: String(messageId) };
  } catch (error) {
    return { success: false, error: safeError(error instanceof Error ? error.message : undefined) };
  }
}

async function publishSelected(channel: Channel, product: Product, imageUrl: string, buyUrl: string): Promise<PublishResult> {
  const caption = makeSalesCaption({ ...product, price: Number(product.price) }, buyUrl);
  try {
    if (channel === "telegram") return publishTelegram(imageUrl, caption, buyUrl);
    if (channel === "facebook") {
      const result = await publishToFacebook(process.env.FACEBOOK_PAGE_ID!, process.env.FACEBOOK_PAGE_ACCESS_TOKEN!, {
        message: caption,
        image_url: imageUrl,
      });
      return result.success && result.postId
        ? { success: true, externalId: result.postId }
        : { success: false, error: safeError(result.error || "Facebook did not return a post ID.") };
    }
    const result = await publishToInstagram(
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!,
      process.env.INSTAGRAM_ACCESS_TOKEN!,
      { imageUrl, caption },
    );
    return result.success && result.postId
      ? { success: true, externalId: result.postId }
      : { success: false, error: safeError(result.error || "Instagram did not return a post ID.") };
  } catch (error) {
    return { success: false, error: safeError(error instanceof Error ? error.message : undefined) };
  }
}

export async function POST(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  if (!productId || !isChannel(body.channel)) {
    return NextResponse.json({ success: false, error: "A productId and one supported channel are required." }, { status: 400 });
  }
  if (("publish" in body && typeof body.publish !== "boolean") || ("dryRun" in body && typeof body.dryRun !== "boolean")) {
    return NextResponse.json({ success: false, error: "publish and dryRun must be boolean values." }, { status: 400 });
  }
  if (body.publish === true && body.dryRun === true) {
    return NextResponse.json({ success: false, error: "A request cannot publish and dry-run at the same time." }, { status: 400 });
  }
  const channel = body.channel;
  const publishRequested = body.publish === true;

  const configured = channelConfigured(channel);
  if (publishRequested && !configured) {
    return NextResponse.json({ success: false, error: `The ${channel} channel is disabled or not configured.` }, { status: 503 });
  }

  try {
    const supabase = getSupabase();
    const { data: product, error: productError } = await supabase.from("products")
      .select("id, title_ar, title_en, description_ar, description_en, price, cover_url")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle();
    if (productError) throw new Error("Could not load the requested product.");
    if (!product) return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });

    const invalid = validateProduct(product as Product);
    if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 422 });
    const imageUrl = getTrustedProductCoverUrl(product.cover_url, process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!imageUrl) return NextResponse.json({ success: false, error: "Product cover URL is invalid." }, { status: 422 });
    let coverResponse: Response;
    try {
      coverResponse = await fetch(imageUrl, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(8000) });
    } catch {
      return NextResponse.json({ success: false, error: "Product cover could not be reached." }, { status: 422 });
    }
    if (!coverResponse.ok || !(coverResponse.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Product cover is not a reachable image." }, { status: 422 });
    }

    const buyUrl = purchaseUrl(productId);
    const { data: priorSuccess, error: duplicateError } = await supabase.from("marketing_campaigns")
      .select("id, metadata")
      .eq("product_id", productId)
      .contains("metadata", { channel_results: { [channel]: { success: true } } })
      .limit(1);
    if (duplicateError) throw new Error("Could not check the existing publishing record.");
    const previous = (priorSuccess || []).find((campaign: { metadata?: Record<string, unknown> }) => {
      const results = campaign.metadata?.channel_results as Record<string, { success?: boolean; externalId?: string }> | undefined;
      return results?.[channel]?.success === true;
    });

    if (previous) {
      return NextResponse.json({
        success: false,
        alreadyPublished: true,
        dryRun: !publishRequested,
        productId,
        channel,
        error: "This product was already published successfully to the selected channel.",
      }, { status: 409 });
    }

    if (!publishRequested) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        publishRequested: false,
        product: { id: productId, title: product.title_en || product.title_ar, price: Number(product.price) },
        imageUrl,
        destination: buyUrl,
        channel: { name: channel, configured, status: configured ? "would_publish" : "not_configured" },
        campaignId: null,
        externalPostsCreated: false,
      });
    }

    const title = product.title_en?.trim() || product.title_ar?.trim() || "Product promotion";
    const initialMetadata = {
      single_channel_publish: true,
      selected_channel: channel,
      auto_publish: false,
      attempts: 1,
      attempt_in_progress: true,
      image_url: imageUrl,
      destination_url: buyUrl,
      channel_results: {},
    };
    const { data: campaign, error: insertError } = await supabase.from("marketing_campaigns").insert({
      product_id: productId,
      name: `${title} — single-channel product test`,
      objective: "sales",
      audience: "radiology students and professionals",
      positioning: "educational product",
      theme: `${title} product promotion`,
      language_strategy: "ar+en",
      status: "ready",
      metadata: initialMetadata,
    }).select("id").single();
    if (insertError?.code === "23505") {
      return NextResponse.json({ success: false, error: "A publish attempt for this product and channel is already in progress." }, { status: 409 });
    }
    if (insertError || !campaign?.id) {
      return NextResponse.json({ success: false, error: "Could not create the publishing record; no publisher was called." }, { status: 500 });
    }

    const outcome = await publishSelected(channel, product as Product, imageUrl, buyUrl);
    const publishedAt = outcome.success ? new Date().toISOString() : null;
    const resultRecord = {
      success: outcome.success,
      ...(outcome.externalId ? { externalId: outcome.externalId } : {}),
      ...(outcome.error ? { error: outcome.error } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    };
    const finalMetadata = {
      ...initialMetadata,
      attempt_in_progress: false,
      last_attempt_at: new Date().toISOString(),
      channel_results: { [channel]: resultRecord },
    };
    const { error: updateError } = await supabase.from("marketing_campaigns")
      .update({ status: outcome.success ? "completed" : "ready", metadata: finalMetadata, updated_at: new Date().toISOString() })
      .eq("id", campaign.id);

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: "Publisher result could not be saved. Reconcile the external post before retrying.",
        providerSucceeded: outcome.success,
        externalId: outcome.externalId || null,
        campaignId: campaign.id,
        persistence: { success: false },
      }, { status: 502 });
    }
    if (!outcome.success) {
      return NextResponse.json({
        success: false,
        error: outcome.error || "The selected platform rejected the post.",
        campaignId: campaign.id,
        channel: { name: channel, success: false },
        persistence: { success: true, status: "ready" },
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      productId,
      channel: { name: channel, success: true, externalId: outcome.externalId },
      imageUrl,
      destination: buyUrl,
      campaignId: campaign.id,
      persistence: { success: true, status: "completed" },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: safeError(error instanceof Error ? error.message : undefined) }, { status: 500 });
  }
}
