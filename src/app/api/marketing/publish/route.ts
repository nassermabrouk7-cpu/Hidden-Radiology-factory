import { NextRequest, NextResponse } from "next/server";
import { publishNextMarketingItem } from "@/lib/marketing-publisher";
import { isMarketingJobAuthorized } from "@/lib/marketing-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isMarketingJobAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await publishNextMarketingItem();
    const success = result.success !== false && !result.error;

    return NextResponse.json(
      { ...result, success },
      { status: success ? 200 : 502 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown publishing error";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
