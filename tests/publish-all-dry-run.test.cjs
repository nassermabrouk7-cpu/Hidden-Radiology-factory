const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const routeSource = readFileSync(resolve(__dirname, "../src/app/api/publish-all/route.ts"), "utf8");
const channelsConfig = require("../src/channels.config.json");

function makeRoute({ fetchMock, database, providerCalls }) {
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const routeModule = { exports: {} };
  const mocks = {
    "next/server": {
      NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) },
    },
    "@supabase/supabase-js": { createClient: () => database },
    "@/channels.config.json": { default: channelsConfig },
    "@/lib/facebook-credentials": { getFacebookCredentialError: () => null },
    "@/lib/channels/facebook": { publishToFacebook: async () => { providerCalls.count += 1; throw new Error("unexpected provider call"); } },
    "@/lib/channels/instagram": { publishToInstagram: async () => { providerCalls.count += 1; throw new Error("unexpected provider call"); } },
    "@/lib/channels/linkedin": { publishToLinkedIn: async () => { providerCalls.count += 1; throw new Error("unexpected provider call"); } },
    "@/lib/channels/threads": { publishToThreads: async () => { providerCalls.count += 1; throw new Error("unexpected provider call"); } },
    "@/lib/marketing-auth": { isCronBearerAuthorized: (request) => request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` },
    "@/lib/marketing-media": { getTrustedProductCoverUrl: (url) => url },
    "@/lib/product-publishing": require("../src/lib/product-publishing.ts"),
  };
  const context = {
    exports: routeModule.exports,
    module: routeModule,
    process,
    URL,
    AbortSignal,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    encodeURIComponent,
    fetch: fetchMock,
    require(id) {
      if (!(id in mocks)) throw new Error(`Unexpected route dependency: ${id}`);
      return mocks[id];
    },
  };
  vm.runInNewContext(compiled, context, { filename: "publish-all-route.cjs" });
  return routeModule.exports;
}

test("publish-all dryRun authenticates, previews enabled channels, and creates no campaign or provider post", async (t) => {
  const envNames = [
    "CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN",
    "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN",
  ];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  });

  Object.assign(process.env, {
    CRON_SECRET: "c".repeat(32),
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "local-test-service-key",
    TELEGRAM_BOT_TOKEN: "local-test-telegram-token",
    FACEBOOK_PAGE_ID: "1234567890123456",
    FACEBOOK_PAGE_ACCESS_TOKEN: "local-test-facebook-token",
    INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890",
    INSTAGRAM_ACCESS_TOKEN: "local-test-instagram-token",
  });

  const product = {
    id: "dry-run-product",
    title_ar: "مرجع أشعة تجريبي",
    title_en: "Dry Run Radiology Reference",
    description_ar: "وصف تجريبي",
    description_en: "Dry run description",
    price: 12.5,
    category: "Radiology",
    cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/dry-run.jpg",
  };
  const database = {
    writes: [],
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        limit() { return this; },
        insert() { database.writes.push({ table, operation: "insert" }); return this; },
        update() { database.writes.push({ table, operation: "update" }); return this; },
        then(resolve, reject) {
          return Promise.resolve({ data: table === "products" ? [product] : [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const fetchCalls = [];
  const fetchMock = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), method: init.method || "GET" });
    return { ok: true, headers: { get: () => "image/jpeg" } };
  };
  const providerCalls = { count: 0 };
  const route = makeRoute({ fetchMock, database, providerCalls });

  const unauthorizedRequest = new Request("https://factory.example/api/publish-all", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dryRun: true, bookId: product.id }),
  });
  Object.defineProperty(unauthorizedRequest, "nextUrl", { value: new URL(unauthorizedRequest.url) });
  assert.equal((await route.POST(unauthorizedRequest)).status, 401);
  assert.deepEqual(database.writes, []);
  assert.equal(fetchCalls.length, 0);

  const request = new Request("https://factory.example/api/publish-all", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ dryRun: true, bookId: product.id }),
  });
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
  const response = await route.POST(request);

  assert.equal(response.status, 200, response.body.error || "Dry-run request did not succeed.");
  assert.equal(response.body.dryRun, true);
  assert.equal(response.body.externalPostsCreated, false);
  assert.equal(response.body.campaignId, null);
  assert.deepEqual(database.writes, []);
  assert.equal(providerCalls.count, 0);
  assert.ok(response.body.channels.length > 0);
  assert.ok(response.body.channels.every(({ status }) => status === "would_publish"));
  assert.ok(fetchCalls.every(({ method }) => method === "HEAD"));
  assert.ok(fetchCalls.every(({ url }) => url === product.cover_url));
});
