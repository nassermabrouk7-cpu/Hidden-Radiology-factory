import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export type MetaTokenStatus = "valid" | "expiring" | "expired" | "invalid" | "not_configured" | "unknown" | "unavailable";
export type MetaTokenName = "facebook" | "instagram";
export type MetaTokenHealth = { status: MetaTokenStatus; expiresAt: number | null };

/** Only a token confirmed valid by Meta is eligible for publishing. */
export function isMetaTokenPublishAllowed(status: MetaTokenStatus): boolean {
  return status === "valid" || status === "expiring";
}

export function shouldResetMetaTokenAlert(status: MetaTokenStatus): boolean {
  return status === "valid";
}

const EXPIRING_WITHIN_SECONDS = 7 * 24 * 60 * 60;
const REQUIRED_SCOPES: Record<MetaTokenName, string[]> = {
  facebook: ["pages_manage_posts", "pages_read_engagement"],
  instagram: ["instagram_basic", "instagram_content_publish"],
};

export async function debugMetaToken(
  token: string,
  appId: string,
  appSecret: string,
  requiredScopes: string[],
  fetcher: typeof fetch = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<MetaTokenHealth> {
  try {
    const appAccessToken = `${appId}|${appSecret}`;
    const url = new URL("https://graph.facebook.com/v23.0/debug_token");
    url.searchParams.set("input_token", token);
    url.searchParams.set("access_token", appAccessToken);
    const response = await fetcher(url, {
      cache: "no-store",
      ...(fetcher === fetch ? { signal: AbortSignal.timeout(10000) } : {}),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: { code?: number } };
      return failure?.error?.code === 190
        ? { status: "invalid", expiresAt: null }
        : { status: "unavailable", expiresAt: null };
    }
    const result = await response.json() as { data?: { app_id?: string; is_valid?: boolean; expires_at?: number; scopes?: string[]; granular_scopes?: Array<{ scope?: string }> } };
    const data = result?.data;
    if (!data || typeof data.is_valid !== "boolean") return { status: "unknown", expiresAt: null };
    if (!data.is_valid) return { status: "invalid", expiresAt: null };
    if (typeof data.app_id !== "string") return { status: "unknown", expiresAt: null };
    if (data.app_id !== appId) return { status: "invalid", expiresAt: null };

    const scopes = new Set([...(data.scopes || []), ...(data.granular_scopes || []).map(({ scope }) => scope).filter((scope): scope is string => Boolean(scope))]);
    if (requiredScopes.length && !data.scopes && !data.granular_scopes) return { status: "unknown", expiresAt: null };
    if (requiredScopes.some((scope) => !scopes.has(scope))) return { status: "invalid", expiresAt: null };
    if (data.expires_at !== undefined && (typeof data.expires_at !== "number" || !Number.isFinite(data.expires_at) || data.expires_at < 0)) return { status: "unknown", expiresAt: null };
    const expiresAt = typeof data.expires_at === "number" && data.expires_at > 0 ? data.expires_at : null;
    if (expiresAt !== null && expiresAt <= nowSeconds) return { status: "expired", expiresAt };
    if (expiresAt !== null && expiresAt - nowSeconds <= EXPIRING_WITHIN_SECONDS) return { status: "expiring", expiresAt };
    // A token without expiry is accepted only because Meta just confirmed is_valid.
    return { status: "valid", expiresAt };
  } catch {
    return { status: "unavailable", expiresAt: null };
  }
}

function tokenConfig(name: MetaTokenName) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const token = name === "facebook" ? process.env.FACEBOOK_PAGE_ACCESS_TOKEN : process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!appId || !appSecret || !token) return null;
  return { appId, appSecret, token };
}

export async function getMetaTokenHealth(name: MetaTokenName): Promise<MetaTokenHealth> {
  const config = tokenConfig(name);
  if (!config) return { status: "not_configured", expiresAt: null };
  return debugMetaToken(config.token, config.appId, config.appSecret, REQUIRED_SCOPES[name]);
}

function getStateStore() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function sendMetaTokenAlerts(health: Record<MetaTokenName, MetaTokenHealth>, now = new Date()): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.META_TOKEN_ALERT_EMAIL;
  const store = getStateStore();
  if (!from || !apiKey || !to || !store) return;
  const day = now.toISOString().slice(0, 10);
  const resend = new Resend(apiKey);

  for (const name of ["facebook", "instagram"] as const) {
    const status = health[name].status;
    // Clear the daily dedupe record only after Meta confirms recovery. An
    // inconclusive check must not erase evidence of an outstanding alert.
    if (shouldResetMetaTokenAlert(status)) {
      await store.from("meta_token_health_alerts").delete().eq("token_name", name);
      continue;
    }
    if (status !== "invalid" && status !== "expired" && status !== "expiring") continue;
    const { data: claimed, error: claimError } = await store.rpc("claim_meta_token_health_alert", {
      p_token_name: name,
      p_status: status,
      p_alerted_on: day,
    });
    if (claimError || claimed !== true) continue;
    const label = name === "facebook" ? "Facebook Page" : "Instagram";
    try {
      const { error: sendError } = await resend.emails.send({
        from,
        to,
        subject: `Meta ${label} token: ${status}`,
        text: `The ${label} access token health is ${status}. Review Meta App Dashboard permissions and reauthorize the account if needed. No token value is included in this message.`,
      });
      if (sendError) await store.from("meta_token_health_alerts").delete().eq("token_name", name).eq("status", status);
    } catch {
      await store.from("meta_token_health_alerts").delete().eq("token_name", name).eq("status", status);
    }
  }
}

export async function checkMetaTokenHealth() {
  const [facebook, instagram] = await Promise.all([getMetaTokenHealth("facebook"), getMetaTokenHealth("instagram")]);
  const health = { facebook, instagram };
  await sendMetaTokenAlerts(health);
  return health;
}
