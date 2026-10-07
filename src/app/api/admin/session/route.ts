import { NextResponse } from "next/server";
import { adminAuthConfigured, adminCookieHeader, createAdminSession, isSameOriginRequest, isValidAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isValidAdminSession(request.headers.get("cookie")) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 4 * 1024) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 413 });
  }

  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "تسجيل الإدارة غير مهيأ على الخادم" }, { status: 503 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`admin-login:${forwardedFor}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقاً." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const password = typeof body === "object" && body !== null && "password" in body ? body.password : undefined;
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const session = createAdminSession();
  if (!session) return NextResponse.json({ error: "تسجيل الإدارة غير مهيأ على الخادم" }, { status: 503 });

  return NextResponse.json({ success: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": adminCookieHeader(session.token, session.maxAge),
    },
  });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  }
  return NextResponse.json({ success: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": adminCookieHeader("", 0),
    },
  });
}
