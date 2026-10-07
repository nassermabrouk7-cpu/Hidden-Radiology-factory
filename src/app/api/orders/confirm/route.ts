import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";\nimport { Resend } from "resend";

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
import { isValidAdminSession } from "@/lib/admin-auth";



export async function POST(request: Request) {`n  const supabase = getSupabase();
  
  if (!isValidAdminSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "ØºÙŠØ± Ù…ØµØ±Ø­" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("referenceId" in body) || typeof body.referenceId !== "string") {
      return NextResponse.json({ error: "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± ØµØ§Ù„Ø­" }, { status: 400 });
    }
    const { referenceId } = body;

    if (!referenceId || referenceId.length > 50) {
      return NextResponse.json({ error: "Order reference is required" }, { status: 400 });
    }

    // 1. Ø¬Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø·Ù„Ø¨
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("reference_id", referenceId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "pending_verification") {
      return NextResponse.json({ error: "Ø§Ù„Ø·Ù„Ø¨ Ù„ÙŠØ³ Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø¯ÙØ¹" }, { status: 409 });
    }
    const orderItems = Array.isArray(order.items) ? order.items as Array<{ product_id?: string; quantity?: number }> : [];
    const productIds = [...new Set([
      ...orderItems.map((item) => item.product_id).filter((id): id is string => typeof id === "string"),
      ...(typeof order.product_id === "string" ? [order.product_id] : []),
    ])];
    if (productIds.length === 0) {
      return NextResponse.json({ error: "Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø§Ù„Ø·Ù„Ø¨ Ø¹Ù„Ù‰ Ù…Ù†ØªØ¬Ø§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªØ³Ù„ÙŠÙ…" }, { status: 409 });
    }

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, title_ar, title_en, language, pdf_url")
      .in("id", productIds);
    if (productError || !products || products.length !== productIds.length) {
      return NextResponse.json({ error: "ØªØ¹Ø°Ø± Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª" }, { status: 409 });
    }

    const productsById = new Map(products.map((product) => [String(product.id), product]));
    const deliveryItems = [];
    for (const item of orderItems.length ? orderItems : [{ product_id: order.product_id }]) {
      if (typeof item.product_id !== "string") continue;
      const product = productsById.get(item.product_id);
      const storagePath = getPdfStoragePath(product?.pdf_url);
      if (!product || !storagePath) {
        return NextResponse.json({ error: "Ù…Ù„Ù Ø£Ø­Ø¯ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ØºÙŠØ± Ø¬Ø§Ù‡Ø² Ù„Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø¢Ù…Ù†" }, { status: 409 });
      }
      const { data: signed, error: signedError } = await supabase.storage.from("pdfs").createSignedUrl(storagePath, 60 * 60 * 24);
      if (signedError || !signed?.signedUrl) {
        return NextResponse.json({ error: "ØªØ¹Ø°Ø± Ø¥Ù†Ø´Ø§Ø¡ Ø±Ø§Ø¨Ø· ØªÙ†Ø²ÙŠÙ„ Ø¢Ù…Ù†" }, { status: 500 });
      }
      deliveryItems.push({
        title: product.language === "ar" ? product.title_ar : product.title_en,
        url: signed.signedUrl,
      });
    }
    if (deliveryItems.length === 0) {
      return NextResponse.json({ error: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù„ÙØ§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªØ³Ù„ÙŠÙ…" }, { status: 409 });
    }

    // Only one concurrent admin request can confirm a pending order.
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({ 
        status: "confirmed",
        confirmed_at: new Date().toISOString()
      })
      .eq("reference_id", referenceId)
      .eq("status", "pending_verification")
      .select()
      .single();

    if (updateError) {
      console.error("Error updating order:", updateError);
      return NextResponse.json({ error: "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø·Ù„Ø¨ Ø£Ùˆ ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ«Ù‡" }, { status: 409 });
    }

    // Send time-limited signed links after an administrator verifies the payment.
    let emailSent = false;
    if (order.customer_email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
      try {
        const isArabic = order.language === "ar";
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error: sendError } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: order.customer_email,
          subject: isArabic ? "ØªØ£ÙƒÙŠØ¯ Ø·Ù„Ø¨Ùƒ Ù…Ù† Hidden Radiology" : "Your Hidden Radiology order is confirmed",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;background:#0A192F;color:#fff;border-radius:16px">
              <h1 style="color:#00E5FF">${isArabic ? "ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø·Ù„Ø¨Ùƒ" : "Your order is confirmed"}</h1>
              <p>${isArabic ? "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨" : "Order reference"}: ${escapeHtml(referenceId)}</p>
              <ul>${deliveryItems.map((item) => `<li style="margin:16px 0"><a style="color:#00E5FF" href="${escapeHtml(item.url)}">${escapeHtml(item.title || (isArabic ? "ØªÙ†Ø²ÙŠÙ„ Ø§Ù„ÙƒØªØ§Ø¨" : "Download book"))}</a></li>`).join("")}</ul>
              <p style="color:#aab6cf">${isArabic ? "Ø±ÙˆØ§Ø¨Ø· Ø§Ù„ØªÙ†Ø²ÙŠÙ„ ØµØ§Ù„Ø­Ø© Ù„Ù…Ø¯Ø© 24 Ø³Ø§Ø¹Ø©." : "Download links expire in 24 hours."}</p>
            </div>
          `,
        });
        if (sendError) throw new Error(sendError.message);
        
        emailSent = true;
        console.log("âœ… Email sent successfully to:", order.customer_email);
      } catch (emailError) {
        console.error("Email delivery failed:", emailError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      order: { referenceId: updatedOrder.reference_id, status: updatedOrder.status },
      emailSent
    });
  } catch (error) {
    console.error("Error in confirm API:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
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

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}



