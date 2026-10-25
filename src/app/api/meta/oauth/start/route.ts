import { isValidAdminSession } from "@/lib/admin-auth";
import { createMetaOAuthState, metaOAuthScopes } from "@/lib/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidRedirectUri(value: string | undefined, requestUrl: URL): value is string {
  if (!value) return false;
  try {
    const redirect = new URL(value);
    const localHttp = redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname);
    return (redirect.protocol === "https:" || localHttp) &&
      !redirect.username && !redirect.password &&
      redirect.origin === requestUrl.origin &&
      redirect.pathname === "/api/meta/oauth/callback" &&
      !redirect.search && !redirect.hash;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!isValidAdminSession(request.headers.get("cookie"))) {
    return Response.json({ success: false, error: "Admin authentication is required." }, { status: 401 });
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !process.env.META_APP_SECRET || !process.env.META_TOKEN_ENCRYPTION_KEY ||
      !isValidRedirectUri(redirectUri, new URL(request.url))) {
    return Response.json({ success: false, error: "Meta OAuth or encrypted token storage is not configured." }, { status: 503 });
  }

  let state: string;
  try {
    state = createMetaOAuthState();
  } catch {
    return Response.json({ success: false, error: "Admin OAuth state signing is not configured." }, { status: 503 });
  }

  const authorizationUrl = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  authorizationUrl.searchParams.set("client_id", appId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", metaOAuthScopes());
  authorizationUrl.searchParams.set("response_type", "code");

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `meta_oauth_state=${encodeURIComponent(state)}; Path=/api/meta/oauth/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
    },
  });
}
