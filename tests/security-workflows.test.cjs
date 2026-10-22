const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

test("admin auth rejects short passwords and signs expiring sessions", async (t) => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSessionSecret = process.env.ADMIN_SESSION_SECRET;
  t.after(() => {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSessionSecret;
  });

  const auth = await import("../src/lib/admin-auth.ts");
  process.env.ADMIN_PASSWORD = "p".repeat(11);
  process.env.ADMIN_SESSION_SECRET = "s".repeat(32);
  assert.equal(auth.adminAuthConfigured(), false);
  assert.equal(auth.verifyAdminPassword(process.env.ADMIN_PASSWORD), false);

  process.env.ADMIN_PASSWORD = "p".repeat(12);
  assert.equal(auth.adminAuthConfigured(), true);
  assert.equal(auth.verifyAdminPassword(process.env.ADMIN_PASSWORD), true);
  assert.equal(auth.verifyAdminPassword("wrong"), false);

  const session = auth.createAdminSession();
  assert.ok(session);
  assert.equal(auth.isValidAdminSession(`${auth.ADMIN_COOKIE_NAME}=${session.token}`), true);
  assert.equal(auth.isValidAdminSession(`${auth.ADMIN_COOKIE_NAME}=invalid.token`), false);
});

test("admin mutations require the exact same origin", async () => {
  const auth = await import("../src/lib/admin-auth.ts");
  assert.equal(auth.isSameOriginRequest(new Request("https://factory.example/api", { headers: { Origin: "https://factory.example" } })), true);
  assert.equal(auth.isSameOriginRequest(new Request("https://factory.example/api", { headers: { Origin: "https://attacker.example" } })), false);
  assert.equal(auth.isSameOriginRequest(new Request("https://factory.example/api")), false);
});

test("marketing jobs require the exact bearer secret", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  const marketing = await import("../src/lib/marketing-auth.ts");
  process.env.CRON_SECRET = "short-cron-secret";
  assert.equal(marketing.isMarketingJobAuthorized(new Request("https://factory.example/api", { headers: { Authorization: "Bearer short-cron-secret" } })), false);
  process.env.CRON_SECRET = "c".repeat(32);
  assert.equal(marketing.isMarketingJobAuthorized(new Request("https://factory.example/api", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })), true);
  assert.equal(marketing.isMarketingJobAuthorized(new Request("https://factory.example/api", { headers: { Authorization: "Bearer wrong-secret" } })), false);
  assert.equal(marketing.isMarketingJobAuthorized(new Request("https://factory.example/api")), false);
});

test("publishing endpoints reject absent, short, and incorrect cron bearer credentials", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
  const { isCronBearerAuthorized } = await import("../src/lib/marketing-auth.ts");
  delete process.env.CRON_SECRET;
  assert.equal(isCronBearerAuthorized(new Request("https://factory.example/api/test-publish")), false);
  process.env.CRON_SECRET = "short";
  assert.equal(isCronBearerAuthorized(new Request("https://factory.example/api/test-publish", { headers: { Authorization: "Bearer short" } })), false);
  process.env.CRON_SECRET = "c".repeat(32);
  assert.equal(isCronBearerAuthorized(new Request("https://factory.example/api/test-publish")), false);
  assert.equal(isCronBearerAuthorized(new Request("https://factory.example/api/test-publish", { headers: { Authorization: `Bearer ${"x".repeat(32)}` } })), false);
  assert.equal(isCronBearerAuthorized(new Request("https://factory.example/api/test-publish", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })), true);
  const routeSource = readFileSync(resolve(__dirname, "../src/app/api/test-publish/route.ts"), "utf8");
  assert.match(routeSource, /export async function POST\(request: NextRequest\)\s*\{\s*if \(!isCronBearerAuthorized\(request\)\)/);
  assert.match(routeSource, /export async function GET\(request: NextRequest\)\s*\{\s*if \(!isCronBearerAuthorized\(request\)\)/);
  assert.ok(routeSource.indexOf("if (body.dryRun === true)") < routeSource.indexOf("// Test each requested channel"));
});

test("campaign publishing maps persistence status, skips successful channels, and bounds retries", async () => {
  const {
    canRetryCampaign,
    countsTowardProductCooldown,
    getCampaignStatus,
    getChannelsToPublish,
    getRetryMetadata,
    makeSalesCaption,
  } = await import("../src/lib/product-publishing.ts");
  const partial = { facebook: { success: true, externalId: "post-1" }, telegram: { success: false, error: "temporary" } };
  assert.equal(getCampaignStatus(["facebook", "telegram"], {}), "ready");
  assert.equal(getCampaignStatus(["facebook", "telegram"], partial), "active");
  assert.equal(getCampaignStatus(["facebook", "telegram"], { facebook: { success: true }, telegram: { success: true } }), "completed");
  assert.deepEqual(getChannelsToPublish(["facebook", "telegram"], partial), ["telegram"]);
  assert.equal(canRetryCampaign({ attempts: 2, channel_results: partial }, 3), true);
  assert.equal(canRetryCampaign({ attempts: 1, channel_results: {} }, 3), true);
  assert.equal(canRetryCampaign({ attempts: 3, channel_results: partial }, 3), false);
  assert.equal(canRetryCampaign({ attempts: 1, retry_exhausted: true, channel_results: partial }, 3), false);
  assert.equal(countsTowardProductCooldown("ready", partial), false);
  assert.equal(countsTowardProductCooldown("active", { channel_results: partial }), true);
  assert.equal(countsTowardProductCooldown("completed", { channel_results: { telegram: { success: false } } }), false);
  assert.deepEqual(getRetryMetadata({ attempts: "invalid", channel_results: partial }).attempts, 0);
  const caption = makeSalesCaption({ title_en: "Chest CT", description_en: "A concise guide", price: 12.5 }, "https://factory.example/library?book=1");
  assert.match(caption, /Chest CT/);
  assert.match(caption, /A concise guide/);
  assert.match(caption, /12\.50/);
  assert.match(caption, /https:\/\/factory\.example\/library/);
});

test("only explicitly approved content can be published when the global gate is enabled", async () => {
  const marketing = await import("../src/lib/marketing-auth.ts");
  assert.equal(marketing.isMarketingItemPublishAuthorized("queued", "true"), false);
  assert.equal(marketing.isMarketingItemPublishAuthorized("approved", "false"), false);
  assert.equal(marketing.isMarketingItemPublishAuthorized("approved", "true"), true);
});

test("campaign destinations require an explicit secure site URL", async () => {
  const { normalizeMarketingSiteUrl } = await import("../src/lib/marketing-site.ts");
  assert.throws(() => normalizeMarketingSiteUrl(undefined), /MARKETING_SITE_URL/);
  assert.equal(normalizeMarketingSiteUrl("https://factory.example/"), "https://factory.example");
  assert.throws(() => normalizeMarketingSiteUrl("http://factory.example", "production"), /HTTPS/);
  assert.throws(() => normalizeMarketingSiteUrl("https://user:pass@factory.example"), /credentials/);
  assert.throws(() => normalizeMarketingSiteUrl("https://factory.example?campaign=1"), /query/);
  assert.equal(normalizeMarketingSiteUrl("http://localhost:3000", "development"), "http://localhost:3000");
});
