import { NextRequest, NextResponse } from "next/server";
import { publishNextMarketingItem } from "@/lib/marketing-publisher";
import { isMarketingJobAuthorized } from "@/lib/marketing-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isMarketingJobAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  try {
    const deploymentHost = process.env.VERCEL_URL;

    const baseUrl = process.env.MARKETING_INTERNAL_URL
      ? process.env.MARKETING_INTERNAL_URL.replace(/\/+$/, "")
      : deploymentHost
        ? `https://${deploymentHost}`
        : "http://localhost:3000";

    const parsedBaseUrl = new URL(baseUrl);
    if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.hostname !== "localhost") {
      return NextResponse.json({ success: false, error: "Marketing internal URL must use HTTPS." }, { status: 500 });
    }

    /*
     * Phase 1:
     * Generate the next marketing campaign.
     */
    const generateResponse = await fetch(
      `${baseUrl}/api/marketing/generate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
        },
        cache: "no-store",
      }
    );

    const generateBody = await generateResponse.text();

    let generateResult: unknown;

    try {
      generateResult = JSON.parse(generateBody);
    } catch {
      generateResult = {
        raw: generateBody,
      };
    }

    /*
     * Phase 2:
     * Publish one item that is currently due.
     *
     * A publishing failure does not erase the generated campaign.
     */
    let publishResult: Awaited<
      ReturnType<typeof publishNextMarketingItem>
    >;

    try {
      publishResult = await publishNextMarketingItem();
    } catch (error) {
      publishResult = {
        processed: false,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown publishing error",
      };
    }

    return NextResponse.json(
      {
        success: generateResponse.ok,
        generation: {
          status: generateResponse.status,
          result: generateResult,
        },
        publishing: publishResult,
      },
      {
        status: generateResponse.ok ? 200 : generateResponse.status,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown marketing cron error",
      },
      { status: 500 }
    );
  }
}
