const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = readFileSync(resolve(__dirname, "../src/app/api/test-publish/route.ts"), "utf8");
const channels = require("../src/channels.config.json");

function loadRoute(statuses, calls) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    "@/channels.config.json": { default: channels },
    "@/lib/marketing-auth": { isCronBearerAuthorized: () => true },
    "@/lib/facebook-credentials": { getFacebookCredentialError: () => null },
    "@/lib/meta-token-health": { getMetaTokenHealth: async (name) => ({ status: statuses[name], expiresAt: null }), isMetaTokenPublishAllowed: (status) => status === "valid" || status === "expiring" },
    "@/lib/channels/facebook": { publishToFacebook: async () => { calls.push("facebook"); return { success: true, postId: "fake" }; } },
    "@/lib/channels/instagram": { publishToInstagram: async () => { calls.push("instagram"); return { success: true, postId: "fake" }; } },
    "@/lib/channels/threads": { publishToThreads: async () => ({ success: true, postId: "fake" }) },
    "@/lib/channels/linkedin": { publishToLinkedIn: async () => ({ success: true, postId: "fake" }) },
  };
  vm.runInNewContext(compiled, { exports: mod.exports, module: mod, process, fetch: async () => { throw new Error("unexpected network"); }, require: (id) => mocks[id] });
  return mod.exports;
}

test("test-publish blocks all Meta health states that are not confirmed publishable", async () => {
  const names = ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    Object.assign(process.env, { FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "local-fake", INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890", INSTAGRAM_ACCESS_TOKEN: "local-fake" });
    for (const status of ["invalid", "expired", "unknown", "unavailable", "not_configured"]) {
      const calls = [];
      const route = loadRoute({ facebook: status, instagram: status }, calls);
      const response = await route.POST(new Request("https://factory.example/api/test-publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channels: ["facebook", "instagram"] }) }));
      assert.equal(response.status, 200);
      assert.equal(response.body.results.every((result) => result.success === false), true);
      assert.deepEqual(calls, [], `${status} must not call Meta publishers`);
    }
  } finally {
    for (const name of names) old[name] === undefined ? delete process.env[name] : process.env[name] = old[name];
  }
});
