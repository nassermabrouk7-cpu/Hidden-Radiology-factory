import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";
import {
  getPaymobAmountMinor,
  getPaymobCheckoutUrl,
  getPaymobPaymentConfig,
  isRecordValue,
} from "@/lib/paymob";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string | number;
  title_ar: string;
  title_en: string;
  price: number | string;
  language: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!configured) throw new Error("NEXT_PUBLIC_SITE_URL is not configured");
  const url = new URL(configured);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Site URL must use HTTPS");
  return url.origin;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64 * 1024) return NextResponse.json({ error: "Request is too large" }, { status: 413 });
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  if (isRateLimited(`paymob-checkout:${ip}`, 8, 10 * 60 * 1000)) return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 }); }
  if (!isRecordValue(body)) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });

  const customerName = body.customerName;
  const customerEmail = body.customerEmail;
  const customerPhone = body.customerPhone;
  const language = body.language;
  if (typeof customerName !== "string" || customerName.trim().length < 2 || customerName.length > 120 ||
      typeof customerEmail !== "string" || customerEmail.length > 254 ||
      typeof customerPhone !== "string" || !/^[+\d()\s.-]{7,32}$/.test(customerPhone.trim()) ||
      (language !== "ar" && language !== "en") || !Array.isArray(body.items) ||
      body.items.length < 1 || body.items.length > 20) {
    return NextResponse.json({ error: "Customer or cart information is invalid" }, { status: 400 });
  }
  const email = customerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email is invalid" }, { status: 400 });

  const cart: Array<{ id: string; quantity: number }> = [];
  for (const item of body.items) {
    if (!isRecordValue(item) || typeof item.id !== "string" || item.id.length > 80 ||
        !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20) {
      return NextResponse.json({ error: "Cart item is invalid" }, { status: 400 });
    }
    cart.push({ id: item.id, quantity: Number(item.quantity) });
  }
  if (new Set(cart.map((item) => item.id)).size !== cart.length) return NextResponse.json({ error: "Duplicate items are not allowed" }, { status: 400 });

  try {
    const paymob = getPaymobPaymentConfig();
    const siteUrl = getSiteUrl();
    const supabase = getSupabase();
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, title_ar, title_en, price, language")
      .in("id", cart.map((item) => item.id));
    if (productsError) throw productsError;
    if (!products || products.length !== cart.length) return NextResponse.json({ error: "A product is no longer available" }, { status: 404 });

    const byId = new Map((products as unknown as ProductRow[]).map((product) => [String(product.id), product]));
    const items = cart.map((entry) => {
      const product = byId.get(entry.id);
      const price = Number(product?.price);
      if (!product || !Number.isFinite(price) || price <= 0) throw new Error("Product price is invalid");
      const amountMinor = getPaymobAmountMinor(price, paymob.multiplier);
      return {
        product_id: product.id,
        title_ar: product.title_ar,
        title_en: product.title_en,
        price,
        quantity: entry.quantity,
        language: product.language,
        amountMinor,
      };
    });
    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    const amountMinor = items.reduce((sum, item) => sum + item.amountMinor * item.quantity, 0);
    const referenceId = `HR-${randomUUID()}`;
    const [firstName, ...lastNameParts] = customerName.trim().split(/\s+/);
    const lastName = lastNameParts.join(" ") || firstName;

    const { error: orderError } = await supabase.from("orders").insert({
      reference_id: referenceId,
      customer_name: customerName.trim(),
      customer_email: email,
      customer_phone: customerPhone.trim(),
      items: items.map((item) => ({
        product_id: item.product_id,
        title_ar: item.title_ar,
        title_en: item.title_en,
        price: item.price,
        quantity: item.quantity,
        language: item.language,
      })),
      total_amount: totalAmount,
      payment_method: "paymob",
      language,
      status: "pending_verification",
    });
    if (orderError) throw orderError;

    const { error: purchaseError } = await supabase.from("purchases").insert({
      reference_id: referenceId,
      product_ids: items.map((item) => String(item.product_id)),
      payment_gateway: "paymob",
      status: "pending",
      amount_minor: amountMinor,
      currency: paymob.currency,
    });
    if (purchaseError) {
      await supabase.from("orders").delete().eq("reference_id", referenceId);
      throw purchaseError;
    }

    const intentionResponse = await fetch(`${paymob.baseUrl}/v1/intention/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${paymob.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: paymob.currency,
        payment_methods: paymob.integrationIds,
        items: items.map((item) => ({
          name: (language === "ar" ? item.title_ar : item.title_en).slice(0, 100),
          amount: item.amountMinor,
          quantity: item.quantity,
          description: (language === "ar" ? item.title_ar : item.title_en).slice(0, 255),
        })),
        billing_data: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: customerPhone.trim(),
          apartment: "NA", floor: "NA", street: "NA", building: "NA",
          shipping_method: "NA", postal_code: "NA", city: "Cairo", state: "Cairo", country: "EGY",
        },
        customer: { first_name: firstName, last_name: lastName, email },
        special_reference: referenceId,
        notification_url: `${siteUrl}/api/webhook/paymob`,
        redirection_url: `${siteUrl}/order/${encodeURIComponent(referenceId)}?lang=${language}&payment=return`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const intention = await intentionResponse.json().catch(() => ({}));
    if (!intentionResponse.ok || typeof intention?.client_secret !== "string" || intention.client_secret.length < 10) {
      await supabase.from("purchases").update({ status: "failed", email_error: "Paymob could not create the payment intention" }).eq("reference_id", referenceId);
      console.error("Paymob intention creation failed", { status: intentionResponse.status });
      return NextResponse.json({ error: "Paymob could not start payment. Please retry or choose manual payment." }, { status: 502 });
    }

    const paymobOrderId = String(intention.intention_order_id ?? "");
    if (!/^\d+$/.test(paymobOrderId)) throw new Error("Paymob did not return a valid order ID");
    const { error: updateError } = await supabase.from("purchases")
      .update({ paymob_order_id: paymobOrderId, updated_at: new Date().toISOString() })
      .eq("reference_id", referenceId);
    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      referenceId,
      checkoutUrl: getPaymobCheckoutUrl(paymob.baseUrl, paymob.publicKey, intention.client_secret),
      amountMinor,
      currency: paymob.currency,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Paymob checkout initialization failed", error instanceof Error ? error.message : "Unknown error");
    const message = error instanceof Error && error.message === "Paymob is not fully configured"
      ? "Paymob checkout is not configured yet"
      : "Could not initialize Paymob checkout";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
