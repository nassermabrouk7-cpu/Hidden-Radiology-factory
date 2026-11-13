export async function GET() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const supa = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supa.from("products").select("id").eq("id","ab4bcc70-639c-42ea-b6f3-bd668000ea05").maybeSingle();
    return Response.json({ url: url?.substring(0,30), keyLen: key?.length, keyFirst3: key?.substring(0,3), hasError: !!error, errorMsg: error?.message || null, errorCode: error?.code || null, errorDetails: error?.details || null, hasData: !!data, dataId: data?.id || null });
  } catch (e) {
    return Response.json({ catchError: String(e) });
  }
}
export async function POST() { return GET(); }
