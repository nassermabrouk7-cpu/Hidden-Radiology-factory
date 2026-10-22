const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Facebook image posts use photos and require an external post ID", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({ id: "photo-post-1" }, { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { publishToFacebook } = await import("../src/lib/channels/facebook.ts");
  const result = await publishToFacebook("1629465452308367", `EAA${"A".repeat(40)}`, {
    message: "Product caption",
    image_url: "https://cdn.example/cover.jpg",
  });
  assert.equal(result.success, true);
  assert.equal(result.postId, "photo-post-1");
  assert.match(calls[0].url, /\/1629465452308367\/photos$/);
  assert.equal(calls[0].body.url, "https://cdn.example/cover.jpg");
  assert.equal(calls[0].body.caption, "Product caption");
});

test("Facebook failures without a post ID are not reported as success", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({}, { status: 200 });
  t.after(() => { globalThis.fetch = originalFetch; });

  const { publishToFacebook } = await import("../src/lib/channels/facebook.ts");
  const result = await publishToFacebook("1629465452308367", `EAA${"A".repeat(40)}`, { message: "Text only" });
  assert.equal(result.success, false);
  assert.match(result.error, /rejected/);
});

test("Instagram only reports success after both HTTP responses return usable IDs", async (t) => {
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = async () => {
    call += 1;
    return call === 1 ? Response.json({ id: "container-1" }) : Response.json({ id: "media-1" });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { publishToInstagram } = await import("../src/lib/channels/instagram.ts");
  const result = await publishToInstagram("1234567890", "test-instagram-token", {
    imageUrl: "https://cdn.example/cover.jpg",
    caption: "Product caption",
  });
  assert.equal(result.success, true);
  assert.equal(result.postId, "media-1");
  assert.equal(call, 2);
});
