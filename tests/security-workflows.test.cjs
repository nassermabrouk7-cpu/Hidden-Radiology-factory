const { test } = require("node:test");
const assert = require("node:assert/strict");

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
  process.env.ADMIN_PASSWORD = "p".repeat(31);
  process.env.ADMIN_SESSION_SECRET = "s".repeat(32);
  assert.equal(auth.adminAuthConfigured(), false);
  assert.equal(auth.verifyAdminPassword(process.env.ADMIN_PASSWORD), false);

  process.env.ADMIN_PASSWORD = "p".repeat(32);
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
