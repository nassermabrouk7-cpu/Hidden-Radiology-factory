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
  return isCronBearerAuthorized(request);
}

export function isMarketingItemPublishAuthorized(
  status: unknown,
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): boolean {
  return autoPublish === "true" && status === "approved";
}
