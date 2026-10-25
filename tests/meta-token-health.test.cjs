const { test } = require("node:test");
const assert = require("node:assert/strict");

const modulePromise = import("../src/lib/meta-token-health.ts");

test("Meta token debugging classifies a valid token without exposing its value", async () => {
  const { debugMetaToken } = await modulePromise;
  const secret = "test-token-that-must-not-leak";
  let calledUrl;
  const result = await debugMetaToken(secret, "app-id", "app-secret", ["pages_manage_posts"], async (url) => {
    calledUrl = String(url);
    return Response.json({ data: { app_id: "app-id", is_valid: true, expires_at: 0, data_access_expires_at: 0, scopes: ["pages_manage_posts"] } });
  }, 1000);
  assert.equal(result.status, "valid");
  assert.equal(result.expiresAt, null);
  assert.match(calledUrl, /debug_token/);
  assert.ok(calledUrl.includes(encodeURIComponent(secret)));
});

test("Meta rejects invalid tokens and missing publishing permissions", async () => {
  const { debugMetaToken } = await modulePromise;
  const invalid = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: { is_valid: false } }));
  const missingScope = await debugMetaToken("fake", "id", "secret", ["pages_manage_posts"], async () => Response.json({ data: { app_id: "id", is_valid: true, expires_at: 0, data_access_expires_at: 0, scopes: [] } }));
  assert.equal(invalid.status, "invalid");
  assert.equal(missingScope.status, "invalid");
});

test("Meta reports a token expiring within seven days", async () => {
  const { debugMetaToken } = await modulePromise;
  const result = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: { app_id: "id", is_valid: true, expires_at: 1500, data_access_expires_at: 0, scopes: [] } }), 1000);
  assert.equal(result.status, "expiring");
});

test("Meta distinguishes expired tokens from invalid tokens and unknown responses", async () => {
  const { debugMetaToken, isMetaTokenPublishAllowed } = await modulePromise;
  const expired = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: { app_id: "id", is_valid: true, expires_at: 900, data_access_expires_at: 0, scopes: [] } }), 1000);
  const unknown = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: {} }));
  const wrongApp = await debugMetaToken("fake", "expected-app", "secret", [], async () => Response.json({ data: { is_valid: true, app_id: "other-app" } }));
  assert.equal(expired.status, "expired");
  assert.equal(unknown.status, "unknown");
  assert.equal(wrongApp.status, "invalid");
  assert.equal(isMetaTokenPublishAllowed("unavailable"), true);
  assert.equal(isMetaTokenPublishAllowed("unknown"), false);
  assert.equal(isMetaTokenPublishAllowed("expired"), false);
  assert.equal(isMetaTokenPublishAllowed("not_configured"), false);
  assert.equal(isMetaTokenPublishAllowed("invalid"), false);
  assert.equal(isMetaTokenPublishAllowed("expiring"), true);
  assert.equal(isMetaTokenPublishAllowed("valid"), true);
});

test("Meta outages are unavailable and absent app settings are not configured", async (t) => {
  const { debugMetaToken, getMetaTokenHealth } = await modulePromise;
  const unavailable = await debugMetaToken("fake", "id", "secret", [], async () => { throw new TypeError("network down"); });
  assert.equal(unavailable.status, "unavailable");
  const names = ["META_APP_ID", "META_APP_SECRET", "FACEBOOK_PAGE_ACCESS_TOKEN"];
  const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => prior[name] === undefined ? delete process.env[name] : process.env[name] = prior[name]));
  names.forEach((name) => delete process.env[name]);
  assert.equal((await getMetaTokenHealth("facebook")).status, "not_configured");
});

test("Meta health requires both expiry fields and classifies only clear transient HTTP failures as unavailable", async () => {
  const { debugMetaToken } = await modulePromise;
  const missingExpiry = await debugMetaToken("fake", "id", "secret", [], async () =>
    Response.json({ data: { app_id: "id", is_valid: true, expires_at: 0, scopes: [] } }));
  const expiredDataAccess = await debugMetaToken("fake", "id", "secret", [], async () =>
    Response.json({ data: { app_id: "id", is_valid: true, expires_at: 0, data_access_expires_at: 900, scopes: [] } }), 1000);
  const rateLimited = await debugMetaToken("fake", "id", "secret", [], async () =>
    new Response(JSON.stringify({}), { status: 429 }));
  const serverError = await debugMetaToken("fake", "id", "secret", [], async () =>
    new Response(JSON.stringify({}), { status: 503 }));
  const clientError = await debugMetaToken("fake", "id", "secret", [], async () =>
    new Response(JSON.stringify({}), { status: 400 }));
  assert.equal(missingExpiry.status, "unknown");
  assert.equal(expiredDataAccess.status, "expired");
  assert.equal(rateLimited.status, "unavailable");
  assert.equal(serverError.status, "unavailable");
  assert.equal(clientError.status, "unknown");
});

test("alert dedupe state resets only on confirmed valid recovery", async () => {
  const { shouldResetMetaTokenAlert } = await modulePromise;
  const transition = (states) => {
    let alertOutstanding = false;
    const alerts = [];
    for (const status of states) {
      if (shouldResetMetaTokenAlert(status)) alertOutstanding = false;
      else if (["invalid", "expired", "expiring"].includes(status) && !alertOutstanding) {
        alertOutstanding = true;
        alerts.push(status);
      }
    }
    return alerts;
  };
  assert.deepEqual(transition(["invalid", "unavailable", "invalid"]), ["invalid"]);
  assert.deepEqual(transition(["expired", "unknown", "expired"]), ["expired"]);
  assert.deepEqual(transition(["invalid", "valid", "invalid"]), ["invalid", "invalid"]);
});

