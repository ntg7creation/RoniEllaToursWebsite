import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  launchProduction,
  stopProcess,
  sourceRecords,
  expectedHeading,
} from "./processes.mjs";
import { parseSiteContent } from "../shared/dist/site-content.js";
const processes = launchProduction();
let fakeApi;
const visible = (html) =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
try {
  await processes.ready();
  const request = (path, options = {}) =>
    fetch(new URL(path, processes.origin), { cache: "no-store", ...options });
  const content = parseSiteContent(
    await (await fetch(`${processes.backendOrigin}/api/v1/content`)).json(),
  );
  assert.equal(content.contentSource, "liveArchive");
  assert.equal(content.pages.length, sourceRecords.length);
  for (const page of content.pages) {
    const response = await request(page.path);
    assert.equal(response.status, 200, page.path);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    const html = visible(await response.text());
    assert.ok(
      html.includes(`<h1>${escape(expectedHeading(page))}</h1>`),
      `Actual SSR H1: ${page.path}`,
    );
    assert.ok(
      html.includes(`<title>${escape(page.seo.title)}</title>`),
      `SSR title: ${page.path}`,
    );
    assert.ok(
      html.includes(new URL(page.path, processes.origin).href),
      `ASCII canonical: ${page.path}`,
    );
    if (page.seo.description)
      assert.ok(html.includes(escape(page.seo.description)));
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
    assert.doesNotMatch(
      html,
      /<input\b|<iframe\b|נועה — מדריכת הדגמה|דרך המשי — מסלול לדוגמה/i,
    );
    const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map(match => match[0]);
    assert.equal(forms.length, page.pageType === "gallery" ? 2 : 0);
    for (const form of forms) {
      assert.match(form, /\bmethod="get"/); assert.match(form, /\baction="\/gallery\/"/);
    }
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g))
      if (match[1].startsWith("/") && !match[1].startsWith("//")) {
        assert.match(
          new URL(match[1], processes.origin).pathname,
          /^[a-zA-Z0-9/_.-]+$/,
        );
        assert.ok(
          !match[1].includes("%25"),
          "Repeatedly encoded application link",
        );
      }
  }
  for (const source of sourceRecords.filter((p) => p.pageType === "tour")) {
    const html = visible(await (await request(source.publicPath)).text());
    for (const day of source.tour.itinerary) {
      assert.ok(
        html.includes(escape(day.heading)),
        `Source itinerary heading missing: ${source.publicPath}`,
      );
      const paragraph = source.main.blocks
        .slice(day.startBlockOrder + 1, day.endBlockOrder + 1)
        .find((b) => b.type === "paragraph" && b.text);
      if (paragraph)
        assert.ok(
          html.includes(escape(paragraph.text)),
          "Source itinerary prose must be rendered outside scripts",
        );
    }
    const term = source.main.blocks.find((b) =>
      b.text?.includes("מיום ההרשמה ועד"),
    );
    if (term)
      assert.ok(html.includes(escape(term.text)), "Archived terms missing");
  }
  const article = sourceRecords.find(
    (p) => p.publicPath === "/blog/uzbekistan-silk-road/",
  );
  const articleHtml = visible(await (await request(article.publicPath)).text());
  const paragraph = article.main.blocks.find(
    (b) =>
      b.type === "paragraph" &&
      !b.anchorIds.includes("breadcrumbs") &&
      b.text.length > 100,
  );
  assert.ok(articleHtml.includes(escape(paragraph.text)));
  for (const rule of content.redirects) {
    const url = new URL(rule.fromPath, processes.origin);
    for (const [k, v] of Object.entries(rule.fromQuery))
      url.searchParams.set(k, v);
    const response = await fetch(url, { redirect: "manual" });
    assert.equal(response.status, 301, url.href);
    const target = await fetch(
      new URL(response.headers.get("location"), processes.origin),
      { redirect: "manual" },
    );
    assert.equal(target.status, 200, "One-hop redirect to a real destination");
  }
  for (const path of [
    "/missing/",
    "/tours/missing/",
    "/blog/missing/",
    "/tours/silk-road-demo/",
    "/blog/travel-journal-demo/",
    "/lead-status/new/",
    "/?p=999999",
    "/?post_type=trips&p=5864",
  ])
    assert.equal((await request(path)).status, 404, path);
  assert.equal((await request("/tours/china-may-2027/_.data")).status, 200);
  console.log(
    `PASS: ${content.pages.length} real archive pages, all six itineraries/terms, article prose, metadata, ${content.redirects.length} one-hop aliases, 404s, no demo content or data-entry forms; gallery has read-only GET shuffle controls`,
  );
  await stopProcess(processes.api);
  const failed = await request("/tours/china-may-2027/?uncached=1");
  assert.equal(failed.status, 503);
  assert.ok(visible(await failed.text()).includes("התוכן אינו זמין כרגע"));
  let slow = false;
  fakeApi = createServer((_req, res) => {
    if (slow) return;
    res.setHeader("Content-Type", "application/json");
    res.end('{"schemaVersion":999}');
  });
  await new Promise((r) => fakeApi.listen(3401, "127.0.0.1", r));
  assert.equal((await request("/?invalid")).status, 503);
  slow = true;
  const start = Date.now();
  assert.equal((await request("/?timeout")).status, 503);
  assert.ok(Date.now() - start < 4000);
  console.log(
    "PASS: backend stopped, invalid API payload and stalled API all return useful 503 responses",
  );
} catch (error) {
  console.error(processes.logs());
  throw error;
} finally {
  if (fakeApi) {
    fakeApi.closeAllConnections();
    await new Promise((r) => fakeApi.close(r));
  }
  await processes.stop();
}
