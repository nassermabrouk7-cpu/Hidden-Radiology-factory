import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateCampaign, type GeneratedCampaign } from "@/lib/marketing-ai";
import { isMarketingJobAuthorized } from "@/lib/marketing-auth";
import { normalizeMarketingSiteUrl } from "@/lib/marketing-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ProductRow = {
  id: string; title_ar: string; title_en: string; category: string; price: number;
  language: string; cover_url: string | null; created_at: string;
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
type MarketingDatabase = {
  public: {
    Tables: {
      products: Table<ProductRow>;
      marketing_campaigns: Table<CampaignRow>;
      marketing_content: Table<ContentRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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

type Platform = "instagram" | "facebook" | "linkedin";

function getConfiguredPlatforms(): Platform[] {
  if (process.env.MARKETING_ALLOW_PAID_METRICOOL_API === "true" && process.env.METRICOOL_API_TOKEN) {
    return (process.env.METRICOOL_PLATFORMS || "facebook,instagram")
      .split(",").map((value) => value.trim())
      .filter((value): value is Platform => ["instagram", "facebook", "linkedin"].includes(value));
  }
  const platforms: Platform[] = [];
  if (process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN) platforms.push("facebook");
  if (process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN) platforms.push("instagram");
  if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN) platforms.push("linkedin");
  return platforms;
}

function validateCampaign(value: GeneratedCampaign) {
  if (!value || typeof value !== "object" || !Array.isArray(value.content) || value.content.length !== 12) {
    throw new Error("The generated campaign must contain exactly 12 content items");
  }

  const languages = { ar: 0, en: 0 };
  for (const item of value.content) {
    if (!item || !["instagram", "facebook", "linkedin"].includes(item.platform)) throw new Error("Campaign contains an unsupported platform");
    if (item.language !== "ar" && item.language !== "en") throw new Error("Campaign contains an unsupported language");
    languages[item.language] += 1;
    if (!["authority", "education", "product", "trust", "conversion"].includes(item.content_type)) throw new Error("Campaign contains an unsupported content type");
    for (const field of ["title", "hook", "body", "cta"] as const) {
      if (typeof item[field] !== "string" || !item[field].trim()) throw new Error(`Campaign is missing ${field}`);
      if (item[field].length > 3000) throw new Error(`Campaign ${field} exceeds the allowed length`);
    }
    if (!Array.isArray(item.hashtags)) item.hashtags = [];
    item.hashtags = item.hashtags.filter((tag) => typeof tag === "string" && tag.trim()).slice(0, 12);
  }
  if (languages.ar !== 6 || languages.en !== 6) throw new Error("Campaign must contain six Arabic and six English posts");
}

export async function POST(request: NextRequest) {
  if (!isMarketingJobAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getSupabase();
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const now = new Date().toISOString();

    // A campaign already covering future posting dates is enough; avoid queuing 12 new posts every day.
    if (!force) {
      const { data: pending, error } = await supabase
        .from("marketing_content")
        .select("id")
        .in("status", ["queued", "approved", "scheduled"])
        .gte("scheduled_at", now)
        .limit(1);
      if (error) throw new Error("Could not inspect the marketing queue");
      if (pending?.length) {
        return NextResponse.json({ success: true, status: "queue_active", generated: false, message: "The existing campaign already has scheduled content." });
      }
    }

    // Resolve the destination before calling Gemini or writing any campaign rows.
    const siteUrl = normalizeMarketingSiteUrl(process.env.MARKETING_SITE_URL);

    const requestedProductId = url.searchParams.get("product_id");
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, title_ar, title_en, category, price, language, cover_url")
      .order("created_at", { ascending: true })
      .limit(200);
    if (productError) throw new Error("Could not load products for campaign generation");
    if (!products?.length) return NextResponse.json({ error: "No products are available for campaign generation" }, { status: 404 });

    let product = requestedProductId ? products.find((item: { id: string }) => String(item.id) === requestedProductId) : undefined;
    if (!product) {
      const { data: campaigns, error } = await supabase.from("marketing_campaigns")
        .select("product_id, created_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error("Could not choose a product for the next campaign");
      const latestByProduct = new Map<string, string>();
      for (const campaign of campaigns || []) {
        const id = String(campaign.product_id);
        if (!latestByProduct.has(id)) latestByProduct.set(id, campaign.created_at);
      }
      product = [...products].sort((a: { id: string }, b: { id: string }) => {
        const aLast = latestByProduct.get(String(a.id)) || "";
        const bLast = latestByProduct.get(String(b.id)) || "";
        return aLast.localeCompare(bLast);
      })[0];
    }

    const availablePlatforms = getConfiguredPlatforms();
    const campaignPlatforms = availablePlatforms.length ? availablePlatforms : ["instagram", "facebook", "linkedin"] as Platform[];
    const campaign = await generateCampaign(product, campaignPlatforms);
    validateCampaign(campaign);
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

    // One post per day matches the once-daily Vercel cron on Hobby plans and avoids an accumulating backlog.
    const items = campaign.content.map((item, index) => {
      const scheduled = new Date();
      scheduled.setUTCDate(scheduled.getUTCDate() + index);
      scheduled.setUTCHours(item.language === "ar" ? 6 : 15, 0, 0, 0);
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
        scheduled_at: scheduled.toISOString(),
        status: "queued",
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
      status: "queued",
      campaignId: insertedCampaign.id,
      product: { id: String(product.id), title_ar: product.title_ar, title_en: product.title_en },
      contentCount: items.length,
      message: "A 12-post campaign was generated and scheduled, one post per day.",
    });
  } catch (error) {
    console.error("Marketing generation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing generation failed" }, { status: 500 });
  }
}
