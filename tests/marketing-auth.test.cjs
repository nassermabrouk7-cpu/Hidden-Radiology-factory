const { test } = require("node:test");
const assert = require("node:assert/strict");

test("marketing job authorization is Bearer-only and rejects URL secrets", async (t) => {
  const previous = process.env.CRON_SECRET;
  t.after(() => previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous);
  process.env.CRON_SECRET = "c".repeat(40);
  const { isMarketingJobAuthorized } = await import("../src/lib/marketing-auth.ts");

  assert.equal(isMarketingJobAuthorized(new Request(`https://factory.example/api/marketing/cron?key=${process.env.CRON_SECRET}`)), false);
  assert.equal(isMarketingJobAuthorized(new Request("https://factory.example/api/marketing/cron", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })), true);
  assert.equal(isMarketingJobAuthorized(new Request("https://factory.example/api/marketing/cron?key=wrong", {
    headers: { authorization: "Bearer wrong" },
  })), false);
});

test("new campaign content requires review unless automatic publishing is explicitly enabled", async () => {
  const { getGeneratedMarketingItemStatus } = await import("../src/lib/marketing-auth.ts");
  assert.equal(getGeneratedMarketingItemStatus("false"), "queued");
  assert.equal(getGeneratedMarketingItemStatus(undefined), "queued");
  assert.equal(getGeneratedMarketingItemStatus("true"), "approved");
});