test("Supabase alert RPC is schema-qualified and least-privilege", () => {
  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const sql = readFileSync(resolve(__dirname, "../supabase/migrations/202610220001_meta_token_health_alerts.sql"), "utf8").toLowerCase();
  assert.match(sql, /security\s+definer[\s\S]*set\s+search_path\s*=\s*''/);
  assert.match(sql, /insert\s+into\s+public\.meta_token_health_alerts\s+as\s+existing_alert/);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.meta_token_health_alerts\s+from\s+public,\s*anon,\s*authenticated/);
  assert.match(sql, /grant\s+delete\s+on\s+table\s+public\.meta_token_health_alerts\s+to\s+service_role/);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.claim_meta_token_health_alert\(text, text, date\)\s+from\s+public,\s*anon,\s*authenticated/);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.claim_meta_token_health_alert\(text, text, date\)\s+to\s+service_role/);
  assert.match(sql, /alter\s+table\s+public\.meta_token_health_alerts\s+enable\s+row\s+level\s+security/);
});

test("Meta health route authenticates before invoking the check", async () => {
  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const vm = require("node:vm");
  const ts = require("typescript");
  const source = readFileSync(resolve(__dirname, "../src/app/api/cron/meta-token-health/route.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let checks = 0;
  const routeModule = { exports: {} };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    "@/lib/marketing-auth": { isCronBearerAuthorized: (request) => request.headers.get("authorization") === "Bearer allowed" },
    "@/lib/meta-token-health": {
      checkMetaTokenHealth: async () => {
        checks += 1;
        return {
          facebook: { status: "valid" },
          instagram: { status: "invalid" },
          renewal: { status: "disabled", manualReauthorizationRequired: false },
          alerts: { configured: false, sent: 0, failed: false },
        };
      },
    },
  };
  vm.runInNewContext(compiled, { exports: routeModule.exports, module: routeModule, require: (id) => mocks[id] });
  const unauthorized = await routeModule.exports.GET(new Request("https://factory.example/api/cron/meta-token-health"));
  assert.equal(unauthorized.status, 401);
  assert.equal(checks, 0);
  const authorized = await routeModule.exports.GET(new Request("https://factory.example/api/cron/meta-token-health", { headers: { authorization: "Bearer allowed" } }));
  assert.equal(authorized.status, 503);
  assert.equal(authorized.body.success, false);
  assert.equal(authorized.body.tokens.facebook, "valid");
  assert.equal(authorized.body.tokens.instagram, "invalid");
  assert.equal(authorized.body.alerts.status, "not_configured");
  assert.equal(checks, 1);
});

test("Meta health alerts report missing delivery setup, deduplicate, and expose send failures safely", async (t) => {
  const names = ["RESEND_FROM_EMAIL", "RESEND_API_KEY", "META_TOKEN_ALERT_EMAIL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  Object.assign(process.env, {
    RESEND_FROM_EMAIL: "alerts@example.invalid",
    RESEND_API_KEY: "test-mail-key",
    META_TOKEN_ALERT_EMAIL: "admin@example.invalid",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  });

  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const vm = require("node:vm");
  const ts = require("typescript");
  const source = readFileSync(resolve(__dirname, "../src/lib/meta-token-health.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let shouldFail = false;
  let claimCount = 0;
  const emails = [];
  const database = {
    from() {
      const query = { delete() { return query; }, eq() { return query; }, then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); } };
      return query;
    },
    rpc: async () => ({ data: ++claimCount <= 2, error: null }),
  };
  const module = { exports: {} };
  const mocks = {
    resend: { Resend: class { constructor() { this.emails = { send: async (message) => { emails.push(message); return shouldFail ? { error: new Error("mailer unavailable") } : { error: null }; } }; } } },
    "@supabase/supabase-js": { createClient: () => database },
    "./meta-token-vault.ts": { getMetaPublishCredentials: async () => null },
    "./meta-token-refresh.ts": { refreshMetaTokenVaultIfNeeded: async () => ({ status: "disabled", manualReauthorizationRequired: false, alertRequired: false }) },
  };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    process,
    Buffer,
    URL,
    URLSearchParams,
    AbortSignal,
    Date,
    Math,
    JSON,
    Number,
    Array,
    String,
    Object,
    Set,
    Promise,
    fetch,
    require: (id) => mocks[id],
  });
  const health = { facebook: { status: "not_configured" }, instagram: { status: "unavailable" } };
  const { sendMetaTokenAlerts } = module.exports;
  const first = await sendMetaTokenAlerts(health, new Date("2026-10-25T00:00:00Z"));
  const duplicate = await sendMetaTokenAlerts(health, new Date("2026-10-25T00:00:00Z"));
  assert.equal(JSON.stringify(first), JSON.stringify({ configured: true, sent: 2, failed: false }));
  assert.equal(JSON.stringify(duplicate), JSON.stringify({ configured: true, sent: 0, failed: false }));
  assert.equal(emails.length, 2);
  assert.ok(emails.every((email) => !JSON.stringify(email).includes("test-service-role")));

  shouldFail = true;
  claimCount = 0;
  const failed = await sendMetaTokenAlerts(health, new Date("2026-10-26T00:00:00Z"));
  assert.equal(failed.configured, true);
  assert.equal(failed.failed, true);
  delete process.env.RESEND_API_KEY;
  const notConfigured = await sendMetaTokenAlerts(health);
  assert.equal(JSON.stringify(notConfigured), JSON.stringify({ configured: false, sent: 0, failed: false }));
});
