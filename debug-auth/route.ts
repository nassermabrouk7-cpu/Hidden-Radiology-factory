export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supaUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const fbToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_TOKEN || "";
  const fbPage = process.env.FACEBOOK_PAGE_ID || process.env.FB_PAGE_ID || "";
  return Response.json({
    cronSecretLen: secret ? secret.length : 0,
    supaUrl: supaUrl ? supaUrl.substring(0,30) + "..." : "MISSING",
    hasServiceKey: !!serviceKey,
    serviceKeyLen: serviceKey.length,
    serviceKeyFirst3: serviceKey ? serviceKey.substring(0,3) : null,
    hasAnonKey: !!anonKey,
    hasFbToken: !!fbToken,
    fbTokenLen: fbToken.length,
    fbPageId: fbPage || "MISSING",
    nodeEnv: process.env.NODE_ENV,
  });
}
export async function POST(request: Request) { return GET(request); }
