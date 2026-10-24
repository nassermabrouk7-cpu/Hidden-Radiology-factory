const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const routeSource = readFileSync(resolve(__dirname, "../src/app/api/publish-one/route.ts"), "utf8");
const channelsConfig = require("../src/channels.config.json");

function makeDatabase(product, priorCampaigns = []) {
  const db = { reads: [], writes: [], campaigns: [...priorCampaigns], nextId: 1 };
  db.from = (table) => {
    const query = { table, operation: "select", row: null, updateValues: null, filters: {} };
    query.select = () => query;
    query.eq = (column, value) => { query.filters[column] = value; return query; };
    query.contains = (column, value) => { query.containsValue = { column, value }; return query; };
    query.limit = () => query;
    query.maybeSingle = async () => {
      db.reads.push({ table, operation: "select" });
      return { data: table === "products" && query.filters.id === product?.id && query.filters.is_active === true ? product : null, error: null };
    };
    query.insert = (row) => {
      query.operation = "insert";
      query.row = { ...row, id: `campaign-${db.nextId++}` };
      db.writes.push({ table, operation: "insert", row: query.row });
      db.campaigns.push(query.row);
      return query;
    };
    query.update = (values) => {
      query.operation = "update";
      query.updateValues = values;
      db.writes.push({ table, operation: "update", values });
      return query;
    };
    query.single = async () => {
      const inFlight = db.campaigns.some((campaign) =>
        campaign.id !== query.row?.id &&
        campaign.product_id === query.row?.product_id &&
        campaign.metadata?.single_channel_publish === true &&
        campaign.metadata?.selected_channel === query.row?.metadata?.selected_channel &&
        campaign.metadata?.attempt_in_progress === true,
      );
      return inFlight
        ? { data: null, error: { code: "23505" } }
        : { data: query.row, error: null };
    };
    query.then = (resolvePromise, rejectPromise) => {
      if (query.operation === "update") {
        const campaign = db.campaigns.find(({ id }) => id === query.filters.id);
        if (campaign) Object.assign(campaign, query.updateValues);
        return Promise.resolve({ data: null, error: null }).then(resolvePromise, rejectPromise);
      }
      db.reads.push({ table, operation: "select" });
      const requestedResults = query.containsValue?.value?.channel_results || {};
      const channel = Object.keys(requestedResults || {})[0];
      const duplicate = db.campaigns.filter((campaign) => {
        if (campaign.product_id !== query.filters.product_id || !channel) return false;
        const results = campaign.metadata?.channel_results;
        return results?.[channel]?.success === true;
      });
      return Promise.resolve({ data: duplicate.slice(0, 1), error: null }).then(resolvePromise, rejectPromise);
    };
    return query;
  };
  return db;
}

