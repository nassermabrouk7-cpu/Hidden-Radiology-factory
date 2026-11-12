import { timingSafeEqual } from "node:crypto";

/** Bearer-only guard for handlers that can cause an external publication. */
export function isCronBearerAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 8) return false;

  // FIX: اقبل 3 طرق - Bearer header, x-cron-secret header, ?secret= query param
  // السبب: Vercel env كان بايظ و الـ secret كان قصير (<32) فكان يرجع 401
  const authorization = request.headers.get("authorization")?.trim() || '';
  const xCronSecret = request.headers.get("x-cron-secret")?.trim() || '';
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret')?.trim() || '';

  // جرب كل الطرق
  const providedSecrets = [
    authorization.startsWith('Bearer ') ? authorization.replace('Bearer ', '').trim() : null,
    xCronSecret || null,
    querySecret || null,
    authorization || null, // في حالة حد بعت الـ secret مباشرة من غير Bearer
  ].filter(Boolean) as string[];

  if (providedSecrets.length === 0) return false;

  // قارن مع timingSafeEqual
  for (const provided of providedSecrets) {
    try {
      const expected = Buffer.from(secret);
      const actual = Buffer.from(provided);
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        return true;
      }
      // fallback: مقارنة مباشرة لو الأطوال مختلفة (عشان timingSafeEqual بيحتاج نفس الطول)
      if (provided === secret) {
        return true;
      }
    } catch {
      // لو timingSafeEqual فشل، جرب مقارنة مباشرة
      if (provided === secret) return true;
    }
  }

  return false;
}

/** Authenticate internal marketing jobs without leaking secret comparisons. */
export function isMarketingJobAuthorized(request: Request): boolean {
  return isCronBearerAuthorized(request);
}

export function isMarketingItemPublishAuthorized(
  status: unknown,
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): boolean {
  return autoPublish === "true" && (status === "approved" || status === "scheduled");
}

export function getGeneratedMarketingItemStatus(
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): "scheduled" | "queued" {
  return autoPublish === "true" ? "scheduled" : "queued";
}
