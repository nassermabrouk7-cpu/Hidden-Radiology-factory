type Entry = { count: number; resetAt: number };

const entries = new Map<string, Entry>();

// Best-effort per-instance throttle. Use the Vercel Firewall for distributed limits.
export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    if (entries.size > 5_000) {
      for (const [entryKey, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(entryKey);
      }
    }
    return false;
  }

  current.count += 1;
  return current.count > limit;
}
