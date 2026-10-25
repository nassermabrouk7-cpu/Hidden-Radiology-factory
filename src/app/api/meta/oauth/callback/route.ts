import { completeMetaOAuthConnection, verifyMetaOAuthState } from "@/lib/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCookie(header: string | null, name: string): string | null {
  const cookie = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
}

function clearStateCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `meta_oauth_state=; Path=/api/meta/oauth/callback; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function finish(request: Request, status: "connected" | "failed") {
  const origin = new URL(request.url).origin;
  const response = Response.redirect(new URL(`/admin?meta_oauth=${status}`, origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Set-Cookie", clearStateCookie());
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = readCookie(request.headers.get("cookie"), "meta_oauth_state");
  if (!verifyMetaOAuthState(state, stateCookie)) return finish(request, "failed");

  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (providerError || !code) return finish(request, "failed");

  try {
    await completeMetaOAuthConnection(code);
    return finish(request, "connected");
  } catch {
    return finish(request, "failed");
  }
}