function makeRoute({ database, providerCalls, fetchCalls, providerResults = {}, metaStatus = "valid" }) {
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const routeModule = { exports: {} };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    "@supabase/supabase-js": { createClient: () => database },
    "@/channels.config.json": { default: channelsConfig },
    "@/lib/channels/facebook": { publishToFacebook: async () => { providerCalls.push("facebook"); return providerResults.facebook || { success: true, postId: "fb-post" }; } },
    "@/lib/channels/instagram": { publishToInstagram: async () => { providerCalls.push("instagram"); return providerResults.instagram || { success: true, postId: "ig-post" }; } },
    "@/lib/facebook-credentials": { getFacebookCredentialError: () => null },
    "@/lib/meta-token-health": {
      getMetaTokenHealth: async () => ({ status: metaStatus, expiresAt: null }),
      isMetaTokenPublishAllowed: (status) => ["valid", "expiring"].includes(status),
    },
    "@/lib/marketing-auth": { isCronBearerAuthorized: (request) => request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` },
    "@/lib/marketing-media": { getTrustedProductCoverUrl: (url) => url },
    "@/lib/product-publishing": { makeSalesCaption: () => "Example sales caption" },
  };
  const context = {
    exports: routeModule.exports,
    module: routeModule,
    process,
    URL,
    AbortSignal,
    Date,
    JSON,
    String,
    Number,
    Boolean,
    encodeURIComponent,
    fetch: async (url, init = {}) => {
      fetchCalls.push({ url: String(url), method: init.method || "GET" });
      if (String(url).startsWith("https://api.telegram.org/")) {
        providerCalls.push("telegram");
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 777 } }) };
      }
      return { ok: true, status: 200, headers: { get: () => "image/jpeg" } };
    },
    require(id) {
      if (!(id in mocks)) throw new Error(`Unexpected route dependency: ${id}`);
      return mocks[id];
    },
  };
  vm.runInNewContext(compiled, context, { filename: "publish-one-route.cjs" });
  return routeModule.exports;
}

function request(body, authorization = `Bearer ${process.env.CRON_SECRET}`) {
  return new Request("https://factory.example/api/publish-one", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const product = {
  id: "single-test-product",
  is_active: true,
  title_ar: "مرجع أشعة",
  title_en: "Radiology Reference",
  description_ar: "وصف المنتج",
  description_en: "Product description",
  price: 14,
  cover_url: "https://project.example.supabase.co/storage/v1/object/public/covers/reference.jpg",
};

test("publish-one rejects unauthorized requests before database, image, or publisher work", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key" });

  const database = makeDatabase(product);
  const providers = [];
  const fetches = [];
  const route = makeRoute({ database, providerCalls: providers, fetchCalls: fetches });
  const response = await route.POST(request({ productId: product.id, channel: "facebook", publish: true }, "Bearer wrong"));
  assert.equal(response.status, 401);
  assert.deepEqual(database.reads, []);
  assert.deepEqual(database.writes, []);
  assert.deepEqual(providers, []);
  assert.deepEqual(fetches, []);
});

test("publish-one dry run validates the product and channel without publisher calls or database writes", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, {
    CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key",
    TELEGRAM_BOT_TOKEN: "test-token", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token",
    INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890", INSTAGRAM_ACCESS_TOKEN: "test-token",
  });
  const database = makeDatabase(product);
  const providers = [];
  const fetches = [];
  const route = makeRoute({ database, providerCalls: providers, fetchCalls: fetches });
  const response = await route.POST(request({ productId: product.id, channel: "instagram", dryRun: true }));
  assert.equal(response.status, 200);
  assert.equal(response.body.dryRun, true);
  assert.equal(response.body.externalPostsCreated, false);
  assert.equal(response.body.campaignId, null);
  assert.equal(response.body.channel.status, "would_publish");
  assert.equal(response.body.destination, `https://hidden-radiology-project-chi.vercel.app/library?book=${product.id}`);
  assert.deepEqual(database.writes, []);
  assert.deepEqual(providers, []);
  assert.deepEqual(fetches.map(({ method }) => method), ["HEAD"]);
});

test("publish-one blocks Meta publishing for invalid, expired, unknown, unavailable, and unconfigured health", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "fake-token" });
  for (const metaStatus of ["invalid", "expired", "unknown", "unavailable", "not_configured"]) {
    const database = makeDatabase(product);
    const providers = [];
    const route = makeRoute({ database, providerCalls: providers, fetchCalls: [], metaStatus });
    const response = await route.POST(request({ productId: product.id, channel: "facebook", publish: true }));
    assert.equal(response.status, 503, `${metaStatus} must block publishing`);
    assert.deepEqual(database.reads, [], `${metaStatus} must block before database reads`);
    assert.deepEqual(database.writes, []);
    assert.deepEqual(providers, []);
  }
});

