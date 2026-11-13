export async function GET() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  try {
    const supa = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    // نفس الـ query بتاعة publish-one بالظبط
    const { data, error } = await supa.from("products").select("id, title_ar, title_en, description_ar, description_en, price, cover_url").eq("id","ab4bcc70-639c-42ea-b6f3-bd668000ea05").maybeSingle();
    // جرب marketing_campaigns كمان
    const camp = await supa.from("marketing_campaigns").select("id, metadata").eq("product_id","ab4bcc70-639c-42ea-b6f3-bd668000ea05").limit(1);
    return Response.json({
      productError: error?.message || null,
      productCode: error?.code || null,
      productDetails: error?.details || null,
      productHint: (error as any)?.hint || null,
      hasProduct: !!data,
      productKeys: data ? Object.keys(data) : [],
      campError: camp.error?.message || null,
      campCode: camp.error?.code || null,
      campHasData: !!(camp.data && camp.data.length >= 0),
    });
  } catch (e) {
    return Response.json({ catchError: String(e) });
  }
}
export async function POST() { return GET(); }
