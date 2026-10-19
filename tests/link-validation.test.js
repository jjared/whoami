import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLinks } from "../src/link-validation.js";

const link = { title: "Example", url: "https://example.com/", icon: "fa-solid fa-link", order: 10 };

test("normalizes stored links and omits unrelated properties", () => {
  assert.deepEqual(validateLinks({ example: { ...link, title: " Example ", url: "https://example.com", extra: true } }), { example: link });
  assert.deepEqual(validateLinks({}), {});
  for (const icon of ["fa-regular fa-star", "fa-brands fa-github", "fab fa-instagram"]) {
    assert.equal(validateLinks({ example: { ...link, icon } }).example.icon, icon);
  }
});

test("rejects invalid field lengths, IDs, URLs, and order values", () => {
  for (const invalid of [
    { ...link, title: "x".repeat(121) },
    { ...link, url: "https://example.com/" + "x".repeat(2048) },
    { ...link, url: "not a URL" },
    { ...link, order: 1.5 },
    { ...link, order: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.equal(validateLinks({ example: invalid }), null);
  for (const key of ["constructor", "prototype", "_invalid", "x".repeat(129)]) {
    assert.equal(validateLinks({ [key]: link }), null);
  }
});

test("accepts up to 200 links and rejects larger documents", () => {
  const links = Object.fromEntries(Array.from({ length: 200 }, (value, index) => [`link-${index}`, link]));
  assert.equal(Object.keys(validateLinks(links)).length, 200);
  assert.equal(validateLinks({ ...links, extra: link }), null);
});