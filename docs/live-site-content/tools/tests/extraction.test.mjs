import { test } from "node:test";
import assert from "node:assert/strict";
import { extractHtml } from "../extraction.mjs";
import { unique } from "../validate.mjs";
import { safePath, urlKey, crawlDecision, publicIdentity } from "../common.mjs";
test("preserves ordered headings, lists, nested lists, tables, FAQ, anchors, forms and conflicting SEO", () => {
  const html = `<html lang="he"><head><title>one</title><title>two</title><meta name="description" content="A"><meta name="description" content="B"><link rel="canonical" href="/a/"><link rel="canonical" href="/b/"><script type="application/ld+json">{bad}</script></head><body><main id="content"><h1 id="intro">Heading</h1><p>Full <a href="/article/" rel="nofollow">linked</a> paragraph.</p><ul><li>first<ul><li>nested</li></ul></li><li>second</li></ul><table><caption>Prices</caption><tr><th>Type</th><td colspan="2">3,450$</td></tr></table><details id="faq"><summary>Question?</summary><p>Full answer.</p></details><form><label for="email">Email</label><input id="email" name="email" type="email"><select><option value="x">Choice</option></select></form></main></body></html>`;
  const r = extractHtml(html, "https://roniellatours.com/test/");
  assert.deepEqual(r.sourceSeo.htmlTitles, ["one", "two"]);
  assert.deepEqual(r.sourceSeo.sourceMetaDescriptions, ["A", "B"]);
  assert.equal(r.sourceSeo.sourceCanonicalUrl, null);
  assert.equal(r.sourceSeo.jsonLd[0].parseStatus, "invalid");
  assert.ok(
    r.main.blocks.some(
      (b) =>
        b.type === "table" &&
        b.rows[0][1].text === "3,450$" &&
        b.rows[0][1].colspan === "2",
    ),
  );
  assert.equal(
    r.main.blocks.find((b) => b.type === "list").items[0].children[0].items[0],
    "nested",
  );
  assert.ok(r.main.anchorIds.some((a) => a.id === "intro"));
  assert.equal(r.main.faq[0].question, "Question?");
  assert.equal(r.forms[0].documentationOnly, true);
  assert.ok(
    r.forms[0].fields.some((f) => f.options.some((o) => o.label === "Choice")),
  );
  assert.equal(
    r.tour.observations.find((o) => o.kind === "price").normalizedValue
      .minorUnits,
    345000,
  );
});
test("saved ID/path collisions and path traversal are rejected", () => {
  assert.equal(
    publicIdentity("single single-trips postid-6032 elementor-page-11"),
    "wordpress:post:6032",
  );
  assert.equal(publicIdentity("page page-id-6"), "wordpress:post:6");
  assert.equal(
    publicIdentity("archive author author-roni author-2"),
    "wordpress:author:2",
  );
  assert.throws(
    () =>
      unique(
        [{ publicPath: "/tours/china/" }, { publicPath: "/tours/china/" }],
        "publicPath",
      ),
    /Duplicate/,
  );
  assert.throws(() => safePath("../../outside"));
  assert.equal(
    urlKey("https://roniellatours.com/%D7%AA/"),
    urlKey("https://roniellatours.com/ת/"),
  );
  assert.equal(
    crawlDecision("https://outside.test/"),
    "external reference; not fetched",
  );
  assert.match(
    crawlDecision("https://roniellatours.com/?sort=x&filter=y"),
    /bound crawl/,
  );
  assert.equal(crawlDecision("https://roniellatours.com/page/2/"), null);
});
