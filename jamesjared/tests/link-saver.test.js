import assert from "node:assert/strict";
import { test } from "node:test";
import { createLinkSaver } from "../public/js/link-saver.js";

async function advance(context) {
    context.mock.timers.tick(1100);
    await Promise.resolve();
    await Promise.resolve();
}

test("rapid edits coalesce into the latest complete document", async context => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const writes = [];
    const states = [];
    const saver = createLinkSaver(state => states.push(state), async body => writes.push(JSON.parse(body)));
    saver.queue({ first: { order: 10 } });
    saver.queue({ second: { order: 10 } });
    assert.equal(writes.length, 0);
    assert.equal(saver.hasUnsavedChanges(), true);
    await advance(context);
    assert.deepEqual(writes, [{ second: { order: 10 } }]);
    assert.equal(states.at(-1), "saved");
    assert.equal(saver.hasUnsavedChanges(), false);
});

test("writes are serialized and spaced even when editing during an active save", async context => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const writes = [];
    let finish;
    const saver = createLinkSaver(() => {}, body => {
        writes.push(JSON.parse(body));
        if (writes.length === 1) return new Promise(resolve => { finish = resolve; });
        return Promise.resolve();
    });
    saver.queue({ first: {} });
    await advance(context);
    saver.queue({ latest: {} });
    await advance(context);
    assert.equal(writes.length, 1);
    finish();
    await Promise.resolve();
    assert.equal(saver.hasUnsavedChanges(), true);
    assert.equal(writes.length, 1);
    await advance(context);
    assert.deepEqual(writes, [{ first: {} }, { latest: {} }]);
    assert.equal(saver.hasUnsavedChanges(), false);
});

test("failed saves retain edits until an explicit retry succeeds", async context => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const states = [];
    let attempts = 0;
    const saver = createLinkSaver(state => states.push(state), async () => {
        if (++attempts === 1) throw new Error("Unavailable");
    });
    saver.queue({});
    await advance(context);
    assert.equal(states.at(-1), "error");
    assert.equal(saver.hasUnsavedChanges(), true);
    await advance(context);
    assert.equal(attempts, 1);
    saver.retry();
    await advance(context);
    assert.equal(attempts, 2);
    assert.equal(states.at(-1), "saved");
    assert.equal(saver.hasUnsavedChanges(), false);
});

test("a failed older save never replaces a newer pending edit", async context => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    let rejectFirst;
    const writes = [];
    const saver = createLinkSaver(() => {}, body => {
        writes.push(JSON.parse(body));
        if (writes.length === 1) return new Promise((resolve, reject) => { rejectFirst = reject; });
        return Promise.resolve();
    });
    saver.queue({ old: {} });
    await advance(context);
    saver.queue({ latest: {} });
    rejectFirst(new Error("Unavailable"));
    await Promise.resolve();
    saver.retry();
    await advance(context);
    assert.deepEqual(writes, [{ old: {} }, { latest: {} }]);
});

test("default transport sends a JSON PUT with a request timeout", async context => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const transport = context.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "/api/links");
        assert.equal(options.method, "PUT");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.equal(options.body, "{}");
        assert.ok(options.signal instanceof AbortSignal);
        return new Response(null, { status: 200 });
    });
    const saver = createLinkSaver(() => {});
    saver.queue({});
    await advance(context);
    assert.equal(transport.mock.callCount(), 1);
    assert.equal(saver.hasUnsavedChanges(), false);
});

test("default transport treats HTTP failures as unsaved changes", async context => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
    const states = [];
    const saver = createLinkSaver(state => states.push(state));
    saver.queue({});
    await advance(context);
    assert.equal(states.at(-1), "error");
    assert.equal(saver.hasUnsavedChanges(), true);
});