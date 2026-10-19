import assert from "node:assert/strict";
import { test } from "node:test";
import workerImplementation from "../src/index.js";
import { issueSession } from "../src/auth.js";

const authEnv = { ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "pass", SESSION_SECRET: "test-session-key-with-at-least-32-characters" };
const sessionCookie = (await issueSession(new Request("https://example.com"), authEnv)).split(";")[0];
const worker = {
  fetch(request, env) {
    if (request.method === "PUT") request.headers.set("Cookie", sessionCookie);
    return workerImplementation.fetch(request, { ...authEnv, ...env });
  },
};

test("returns links and their order from KV", async () => {
  const links = { example: { title: "Example", url: "https://example.com", icon: "fa-solid fa-link", order: 10 } };
  const env = {
    SITE_DATA: {
      async get(key, options) {
        assert.equal(key, "links");
        assert.deepEqual(options, { type: "json" });
        return links;
      },
    },
  };
  const response = await worker.fetch(new Request("https://example.com/api/links"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), links);
});

test("returns no links when KV is empty", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/links"), {
    SITE_DATA: { get: async () => null },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
});

test("preserves an explicitly empty links object", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/links"), {
    SITE_DATA: { get: async () => ({}) },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
});

test("rejects unsupported methods without accessing KV", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/links", { method: "POST" }), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, PUT");
});

test("unknown API routes return JSON 404", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/unknown"), {});
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
});

test("KV failures return a generic error", async (context) => {
  context.mock.method(console, "error", () => {});
  const response = await worker.fetch(new Request("https://example.com/api/links"), {
    SITE_DATA: { get: async () => { throw new Error("private details"); } },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Links are temporarily unavailable" });
});

const editableLinks = {
  example: { title: "Example", url: "https://example.com/", icon: "fa-solid fa-link", order: 10 },
};

function putRequest(body, headers = {}) {
  return new Request("https://example.com/api/links", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("PUT persists the complete link document and order, including deletions", async () => {
  let stored = {};
  const env = { SITE_DATA: {
    async put(key, value) {
      assert.equal(key, "links");
      stored = JSON.parse(value);
    },
    get: async () => stored,
  } };
  for (const links of [editableLinks, { ...editableLinks, second: { ...editableLinks.example, order: 5 } }, {}]) {
    const response = await worker.fetch(putRequest(links), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { saved: true });
    assert.deepEqual(stored, links);
    const read = await worker.fetch(new Request("https://example.com/api/links"), env);
    assert.deepEqual(await read.json(), links);
    assert.equal(read.headers.get("Cache-Control"), "no-store");
  }
});

test("PUT rejects malformed and oversized documents without writing", async () => {
  const invalid = [null, [], { example: {} }, { example: { ...editableLinks.example, url: "javascript:alert(1)" } },
    { example: { ...editableLinks.example, title: " " } },
    { example: { ...editableLinks.example, order: -1 } },
    { example: { ...editableLinks.example, icon: "not an icon" } },
    JSON.parse('{"__proto__":{"title":"Unsafe"}}'), "{broken"];
  for (const value of invalid) {
    const response = await worker.fetch(putRequest(value), {});
    assert.equal(response.status, 400);
  }
  const oversized = await worker.fetch(putRequest(" ".repeat(65537)), {});
  assert.equal(oversized.status, 413);
});

test("PUT rejects non-JSON and cross-origin writes", async () => {
  assert.equal((await worker.fetch(putRequest(editableLinks, { "Content-Type": "text/plain" }), {})).status, 415);
  assert.equal((await worker.fetch(putRequest(editableLinks, { Origin: "https://other.example" }), {})).status, 403);
  assert.equal((await worker.fetch(putRequest(editableLinks, { "Sec-Fetch-Site": "cross-site" }), {})).status, 403);
});

test("PUT reports KV failures without exposing internal details", async (context) => {
  context.mock.method(console, "error", () => {});
  const response = await worker.fetch(putRequest(editableLinks), {
    SITE_DATA: { put: async () => { throw new Error("private details"); } },
  });
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes("private details"), false);
});