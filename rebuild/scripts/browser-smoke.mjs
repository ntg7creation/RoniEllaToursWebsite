import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { launchProduction, expectedHeading } from "./processes.mjs";
const processes = launchProduction({ webPort: 3500, apiPort: 3501 });
let browser;
let executablePath;
for (const candidate of [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean)) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
try {
  await processes.ready();
  const content = await (
    await fetch(`${processes.backendOrigin}/api/v1/content`)
  ).json();
  browser = await chromium.launch({ executablePath, headless: true });
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  await staticPage.goto(
    new URL("/tours/china-may-2027/", processes.origin).href,
  );
  assert.ok(
    (await staticPage.locator("main").innerText()).includes("היום הראשון"),
  );
  assert.ok(
    (await staticPage.locator("main").innerText()).includes("תנאים והערות"),
  );
  await staticPage
    .locator("header nav a:visible")
    .filter({ hasText: "בלוג" })
    .click();
  await staticPage.locator("main .card h2 a").first().click();
  assert.ok((await staticPage.locator("main").innerText()).length > 500);
  await noJs.close();
  console.log(
    "PASS: JavaScript disabled: actual itinerary, conditions, listing navigation and full article remain usable",
  );
  const page = await browser.newPage();
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  page.on("request", (r) => {
    if (!r.url().startsWith(processes.origin)) external.push(r.url());
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const record of content.pages) {
      const r = await page.goto(new URL(record.path, processes.origin).href);
      assert.equal(r.status(), 200);
      assert.equal(
        await page.locator("h1").innerText(),
        expectedHeading(record).replace(/\s+/g, " "),
      );
      await page.waitForLoadState("networkidle");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow: ${record.path} at ${width}`,
      );
      assert.equal(await page.locator("input,iframe").count(), 0);
      assert.equal(await page.locator("form").count(), record.pageType === "gallery" ? 2 : 0);
      for (const form of await page.locator("form").all()) {
        assert.equal(await form.getAttribute("method"), "get");
        assert.equal(await form.getAttribute("action"), "/gallery/");
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(processes.origin);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.navigationSentinel = "preserved";
  });
  const data = page.waitForResponse((r) => r.url().includes(".data"));
  await page
    .locator("header nav a:visible")
    .filter({ hasText: "הטיולים שלנו" })
    .click();
  assert.equal((await data).status(), 200);
  assert.equal(
    await page.evaluate(() => window.navigationSentinel),
    "preserved",
  );
  await page.locator("main .card h2 a").first().click();
  await page.waitForURL(
    (url) => url.pathname.startsWith("/tours/") && url.pathname !== "/tours/",
  );
  const title = await page.locator("h1").innerText();
  await page.reload();
  assert.equal(await page.locator("h1").innerText(), title);
  await page.goto(
    new URL("/הטיולים-שלנו/צפון-יוון-2/#cost", processes.origin).href,
  );
  await page.waitForURL(
    (url) => url.pathname === "/tours/northern-greece/" && url.hash === "#cost",
  );
  assert.equal(await page.locator("#cost").count(), 1);
  await page.goto(processes.origin);
  await page.keyboard.press("Tab");
  assert.ok(
    await page
      .locator(".skip-link")
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Enter");
  assert.ok(
    await page.locator("main").evaluate((el) => el === document.activeElement),
  );
  await mkdir(new URL("../.qa/", import.meta.url), { recursive: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: fileURLToPath(
      new URL("../.qa/archive-home-mobile.png", import.meta.url),
    ),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    `PASS: ${content.pages.length} actual pages at desktop/mobile sizes, hydrated navigation, refresh, source fragment redirect, focus, no overflow or console/network errors`,
  );
} catch (error) {
  console.error(processes.logs());
  throw error;
} finally {
  await browser?.close();
  await processes.stop();
}
