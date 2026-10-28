import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateCampaign, type GeneratedCampaign, type MarketingPlatform } from "@/lib/marketing-ai";
import { getGeneratedMarketingItemStatus, isMarketingJobAuthorized } from "@/lib/marketing-auth";
import { normalizeMarketingSiteUrl } from "@/lib/marketing-site";
import { claimDailyMarketingGenerationRun, getDailyMarketingSchedule, selectNextMarketingProduct } from "@/lib/marketing-schedule";
import channelsConfig from "@/channels.config.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ProductRow = {
  id: string; title_ar: string; title_en: string; category: string; price: number;
  language: string; cover_url: string | null; created_at: string; is_active: boolean;
};
type CampaignRow = {
  id: string; product_id: string; name: string; objective: string; audience: string;
  positioning: string; theme: string; language_strategy: string; status: string;
  metadata: Record<string, unknown>; created_at: string; updated_at: string;
};
type ContentRow = {
  id: string; campaign_id: string; product_id: string; platform: string; language: string;
  content_type: string; title: string; hook: string; body: string; cta: string;
  hashtags: string[]; destination_url: string | null; scheduled_at: string | null;
  status: string; metadata: Record<string, unknown>; created_at: string; updated_at: string;
};
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type GenerationRunRow = {
  run_date: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  result: Record<string, unknown>;
};
type MarketingDatabase = {
  public: {
    Tables: {
      products: Table<ProductRow>;
      marketing_campaigns: Table<CampaignRow>;
      marketing_content: Table<ContentRow>;
      marketing_generation_daily_runs: Table<GenerationRunRow>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_marketing_generation_daily_run: {
        Args: { p_run_date: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return createClient<MarketingDatabase>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getConfiguredPlatforms(): MarketingPlatform[] {
  const configured: MarketingPlatform[] = [];
  if (channelsConfig.telegram.enabled && process.env.TELEGRAM_BOT_TOKEN && channelsConfig.telegram.chat_id) {
    configured.push("telegram");
  }
  if (channelsConfig.facebook.enabled &&
      (process.env.META_TOKEN_VAULT_ENABLED === "true" ||
        (process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN))) {
    configured.push("facebook");
  }
  if (channelsConfig.instagram.enabled &&
      (process.env.META_TOKEN_VAULT_ENABLED === "true" ||
        ((process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID) &&
          process.env.INSTAGRAM_ACCESS_TOKEN))) {
    configured.push("instagram");
  }
  if (channelsConfig.linkedin.enabled && process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN) {
    configured.push("linkedin");
  }
  if (channelsConfig.threads.enabled && process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN) {
    configured.push("threads");
  }

  if (process.env.MARKETING_ALLOW_PAID_METRICOOL_API === "true" && process.env.METRICOOL_API_TOKEN) {
    return (process.env.METRICOOL_PLATFORMS || "facebook,instagram")
      .split(",").map((value) => value.trim())
      .filter((value): value is MarketingPlatform =>
        ["instagram", "facebook", "linkedin"].includes(value) && configured.includes(value as MarketingPlatform));
  }
  return configured;
}

function validateCampaign(value: GeneratedCampaign, platforms: MarketingPlatform[]) {
  if (!value || typeof value !== "object" || !Array.isArray(value.content) || value.content.length !== platforms.length) {
    throw new Error(`The generated campaign must contain exactly ${platforms.length} content items`);
  }

  const seenPlatforms = new Set<string>();
  for (const item of value.content) {
    if (!item || !platforms.includes(item.platform)) throw new Error("Campaign contains an unsupported platform");
    if (seenPlatforms.has(item.platform)) throw new Error("Campaign must contain exactly one post per platform");
    seenPlatforms.add(item.platform);
    if (item.language !== "ar" && item.language !== "en") throw new Error("Campaign contains an unsupported language");
    if (!["authority", "education", "product", "trust", "conversion"].includes(item.content_type)) throw new Error("Campaign contains an unsupported content type");
    for (const field of ["title", "hook", "body", "cta"] as const) {
      if (typeof item[field] !== "string" || !item[field].trim()) throw new Error(`Campaign is missing ${field}`);
      if (item[field].length > 3000) throw new Error(`Campaign ${field} exceeds the allowed length`);
    }
    const maxLength = item.platform === "telegram" ? 750
      : item.platform === "threads" ? 350
        : item.platform === "instagram" ? 2000
          : 2800;
    if (!Array.isArray(item.hashtags)) item.hashtags = [];
    item.hashtags = item.hashtags.filter((tag) => typeof tag === "string" && tag.trim()).slice(0, 12);
    const composedText = [
      item.title,
      item.hook,
      item.body,
      item.cta,
      ...item.hashtags,
    ].join("\n\n");
    if (composedText.length > maxLength) {
      throw new Error(`Campaign content exceeds the ${item.platform} text limit`);
    }
  }
  if (seenPlatforms.size !== platforms.length) throw new Error("Campaign is missing a configured platform");
}

async function generateForRequest(request: NextRequest, allowQueueBacklog: boolean) {
  try {
    const supabase = getSupabase();
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    // Do not add a campaign while any prior content still needs review, publishing, or reconciliation.
    if (!force && !allowQueueBacklog) {
      const { data: pending, error } = await supabase
        .from("marketing_content")
        .select("id")
        .in("status", ["queued", "approved", "scheduled"])
        .limit(1);
      if (error) throw new Error("Could not inspect the marketing queue");
      if (pending?.length) {
        return NextResponse.json({ success: true, status: "queue_active", generated: false, message: "The existing campaign already has scheduled content." });
      }
    }

    const availablePlatforms = getConfiguredPlatforms();
    if (!availablePlatforms.length) {
      return NextResponse.json(
        { error: "No social publishing integration is configured." },
        { status: 503 },
      );
    }

    // Resolve the destination before calling Gemini or writing any campaign rows.
    const siteUrl = normalizeMarketingSiteUrl(process.env.MARKETING_SITE_URL);

    const requestedProductId = url.searchParams.get("product_id");
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, title_ar, title_en, category, price, language, cover_url")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(200);
    if (productError) throw new Error("Could not load products for campaign generation");
    if (!products?.length) return NextResponse.json({ error: "No products are available for campaign generation" }, { status: 404 });

    let product = requestedProductId ? products.find((item: { id: string }) => String(item.id) === requestedProductId) : undefined;
    if (!product) {
      const { data: campaigns, error } = await supabase.from("marketing_campaigns")
        .select("product_id, created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error("Could not choose a product for the next campaign");
      product = selectNextMarketingProduct(products, campaigns || []);
    }
    if (!product) return NextResponse.json({ error: "No product is available for campaign generation" }, { status: 404 });

    const campaignPlatforms = availablePlatforms;
    const campaign = await generateCampaign(product, campaignPlatforms);
    validateCampaign(campaign, campaignPlatforms);
    if (campaign.content.some((item) => !campaignPlatforms.includes(item.platform))) {
      throw new Error("Campaign includes a platform that is not configured");
    }

    const { data: insertedCampaign, error: campaignError } = await supabase.from("marketing_campaigns").insert({
      product_id: String(product.id),
      name: campaign.name,
      objective: campaign.objective,
      audience: campaign.audience,
      positioning: campaign.positioning,
      theme: campaign.theme,
      language_strategy: campaign.language_strategy,
      status: "ready",
      metadata: { generated_by: "gemini", model: process.env.GEMINI_MODEL || "gemini-3.8-flash" },
    }).select("id").single();
    if (campaignError || !insertedCampaign) throw new Error("Could not save the generated campaign");

    // Queue one post for each configured platform in the same next-daily slot.
    const scheduleStart = new Date();
    const items = campaign.content.map((item, index) => {
      return {
        campaign_id: insertedCampaign.id,
        product_id: String(product.id),
        platform: item.platform,
        language: item.language,
        content_type: item.content_type,
        title: item.title,
        hook: item.hook,
        body: item.body,
        cta: item.cta,
        hashtags: item.hashtags,
        destination_url: `${siteUrl}/library`,
        scheduled_at: getDailyMarketingSchedule(0, scheduleStart),
        status: getGeneratedMarketingItemStatus(),
        metadata: { sequence: index + 1, media_url: product.cover_url || null },
      };
    });

    const { error: contentError } = await supabase.from("marketing_content").insert(items);
    if (contentError) {
      await supabase.from("marketing_campaigns").delete().eq("id", insertedCampaign.id);
      throw new Error("Could not save the generated campaign content");
    }

    return NextResponse.json({
      success: true,
      status: getGeneratedMarketingItemStatus(),
      campaignId: insertedCampaign.id,
      product: { id: String(product.id), title_ar: product.title_ar, title_en: product.title_en },
      contentCount: items.length,
      platforms: campaignPlatforms,
      message: process.env.MARKETING_AUTO_PUBLISH === "true"
        ? "One post per configured platform was generated and scheduled for automatic publishing."
        : "One post per configured platform was generated and queued for admin approval.",
    });
  } catch (error) {
    console.error("Marketing generation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing generation failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isMarketingJobAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return generateForRequest(request, false);
}

export async function GET(request: NextRequest) {
  if (!isMarketingJobAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getSupabase();
    const { claimed, runDate } = await claimDailyMarketingGenerationRun(supabase);
    if (!claimed) {
      return NextResponse.json({
        success: true,
        skipped: true,
        status: "already_generated",
        runDate,
      });
    }

    const response = await generateForRequest(request, true);
    const result = await response.clone().json().catch(() => ({})) as Record<string, unknown>;
    const completed = response.status < 400 && result.success === true;
    const { error } = await supabase.from("marketing_generation_daily_runs").update({
      status: completed ? "completed" : "failed",
      completed_at: new Date().toISOString(),
      result: { status: response.status, campaignId: result.campaignId || null },
    }).eq("run_date", runDate);
    if (error) {
      console.error("Marketing generation run status update failed:", error.message);
      return NextResponse.json({ success: false, error: "The daily generation outcome could not be recorded." }, { status: 502 });
    }
    return response;
  } catch (error) {
    console.error("Daily marketing generation failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Daily marketing generation failed",
    }, { status: 500 });
  }
}
