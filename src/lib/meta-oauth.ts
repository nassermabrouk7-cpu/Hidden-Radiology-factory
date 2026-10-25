import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { debugMetaToken, REQUIRED_SCOPES } from "@/lib/meta-token-health";
import { getInstagramBusinessAccountId } from "@/lib/meta-credentials";
import { saveMetaTokenVault, type MetaTokenVault } from "@/lib/meta-token-vault";

const GRAPH_VERSION = "v23.0";
const STATE_TTL_SECONDS = 10 * 60;
const OAUTH_SCOPES = [
  "pages_show_list",
  ...REQUIRED_SCOPES.facebook,
  ...REQUIRED_SCOPES.instagram,
];

function stateMac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`meta-oauth-state:${payload}`).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createMetaOAuthState(
  sessionSecret = process.env.ADMIN_SESSION_SECRET,
  nowSeconds = Math.floor(Date.now() / 1000),
  nonce = randomBytes(32).toString("base64url"),
): string {
  if (!sessionSecret || sessionSecret.length < 32) throw new Error("Admin session signing is not configured.");
  const payload = Buffer.from(JSON.stringify({ expiresAt: nowSeconds + STATE_TTL_SECONDS, nonce })).toString("base64url");
  return `${payload}.${stateMac(payload, sessionSecret)}`;
}

export function verifyMetaOAuthState(
  state: string | null,
  cookieState: string | null,
  sessionSecret = process.env.ADMIN_SESSION_SECRET,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!state || !cookieState || !sessionSecret || sessionSecret.length < 32 || !safeEqual(state, cookieState)) return false;
  const [payload, suppliedMac, extra] = state.split(".");
  if (!payload || !suppliedMac || extra) return false;
  if (!safeEqual(suppliedMac, stateMac(payload, sessionSecret))) return false;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded === "object" && decoded !== null &&
      "expiresAt" in decoded && typeof decoded.expiresAt === "number" &&
      decoded.expiresAt > nowSeconds && decoded.expiresAt <= nowSeconds + STATE_TTL_SECONDS &&
      "nonce" in decoded && typeof decoded.nonce === "string";
  } catch {
    return false;
  }
}

export function metaOAuthScopes(): string {
  return OAUTH_SCOPES.join(",");
}

type MetaFetch = typeof fetch;
type MetaTokenResponse = { access_token?: unknown; expires_in?: unknown; error?: unknown };

async function readMetaJson<T>(url: URL, fetcher: MetaFetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Meta OAuth request failed.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") throw new Error("Meta OAuth request failed.");
  return body as T;
}

function graphUrl(path: string): URL {
  return new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
}

async function exchangeToken(
  params: Record<string, string>,
  fetcher: MetaFetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = graphUrl("oauth/access_token");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const result = await readMetaJson<MetaTokenResponse>(url, fetcher);
  if (typeof result.access_token !== "string" || !result.access_token ||
      typeof result.expires_in !== "number" || !Number.isFinite(result.expires_in) || result.expires_in <= 0) {
    throw new Error("Meta did not return a usable access token.");
  }
  return { accessToken: result.access_token, expiresIn: result.expires_in };
}

function assertTokenHealth(status: string): void {
  if (status !== "valid") throw new Error("Meta OAuth token permissions or validity could not be verified.");
}

