const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const routeSource = readFileSync(
  resolve(__dirname, "../src/app/api/marketing/cron/route.ts"),
  "utf8",
);
const publishRouteSource = readFileSync(
  resolve(__dirname, "../src/app/api/marketing/publish/route.ts"),
  "utf8",
);

async function runMarketingCron(publishResult) {
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const routeModule = { exports: {} };
  const mocks = {
    "next/server": {
      NextResponse: {
        json: (body, init = {}) => ({ body, status: init.status || 200 }),
      },
    },
    "@/lib/marketing-publisher": {
      publishNextMarketingItem: async () => publishResult,
    },
    "@/lib/marketing-auth": {
      isMarketingJobAuthorized: () => true,
    },
  };
  const context = {
    exports: routeModule.exports,
    module: routeModule,
    process,
    URL,
    fetch: async () => new Response('{"success":true}', { status: 200 }),
    require(id) {
      if (!(id in mocks)) throw new Error(`Unexpected route dependency: ${id}`);
      return mocks[id];
    },
  };
  vm.runInNewContext(compiled, context, {
    filename: "marketing-cron-route.cjs",
  });

  return routeModule.exports.GET(
    new Request("https://factory.example/api/marketing/cron"),
  );
}

async function runMarketingPublish(publishResult) {
  const compiled = ts.transpileModule(publishRouteSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const routeModule = { exports: {} };
  const mocks = {
    "next/server": {
      NextResponse: {
        json: (body, init = {}) => ({ body, status: init.status || 200 }),
      },
    },
    "@/lib/marketing-publisher": {
      publishNextMarketingItem: async () => publishResult,
    },
    "@/lib/marketing-auth": {
      isMarketingJobAuthorized: () => true,
    },
  };
  const context = {
    exports: routeModule.exports,
    module: routeModule,
    process,
    require(id) {
      if (!(id in mocks)) throw new Error(`Unexpected route dependency: ${id}`);
      return mocks[id];
    },
  };
  vm.runInNewContext(compiled, context, {
    filename: "marketing-publish-route.cjs",
  });

  return routeModule.exports.POST(
    new Request("https://factory.example/api/marketing/publish", { method: "POST" }),
  );
}

test("Vercel schedules daily store product publishing without overlapping the marketing queue", () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, "../vercel.json"), "utf8"),
  );
  assert.deepEqual(config.crons, [
    { path: "/api/publish-all?auto=true", schedule: "0 7 * * *" },
  ]);
  assert.equal(
    config.crons.some(({ path }) => path === "/api/marketing/cron" || path === "/api/marketing/publish"),
    false,
  );
});

test("marketing cron reports publication failures as unsuccessful HTTP responses", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  const previousDeploymentUrl = process.env.VERCEL_URL;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    if (previousDeploymentUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousDeploymentUrl;
  });
  process.env.CRON_SECRET = "c".repeat(32);
  process.env.VERCEL_URL = "factory.example";

  const response = await runMarketingCron({
    processed: true,
    success: false,
    error: "Provider rejected the post",
  });
  assert.equal(response.status, 502);
  assert.equal(response.body.success, false);
});

test("marketing cron treats an empty eligible queue as a successful run", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  const previousDeploymentUrl = process.env.VERCEL_URL;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    if (previousDeploymentUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousDeploymentUrl;
  });
  process.env.CRON_SECRET = "c".repeat(32);
  process.env.VERCEL_URL = "factory.example";

  const response = await runMarketingCron({ processed: false });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("marketing cron treats the deliberately disabled auto-publish gate as an expected skip", async (t) => {
  const previousSecret = process.env.CRON_SECRET;
  const previousDeploymentUrl = process.env.VERCEL_URL;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    if (previousDeploymentUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousDeploymentUrl;
  });
  process.env.CRON_SECRET = "c".repeat(32);
  process.env.VERCEL_URL = "factory.example";

  const response = await runMarketingCron({
    processed: false,
    error: "Automatic social publishing is disabled.",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("marketing publish route does not report a failed or disabled item as successful", async () => {
  const response = await runMarketingPublish({
    processed: false,
    error: "Automatic social publishing is disabled.",
  });
  assert.equal(response.status, 502);
  assert.equal(response.body.success, false);
});
