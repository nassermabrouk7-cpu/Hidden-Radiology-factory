import { NextResponse } from "next/server";
import { isCronBearerAuthorized } from "@/lib/marketing-auth";

/** Retired duplicate scheduler; product publishing is owned by /api/publish-all. */
function retired(request: Request) {
  if (!isCronBearerAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { success: false, error: "This legacy publisher is retired. Use /api/publish-all?auto=true." },
    { status: 410 },
  );
}

export async function GET(request: Request) {
  return retired(request);
}

export async function POST(request: Request) {
  return retired(request);
}
