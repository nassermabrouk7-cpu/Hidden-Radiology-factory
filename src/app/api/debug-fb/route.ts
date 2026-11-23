export async function GET() {
  const pageId = process.env.FACEBOOK_PAGE_ID || "";
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
  const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=name,id&access_token=${token}`);
  const body = await res.text();
  return Response.json({
    pageId,
    tokenLen: token.length,
    tokenStart: token.substring(0,3),
    graphStatus: res.status,
    graphBody: body.slice(0,400),
    vaultEnabled: process.env.META_TOKEN_VAULT_ENABLED || "not-set",
  });
}