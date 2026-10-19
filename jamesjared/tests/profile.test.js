import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../src/index.js";

test("profile reads use the bound namespace and return only public fields", async () => {
  for (const profile of [
    { handle: "@jams_jard", imagePath: "/me.jpg" },
    { handle: "@thecybergay", imagePath: "/thecybergay.jpg" },
  ]) {
    const response = await worker.fetch(new Request("https://example.com/api/profile"), {
      SITE_DATA: { async get(key, options) {
        assert.equal(key, "profile");
        assert.deepEqual(options, { type: "json" });
        return { ...profile, privateValue: "not public" };
      } },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), profile);
  }
});

test("an unconfigured profile returns an empty object without a site-specific default", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/profile"), {
    SITE_DATA: { get: async () => null },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
});

test("profile API does not allow writes", async () => {
  for (const method of ["PUT", "POST", "DELETE"]) {
    const response = await worker.fetch(new Request("https://example.com/api/profile", { method }), {});
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET");
  }
});

test("invalid profiles and KV failures return generic errors", async context => {
  context.mock.method(console, "error", () => {});
  for (const value of [
    {}, { handle: " ", imagePath: "/me.jpg" },
    ...["https://other.example/photo.jpg", "//other.example/photo.jpg", "/\\other.example/photo.jpg", "javascript:alert(1)"]
      .map(imagePath => ({ handle: "@example", imagePath })),
  ]) {
    const response = await worker.fetch(new Request("https://example.com/api/profile"), { SITE_DATA: { get: async () => value } });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Profile is temporarily unavailable" });
  }
  const response = await worker.fetch(new Request("https://example.com/api/profile"), {
    SITE_DATA: { get: async () => { throw new Error("private details"); } },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Profile is temporarily unavailable" });
});