const DAILY_PUBLISH_HOUR_UTC = 6;

/** Return one future 06:00 UTC slot per item, matching the daily Vercel cron. */
export function getDailyMarketingSchedule(index: number, now = new Date()): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Marketing schedule index must be a non-negative integer");
  }

  const firstSlot = new Date(now);
  firstSlot.setUTCHours(DAILY_PUBLISH_HOUR_UTC, 0, 0, 0);
  if (firstSlot.getTime() <= now.getTime()) {
    firstSlot.setUTCDate(firstSlot.getUTCDate() + 1);
  }
  firstSlot.setUTCDate(firstSlot.getUTCDate() + index);
  return firstSlot.toISOString();
}
