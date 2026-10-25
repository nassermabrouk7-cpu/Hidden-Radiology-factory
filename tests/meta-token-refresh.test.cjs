const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadRefreshModule(mocks) {
  const source = readFileSync(resolve(__dirname, "../src/lib/meta-token-refresh.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    process,
    Date,
    Math,
    Promise,
    Number,
    Array,
    String,
    Object,
    require: (id) => {
      if (!(id in mocks)) throw new Error(`Unexpected refresh dependency: ${id}`);
      return mocks[id];
    },
  });
  return module.exports;
}

function refreshMocks({ current, lock, refresh, saved, attempts, currentStatus = "expiring", expiresAt = 2_000_000_100 }) {
  const events = { calls: 0, saves: 0, updates: [], releases: 0 };
  return {
    events,
    mocks: {
      "@/lib/meta-token-health": {
        REQUIRED_SCOPES: { facebook: ["pages_manage_posts"], instagram: ["instagram_content_publish"] },
        debugMetaToken: async () => ({ status: currentStatus, expiresAt }),
      },
      "@/lib/meta-token-vault": {
        loadMetaTokenVault: async () => current,
        claimMetaTokenRefresh: async () => lock(),
        claimMetaTokenRefreshAttempt: async () => attempts(),
        getMetaTokenRefreshAttemptStatus: async () => "failed",
        releaseMetaTokenRefresh: async () => { events.releases += 1; },
        saveMetaTokenVault: async (value) => { events.saves += 1; await saved(value); },
        updateMetaTokenRefreshAttempt: async (_expiresAt, status) => { events.updates.push(status); },
      },
      "@/lib/meta-oauth": {
        refreshMetaOAuthConnection: async (value) => {
          events.calls += 1;
          return refresh(value);
        },
      },
    },
  };
}

const currentVault = {
  userAccessToken: "old-user-token",
  userTokenExpiresAt: 2_000_000_100,
  facebookPageId: "1234567890123456",
  facebookPageAccessToken: "old-page-token",
  instagramBusinessAccountId: "1234567890",
  instagramAccessToken: "old-page-token",
};

test("expired or revoked Meta user tokens require admin reauthorization without a renewal call", async (t) => {
  const previous = Object.fromEntries(["META_TOKEN_VAULT_ENABLED", "META_APP_ID", "META_APP_SECRET"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { META_TOKEN_VAULT_ENABLED: "true", META_APP_ID: "app", META_APP_SECRET: "secret" });
  const setup = refreshMocks({ current: { ...currentVault, userTokenExpiresAt: 1_999_999_999 }, lock: async () => "lock", refresh: async () => { throw new Error("must not refresh"); }, saved: async () => {}, attempts: async () => true, currentStatus: "expired" });
  const refreshModule = loadRefreshModule(setup.mocks);
  const result = await refreshModule.refreshMetaTokenVaultIfNeeded(2_000_000_000);
  assert.equal(result.status, "reauthorization_required");
  assert.equal(result.manualReauthorizationRequired, true);
  assert.equal(setup.events.calls, 0);
});

test("concurrent daily checks perform at most one Meta token refresh", async (t) => {
  const previous = Object.fromEntries(["META_TOKEN_VAULT_ENABLED", "META_APP_ID", "META_APP_SECRET"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { META_TOKEN_VAULT_ENABLED: "true", META_APP_ID: "app", META_APP_SECRET: "secret" });
  let isLocked = false;
  let finishRefresh;
  const refreshGate = new Promise((resolve) => { finishRefresh = resolve; });
  const setup = refreshMocks({
    current: currentVault,
    lock: async () => { if (isLocked) return null; isLocked = true; return "lock-owner"; },
    refresh: async () => { await refreshGate; return { ...currentVault, userAccessToken: "new-user-token" }; },
    saved: async () => {},
    attempts: async () => true,
  });
  setup.mocks["@/lib/meta-token-vault"].releaseMetaTokenRefresh = async () => { isLocked = false; setup.events.releases += 1; };
  const refreshModule = loadRefreshModule(setup.mocks);
  const first = refreshModule.refreshMetaTokenVaultIfNeeded(2_000_000_000);
  await new Promise((resolve) => setImmediate(resolve));
  const concurrent = await refreshModule.refreshMetaTokenVaultIfNeeded(2_000_000_000);
  finishRefresh();
  const firstResult = await first;
  assert.equal(concurrent.status, "in_progress");
  assert.equal(firstResult.status, "succeeded");
  assert.equal(setup.events.calls, 1);
  assert.equal(setup.events.saves, 1);
  assert.deepEqual(setup.events.updates, ["succeeded"]);
});

test("failed refresh preserves the existing vault and records a reauthorization requirement", async (t) => {
  const previous = Object.fromEntries(["META_TOKEN_VAULT_ENABLED", "META_APP_ID", "META_APP_SECRET"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { META_TOKEN_VAULT_ENABLED: "true", META_APP_ID: "app", META_APP_SECRET: "secret" });
  const setup = refreshMocks({
    current: currentVault,
    lock: async () => "lock-owner",
    refresh: async () => { throw new Error("private refresh failure"); },
    saved: async () => {},
    attempts: async () => true,
  });
  const refreshModule = loadRefreshModule(setup.mocks);
  const result = await refreshModule.refreshMetaTokenVaultIfNeeded(2_000_000_000);
  assert.equal(result.status, "reauthorization_required");
  assert.equal(setup.events.saves, 0);
  assert.deepEqual(setup.events.updates, ["failed"]);
  assert.equal(currentVault.userAccessToken, "old-user-token");
  assert.equal(setup.events.releases, 1);
});
