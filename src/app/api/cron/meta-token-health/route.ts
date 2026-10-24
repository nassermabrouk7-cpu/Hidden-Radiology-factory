import { NextResponse } from "next/server";
import { isCronBearerAuthorized } from "@/lib/marketing-auth";
import { checkMetaTokenHealth } from "@/lib/meta-token-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronBearerAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const health = await checkMetaTokenHealth();
    return NextResponse.json({ success: true, tokens: { facebook: health.facebook.status, instagram: health.instagram.status } });
  } catch {
    return NextResponse.json({ success: false, error: "Meta token health check unavailable." }, { status: 503 });
  }
}
