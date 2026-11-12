import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isMarketingJobAuthorized } from "@/lib/marketing-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: NextRequest) {
  if (!isMarketingJobAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabase();

    // Get marketing content status
    const { data: contentStats, error: contentError } = await supabase
      .from("marketing_content")
      .select("status, platform, created_at, published_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (contentError) throw new Error(`Failed to load marketing content: ${contentError.message}`);

    // Count by status
    const statusCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    let lastGeneration: string | null = null;
    let lastPublish: string | null = null;

    for (const item of contentStats || []) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;

      if (item.status === "scheduled" && !lastGeneration) {
        lastGeneration = item.created_at;
      }
      if (item.status === "published" && !lastPublish) {
        lastPublish = item.published_at as string;
      }
    }

    // Get latest generation run
    const { data: generationRun, error: generationError } = await supabase
      .from("marketing_generation_daily_runs")
      .select("*")
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (generationError) throw new Error(`Failed to load generation runs: ${generationError.message}`);

    // Get Meta token health
    const facebookHealth = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ? "configured" : "not_configured";
    const instagramHealth = process.env.INSTAGRAM_ACCESS_TOKEN ? "configured" : "not_configured";
    const telegramHealth = process.env.TELEGRAM_BOT_TOKEN ? "configured" : "not_configured";

    return NextResponse.json({
      success: true,
      content: {
        total: contentStats?.length || 0,
        byStatus: statusCounts,
        byPlatform: platformCounts,
        lastGeneration,
        lastPublish,
      },
      generation: {
        lastRun: generationRun?.run_date || null,
        status: generationRun?.status || "never_run",
        completedAt: generationRun?.completed_at || null,
      },
      channels: {
        telegram: telegramHealth,
        facebook: facebookHealth,
        instagram: instagramHealth,
      },
      config: {
        autoPublish: process.env.MARKETING_AUTO_PUBLISH === "true",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        geminiFreeTier: process.env.GEMINI_FREE_TIER_ONLY === "true",
      },
    });
  } catch (error) {
    console.error("Marketing status check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Marketing status check failed" },
      { status: 500 }
    );
  }
}
