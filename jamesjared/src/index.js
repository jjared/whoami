import { MAX_LINK_BYTES, validateLinks } from "./link-validation.js";
import { authenticated, handleAuth } from "./auth.js";
import { readProfile } from "./profile.js";

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function saveLinks(request, env) {
  const origin = request.headers.get("Origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return json({ error: "Cross-origin writes are not allowed" }, 403);
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Expected application/json" }, 415);
  }

  let body;
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Expected a JSON document" }, 400);
  try {
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_LINK_BYTES) {
        await reader.cancel();
        return json({ error: "Link data exceeds 64 KiB" }, 413);
      }
      chunks.push(value);
    }
    body = JSON.parse(await new Blob(chunks).text());
  } catch {
    return json({ error: "Invalid JSON document" }, 400);
  } finally {
    reader.releaseLock();
  }

  const links = validateLinks(body);
  if (!links) return json({ error: "Invalid links: provide IDs, titles, HTTP/HTTPS URLs, icon classes, and nonnegative integer orders (maximum 200 links)" }, 400);
  try {
    await env.SITE_DATA.put("links", JSON.stringify(links));
    return json({ saved: true });
  } catch (error) {
    console.error("Could not save links to KV", error);
    return json({ error: "Links could not be saved. Please try again." }, 503);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (["/api/login", "/api/logout", "/api/session"].includes(pathname)) return handleAuth(request, env, pathname);

    if (pathname === "/api/profile") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      try {
        return json(readProfile(await env.SITE_DATA.get("profile", { type: "json" })));
      } catch (error) {
        console.error("Could not read profile from KV", error);
        return json({ error: "Profile is temporarily unavailable" }, 503);
      }
    }

    if (pathname !== "/api/links") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method === "PUT") {
      if (!await authenticated(request, env)) return json({ error: "Sign in to save changes" }, 401);
      return saveLinks(request, env);
    }

    if (request.method !== "GET") {
      return json(
        { error: "Method not allowed" },
        405, { Allow: "GET, PUT" },
      );
    }

    try {
      const links = await env.SITE_DATA.get("links", { type: "json" });
      return json(links ?? {});
    } catch (error) {
      console.error("Could not read links from KV", error);
      return json(
        { error: "Links are temporarily unavailable" },
        503,
      );
    }
  },
};