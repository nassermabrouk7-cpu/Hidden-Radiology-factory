export async function GET() {
  const appId = process.env.META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
  const url = `https://graph.facebook.com/v23.0/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.text();
  return Response.json({ appId, hasSecret: !!appSecret, status: res.status, body: body.slice(0,1200) });
}