async function loadPageCredentials(
  userToken: string,
  appId: string,
  appSecret: string,
  fetcher: MetaFetch,
  requiredPageId?: string,
  requiredInstagramId?: string,
): Promise<{ pageId: string; pageToken: string; instagramId: string }> {
  const pagesUrl = graphUrl("me/accounts");
  pagesUrl.searchParams.set("fields", "id,access_token,instagram_business_account{id}");
  pagesUrl.searchParams.set("limit", "100");
  pagesUrl.searchParams.set("access_token", userToken);
  const pagesResponse = await readMetaJson<{ data?: Array<{
    id?: unknown;
    access_token?: unknown;
    instagram_business_account?: { id?: unknown } | null;
  }> }>(pagesUrl, fetcher);
  if (!Array.isArray(pagesResponse.data)) throw new Error("Meta did not return Facebook Pages.");

  const availablePages = pagesResponse.data.filter((page) =>
    typeof page.id === "string" && /^\d{10,20}$/.test(page.id) &&
    typeof page.access_token === "string" && page.access_token.length > 0 &&
    typeof page.instagram_business_account?.id === "string" &&
    /^\d{10,20}$/.test(page.instagram_business_account.id),
  );
  const configuredPageId = process.env.FACEBOOK_PAGE_ID?.trim() || requiredPageId;
  const selectedPages = configuredPageId
    ? availablePages.filter((page) => page.id === configuredPageId)
    : availablePages;
  if (selectedPages.length !== 1) throw new Error("A unique connected Facebook Page and professional Instagram account are required.");
  const page = selectedPages[0];
  const pageId = page.id as string;
  const instagramId = page.instagram_business_account!.id as string;
  const configuredInstagramId = getInstagramBusinessAccountId();
  if (
    (requiredPageId && pageId !== requiredPageId) ||
    (process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && !configuredInstagramId) ||
    (configuredInstagramId && configuredInstagramId !== instagramId) ||
    (requiredInstagramId && requiredInstagramId !== instagramId)
  ) throw new Error("The connected Instagram account does not match the configured account.");

  const pageToken = page.access_token as string;
  const pageHealth = await debugMetaToken(pageToken, appId, appSecret, [...REQUIRED_SCOPES.facebook, ...REQUIRED_SCOPES.instagram], fetcher);
  assertTokenHealth(pageHealth.status);
  return { pageId, pageToken, instagramId };
}

function buildMetaTokenVault(
  userAccessToken: string,
  userTokenExpiresAt: number | null,
  pageCredentials: { pageId: string; pageToken: string; instagramId: string },
): MetaTokenVault {
  return {
    userAccessToken,
    userTokenExpiresAt,
    facebookPageId: pageCredentials.pageId,
    facebookPageAccessToken: pageCredentials.pageToken,
    instagramBusinessAccountId: pageCredentials.instagramId,
    instagramAccessToken: pageCredentials.pageToken,
  };
}

export async function completeMetaOAuthConnection(
  code: string,
  fetcher: MetaFetch = fetch,
): Promise<void> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri || !process.env.META_TOKEN_ENCRYPTION_KEY) {
    throw new Error("Meta OAuth or encrypted token storage is not configured.");
  }

  const shortLived = await exchangeToken({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  }, fetcher);

  const longLived = await exchangeToken({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.accessToken,
  }, fetcher);
  const userHealth = await debugMetaToken(shortLived.accessToken, appId, appSecret, OAUTH_SCOPES, fetcher);
  assertTokenHealth(userHealth.status);
  const longLivedHealth = await debugMetaToken(longLived.accessToken, appId, appSecret, OAUTH_SCOPES, fetcher);
  assertTokenHealth(longLivedHealth.status);
  const pageCredentials = await loadPageCredentials(longLived.accessToken, appId, appSecret, fetcher);
  const vault = buildMetaTokenVault(longLived.accessToken, longLivedHealth.expiresAt, pageCredentials);
  await saveMetaTokenVault(vault);
}

export async function refreshMetaOAuthConnection(
  current: MetaTokenVault,
  fetcher: MetaFetch = fetch,
): Promise<MetaTokenVault> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Meta OAuth is not configured.");

  const currentHealth = await debugMetaToken(current.userAccessToken, appId, appSecret, OAUTH_SCOPES, fetcher);
  if (currentHealth.status !== "valid" && currentHealth.status !== "expiring") {
    throw new Error("Meta requires administrator reauthorization.");
  }
  if (currentHealth.expiresAt === null) throw new Error("Meta user token expiry is not verifiable.");

  const refreshed = await exchangeToken({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: current.userAccessToken,
  }, fetcher);
  const refreshedHealth = await debugMetaToken(refreshed.accessToken, appId, appSecret, OAUTH_SCOPES, fetcher);
  assertTokenHealth(refreshedHealth.status);
  if (refreshedHealth.expiresAt === null || refreshedHealth.expiresAt <= currentHealth.expiresAt) {
    throw new Error("Meta did not extend the user token lifetime.");
  }

  const pageCredentials = await loadPageCredentials(
    refreshed.accessToken,
    appId,
    appSecret,
    fetcher,
    current.facebookPageId,
    current.instagramBusinessAccountId,
  );
  return buildMetaTokenVault(refreshed.accessToken, refreshedHealth.expiresAt, pageCredentials);
}
