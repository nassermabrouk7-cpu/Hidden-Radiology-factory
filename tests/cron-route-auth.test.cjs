const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const routeSource = readFileSync(resolve(__dirname, "../src/app/api/cron/route.ts"), "utf8");

async function runCronRoute(request) {
  const calls = { generateBookDraft: 0, medicalAccuracyGate: 0, qualityGate: 0 };
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const routeModule = { exports: {} };
  const isCronBearerAuthorized = (await import("../src/lib/marketing-auth.ts")).isCronBearerAuthorized;
  const mocks = {
    "next/server": {
      NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) },
    },
    "@/lib/maestro/config": { MAESTRO_CONFIG: { requireHumanApproval: true } },
    "@/lib/maestro/gates": {
      medicalAccuracyGate: async () => { calls.medicalAccuracyGate += 1; return { passed: true, score: 100 }; },
      qualityGate: async () => { calls.qualityGate += 1; return { passed: true, score: 100 }; },
    },
    "@/lib/marketing-auth": { isCronBearerAuthorized },
    "@/lib/book-ai": {
      generateBookDraft: async () => { calls.generateBookDraft += 1; return "draft"; },
    },
  };
  const context = {
    exports: routeModule.exports,
    module: routeModule,
    process,
    URL,
    Date,
    Math,
    require(id) {
      if (!(id in mocks)) throw new Error(`Unexpected route dependency: ${id}`);
      return mocks[id];
    },
  };
  vm.runInNewContext(compiled, context, { filename: "cron-route.cjs" });
  return { response: await routeModule.exports.GET(request), calls };
}

test("cron route rejects requests when CRON_SECRET is missing without generating a book", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
  delete process.env.CRON_SECRET;

  const { response, calls } = await runCronRoute(new Request("https://factory.example/api/cron?key=HRF2026_SECRET"));
  assert.equal(response.status, 401);
  assert.deepEqual(calls, { generateBookDraft: 0, medicalAccuracyGate: 0, qualityGate: 0 });
});

test("cron route rejects a short CRON_SECRET without generating a book", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
  process.env.CRON_SECRET = "too-short";

  const { response, calls } = await runCronRoute(new Request("https://factory.example/api/cron", {
    headers: { Authorization: "Bearer too-short" },
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(calls, { generateBookDraft: 0, medicalAccuracyGate: 0, qualityGate: 0 });
});

test("cron route rejects an incorrect bearer token without generating a book", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
  process.env.CRON_SECRET = "c".repeat(32);

  const { response, calls } = await runCronRoute(new Request("https://factory.example/api/cron", {
    headers: { Authorization: `Bearer ${"x".repeat(32)}` },
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(calls, { generateBookDraft: 0, medicalAccuracyGate: 0, qualityGate: 0 });
});

test("cron route never accepts a query-string key", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
  process.env.CRON_SECRET = "c".repeat(32);

  const { response, calls } = await runCronRoute(new Request(`https://factory.example/api/cron?key=${process.env.CRON_SECRET}`));
  assert.equal(response.status, 401);
  assert.deepEqual(calls, { generateBookDraft: 0, medicalAccuracyGate: 0, qualityGate: 0 });
});

test("cron route accepts the configured bearer token and continues to book generation", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });
  process.env.CRON_SECRET = "c".repeat(32);

  const { response, calls } = await runCronRoute(new Request("https://factory.example/api/cron", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "pending_human_approval");
  assert.deepEqual(calls, { generateBookDraft: 1, medicalAccuracyGate: 1, qualityGate: 1 });
});
