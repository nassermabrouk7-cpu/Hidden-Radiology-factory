import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "كتالوج المنتجات غير متاح" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: products, error } = await supabase
    .from("products")
    .select("id, title_ar, title_en, category, price, cover_url, language")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Product catalog query failed:", error.message);
    return NextResponse.json({ error: "تعذر تحميل المنتجات" }, { status: 503 });
  }

  return NextResponse.json(
    { products: products || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
