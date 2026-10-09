import { NextResponse } from "next/server";
import { generateBookDraft } from "@/lib/book-ai";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  }
  if (!isValidAdminSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "يجب تسجيل الدخول بصلاحيات الإدارة أولاً" }, { status: 401 });
  }
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`book-draft:${forwardedFor}`, 4, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "تجاوزت عدد مرات توليد المسودات. حاول لاحقاً." }, { status: 429 });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 8_192) return NextResponse.json({ error: "الطلب أكبر من المسموح" }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  }

  const value = body as Record<string, unknown>;
  const text = (key: string, limit: number) => typeof value[key] === "string" ? value[key].trim().slice(0, limit) : "";
  const language = value.language === "en" ? "en" : value.language === "ar" ? "ar" : null;
  const brief = text("brief", 2_000);
  if (!language || !text("titleAr", 180) || !text("titleEn", 180) || !text("category", 80) || brief.length < 20) {
    return NextResponse.json({ error: "أكمل العنوانين والتصنيف واكتب وصفاً للكتاب من 20 حرفاً على الأقل" }, { status: 400 });
  }

  try {
    const manuscript = await generateBookDraft({
      titleAr: text("titleAr", 180),
      titleEn: text("titleEn", 180),
      subtitleAr: text("subtitleAr", 300),
      subtitleEn: text("subtitleEn", 300),
      category: text("category", 80),
      language,
      brief,
    });
    return NextResponse.json({ manuscript }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Book draft generation failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر توليد المسودة" }, { status: 503 });
  }
}
