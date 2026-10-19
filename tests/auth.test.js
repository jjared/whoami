import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import worker from "../src/index.js";
import { authenticated, issueSession } from "../src/auth.js";

const env = { ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "pass", SESSION_SECRET: "test-signing-secret-at-least-32-characters" };
let client = 0;
function login(body = { username: "admin", password: "pass" }, headers = {}, url = "https://example.com/api/login") {
  return new Request(url, { method: "POST", headers: {
    "Content-Type": "application/json", "CF-Connecting-IP": `test-${++client}`, ...headers,
  }, body: JSON.stringify(body) });
}

test("public reads work but unauthenticated writes cannot reach KV", async () => {
  const read = await worker.fetch(new Request("https://example.com/api/links"), { SITE_DATA: { get: async () => null } });
  assert.equal(read.status, 200);
  const write = await worker.fetch(new Request("https://example.com/api/links", { method: "PUT", body: "{}" }), {});
  assert.equal(write.status, 401);
});

test("login issues a secure cookie and session check verifies it", async () => {
  const response = await worker.fetch(login(), env);
  assert.equal(response.status, 200);
  const cookie = response.headers.get("Set-Cookie");
  for (const attribute of ["__Host-session=", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=28800"]) assert.ok(cookie.includes(attribute));
  const check = await worker.fetch(new Request("https://example.com/api/session", { headers: { Cookie: cookie.split(";")[0] } }), env);
  assert.deepEqual(await check.json(), { authenticated: true });
  assert.equal(check.headers.get("Cache-Control"), "no-store");
});

test("wrong credentials, missing configuration, malformed and cross-origin login fail", async () => {
  assert.equal((await worker.fetch(login({ username: "admin", password: "wrong" }), env)).status, 401);
  assert.equal((await worker.fetch(login(), {})).status, 503);
  assert.equal((await worker.fetch(login({}), env)).status, 400);
  assert.equal((await worker.fetch(login({}, { Origin: "https://other.example" }), env)).status, 403);
  assert.equal((await worker.fetch(login({}, { "Sec-Fetch-Site": "cross-site" }), env)).status, 403);
  assert.equal((await worker.fetch(login({ password: "x".repeat(5000) }), env)).status, 400);
});

test("expired, tampered, wrong-origin and rotated-secret sessions fail", async () => {
  const cookie = (await issueSession(new Request("https://example.com"), env)).split(";")[0];
  const request = value => new Request("https://example.com/api/session", { headers: { Cookie: value } });
  assert.equal(await authenticated(request(cookie), { ...env, SESSION_SECRET: "different-session-key-with-32-characters" }), false);
  assert.equal(await authenticated(request(cookie + "tampered"), env), false);
  assert.equal(await authenticated(new Request("https://other.example", { headers: { Cookie: cookie } }), env), false);
  const expired = await new SignJWT({ admin: true }).setProtectedHeader({ alg: "HS256" })
    .setIssuer("whoami-admin").setAudience("https://example.com").setIssuedAt(1).setExpirationTime(2)
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
  assert.equal(await authenticated(request(`__Host-session=${expired}`), env), false);
});

test("local HTTP requires explicit flag and private hostname", async () => {
  assert.equal((await worker.fetch(login(undefined, {}, "http://localhost/api/login"), env)).status, 403);
  const localEnv = { ...env, ALLOW_INSECURE_LOCAL_AUTH: "true" };
  for (const host of ["localhost", "192.168.1.2"]) {
    const response = await worker.fetch(login(undefined, {}, `http://${host}/api/login`), localEnv);
    assert.equal(response.status, 200);
    const cookie = response.headers.get("Set-Cookie");
    assert.ok(cookie.startsWith("dev_session="));
    assert.equal(cookie.includes("; Secure"), false);
    assert.equal(await authenticated(new Request(`http://${host}/api/links`, { headers: { Cookie: cookie.split(";")[0] } }), localEnv), true);
  }
  assert.equal((await worker.fetch(login(undefined, {}, "http://public.example/api/login"), localEnv)).status, 403);
});

test("logout clears the cookie and rejects cross-origin requests", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/logout", { method: "POST" }), env);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("Set-Cookie").includes("Max-Age=0"));
  assert.equal((await worker.fetch(new Request("https://example.com/api/logout", { method: "POST", headers: { Origin: "https://other.example" } }), env)).status, 403);
});

test("five failed logins trigger per-instance throttling", async () => {
  const headers = { "CF-Connecting-IP": "throttle-test" };
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await worker.fetch(login({ username: "admin", password: "wrong" }, headers), env)).status, 401);
  const response = await worker.fetch(login(undefined, headers), env);
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("Retry-After")) > 0);
});