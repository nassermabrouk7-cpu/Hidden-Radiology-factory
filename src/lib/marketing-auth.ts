import { timingSafeEqual } from "node:crypto";

/** Bearer-only guard for handlers that can cause an external publication. */
export function isCronBearerAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Authenticate internal marketing jobs without leaking secret comparisons. */
export function isMarketingJobAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;

  // Check Authorization header first
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(authorization);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  // Fallback to query parameter for Vercel cron
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key) {
    const expected = Buffer.from(secret);
    const actual = Buffer.from(key);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  return false;
}

export function isMarketingItemPublishAuthorized(
  status: unknown,
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): boolean {
  return autoPublish === "true" && status === "approved";
}
