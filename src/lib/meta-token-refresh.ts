import { debugMetaToken, REQUIRED_SCOPES } from "@/lib/meta-token-health";
import {
  claimMetaTokenRefresh,
  claimMetaTokenRefreshAttempt,
  getMetaTokenRefreshAttemptStatus,
  loadMetaTokenVault,
  releaseMetaTokenRefresh,
  saveMetaTokenVault,
  updateMetaTokenRefreshAttempt,
} from "@/lib/meta-token-vault";
import { refreshMetaOAuthConnection } from "@/lib/meta-oauth";

const REFRESH_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export type MetaTokenRefreshResult = {
  status: "disabled" | "not_due" | "succeeded" | "in_progress" | "failed" | "reauthorization_required" | "unavailable";
  manualReauthorizationRequired: boolean;
  alertRequired: boolean;
};

const disabled: MetaTokenRefreshResult = {
  status: "disabled",
  manualReauthorizationRequired: false,
  alertRequired: false,
};

export async function refreshMetaTokenVaultIfNeeded(
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<MetaTokenRefreshResult> {
  if (process.env.META_TOKEN_VAULT_ENABLED !== "true") return disabled;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { status: "unavailable", manualReauthorizationRequired: false, alertRequired: true };

  let current;
  try {
    current = await loadMetaTokenVault();
  } catch {
    return { status: "unavailable", manualReauthorizationRequired: false, alertRequired: true };
  }
  if (!current) return { status: "unavailable", manualReauthorizationRequired: true, alertRequired: true };
  if (current.userTokenExpiresAt === null) return { status: "not_due", manualReauthorizationRequired: false, alertRequired: false };
  if (current.userTokenExpiresAt <= nowSeconds) {
    return { status: "reauthorization_required", manualReauthorizationRequired: true, alertRequired: true };
  }
  if (current.userTokenExpiresAt - nowSeconds > REFRESH_WINDOW_SECONDS) {
    return { status: "not_due", manualReauthorizationRequired: false, alertRequired: false };
  }

  const currentHealth = await debugMetaToken(current.userAccessToken, appId, appSecret, [
    "pages_show_list",
    ...REQUIRED_SCOPES.facebook,
    ...REQUIRED_SCOPES.instagram,
  ]);
  if (currentHealth.status === "expired" || currentHealth.status === "invalid") {
    return { status: "reauthorization_required", manualReauthorizationRequired: true, alertRequired: true };
  }
  if (currentHealth.status !== "valid" && currentHealth.status !== "expiring") {
    return { status: "unavailable", manualReauthorizationRequired: false, alertRequired: true };
  }
  if (currentHealth.expiresAt === null || currentHealth.expiresAt <= nowSeconds) {
    return { status: "reauthorization_required", manualReauthorizationRequired: true, alertRequired: true };
  }

  let owner: string | null;
  try {
    owner = await claimMetaTokenRefresh();
  } catch {
    return { status: "unavailable", manualReauthorizationRequired: false, alertRequired: true };
  }
  if (!owner) return { status: "in_progress", manualReauthorizationRequired: false, alertRequired: false };

  let outcome: MetaTokenRefreshResult | null = null;
  let attemptClaimed = false;
  try {
    attemptClaimed = await claimMetaTokenRefreshAttempt(currentHealth.expiresAt);
    if (!attemptClaimed) {
      const priorStatus = await getMetaTokenRefreshAttemptStatus(currentHealth.expiresAt);
      outcome = priorStatus === "failed"
        ? { status: "reauthorization_required", manualReauthorizationRequired: true, alertRequired: true }
        : { status: "in_progress", manualReauthorizationRequired: false, alertRequired: false };
    } else {
      const replacement = await refreshMetaOAuthConnection(current);
      await saveMetaTokenVault(replacement);
      await updateMetaTokenRefreshAttempt(currentHealth.expiresAt, "succeeded");
      outcome = { status: "succeeded", manualReauthorizationRequired: false, alertRequired: false };
    }
  } catch {
    if (attemptClaimed) {
      try {
        await updateMetaTokenRefreshAttempt(currentHealth.expiresAt, "failed");
      } catch {
        outcome = { status: "unavailable", manualReauthorizationRequired: true, alertRequired: true };
      }
    }
    if (!outcome) outcome = { status: "reauthorization_required", manualReauthorizationRequired: true, alertRequired: true };
  }
  try {
    await releaseMetaTokenRefresh(owner);
  } catch {
    return { status: "unavailable", manualReauthorizationRequired: true, alertRequired: true };
  }
  return outcome || { status: "unavailable", manualReauthorizationRequired: true, alertRequired: true };
}
