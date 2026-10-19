import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildProfileHtml } from "../scripts/profile-html.js";

const template = '<title>@{{PROFILE_HANDLE}}</title><img src="/{{PROFILE_IMAGE_PATH}}" alt="@{{PROFILE_HANDLE}}">';

test("bakes either profile into static HTML", () => {
    for (const [handle, imagePath] of [["jams_jard", "me.jpg"], ["thecybergay", "thecybergay.jpg"]]) {
        const html = buildProfileHtml(template, { PROFILE_HANDLE: handle, PROFILE_IMAGE_PATH: imagePath });
        assert.ok(html.includes(`<title>@${handle}</title>`));
        assert.ok(html.includes(`src="/${imagePath}"`));
        assert.equal(html.includes("{{"), false);
    }
});

test("escapes profile text and attribute values", () => {
    const html = buildProfileHtml(template, { PROFILE_HANDLE: '<img onerror="bad">&', PROFILE_IMAGE_PATH: 'photo".jpg' });
    assert.ok(html.includes("&lt;img onerror=&quot;bad&quot;&gt;&amp;"));
    assert.ok(html.includes('/photo&quot;.jpg'));
});

test("missing build variables produce a clear configuration error", () => {
    for (const variables of [{}, { PROFILE_HANDLE: "test" }, { PROFILE_IMAGE_PATH: "me.jpg" },
        { PROFILE_HANDLE: " ", PROFILE_IMAGE_PATH: "me.jpg" }]) {
        assert.throws(() => buildProfileHtml(template, variables), /Set PROFILE_HANDLE and PROFILE_IMAGE_PATH/);
    }
});

test("configured values are escaped without format or length restrictions", () => {
    const handle = "x".repeat(121);
    const html = buildProfileHtml(template, { PROFILE_HANDLE: handle, PROFILE_IMAGE_PATH: "photos/my-photo.jpg" });
    assert.ok(html.includes(`<title>@${handle}</title>`));
    assert.ok(html.includes('src="/photos/my-photo.jpg"'));
});

test("the real page template renders profile attributes without runtime placeholders", () => {
    const source = readFileSync(new URL("../scripts/index.html", import.meta.url), "utf8");
    const html = buildProfileHtml(source, { PROFILE_HANDLE: "thecybergay", PROFILE_IMAGE_PATH: "thecybergay.jpg" });
    assert.ok(html.includes('<div id="userName">@thecybergay</div>'));
    assert.ok(html.includes('src="/thecybergay.jpg"'));
    assert.ok(html.includes('href="/thecybergay.jpg"'));
    assert.ok(html.includes('width="96" height="96"'));
    assert.equal(html.includes("data-profile-image"), false);
    assert.equal(/<img[^>]*\bhidden\b/.test(html), false);
    assert.equal(html.includes('id="logout"'), false);
    assert.equal(html.includes("{{PROFILE_"), false);
});

test("hosted builds fail if profile variables are absent or local defaults are requested", () => {
    const env = { ...process.env, WORKERS_CI: "1" };
    delete env.PROFILE_HANDLE;
    delete env.PROFILE_IMAGE_PATH;
    const build = fileURLToPath(new URL("../scripts/build.js", import.meta.url));
    const missing = spawnSync(process.execPath, [build], { env, encoding: "utf8" });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Set PROFILE_HANDLE/);
    const local = spawnSync(process.execPath, [build, "--local"], { env, encoding: "utf8" });
    assert.notEqual(local.status, 0);
    assert.match(local.stderr, /Local profile defaults cannot be used/);
});