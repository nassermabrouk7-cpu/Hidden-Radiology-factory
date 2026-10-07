import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export async function GET(request: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  if (isRateLimited(`order-status:${ip}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقاً." }, { status: 429 });
  }

  const referenceId = new URL(request.url).searchParams.get("ref");
  if (!referenceId || !/^HR-[0-9a-f-]{36}$/i.test(referenceId)) {
    return NextResponse.json({ error: "رقم الطلب غير صالح" }, { status: 400 });
  }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("reference_id, status, total_amount, items, product_id")
      .eq("reference_id", referenceId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    const downloads: Array<{ title: string; url: string }> = [];
    if (order.status === "confirmed") {
      const orderItems = Array.isArray(order.items) ? order.items as Array<{ product_id?: string }> : [];
      const productIds = [...new Set([
        ...orderItems.map((item) => item.product_id).filter((id): id is string => typeof id === "string"),
        ...(typeof order.product_id === "string" ? [order.product_id] : []),
      ])];
      if (productIds.length === 0) {
        return NextResponse.json({ error: "ملفات الطلب غير جاهزة" }, { status: 409 });
      }

      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, title_ar, title_en, language, pdf_url")
        .in("id", productIds);
      if (productError || !products || products.length !== productIds.length) {
        return NextResponse.json({ error: "ملفات الطلب غير جاهزة" }, { status: 409 });
      }

      for (const product of products) {
        const storagePath = getPdfStoragePath(product.pdf_url);
        if (!storagePath) return NextResponse.json({ error: "ملف التنزيل غير مهيأ" }, { status: 409 });
        const { data: signed, error: signedError } = await supabase.storage.from("pdfs").createSignedUrl(storagePath, 60 * 60 * 24);
        if (signedError || !signed?.signedUrl) {
          return NextResponse.json({ error: "تعذر إنشاء رابط التنزيل" }, { status: 503 });
        }
        downloads.push({
          title: product.language === "ar" ? product.title_ar : product.title_en,
          url: signed.signedUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        referenceId: order.reference_id,
        status: order.status,
        totalAmount: Number(order.total_amount) || 0,
        downloads,
      },
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Order status lookup failed:", error);
    return NextResponse.json({ error: "تعذر تحميل حالة الطلب" }, { status: 500 });
  }
}

function getPdfStoragePath(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const pathname = new URL(value).pathname;
    const marker = "/storage/v1/object/public/pdfs/";
    const index = pathname.indexOf(marker);
    return index < 0 ? null : decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}