test("publish-one invokes only the explicitly selected publisher and records its verified ID", async (t) => {
  const envNames = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"];
  const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, {
    CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key",
    TELEGRAM_BOT_TOKEN: "test-token", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token",
    INSTAGRAM_BUSINESS_ACCOUNT_ID: "1234567890", INSTAGRAM_ACCESS_TOKEN: "test-token",
  });

  for (const [channel, expectedId] of [["telegram", "777"], ["facebook", "fb-post"], ["instagram", "ig-post"]]) {
    const database = makeDatabase(product);
    const providers = [];
    const fetches = [];
    const route = makeRoute({ database, providerCalls: providers, fetchCalls: fetches });
    const response = await route.POST(request({ productId: product.id, channel, publish: true }));
    assert.equal(response.status, 200, `${channel} should publish successfully`);
    assert.deepEqual(providers, [channel]);
    assert.equal(response.body.channel.externalId, expectedId);
    assert.equal(database.writes.length, 2);
    const record = database.campaigns[0];
    assert.equal(record.status, "completed");
    assert.equal(record.metadata.channel_results[channel].success, true);
    assert.equal(record.metadata.channel_results[channel].externalId, expectedId);
    assert.deepEqual(Object.keys(record.metadata.channel_results), [channel]);
    assert.ok(fetches.some(({ url }) => url === product.cover_url && url.startsWith("https://")));
  }
});

test("publish-one rejects missing, malformed, unsupported, and unknown product requests without publishing", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token" });
  const database = makeDatabase(product);
  const providers = [];
  const fetches = [];
  const route = makeRoute({ database, providerCalls: providers, fetchCalls: fetches });

  for (const body of [{ channel: "facebook" }, { productId: product.id }, { productId: product.id, channel: "linkedin", publish: true }, { productId: product.id, channel: "facebook", publish: "yes" }, { productId: product.id, channel: "facebook", publish: true, dryRun: true }]) {
    const response = await route.POST(request(body));
    assert.equal(response.status, 400);
  }
  const missingProduct = await route.POST(request({ productId: "missing", channel: "facebook", publish: true }));
  assert.equal(missingProduct.status, 404);
  assert.deepEqual(providers, []);
  assert.deepEqual(database.writes, []);
});

test("publish-one refuses a previously successful product-channel pair", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token" });
  const previousCampaign = { product_id: product.id, metadata: { channel_results: { facebook: { success: true, externalId: "already-posted" } } } };
  const database = makeDatabase(product, [previousCampaign]);
  const providers = [];
  const route = makeRoute({ database, providerCalls: providers, fetchCalls: [] });
  const response = await route.POST(request({ productId: product.id, channel: "facebook", publish: true }));
  assert.equal(response.status, 409);
  assert.equal(response.body.alreadyPublished, true);
  assert.deepEqual(providers, []);
  assert.deepEqual(database.writes, []);
});

test("publish-one records provider failures as failures, never as completed", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token" });
  const database = makeDatabase(product);
  const providers = [];
  const route = makeRoute({ database, providerCalls: providers, fetchCalls: [], providerResults: { facebook: { success: false, error: "provider rejected" } } });
  const response = await route.POST(request({ productId: product.id, channel: "facebook", publish: true }));
  assert.equal(response.status, 502);
  assert.equal(response.body.success, false);
  assert.equal(response.body.persistence.success, true);
  assert.equal(database.campaigns[0].status, "ready");
  assert.equal(database.campaigns[0].metadata.channel_results.facebook.success, false);
  assert.equal(database.campaigns[0].metadata.attempt_in_progress, false);
  assert.equal("externalId" in database.campaigns[0].metadata.channel_results.facebook, false);
  assert.deepEqual(providers, ["facebook"]);
});

test("publish-one's database lock prevents concurrent duplicate attempts", async (t) => {
  const previous = Object.fromEntries(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"].map((name) => [name, process.env[name]]));
  t.after(() => Object.entries(previous).forEach(([name, value]) => value === undefined ? delete process.env[name] : process.env[name] = value));
  Object.assign(process.env, { CRON_SECRET: "c".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://project.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key", FACEBOOK_PAGE_ID: "1234567890123456", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token" });
  const pendingCampaign = { product_id: product.id, metadata: { single_channel_publish: true, selected_channel: "facebook", attempt_in_progress: true } };
  const database = makeDatabase(product, [pendingCampaign]);
  const providers = [];
  const route = makeRoute({ database, providerCalls: providers, fetchCalls: [] });
  const response = await route.POST(request({ productId: product.id, channel: "facebook", publish: true }));
  assert.equal(response.status, 409);
  assert.match(response.body.error, /already in progress/);
  assert.deepEqual(providers, []);
});
