import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getMetaPublishCredentials } from "./meta-token-vault.ts";

export type MetaTokenStatus = "valid" | "expiring" | "expired" | "invalid" | "not_configured" | "unknown" | "unavailable" | "refresh_failed";
export type MetaTokenName = "facebook" | "instagram";
export type MetaTokenHealth = { status: MetaTokenStatus; expiresAt: number | null };

/** Only a token confirmed valid by Meta is eligible for publishing. */
export function isMetaTokenPublishAllowed(status: MetaTokenStatus): boolean {
  return status === "valid" || status === "expiring" || status === "unavailable";
}

export function shouldResetMetaTokenAlert(status: MetaTokenStatus): boolean {
  return status === "valid";
}

const EXPIRING_WITHIN_SECONDS = 7 * 24 * 60 * 60;
export const REQUIRED_SCOPES: Record<MetaTokenName, string[]> = {
  facebook: ["pages_manage_posts", "pages_read_engagement"],
  instagram: ["instagram_basic", "instagram_content_publish"],
};

function isTransientNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  if (!error || typeof error !== "object") return false;
  const cause = "cause" in error ? error.cause : undefined;
  if (!cause || typeof cause !== "object" || !("code" in cause) || typeof cause.code !== "string") return false;
  return ["ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EAI_AGAIN", "ECONNREFUSED"].includes(cause.code);
}

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
      if (failure?.error?.code === 190) return { status: "invalid", expiresAt: null };
      if (response.status === 429 || response.status >= 500) return { status: "unavailable", expiresAt: null };
      return { status: "unknown", expiresAt: null };
    }
    const result = await response.json() as { data?: {
      app_id?: string;
      is_valid?: boolean;
      expires_at?: number;
      data_access_expires_at?: number;
      scopes?: string[];
      granular_scopes?: Array<{ scope?: string }>;
    } };
    const data = result?.data;
    if (!data || typeof data.is_valid !== "boolean") return { status: "unknown", expiresAt: null };
    if (!data.is_valid) return { status: "invalid", expiresAt: null };
    if (typeof data.app_id !== "string") return { status: "unknown", expiresAt: null };
    if (data.app_id !== appId) return { status: "invalid", expiresAt: null };

    if (
      typeof data.expires_at !== "number" ||
      !Number.isFinite(data.expires_at) ||
      data.expires_at < 0 ||
      typeof data.data_access_expires_at !== "number" ||
      !Number.isFinite(data.data_access_expires_at) ||
      data.data_access_expires_at < 0
    ) return { status: "unknown", expiresAt: null };
    if (
      (data.scopes !== undefined && (!Array.isArray(data.scopes) || data.scopes.some((scope) => typeof scope !== "string"))) ||
      (data.granular_scopes !== undefined && (!Array.isArray(data.granular_scopes) || data.granular_scopes.some((item) => typeof item?.scope !== "string")))
    ) return { status: "unknown", expiresAt: null };

    const scopes = new Set([...(data.scopes || []), ...(data.granular_scopes || []).map(({ scope }) => scope).filter((scope): scope is string => Boolean(scope))]);
    if (requiredScopes.length && !data.scopes && !data.granular_scopes) return { status: "unknown", expiresAt: null };
    if (requiredScopes.some((scope) => !scopes.has(scope))) return { status: "invalid", expiresAt: null };
    const expiries = [data.expires_at, data.data_access_expires_at].filter((expiry) => expiry > 0);
    const expiresAt = expiries.length ? Math.min(...expiries) : null;
    if (expiresAt !== null && expiresAt <= nowSeconds) return { status: "expired", expiresAt };
    if (expiresAt !== null && expiresAt - nowSeconds <= EXPIRING_WITHIN_SECONDS) return { status: "expiring", expiresAt };
    // A token without expiry is accepted only because Meta just confirmed is_valid.
    return { status: "valid", expiresAt };
  } catch (error) {
    return { status: isTransientNetworkFailure(error) ? "unavailable" : "unknown", expiresAt: null };
  }
}

