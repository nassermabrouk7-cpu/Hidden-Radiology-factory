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
     * Drain today's due posts; the configured platform limit is five.
     * One failed channel does not block the other enabled channels.
     */
    const publishing: Array<Awaited<ReturnType<typeof publishNextMarketingItem>>> = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await publishNextMarketingItem();
        if (!result.processed) {
          if (result.error) publishing.push(result);
          break;
        }
        publishing.push(result);
      } catch (error) {
        publishing.push({
          processed: false,
          success: false,
          error: error instanceof Error ? error.message : "Unknown publishing error",
        });
        break;
      }
    }

    const publishingSucceeded = publishing.every((result) =>
      result.error === "Automatic social publishing is disabled." ||
      result.success !== false
    );
    const success = generateResponse.ok && publishingSucceeded;

    return NextResponse.json(
      {
        success,
        generation: {
          status: generateResponse.status,
          result: generateResult,
        },
        publishing: {
          processed: publishing.some((result) => result.processed),
          attempted: publishing.filter((result) => result.processed).length,
          results: publishing,
        },
      },
      {
        status: !generateResponse.ok
          ? generateResponse.status
          : publishingSucceeded
            ? 200
            : 502,
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
