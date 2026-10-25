const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const routeSource = readFileSync(resolve(__dirname, "../src/app/api/publish-all/route.ts"), "utf8");
const channelsConfig = require("../src/channels.config.json");

function makeRoute({ fetchMock, database, providerCalls, metaStatus = "valid" }) {
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const routeModule = { exports: {} };
  const mocks = {
    "next/server": {
      NextResponse: { json: (body, init = {}) => ({
        body,
        status: init.status || 200,
        clone: () => ({ json: async () => body }),
      }) },
    },
    "@supabase/supabase-js": { createClient: () => database },
    "@/channels.config.json": { default: channelsConfig },
    "@/lib/facebook-credentials": { getFacebookCredentialError: () => null },
    "@/lib/meta-credentials": { getInstagramBusinessAccountId: () => process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID || null },
    "@/lib/meta-token-vault": {
      getMetaPublishCredentials: async (channel) => channel === "facebook"
        ? { id: process.env.FACEBOOK_PAGE_ID, accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN }
        : { id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID, accessToken: process.env.INSTAGRAM_ACCESS_TOKEN },
    },
    "@/lib/meta-token-health": {
      getMetaTokenHealth: async () => ({ status: metaStatus, expiresAt: null }),
      isMetaTokenPublishAllowed: (status) => ["valid", "expiring", "unavailable"].includes(status),
    },
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

test("publish-all dryRun permits configured Meta channels during transient health outages", async (t) => {
  const envNames = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"];
  const old = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => envNames.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "local-test-key", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "local-fake", INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890", INSTAGRAM_ACCESS_TOKEN: "local-fake" });
  const product = { id: "health-preview", title_en: "Preview", title_ar: null, description_en: "Description", description_ar: null, price: 10, category: "test", cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/a.jpg" };
  const database = { writes: [], from(table) {
    const query = { select() { return this; }, eq() { return this; }, limit() { return this; }, insert() { database.writes.push("insert"); return this; }, update() { database.writes.push("update"); return this; }, then(resolve, reject) { return Promise.resolve({ data: table === "products" ? [product] : [], error: null }).then(resolve, reject); } };
    return query;
  } };
  const providerCalls = { count: 0 };
  const route = makeRoute({ fetchMock: async () => ({ ok: true, headers: { get: () => "image/jpeg" } }), database, providerCalls, metaStatus: "unavailable" });
  const request = new Request("https://factory.example/api/publish-all?dry_run=true", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });

  const response = await route.GET(request);
  assert.equal(response.status, 200);
  assert.equal(response.body.externalPostsCreated, false);
  assert.equal(response.body.channels.find(({ channel }) => channel === "facebook").status, "would_publish");
  assert.equal(response.body.channels.find(({ channel }) => channel === "instagram").status, "would_publish");
  assert.deepEqual(database.writes, []);
  assert.equal(providerCalls.count, 0);
});

test("publish-all never invokes Meta publishers for rejected health states", async (t) => {
  const envNames = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"];
  const old = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => envNames.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "local-test-key", TELEGRAM_BOT_TOKEN: "test-telegram-token", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "local-fake", INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890", INSTAGRAM_ACCESS_TOKEN: "local-fake" });
  const product = { id: "health-gate", title_en: "Test product", title_ar: null, description_en: "Description", description_ar: null, price: 10, category: "test", cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/a.jpg" };
  for (const metaStatus of ["invalid", "expired", "unknown", "not_configured"]) {
    const database = { writes: [], from(table) {
      const query = { table, row: null, values: null, select() { return this; }, eq() { return this; }, limit() { return this; }, insert(row) { this.row = row; database.writes.push({ table, operation: "insert" }); return this; }, update(values) { this.values = values; database.writes.push({ table, operation: "update" }); return this; }, single: async () => ({ data: { id: "campaign-local" }, error: null }), then(resolve, reject) { return Promise.resolve({ data: table === "products" ? [product] : null, error: null }).then(resolve, reject); } };
      return query;
    } };
    const calls = { count: 0 };
    const fetchMock = async (url, init = {}) => String(url).startsWith("https://api.telegram.org/")
      ? { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 771 } }) }
      : { ok: true, headers: { get: () => init.method === "HEAD" ? "image/jpeg" : null } };
    const route = makeRoute({ fetchMock, database, providerCalls: calls, metaStatus });
    const request = new Request("https://factory.example/api/publish-all", { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ bookId: product.id }) });
    Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
    const response = await route.POST(request);
    assert.equal(response.status, 200, `${metaStatus} should complete safely without publishing Meta`);
    assert.equal(calls.count, 0, `${metaStatus} must prevent all providers from being invoked`);
    assert.equal(response.body.results.find(({ channel }) => channel === "telegram").success, true);
  }
});

