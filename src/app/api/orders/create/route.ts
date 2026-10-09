import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const PAYMENT_METHODS = new Set(["instapay", "vodafone", "etisalat", "paypal"]);
type CartInput = { id: string; quantity: number };
type ProductRow = {
  id: string | number;
  title_ar: string;
  title_en: string;
  price: number | string;
  language: string;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64 * 1024) return NextResponse.json({ error: "حجم الطلب أكبر من المسموح" }, { status: 413 });
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  if (isRateLimited(`create-order:${ip}`, 10, 10 * 60 * 1000)) return NextResponse.json({ error: "محاولات كثيرة. حاول لاحقاً." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة"}, { status: 400 }); }
  if (!isRecord(body)) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const customerName = body.customerName;
  const customerEmail = body.customerEmail;
  const customerPhone = body.customerPhone;
  const items = body.items;
  const paymentMethod = body.paymentMethod;
  const language = body.language;
  if (typeof customerName !== "string" || customerName.trim().length < 2 || customerName.length > 120 || typeof customerEmail !== "string" || customerEmail.length > 254|| typeof customerPhone !== "string" || customerPhone.trim().length < 7 || customerPhone.length > 32 || !Array.isArray(items) || items.length < 1 || items.length > 20 || typeof paymentMethod !== "string" || !PAYMENT_METHODS.has(paymentMethod) || (language !== "ar" && language !== "en")) return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  const email = customerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "بريد إلكتروني غير صالح" }, { status: 400 });
  if (!/^[+\d()\s.-]{7,32}$/.test(customerPhone.trim())) return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
  const cart: CartInput[] = [];
  for (const item of items) {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.length > 80 || !Number.isInteger(item.quantity) || (item.quantity as number)< 1 || (item.quantity as number) > 20) return NextResponse.json({ error: "تفاصيل المنتجات غير صالحة" }, { status: 400 });
    cart.push({ id: item.id, quantity: item.quantity as number });
  }
  if (new Set(cart.map((item) => item.id)).size !== cart.length) return NextResponse.json({ error: "المنتجات المكررة غير مسموحة" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const ids = cart.map((item) => item.id);
    const { data: products, error: productError } = await supabase.from("products").select("id, title_ar, title_en, price, language").in("id", ids);
    if (productError) throw productError;
    if (!products || products.length !== ids.length) return NextResponse.json({ error: "أحد المنتجات لم يعد متاحاً" }, { status: 404 });
    const productRows = products as unknown as ProductRow[];
    const productsById = new Map(productRows.map((product) => [String(product.id), product]));
    const validatedItems = cart.map((item) => {
      const product = productsById.get(item.id);
      const price = Number(product?.price);
      if (!product || !Number.isFinite(price) || price < 0) throw new Error("Invalid product price");
      return { product_id: product.id, title_ar: product.title_ar, title_en: product.title_en, price, quantity: item.quantity, language: product.language };
    });
    const totalAmount = Math.round(validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    const referenceId = `HR-${randomUUID()}`;
    const { error: insertError } = await supabase.from("orders").insert({ reference_id: referenceId, customer_name: customerName.trim(), customer_email: email, customer_phone: customerPhone.trim(), items: validatedItems, total_amount: totalAmount, payment_method: paymentMethod, language, status: "pending_verification" });
    if (insertError) throw insertError;
    return NextResponse.json({ success: true, referenceId, totalAmount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Order creation failed:", error); return NextResponse.json({ error: "تعذر إنشاء الطلب حالياً" }, { status: 500 }); }
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
