import { NextResponse } from "next/server";
import { isCronBearerAuthorized } from "@/lib/marketing-auth";
import { checkMetaTokenHealth } from "@/lib/meta-token-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronBearerAuthorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const health = await checkMetaTokenHealth();
    const tokens = { facebook: health.facebook.status, instagram: health.instagram.status };
    const healthy = Object.values(tokens).every((status) => status === "valid" || status === "expiring");
    const renewalHealthy = !health.renewal.manualReauthorizationRequired &&
      health.renewal.status !== "unavailable" &&
      health.renewal.status !== "reauthorization_required";
    return NextResponse.json({
      success: healthy && renewalHealthy && !health.alerts.failed,
      tokens,
      renewal: {
        status: health.renewal.status,
        manualReauthorizationRequired: health.renewal.manualReauthorizationRequired,
      },
      alerts: {
        configured: health.alerts.configured,
        sent: health.alerts.sent,
        failed: health.alerts.failed,
        status: !health.alerts.configured ? "not_configured" : health.alerts.failed ? "failed" : "ready",
      },
      ...(healthy && renewalHealthy ? {} : { message: "One or more Meta token states require attention; review the returned statuses." }),
    }, { status: healthy && renewalHealthy && !health.alerts.failed ? 200 : 503 });
  } catch {
    return NextResponse.json({ success: false, error: "Meta token health check unavailable." }, { status: 503 });
  }
}
