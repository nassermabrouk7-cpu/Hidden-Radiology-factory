const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadMetaOAuth({ tokenStatus = "valid", save = async () => {} } = {}) {
  const source = readFileSync(resolve(__dirname, "../src/lib/meta-oauth.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const mocks = {
    "node:crypto": require("node:crypto"),
    "@/lib/meta-token-health": {
      debugMetaToken: async (token) => ({ status: typeof tokenStatus === "function" ? tokenStatus(token) : tokenStatus, expiresAt: 4_000_000_000 }),
      REQUIRED_SCOPES: { facebook: ["pages_manage_posts", "pages_read_engagement"], instagram: ["instagram_basic", "instagram_content_publish"] },
    },
    "@/lib/meta-credentials": { getInstagramBusinessAccountId: () => process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || null },
    "@/lib/meta-token-vault": { saveMetaTokenVault: save },
  };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    process,
    Buffer,
    URL,
    URLSearchParams,
    AbortSignal,
    fetch,
    JSON,
    Number,
    Array,
    String,
    Object,
    RegExp,
    require: (id) => {
      if (!(id in mocks)) throw new Error(`Unexpected OAuth dependency: ${id}`);
      return mocks[id];
    },
  });
  return module.exports;
}

function configureOAuth(t, extra = {}) {
  const names = ["META_APP_ID", "META_APP_SECRET", "META_OAUTH_REDIRECT_URI", "META_TOKEN_ENCRYPTION_KEY", "FACEBOOK_PAGE_ID", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_USER_ID"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  Object.assign(process.env, {
    META_APP_ID: "test-app-id",
    META_APP_SECRET: "test-app-secret",
    META_OAUTH_REDIRECT_URI: "https://factory.example/api/meta/oauth/callback",
    META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    ...extra,
  });
}

test("Meta OAuth state is signed, expires, and must match its secure cookie", () => {
  const { createMetaOAuthState, verifyMetaOAuthState } = loadMetaOAuth();
  const secret = "a".repeat(40);
  const state = createMetaOAuthState(secret, 1_000, "random-nonce");
  assert.equal(verifyMetaOAuthState(state, state, secret, 1_100), true);
  assert.equal(verifyMetaOAuthState(state, "different-cookie", secret, 1_100), false);
  assert.equal(verifyMetaOAuthState(state, state, secret, 2_000), false);
  assert.equal(verifyMetaOAuthState(`${state}x`, `${state}x`, secret, 1_100), false);
});

test("Meta OAuth exchanges codes server-side and stores only after app, scopes, and IDs verify", async (t) => {
  configureOAuth(t);
  let saved = null;
  const oauth = loadMetaOAuth({ save: async (value) => { saved = value; } });
  const fetcher = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/oauth/access_token")) {
      return Response.json({ access_token: url.searchParams.get("code") ? "short-lived-test-token" : "long-lived-test-token", expires_in: 5_000_000 });
    }
    if (url.pathname.endsWith("/me/accounts")) {
      return Response.json({ data: [{ id: "1234567890123456", access_token: "EAA_page-test-token", instagram_business_account: { id: "1234567890" } }] });
    }
    throw new Error("unexpected request");
  };
  await oauth.completeMetaOAuthConnection("one-time-test-code", fetcher);
  assert.equal(saved.facebookPageId, "1234567890123456");
  assert.equal(saved.instagramBusinessAccountId, "1234567890");
  assert.equal(saved.instagramAccessToken, saved.facebookPageAccessToken);
  assert.equal(saved.userAccessToken, "long-lived-test-token");
});

test("Meta OAuth failures do not store credentials or expose app secrets or authorization codes", async (t) => {
  configureOAuth(t);
  let saved = 0;
  const oauth = loadMetaOAuth({ save: async () => { saved += 1; } });
  await assert.rejects(
    oauth.completeMetaOAuthConnection("sensitive-test-code", async () => new Response("{}", { status: 400 })),
    (error) => !error.message.includes("sensitive-test-code") && !error.message.includes("test-app-secret"),
  );
  assert.equal(saved, 0);
});

test("Meta OAuth rejects missing permissions and mismatched Facebook Page or Instagram IDs", async (t) => {
  configureOAuth(t);
  const pageResponse = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/oauth/access_token")) {
      return Response.json({ access_token: url.searchParams.get("code") ? "short-token" : "long-token", expires_in: 5_000_000 });
    }
    return Response.json({ data: [{ id: "1234567890123456", access_token: "EAA_page", instagram_business_account: { id: "1234567890" } }] });
  };

  let saved = 0;
  const missingScopes = loadMetaOAuth({ tokenStatus: (token) => token === "long-token" ? "invalid" : "valid", save: async () => { saved += 1; } });
  await assert.rejects(missingScopes.completeMetaOAuthConnection("code", pageResponse), /permissions or validity/);
  assert.equal(saved, 0);

  process.env.FACEBOOK_PAGE_ID = "9999999999999999";
  const mismatchPage = loadMetaOAuth({ save: async () => { saved += 1; } });
  await assert.rejects(mismatchPage.completeMetaOAuthConnection("code", pageResponse), /unique connected/);
  delete process.env.FACEBOOK_PAGE_ID;

  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "9999999999";
  const mismatchInstagram = loadMetaOAuth({ save: async () => { saved += 1; } });
  await assert.rejects(mismatchInstagram.completeMetaOAuthConnection("code", pageResponse), /does not match/);
  assert.equal(saved, 0);
});

test("Meta token vault uses authenticated AES-256-GCM encryption", async (t) => {
  const key = Buffer.alloc(32, 9).toString("base64");
  const { encryptMetaTokenValue, decryptMetaTokenValue } = await import("../src/lib/meta-token-vault.ts");
  const original = {
    userAccessToken: "private-user-token",
    userTokenExpiresAt: 123,
    facebookPageId: "1234567890123456",
    facebookPageAccessToken: "private-page-token",
    instagramBusinessAccountId: "1234567890",
    instagramAccessToken: "private-instagram-token",
  };
  const encrypted = encryptMetaTokenValue(original, key);
  assert.equal(JSON.stringify(encrypted).includes("private-user-token"), false);
  assert.deepEqual(decryptMetaTokenValue(encrypted, key), original);
  assert.throws(() => decryptMetaTokenValue({ ...encrypted, auth_tag: Buffer.alloc(16).toString("base64") }, key));
});

test("Instagram account ID alias is accepted only when values match", async (t) => {
  const names = ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_USER_ID"];
  const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => names.forEach((name) => old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]));
  const { getInstagramBusinessAccountId } = await import("../src/lib/meta-credentials.ts");
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "1234567890";
  process.env.INSTAGRAM_USER_ID = "1234567890";
  assert.equal(getInstagramBusinessAccountId(), "1234567890");
  process.env.INSTAGRAM_USER_ID = "9999999999";
  assert.equal(getInstagramBusinessAccountId(), null);
});
