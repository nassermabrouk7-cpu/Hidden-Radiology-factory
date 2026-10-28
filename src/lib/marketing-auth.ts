import { timingSafeEqual } from "node:crypto";

/** Bearer-only guard for handlers that can cause an external publication. */
export function isCronBearerAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization) return false;

  const normalized = authorization.trim();
  if (!normalized.startsWith("Bearer ")) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(normalized);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Authenticate internal marketing jobs without leaking secret comparisons. */
export function isMarketingJobAuthorized(request: Request): boolean {
  return isCronBearerAuthorized(request);
}

export function isMarketingItemPublishAuthorized(
  status: unknown,
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): boolean {
  return autoPublish === "true" && status === "approved";
}

export function getGeneratedMarketingItemStatus(
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): "approved" | "queued" {
  return autoPublish === "true" ? "approved" : "queued";
}
