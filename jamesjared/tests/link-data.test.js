import assert from "node:assert/strict";
import { test } from "node:test";
import { createLinkId, orderLinks } from "../public/js/link-data.js";

test("orders links numerically, preserving ties and placing unranked links last", () => {
    const links = {
        unranked: {},
        last: { order: 30 },
        first: { order: 10 },
        tied: { order: 10 },
    };
    assert.deepEqual(orderLinks(links).map(([key]) => key), ["first", "tied", "last", "unranked"]);
    assert.deepEqual(Object.keys(links), ["unranked", "last", "first", "tied"]);
    assert.deepEqual(orderLinks({}), []);
});

test("generates a short-link ID from the title", () => {
    assert.equal(createLinkId("  My New Link! ", []), "my-new-link");
    assert.equal(createLinkId("!!!", []), "link");
});

test("avoids collisions with existing short-link IDs", () => {
    assert.equal(createLinkId("Instagram", ["instagram", "instagram-2"]), "instagram-3");
});