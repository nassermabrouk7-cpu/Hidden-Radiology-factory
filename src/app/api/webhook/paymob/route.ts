import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyPaymobTransactionHmac, isRecordValue } from "@/lib/paymob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  if (!hmacSecret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid callback body" }, { status: 400 }); }
  if (!isRecordValue(payload) || payload.type !== "TRANSACTION" || !isRecordValue(payload.obj)) {
    return NextResponse.json({ error: "Unsupported callback" }, { status: 400 });
  }
  const transaction = payload.obj;
  const suppliedHmac = new URL(request.url).searchParams.get("hmac") || "";
  if (!verifyPaymobTransactionHmac(transaction, suppliedHmac, hmacSecret)) {
    return NextResponse.json({ error: "Invalid callback signature" }, { status: 401 });
  }

  const transactionId = String(transaction.id);
  const paymobOrderId = isRecordValue(transaction.order) ? String(transaction.order.id) : "";
  const integrationId = Number(transaction.integration_id);
  const expectedIntegrationIds = [
    process.env.PAYMOB_INTEGRATION_IDS,
    process.env.PAYMOB_INTEGRATION_ID_CARD,
    process.env.PAYMOB_INTEGRATION_ID_WALLET,
    process.env.PAYMOB_INTEGRATION_ID,
  ].filter(Boolean).flatMap((value) => (value || "").split(","))
    .map((value) => Number(value.trim())).filter(Number.isSafeInteger);
  if (!/^\d+$/.test(transactionId) || !/^\d+$/.test(paymobOrderId) || !expectedIntegrationIds.includes(integrationId)) {
    return NextResponse.json({ error: "Callback does not match a configured Paymob integration" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: purchase, error: purchaseError } = await supabase.from("purchases")
      .select("reference_id, status, amount_minor, currency, email_sent_at")
      .eq("payment_gateway", "paymob")
      .eq("paymob_order_id", paymobOrderId)
      .maybeSingle();
    if (purchaseError) throw purchaseError;
    if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

    const amountMinor = Number(transaction.amount_cents);
    const currency = typeof transaction.currency === "string" ? transaction.currency.toUpperCase() : "";
    if (amountMinor !== Number(purchase.amount_minor) || currency !== purchase.currency) {
      return NextResponse.json({ error: "Payment amount or currency does not match the purchase" }, { status: 400 });
    }

    const success = transaction.success === true && transaction.pending === false &&
      transaction.error_occured === false && transaction.is_refunded === false &&
      transaction.is_voided === false;

    if (!success) {
      if (transaction.success === false && transaction.pending === false) {
        const { error } = await supabase.rpc("apply_paymob_failure", {
          p_reference_id: purchase.reference_id,
          p_paymob_order_id: paymobOrderId,
          p_transaction_id: transactionId,
        });
        if (error) throw error;
      }
      return NextResponse.json({ received: true, paid: false });
    }

    const merchantReference = isRecordValue(transaction.order) && typeof transaction.order.merchant_order_id === "string"
      ? transaction.order.merchant_order_id
      : null;
    if (merchantReference && merchantReference !== purchase.reference_id) {
      return NextResponse.json({ error: "Merchant reference mismatch" }, { status: 400 });
    }

    const { error: applyError } = await supabase.rpc("apply_paymob_success", {
      p_reference_id: purchase.reference_id,
      p_paymob_order_id: paymobOrderId,
      p_transaction_id: transactionId,
      p_amount_minor: amountMinor,
      p_currency: currency,
    });
    if (applyError) throw applyError;

    const { error: outboxError } = await supabase.from("payment_fulfillment_outbox")
      .upsert({ reference_id: purchase.reference_id, status: "pending" }, { onConflict: "reference_id", ignoreDuplicates: true });
    if (outboxError) throw outboxError;

    const { data: refreshedPurchase, error: refreshedError } = await supabase.from("purchases")
      .select("email_sent_at")
      .eq("reference_id", purchase.reference_id)
      .single();
    if (refreshedError) throw refreshedError;
    if (refreshedPurchase.email_sent_at) return NextResponse.json({ received: true, paid: true, emailSent: true });

    const { data: claimed, error: claimError } = await supabase.rpc("claim_payment_fulfillment", {
      p_reference_id: purchase.reference_id,
    });
    if (claimError) throw claimError;
    if (claimed !== true) return NextResponse.json({ received: true, paid: true, fulfillmentQueued: true });

    const { data: order, error: orderError } = await supabase.from("orders")
      .select("reference_id, customer_email, customer_name, language, items")
      .eq("reference_id", purchase.reference_id)
      .single();
    if (orderError || !order) throw orderError || new Error("Paid order is missing");
    const from = process.env.RESEND_FROM_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;
    if (!from || !resendKey) throw new Error("Resend sender is not configured");

    const items = Array.isArray(order.items) ? order.items.filter(isRecordValue) : [];
    const productIds = [...new Set(items.map((item) => item.product_id).filter((id): id is string | number => typeof id === "string" || typeof id === "number"))];
    if (productIds.length === 0) throw new Error("Paid order has no downloadable products");
    const { data: products, error: productError } = await supabase.from("products")
      .select("id, title_ar, title_en, language, pdf_url")
      .in("id", productIds);
    if (productError || !products || products.length !== productIds.length) throw productError || new Error("A purchased PDF is missing");

    const downloadLinks: Array<{ title: string; url: string }> = [];
    for (const product of products) {
      const storagePath = getPdfStoragePath(product.pdf_url);
      if (!storagePath) throw new Error("A purchased PDF has no valid storage path");
      const { data: signed, error: signedError } = await supabase.storage.from("pdfs").createSignedUrl(storagePath, 60 * 60 * 24);
      if (signedError || !signed?.signedUrl) throw signedError || new Error("Could not sign the PDF download");
      downloadLinks.push({ title: order.language === "ar" ? product.title_ar : product.title_en, url: signed.signedUrl });
    }

    const isArabic = order.language === "ar";
    const linkHtml = downloadLinks.map((item) => `<li style="margin:16px 0"><a style="color:#00E5FF" href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></li>`).join("");
    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from,
      to: order.customer_email,
      subject: isArabic ? "تم الدفع — روابط كتبك من Hidden Radiology" : "Payment received — your Hidden Radiology downloads",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#0A192F;color:#fff;border-radius:16px"><h1 style="color:#00E5FF">${isArabic ? "تم تأكيد الدفع" : "Payment confirmed"}</h1><p>${isArabic ? "رقم الطلب" : "Order reference"}: ${escapeHtml(purchase.reference_id)}</p><ul>${linkHtml}</ul><p style="color:#aab6cf">${isArabic ? "روابط التنزيل صالحة لمدة 24 ساعة." : "Download links expire in 24 hours."}</p></div>`,
    });
    if (emailError) throw emailError;

    const sentAt = new Date().toISOString();
    const [{ error: purchaseUpdateError }, { error: outboxUpdateError }] = await Promise.all([
      supabase.from("purchases").update({ email_sent_at: sentAt, email_error: null, updated_at: sentAt }).eq("reference_id", purchase.reference_id),
      supabase.from("payment_fulfillment_outbox").update({ status: "sent", sent_at: sentAt, attempts: 1, last_error: null }).eq("reference_id", purchase.reference_id),
    ]);
    if (purchaseUpdateError) throw purchaseUpdateError;
    if (outboxUpdateError) throw outboxUpdateError;

    return NextResponse.json({ received: true, paid: true, emailSent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown fulfillment error";
    console.error("Paymob webhook processing failed", message);
    try {
      const supabase = getSupabase();
      const { data: transactionOrder } = await supabase.from("purchases").select("reference_id")
        .eq("paymob_order_id", paymobOrderId).maybeSingle();
      if (transactionOrder) {
        await Promise.all([
          supabase.from("purchases").update({ email_error: message, updated_at: new Date().toISOString() }).eq("reference_id", transactionOrder.reference_id),
          supabase.from("payment_fulfillment_outbox").update({ status: "pending", processing_at: null, last_error: message }).eq("reference_id", transactionOrder.reference_id),
        ]);
      }
    } catch { /* Preserve the original callback failure response. */ }
    return NextResponse.json({ error: "Payment was recorded but fulfillment needs retry" }, { status: 503 });
  }
}

function getPdfStoragePath(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const pathname = new URL(value).pathname;
    const markers = ["/storage/v1/object/public/pdfs/", "/storage/v1/object/sign/pdfs/", "/storage/v1/object/authenticated/pdfs/"];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    if (!marker) return null;
    const index = pathname.indexOf(marker);
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch { return null; }
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}
