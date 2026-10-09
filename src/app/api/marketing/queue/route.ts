import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isValidAdminSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "قاعدة البيانات غير متاحة" }, { status: 503 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: content, error } = await supabase.from("marketing_content")
    .select("id, campaign_id, product_id, platform, language, content_type, title, hook, body, cta, hashtags, destination_url, scheduled_at, status, publish_attempts, published_at, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Marketing queue lookup failed:", error.message);
    return NextResponse.json({ error: "تعذر تحميل قائمة الإعلانات" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ content: content || [] }, { headers: { "Cache-Control": "no-store, private" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!isValidAdminSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (Number(request.headers.get("content-length") || 0) > 1024) {
    return NextResponse.json({ error: "بيانات الطلب أكبر من المسموح" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const id = typeof body === "object" && body !== null && "id" in body
    ? (body as { id?: unknown }).id
    : null;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "معرّف المحتوى غير صالح" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "قاعدة البيانات غير متاحة" }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from("marketing_content")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued")
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("Marketing approval failed:", error.message);
    return NextResponse.json({ error: "تعذرت الموافقة على المحتوى" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!data) {
    return NextResponse.json({ error: "المحتوى غير موجود أو سبق تغيير حالته" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ success: true, content: data }, { headers: { "Cache-Control": "no-store" } });
}