test("publish-all daily lock serializes repeated and concurrent invocations while retrying other products", async (t) => {
  const names = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN", "META_TOKEN_VAULT_ENABLED"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  Object.assign(process.env, {
    CRON_SECRET: "c".repeat(32),
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "local-test-key",
    TELEGRAM_BOT_TOKEN: "test-telegram-token",
    FACEBOOK_PAGE_ID: "1234567890123456",
    FACEBOOK_PAGE_ACCESS_TOKEN: "test-facebook-token",
    INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890",
    INSTAGRAM_ACCESS_TOKEN: "test-instagram-token",
  });
  delete process.env.META_TOKEN_VAULT_ENABLED;

  const products = [
    { id: "stuck-product", title_en: "Stuck", title_ar: null, description_en: "Existing campaign", description_ar: null, price: 10, cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/stuck.jpg" },
    { id: "fresh-product", title_en: "Fresh", title_ar: null, description_en: "New product", description_ar: null, price: 12, cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/fresh.jpg" },
  ];
  const campaigns = [{
    id: "stuck-campaign",
    product_id: "stuck-product",
    status: "active",
    metadata: {
      auto_publish: true,
      attempts: 1,
      required_channels: ["telegram", "facebook", "instagram"],
      channel_results: {
        telegram: { success: true, externalId: "telegram-existing" },
        facebook: { success: true, externalId: "facebook-existing" },
        instagram: { success: false, error: "expired" },
      },
    },
  }];
  const lockedDates = new Set();
  let nextCampaignId = 1;
  let telegramPosts = 0;
  const database = {
    writes: [],
    rpc: async (_name, args) => {
      if (lockedDates.has(args.p_run_date)) return { data: false, error: null };
      lockedDates.add(args.p_run_date);
      return { data: true, error: null };
    },
    from(table) {
      const query = { operation: "select", values: null, row: null, filters: {}, statuses: [] };
      query.select = () => query;
      query.eq = (name, value) => { query.filters[name] = value; return query; };
      query.gte = () => query;
      query.in = (_name, values) => { query.statuses = values; return query; };
      query.order = () => query;
      query.limit = () => query;
      query.insert = (row) => {
        query.operation = "insert";
        query.row = { ...row, id: `new-campaign-${nextCampaignId++}` };
        database.writes.push({ table, operation: "insert" });
        campaigns.push(query.row);
        return query;
      };
      query.update = (values) => { query.operation = "update"; query.values = values; return query; };
      query.single = async () => ({ data: { id: query.row.id }, error: null });
      query.then = (resolve, reject) => {
        if (query.operation === "update") {
          database.writes.push({ table, operation: "update" });
          if (table === "marketing_campaigns") {
            const campaign = campaigns.find(({ id }) => id === query.filters.id);
            if (campaign) Object.assign(campaign, query.values);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        const data = table === "products" ? products : campaigns.filter((campaign) => query.statuses.includes(campaign.status));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return query;
    },
  };
  const fetchMock = async (url, init = {}) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      telegramPosts += 1;
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 998 } }) };
    }
    return { ok: true, headers: { get: () => init.method === "HEAD" ? "image/jpeg" : null } };
  };
  const providerCalls = { count: 0 };
  const route = makeRoute({ fetchMock, database, providerCalls, metaStatus: "invalid" });
  const makeRequest = () => {
    const request = new Request("https://factory.example/api/publish-all?auto=true", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
    return request;
  };
  const responses = await Promise.all([route.POST(makeRequest()), route.POST(makeRequest())]);
  assert.equal(responses.filter(({ body }) => body.skipped === true).length, 1);
  assert.equal(telegramPosts, 1);
  assert.equal(providerCalls.count, 0);
  assert.equal(campaigns.length, 2);
  const newCampaign = campaigns.find(({ id }) => id !== "stuck-campaign");
  assert.equal(newCampaign.product_id, "fresh-product");
  assert.equal(newCampaign.metadata.attempts, 1);
  assert.equal(newCampaign.metadata.channel_results.telegram.success, true);
  assert.equal(newCampaign.metadata.channel_results.facebook.status, "not_configured");
  assert.equal(newCampaign.metadata.channel_results.instagram.status, "not_configured");
  const repeated = await route.POST(makeRequest());
  assert.equal(repeated.body.skipped, true);
  assert.equal(telegramPosts, 1);
});

test("publish-all does not create a campaign or consume an attempt when no channel is ready", async (t) => {
  const names = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key" });
  for (const name of ["TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"]) delete process.env[name];
  const product = { id: "not-ready", title_en: "Not ready", title_ar: null, description_en: "Product", description_ar: null, price: 9, cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/a.jpg" };
  const database = {
    campaignsCreated: 0,
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      const query = { operation: "select", update() { query.operation = "update"; return query; }, insert() { database.campaignsCreated += 1; query.operation = "insert"; return query; }, select() { return query; }, eq() { return query; }, gte() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; }, then(resolve, reject) { return Promise.resolve({ data: table === "products" ? [product] : [], error: null }).then(resolve, reject); } };
      return query;
    },
  };
  const route = makeRoute({ fetchMock: async () => ({ ok: true, headers: { get: () => "image/jpeg" } }), database, providerCalls: { count: 0 }, metaStatus: "invalid" });
  const request = new Request("https://factory.example/api/publish-all?auto=true", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
  const response = await route.GET(request);
  assert.equal(response.status, 503);
  assert.equal(response.body.publicationAttempted, false);
  assert.equal(response.body.channels.length, 3);
  assert.equal(database.campaignsCreated, 0);
});
