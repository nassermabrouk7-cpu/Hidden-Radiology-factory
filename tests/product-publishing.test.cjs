const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  canRetryCampaign,
  claimDailyProductPublishRun,
  getCampaignStatus,
  getChannelsToPublish,
  getRetryMetadata,
} = require("../src/lib/product-publishing.ts");

test("retry selects every missing or unsuccessful channel but never a successful channel", () => {
  const results = {
    facebook: { success: true, externalId: "fb" },
    instagram: { success: false, error: "temporary failure" },
  };
  assert.deepEqual(getChannelsToPublish(["telegram", "facebook", "instagram"], results), ["telegram", "instagram"]);
  assert.equal(getCampaignStatus(["telegram", "facebook", "instagram"], results), "active");
  assert.equal(canRetryCampaign({ attempts: 1, channel_results: results }, 3), true);
});

test("missing and malformed channel outcomes do not count as success", () => {
  assert.deepEqual(getRetryMetadata({ channel_results: { telegram: { success: "true" } } }).results, {});
  assert.deepEqual(getChannelsToPublish(["telegram", "facebook"], { telegram: { success: true } }), ["facebook"]);
  assert.equal(getCampaignStatus(["telegram", "facebook"], { telegram: { success: true } }), "active");
  assert.equal(getCampaignStatus(["telegram"], {}), "ready");
});

test("campaigns with all required channels successful are not retried", () => {
  const metadata = {
    attempts: 1,
    channel_results: { facebook: { success: true }, instagram: { success: true } },
  };
  assert.equal(canRetryCampaign(metadata, 3), false);
  assert.deepEqual(getChannelsToPublish(["facebook", "instagram"], getRetryMetadata(metadata).results), []);
});

test("ambiguous in-flight campaigns and exhausted campaigns are not retried", () => {
  assert.equal(canRetryCampaign({ attempts: 1, attempt_in_progress: true, channel_results: { instagram: { success: false } } }, 3), false);
  assert.equal(canRetryCampaign({ attempts: 3, channel_results: { instagram: { success: false } } }, 3), false);
});

test("daily publishing acquires an atomic date idempotency key via RPC", async () => {
  const claimedDates = new Set();
  const store = {
    rpc: async (name, args) => {
      assert.equal(name, "claim_product_publish_daily_run");
      assert.equal(args.p_idempotency_key, `product-publish:${args.p_run_date}`);
      if (claimedDates.has(args.p_run_date)) return { data: false, error: null };
      claimedDates.add(args.p_run_date);
      return { data: true, error: null };
    },
  };
  const now = new Date("2026-10-25T07:00:00.000Z");
  const repeated = await Promise.all([
    claimDailyProductPublishRun(store, now),
    claimDailyProductPublishRun(store, now),
  ]);
  assert.equal(repeated.filter(({ claimed }) => claimed).length, 1);
  assert.equal((await claimDailyProductPublishRun(store, now)).claimed, false);
  assert.equal((await claimDailyProductPublishRun(store, new Date("2026-10-26T07:00:00.000Z"))).claimed, true);
});

test("daily publishing lock failures surface instead of allowing a publish", async () => {
  await assert.rejects(
    claimDailyProductPublishRun({ rpc: async () => ({ data: false, error: new Error("database unavailable") }) }),
    /Could not acquire the daily product publishing lock/,
  );
});
