import { createHmac, timingSafeEqual } from "node:crypto";

const REQUIRED_TRANSACTION_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalar(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function verifyPaymobTransactionHmac(
  transaction: unknown,
  suppliedHmac: string,
  secret: string,
): boolean {
  if (!isRecord(transaction) || !isRecord(transaction.order) || !isRecord(transaction.source_data)) return false;
  if (!/^[a-f\d]{128}$/i.test(suppliedHmac)) return false;

  const values: unknown[] = REQUIRED_TRANSACTION_FIELDS.map((field) => transaction[field]);
  values.push(
    transaction.order.id,
    transaction.owner,
    transaction.pending,
    transaction.source_data.pan,
    transaction.source_data.sub_type,
    transaction.source_data.type,
    transaction.success,
  );

  const normalized = values.map(scalar);
  if (normalized.some((value) => value === null)) return false;
  const expected = createHmac("sha512", secret).update(normalized.join("")).digest();
  const received = Buffer.from(suppliedHmac, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function getPaymobCheckoutBaseUrl() {
  const configured = process.env.PAYMOB_BASE_URL || "https://accept.paymob.com";
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("PAYMOB_BASE_URL must be an HTTPS origin without a path");
  }
  return parsed.origin;
}

export function getPaymobPaymentConfig() {
  const secretKey = process.env.PAYMOB_SECRET_KEY;
  const publicKey = process.env.PAYMOB_PUBLIC_KEY;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const integrationIds = [
    process.env.PAYMOB_INTEGRATION_IDS,
    process.env.PAYMOB_INTEGRATION_ID_CARD,
    process.env.PAYMOB_INTEGRATION_ID_WALLET,
    process.env.PAYMOB_INTEGRATION_ID,
  ].filter(Boolean).flatMap((value) => (value || "").split(",")).map((value) => value.trim()).filter(Boolean);
  const currency = (process.env.PAYMOB_CURRENCY || "").trim().toUpperCase();
  const multiplier = Number(process.env.PAYMOB_AMOUNT_MULTIPLIER);

  if (!secretKey || !publicKey || !hmacSecret || integrationIds.length === 0 || !currency) {
    throw new Error("Paymob is not fully configured");
  }
  if (integrationIds.some((id) => !/^\d+$/.test(id))) throw new Error("Paymob integration IDs must be numeric");
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("PAYMOB_AMOUNT_MULTIPLIER must be set to a positive rate");
  const publicMultiplier = Number(process.env.NEXT_PUBLIC_PAYMOB_AMOUNT_MULTIPLIER);
  if (process.env.NEXT_PUBLIC_PAYMOB_AMOUNT_MULTIPLIER && (!Number.isFinite(publicMultiplier) || publicMultiplier !== multiplier)) {
    throw new Error("Public and server Paymob amount multipliers must match");
  }

  return {
    secretKey,
    publicKey,
    hmacSecret,
    integrationIds: integrationIds.map(Number),
    currency,
    multiplier,
    baseUrl: getPaymobCheckoutBaseUrl(),
  };
}

export function getPaymobAmountMinor(amount: number, multiplier: number) {
  const minor = Math.round(amount * multiplier * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error("Calculated Paymob amount is invalid");
  return minor;
}

export function getPaymobCheckoutUrl(baseUrl: string, publicKey: string, clientSecret: string) {
  const url = new URL("/unifiedcheckout/", baseUrl);
  url.searchParams.set("publicKey", publicKey);
  url.searchParams.set("clientSecret", clientSecret);
  return url.toString();
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
