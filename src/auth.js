import { SignJWT, jwtVerify } from "jose";

const SESSION_SECONDS = 8 * 60 * 60;
const attempts = new Map();
const encoder = new TextEncoder();

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function configured(env) {
  return Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD && env.SESSION_SECRET?.length >= 32);
}

function localHttp(request, env) {
  const { hostname } = new URL(request.url);
  return env.ALLOW_INSECURE_LOCAL_AUTH === "true" &&
    /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(hostname);
}

function cookieName(request, env) {
  return localHttp(request, env) && new URL(request.url).protocol === "http:" ? "dev_session" : "__Host-session";
}

function cookie(request, env, value, age = SESSION_SECONDS) {
  const secure = cookieName(request, env) === "__Host-session" ? "; Secure" : "";
  return `${cookieName(request, env)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return (!origin || origin === new URL(request.url).origin) && request.headers.get("Sec-Fetch-Site") !== "cross-site";
}

export async function issueSession(request, env) {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("whoami-admin")
    .setAudience(new URL(request.url).origin)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(encoder.encode(env.SESSION_SECRET));
  return cookie(request, env, token);
}

export async function authenticated(request, env) {
  if (!configured(env)) return false;
  if (new URL(request.url).protocol !== "https:" && !localHttp(request, env)) return false;
  const name = cookieName(request, env);
  const token = request.headers.get("Cookie")?.split(";")
    .map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, encoder.encode(env.SESSION_SECRET), {
      algorithms: ["HS256"], issuer: "whoami-admin", audience: new URL(request.url).origin,
      maxTokenAge: `${SESSION_SECONDS}s`,
    });
    return payload.admin === true;
  } catch {
    return false;
  }
}

async function equalCredentials(actual, expected) {
  const [actualHash, expectedHash] = await Promise.all([actual, expected]
    .map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index++) difference |= actualBytes[index] ^ expectedBytes[index];
  return difference === 0;
}

async function loginBody(request) {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  try {
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = JSON.parse(await new Blob(chunks).text());
    if (typeof body?.username !== "string" || typeof body?.password !== "string") return null;
    return body;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function handleAuth(request, env, pathname) {
  if (pathname === "/api/session") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
    return json({ authenticated: await authenticated(request, env) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not allowed" }, 403);
  if (pathname === "/api/logout") return json({ authenticated: false }, 200, { "Set-Cookie": cookie(request, env, "", 0) });
  if (!configured(env)) return json({ error: "Admin login is not configured" }, 503);
  if (new URL(request.url).protocol !== "https:" && !localHttp(request, env)) return json({ error: "HTTPS is required" }, 403);

  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
  const client = request.headers.get("CF-Connecting-IP") ?? "local";
  const entry = attempts.get(client) ?? { count: 0, expires: now + 15 * 60 * 1000 };
  if (entry.count >= 5) return json({ error: "Too many login attempts. Try again later." }, 429, { "Retry-After": String(Math.ceil((entry.expires - now) / 1000)) });
  if (attempts.size >= 10000 && !attempts.has(client)) return json({ error: "Login temporarily unavailable" }, 429);
  entry.count++;
  attempts.set(client, entry);
  const body = await loginBody(request);
  if (!body) return json({ error: "Expected a username and password" }, 400);
  const [usernameMatches, passwordMatches] = await Promise.all([
    equalCredentials(body.username, env.ADMIN_USERNAME), equalCredentials(body.password, env.ADMIN_PASSWORD),
  ]);
  if (!usernameMatches || !passwordMatches) return json({ error: "Invalid username or password" }, 401);
  attempts.delete(client);
  return json({ authenticated: true }, 200, { "Set-Cookie": await issueSession(request, env) });
}