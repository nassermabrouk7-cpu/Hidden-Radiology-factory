const { test } = require("node:test");
const assert = require("node:assert/strict");

test("daily campaign posts are assigned future 06:00 UTC slots once per day", async () => {
  const { getDailyMarketingSchedule } = await import("../src/lib/marketing-schedule.ts");
  const now = new Date("2026-10-11T06:00:15.000Z");
  const slots = [0, 1, 2].map((index) => getDailyMarketingSchedule(index, now));
  assert.deepEqual(slots, [
    "2026-10-12T06:00:00.000Z",
    "2026-10-13T06:00:00.000Z",
    "2026-10-14T06:00:00.000Z",
  ]);
});

test("a campaign generated before the cron keeps its same-day first slot", async () => {
  const { getDailyMarketingSchedule } = await import("../src/lib/marketing-schedule.ts");
  assert.equal(getDailyMarketingSchedule(0, new Date("2026-10-11T05:59:00.000Z")), "2026-10-11T06:00:00.000Z");
});

test("admin cover preview accepts only HTTPS originals from the project's public covers bucket", async () => {
  const { getTrustedProductCoverUrl } = await import("../src/lib/marketing-media.ts");
  const supabase = "https://project.supabase.co";
  const original = "https://project.supabase.co/storage/v1/object/public/covers/book-cover.jpg";
  assert.equal(getTrustedProductCoverUrl(original, supabase), original);
  assert.equal(getTrustedProductCoverUrl("http://project.supabase.co/storage/v1/object/public/covers/book.jpg", supabase), null);
  assert.equal(getTrustedProductCoverUrl("https://evil.example/storage/v1/object/public/covers/book.jpg", supabase), null);
  assert.equal(getTrustedProductCoverUrl("https://project.supabase.co/storage/v1/object/sign/covers/book.jpg", supabase), null);
  assert.equal(getTrustedProductCoverUrl(`${original}?token=secret`, supabase), null);
  assert.equal(getTrustedProductCoverUrl(null, supabase), null);
});
