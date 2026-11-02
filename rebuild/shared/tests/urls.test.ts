import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paths,
  scaffoldRedirects,
  normalizePath,
  tourPath,
  postPath,
  PublicContentSchema,
} from "../src/index.js";
test("saved ASCII URLs do not depend on display titles or re-encode slugs", () => {
  assert.equal(tourPath("china-may-2027"), "/tours/china-may-2027/");
  assert.equal(postPath("uzbekistan-silk-road"), "/blog/uzbekistan-silk-road/");
  assert.throws(() => tourPath("%D7%AA"));
  assert.throws(() => tourPath("כותרת"));
  for (const [old, target] of Object.entries(scaffoldRedirects)) {
    assert.equal(scaffoldRedirects[normalizePath(encodeURI(old))], target);
    assert.match(target, /^\/(?:[a-z0-9-]+\/)*$/);
    assert.ok(!scaffoldRedirects[target]);
  }
  assert.equal(new Set(Object.values(paths)).size, Object.values(paths).length);
});
