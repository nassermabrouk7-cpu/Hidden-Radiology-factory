const { test } = require("node:test");
const assert = require("node:assert/strict");

const modulePromise = import("../src/lib/meta-token-health.ts");

test("Meta token debugging classifies a valid token without exposing its value", async () => {
  const { debugMetaToken } = await modulePromise;
  const secret = "test-token-that-must-not-leak";
  let calledUrl;
  const result = await debugMetaToken(secret, "app-id", "app-secret", ["pages_manage_posts"], async (url) => {
    calledUrl = String(url);
    return Response.json({ data: { app_id: "app-id", is_valid: true, expires_at: 0, scopes: ["pages_manage_posts"] } });
  }, 1000);
  assert.equal(result.status, "valid");
  assert.equal(result.expiresAt, null);
  assert.match(calledUrl, /debug_token/);
  assert.ok(calledUrl.includes(encodeURIComponent(secret)));
});

test("Meta rejects invalid tokens and missing publishing permissions", async () => {
  const { debugMetaToken } = await modulePromise;
  const invalid = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: { is_valid: false } }));
  const missingScope = await debugMetaToken("fake", "id", "secret", ["pages_manage_posts"], async () => Response.json({ data: { app_id: "id", is_valid: true, scopes: [] } }));
  assert.equal(invalid.status, "invalid");
  assert.equal(missingScope.status, "invalid");
});

test("Meta reports a token expiring within seven days", async () => {
  const { debugMetaToken } = await modulePromise;
  const result = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: { app_id: "id", is_valid: true, expires_at: 1500 } }), 1000);
  assert.equal(result.status, "expiring");
});

test("Meta distinguishes expired tokens from invalid tokens and unknown responses", async () => {
  const { debugMetaToken, isMetaTokenPublishAllowed } = await modulePromise;
  const expired = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: { app_id: "id", is_valid: true, expires_at: 900 } }), 1000);
  const unknown = await debugMetaToken("fake", "id", "secret", [], async () => Response.json({ data: {} }));
  const wrongApp = await debugMetaToken("fake", "expected-app", "secret", [], async () => Response.json({ data: { is_valid: true, app_id: "other-app" } }));
  assert.equal(expired.status, "expired");
  assert.equal(unknown.status, "unknown");
  assert.equal(wrongApp.status, "invalid");
  assert.equal(isMetaTokenPublishAllowed("unavailable"), false);
  assert.equal(isMetaTokenPublishAllowed("unknown"), false);
  assert.equal(isMetaTokenPublishAllowed("expired"), false);
  assert.equal(isMetaTokenPublishAllowed("not_configured"), false);
  assert.equal(isMetaTokenPublishAllowed("invalid"), false);
  assert.equal(isMetaTokenPublishAllowed("expiring"), true);
  assert.equal(isMetaTokenPublishAllowed("valid"), true);
});

test("Meta outages are unavailable and absent app settings are not configured", async (t) => {
  const { debugMetaToken, getMetaTokenHealth } = await modulePromise;
  const unavailable = await debugMetaToken("fake", "id", "secret", [], async () => { throw new Error("network down"); });
  assert.equal(unavailable.status, "unavailable");
  const names = ["META_APP_ID", "META_APP_SECRET", "FACEBOOK_PAGE_ACCESS_TOKEN"];
  const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => prior[name] === undefined ? delete process.env[name] : process.env[name] = prior[name]));
  names.forEach((name) => delete process.env[name]);
  assert.equal((await getMetaTokenHealth("facebook")).status, "not_configured");
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
    "@/lib/meta-token-health": { checkMetaTokenHealth: async () => { checks += 1; return { facebook: { status: "valid" }, instagram: { status: "invalid" } }; } },
  };
  vm.runInNewContext(compiled, { exports: routeModule.exports, module: routeModule, require: (id) => mocks[id] });
  const unauthorized = await routeModule.exports.GET(new Request("https://factory.example/api/cron/meta-token-health"));
  assert.equal(unauthorized.status, 401);
  assert.equal(checks, 0);
  const authorized = await routeModule.exports.GET(new Request("https://factory.example/api/cron/meta-token-health", { headers: { authorization: "Bearer allowed" } }));
  assert.equal(authorized.body.tokens.facebook, "valid");
  assert.equal(authorized.body.tokens.instagram, "invalid");
  assert.equal(checks, 1);
});