async function tokenConfig(name: MetaTokenName, appId: string, appSecret: string) {
  try {
    const credentials = await getMetaPublishCredentials(name);
    if (!credentials) return null;
    return {
      appId,
      appSecret,
      token: credentials.accessToken,
    };
  } catch {
    return "vault_unavailable" as const;
  }
}

export async function getMetaTokenHealth(name: MetaTokenName): Promise<MetaTokenHealth> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { status: "not_configured", expiresAt: null };
  const config = await tokenConfig(name, appId, appSecret);
  if (!config) return { status: "not_configured", expiresAt: null };
  if (config === "vault_unavailable") return { status: "unknown", expiresAt: null };
  return debugMetaToken(config.token, config.appId, config.appSecret, REQUIRED_SCOPES[name]);
}

function getStateStore() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type MetaTokenAlertResult = { configured: boolean; sent: number; failed: boolean };

export async function sendMetaTokenAlerts(
  health: Record<MetaTokenName, MetaTokenHealth>,
  now = new Date(),
  refreshFailure = false,
): Promise<MetaTokenAlertResult> {
  const from = process.env.RESEND_FROM_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.META_TOKEN_ALERT_EMAIL;
  if (!from || !apiKey || !to || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { configured: false, sent: 0, failed: false };
  }
  let store: ReturnType<typeof getStateStore>;
  try {
    store = getStateStore();
  } catch {
    return { configured: true, sent: 0, failed: true };
  }
  if (!store) return { configured: false, sent: 0, failed: false };
  const day = now.toISOString().slice(0, 10);
  let resend: Resend;
  try {
    resend = new Resend(apiKey);
  } catch {
    return { configured: true, sent: 0, failed: true };
  }
  let sent = 0;
  let failed = false;
  const clearClaim = async (name: MetaTokenName, status?: string) => {
    try {
      let query = store!.from("meta_token_health_alerts").delete().eq("token_name", name);
      if (status) query = query.eq("status", status);
      const { error } = await query;
      if (error) failed = true;
    } catch {
      failed = true;
    }
  };

  for (const name of ["facebook", "instagram"] as const) {
    const refreshNeedsAttention = refreshFailure && (health[name].status === "valid" || health[name].status === "expiring");
    const status = refreshNeedsAttention ? "refresh_failed" : health[name].status;
    // Clear the daily dedupe record only after Meta confirms recovery. An
    // inconclusive check must not erase evidence of an outstanding alert.
    if (shouldResetMetaTokenAlert(status)) {
      await clearClaim(name);
      continue;
    }
    if (status === "valid") continue;
    let claimed: unknown;
    try {
      const result = await store.rpc("claim_meta_token_health_alert", {
        p_token_name: name,
        p_status: status,
        p_alerted_on: day,
      });
      if (result.error) failed = true;
      else claimed = result.data;
    } catch {
      failed = true;
      continue;
    }
    if (claimed === undefined && failed) continue;
    if (claimed !== true) continue;
    const label = name === "facebook" ? "Facebook Page" : "Instagram";
    try {
      const { error: sendError } = await resend.emails.send({
        from,
        to,
        subject: `Meta ${label} token: ${status}`,
        text: `The ${label} Meta connection requires attention (${status}). Review Meta permissions and reauthorize the administrator if required. No token value is included in this message.`,
      });
      if (sendError) {
        failed = true;
        await clearClaim(name, status);
      } else {
        sent += 1;
      }
    } catch {
      failed = true;
      await clearClaim(name, status);
    }
  }
  return { configured: true, sent, failed };
}

export async function checkMetaTokenHealth() {
  const { refreshMetaTokenVaultIfNeeded } = await import("./meta-token-refresh.ts");
  const renewal = await refreshMetaTokenVaultIfNeeded();
  const [facebook, instagram] = await Promise.all([getMetaTokenHealth("facebook"), getMetaTokenHealth("instagram")]);
  const health = { facebook, instagram };
  const alerts = await sendMetaTokenAlerts(health, new Date(), renewal.alertRequired);
  return { ...health, renewal, alerts };
}
