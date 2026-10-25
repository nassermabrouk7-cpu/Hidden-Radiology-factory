import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type MetaTokenVault = {
  userAccessToken: string;
  userTokenExpiresAt: number | null;
  facebookPageId: string;
  facebookPageAccessToken: string;
  instagramBusinessAccountId: string;
  instagramAccessToken: string;
};

export type EncryptedMetaToken = {
  ciphertext: string;
  iv: string;
  auth_tag: string;
};

function decodeEncryptionKey(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== normalized.replace(/=+$/, "")) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes.");
  }
  return key;
}

export function encryptMetaTokenValue(value: MetaTokenVault, encryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY): EncryptedMetaToken {
  if (!encryptionKey) throw new Error("META_TOKEN_ENCRYPTION_KEY is not configured.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", decodeEncryptionKey(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptMetaTokenValue(encrypted: EncryptedMetaToken, encryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY): MetaTokenVault {
  if (!encryptionKey) throw new Error("META_TOKEN_ENCRYPTION_KEY is not configured.");
  const decipher = createDecipheriv("aes-256-gcm", decodeEncryptionKey(encryptionKey), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.auth_tag, "base64"));
  const plainText = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const value: unknown = JSON.parse(plainText);
  if (
    !value || typeof value !== "object" ||
    typeof (value as MetaTokenVault).userAccessToken !== "string" ||
    typeof (value as MetaTokenVault).facebookPageId !== "string" ||
    typeof (value as MetaTokenVault).facebookPageAccessToken !== "string" ||
    typeof (value as MetaTokenVault).instagramBusinessAccountId !== "string" ||
    typeof (value as MetaTokenVault).instagramAccessToken !== "string"
  ) throw new Error("Stored Meta token data is invalid.");
  return value as MetaTokenVault;
}

function getVaultStore() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Meta token vault storage is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function loadMetaTokenVault(): Promise<MetaTokenVault | null> {
  if (process.env.META_TOKEN_VAULT_ENABLED !== "true") return null;
  const { data, error } = await getVaultStore()
    .from("meta_token_vault")
    .select("ciphertext, iv, auth_tag")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Could not read the encrypted Meta token vault.");
  if (!data) return null;
  return decryptMetaTokenValue(data as EncryptedMetaToken);
}

export async function saveMetaTokenVault(value: MetaTokenVault): Promise<void> {
  const encrypted = encryptMetaTokenValue(value);
  const { error } = await getVaultStore().from("meta_token_vault").upsert({
    id: 1,
    ...encrypted,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not save the encrypted Meta token vault.");
}

export async function claimMetaTokenRefresh(owner = randomUUID()): Promise<string | null> {
  const store = getVaultStore();
  const { data, error } = await store.rpc("claim_meta_token_refresh_lock", {
    p_owner: owner,
    p_lease_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error("Could not acquire the Meta token refresh lock.");
  return data === true ? owner : null;
}

export async function releaseMetaTokenRefresh(owner: string): Promise<void> {
  const { data, error } = await getVaultStore().rpc("release_meta_token_refresh_lock", { p_owner: owner });
  if (error || data !== true) throw new Error("Could not release the Meta token refresh lock.");
}

export async function claimMetaTokenRefreshAttempt(expiresAt: number): Promise<boolean> {
  const { data, error } = await getVaultStore().rpc("claim_meta_token_refresh_attempt", {
    p_token_expires_at: new Date(expiresAt * 1000).toISOString(),
  });
  if (error) throw new Error("Could not record the Meta token refresh attempt.");
  return data === true;
}

export async function updateMetaTokenRefreshAttempt(expiresAt: number, status: "succeeded" | "failed"): Promise<void> {
  const { error } = await getVaultStore().from("meta_token_refresh_attempts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("token_expires_at", new Date(expiresAt * 1000).toISOString());
  if (error) throw new Error("Could not record the Meta token refresh outcome.");
}

export async function getMetaTokenRefreshAttemptStatus(expiresAt: number): Promise<string | null> {
  const { data, error } = await getVaultStore().from("meta_token_refresh_attempts")
    .select("status")
    .eq("token_expires_at", new Date(expiresAt * 1000).toISOString())
    .maybeSingle();
  if (error) throw new Error("Could not inspect the Meta token refresh attempt.");
  return typeof data?.status === "string" ? data.status : null;
}

export async function getMetaPublishCredentials(channel: "facebook" | "instagram") {
  if (process.env.META_TOKEN_VAULT_ENABLED === "true") {
    const vault = await loadMetaTokenVault();
    if (!vault) return null;
    return channel === "facebook"
      ? { id: vault.facebookPageId, accessToken: vault.facebookPageAccessToken }
      : { id: vault.instagramBusinessAccountId, accessToken: vault.instagramAccessToken };
  }
  if (channel === "facebook") {
    const id = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    return id && accessToken ? { id, accessToken } : null;
  }
  const id = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  const legacyId = process.env.INSTAGRAM_USER_ID?.trim();
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (id && legacyId && id !== legacyId) return null;
  const businessId = id || legacyId;
  return businessId && accessToken ? { id: businessId, accessToken } : null;
}
