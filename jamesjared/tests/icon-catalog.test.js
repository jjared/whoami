import assert from "node:assert/strict";
import { test } from "node:test";
import { createIconCatalog } from "../scripts/icon-catalog.js";

test("catalog includes free classic variants but excludes paid styles and other families", () => {
    const catalog = createIconCatalog({
        heart: {
            label: "Heart",
            search: { terms: ["love"] },
            aliases: { names: ["favorite"] },
            familyStylesByLicense: {
                free: [
                    { family: "classic", style: "solid" },
                    { family: "classic", style: "regular" },
                    { family: "sharp", style: "solid" },
                ],
                pro: [{ family: "classic", style: "light" }],
            },
        },
    });
    assert.deepEqual(catalog.map(icon => icon.className), ["fa-regular fa-heart", "fa-solid fa-heart"]);
    assert.equal(catalog[0].label, "Heart (regular)");
    assert.match(catalog[0].search, /love favorite/);
});

test("catalog supports brands and icons without search terms", () => {
    const catalog = createIconCatalog({
        github: {
            label: "GitHub",
            familyStylesByLicense: { free: [{ family: "classic", style: "brands" }] },
        },
        paid: { label: "Paid", familyStylesByLicense: { free: [] } },
    });
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].className, "fa-brands fa-github");
    assert.deepEqual(createIconCatalog({}), []);
});