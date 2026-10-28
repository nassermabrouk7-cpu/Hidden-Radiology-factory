const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = readFileSync(resolve(__dirname, "../src/lib/marketing-publisher.ts"), "utf8");
const channelsConfig = require("../src/channels.config.json");

test("marketing queue excludes Facebook and Instagram for every rejected token state", async (t) => {
  const envNames = ["MARKETING_AUTO_PUBLISH", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN", "TELEGRAM_BOT_TOKEN", "THREADS_USER_ID", "THREADS_ACCESS_TOKEN", "META_TOKEN_VAULT_ENABLED"];
  const old = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => envNames.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  for (const name of ["TELEGRAM_BOT_TOKEN", "THREADS_USER_ID", "THREADS_ACCESS_TOKEN", "META_TOKEN_VAULT_ENABLED"]) delete process.env[name];
  Object.assign(process.env, { MARKETING_AUTO_PUBLISH: "true", NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "local-fake", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "local-fake", INSTAGRAM_USER_ID: "1234567890", INSTAGRAM_ACCESS_TOKEN: "local-fake" });
  for (const status of ["invalid", "expired", "unknown", "unavailable", "not_configured"]) {
    let platforms = null;
    const database = { from() { const q = { update() { return this; }, select() { return this; }, eq() { return this; }, is() { return this; }, lt() { return this; }, in(column, values) { if (column === "platform") platforms = values; return this; }, not() { return this; }, order() { return this; }, lte() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: null }), then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); } }; return q; } };
    const mocks = {
      "@supabase/supabase-js": { createClient: () => database },
      "@/lib/marketing-auth": { isMarketingItemPublishAuthorized: () => true },
      "@/lib/marketing-media": { getTrustedProductCoverUrl: (url) => url },
      "@/lib/facebook-credentials": { getFacebookCredentialError: () => null },
      "@/lib/meta-credentials": { getInstagramBusinessAccountId: () => process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID || null },
      "@/lib/meta-token-vault": {
        getMetaPublishCredentials: async (platform) => platform === "facebook"
          ? { id: process.env.FACEBOOK_PAGE_ID, accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN }
          : { id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID, accessToken: process.env.INSTAGRAM_ACCESS_TOKEN },
      },
      "@/lib/channels/threads": { publishToThreads: async () => ({ success: false }) },
      "@/channels.config.json": { default: channelsConfig },
      "@/lib/meta-token-health": { getMetaTokenHealth: async () => ({ status, expiresAt: null }), isMetaTokenPublishAllowed: (value) => value === "valid" || value === "expiring" },
    };
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} };
    vm.runInNewContext(compiled, { exports: mod.exports, module: mod, process, Date, URL, fetch: async () => { throw new Error("unexpected provider request"); }, require: (id) => mocks[id] });
    const result = await mod.exports.publishNextMarketingItem();
    assert.equal(result.processed, false);
    assert.equal(platforms, null);
  }
});
