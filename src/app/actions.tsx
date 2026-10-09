"use server";

import { createClient } from "@supabase/supabase-js";
import { generateCover } from "@/lib/cover-generator";
import { PDFDocument } from "@/lib/pdf-generator";
import { renderToBuffer } from "@react-pdf/renderer";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/admin-auth";
import { randomUUID } from "node:crypto";

type ProductRow = {
  id: string;
  title_ar: string;
  title_en: string;
  subtitle_ar: string;
  subtitle_en: string;
  category: string;
  price: number;
  cover_url: string;
  pdf_url: string;
  language: string;
};
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type FactoryDatabase = {
  public: {
    Tables: { products: Table<ProductRow> };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export async function generateAndPublish(formData: FormData) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminSession(sessionCookie ? `${ADMIN_COOKIE_NAME}=${sessionCookie}` : null)) {
    return { success: false, error: "يجب تسجيل الدخول بصلاحيات الإدارة أولاً" };
  }

  let coverFileName: string | undefined;
  let pdfFileName: string | undefined;
  let supabase: ReturnType<typeof createClient<FactoryDatabase>> | undefined;
  try {
    const titleAr = formText(formData, "title_ar");
    const titleEn = formText(formData, "title_en");
    const subtitleAr = formText(formData, "subtitle_ar");
    const subtitleEn = formText(formData, "subtitle_en");
    const manuscript = formText(formData, "manuscript");
    const category = formText(formData, "category");
    const languageValue = formText(formData, "language");
    const language = languageValue === "en" ? "en" : languageValue === "ar" ? "ar" : "";
    const rawPrice = formText(formData, "price");
    const price = Number(rawPrice);
    if (!titleAr || !titleEn || titleAr.length > 180 || titleEn.length > 180 ||
        subtitleAr.length > 300 || subtitleEn.length > 300 || category.length > 80 ||
        manuscript.length < 100 || manuscript.length > 100_000 || !language ||
        !Number.isFinite(price) || price < 0 || price > 10000) {
      return { success: false, error: "تحقق من العناوين والتصنيف واللغة والسعر، وأدخل مخطوطة بين 100 و100,000 حرف" };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) throw new Error("إعدادات تخزين المنتجات غير مكتملة على الخادم");
    supabase = createClient<FactoryDatabase>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const coverBuffer = await generateCover({
      title_ar: titleAr,
      title_en: titleEn,
      subtitle_ar: subtitleAr,
      subtitle_en: subtitleEn,
    });
    const pdfBuffer = await renderToBuffer(
      <PDFDocument data={{ title_ar: titleAr, title_en: titleEn, subtitle_ar: subtitleAr, subtitle_en: subtitleEn, language, manuscript }} />
    );

    const newCoverFileName = `cover-${randomUUID()}.png`;
    const { error: coverError } = await supabase.storage.from("covers").upload(newCoverFileName, coverBuffer, {
      contentType: "image/png", cacheControl: "3600", upsert: false,
    });
    if (coverError) throw new Error("فشل رفع الغلاف إلى التخزين");
    coverFileName = newCoverFileName;

    const newPdfFileName = `book-${randomUUID()}.pdf`;
    const { error: pdfError } = await supabase.storage.from("pdfs").upload(newPdfFileName, pdfBuffer, {
      contentType: "application/pdf", cacheControl: "3600", upsert: false,
    });
    if (pdfError) throw new Error("فشل رفع ملف الكتاب إلى التخزين");
    pdfFileName = newPdfFileName;

    const { data: coverData } = supabase.storage.from("covers").getPublicUrl(coverFileName);
    const { data: pdfData } = supabase.storage.from("pdfs").getPublicUrl(pdfFileName);
    const { data: product, error: insertError } = await supabase.from("products").insert({
      title_ar: titleAr,
      title_en: titleEn,
      subtitle_ar: subtitleAr,
      subtitle_en: subtitleEn,
      category,
      price,
      cover_url: coverData.publicUrl,
      pdf_url: pdfData.publicUrl,
      language,
    }).select("id").single();
    if (insertError || !product) throw new Error("فشل حفظ المنتج في قاعدة البيانات");

    return { success: true, productId: product.id };
  } catch (error: unknown) {
    console.error("Factory production failed", error);
    if (supabase) {
      const cleanup = [];
      if (coverFileName) cleanup.push(supabase.storage.from("covers").remove([coverFileName]));
      if (pdfFileName) cleanup.push(supabase.storage.from("pdfs").remove([pdfFileName]));
      const results = await Promise.allSettled(cleanup);
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.error) console.error("Factory storage cleanup failed", result.value.error);
      }
    }
    return { success: false, error: error instanceof Error ? error.message : "تعذر إكمال إنتاج الكتاب" };
  }
}

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
