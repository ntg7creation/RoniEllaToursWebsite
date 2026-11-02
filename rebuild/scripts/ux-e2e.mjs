import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { launchProduction } from "./processes.mjs";

// Uses the real production SSR runtime and read-only archive backend, with no mocks.
const processes = launchProduction({ webPort: 3600, apiPort: 3601 });
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const screenshots = new URL("../.qa/ux-after/", import.meta.url);
const errors = [];
const measurements = [];
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
  await mkdir(screenshots, { recursive: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  async function capture(name, width, fullPage = false) {
    await page.screenshot({
      path: fileURLToPath(new URL(`${name}-${width}.png`, screenshots)),
      fullPage,
    });
  }
  async function openNavigation() {
    if (await page.locator(".mobile-menu").isVisible())
      await page.locator(".mobile-menu > summary").click();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(processes.origin);
    await page.waitForLoadState("networkidle");
    await capture("home", width);
    await page.evaluate(() => {
      window.uxNavigationSentinel = "hydrated";
    });
    await openNavigation();
    await page
      .locator("header nav a:visible")
      .filter({ hasText: "הטיולים שלנו" })
      .click();
    await page.waitForURL("**/tours/");
    assert.equal(
      await page.evaluate(() => window.uxNavigationSentinel),
      "hydrated",
    );
    if (width === 390)
      assert.equal(
        await page.locator(".mobile-menu").getAttribute("open"),
        null,
      );
    await capture("tours", width);
    await page.locator('.card h2 a[href="/tours/china-may-2027/"]').click();
    await page.waitForURL("**/tours/china-may-2027/");
    await page.locator(".day-card").first().waitFor();
    assert.equal(await page.locator(".day-card").count(), 17);
    assert.equal(await page.locator(".day-card[open]").count(), 1);
    const secondDay = page.locator(".day-card").nth(1);
    await secondDay.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await secondDay.evaluate((element) => element.open), true);
    assert.ok((await secondDay.locator(".prose").innerText()).length > 100);
    await page.keyboard.press("Enter");
    assert.equal(await secondDay.evaluate((element) => element.open), false);
    await page.locator('.section-nav a[href="#cost"]').click();
    await page.waitForURL("**/#cost");
    assert.ok(
      (await page.locator(".price-section").innerText()).includes("6,580"),
    );
    await page
      .locator(".terms-section summary")
      .filter({ hasText: "תנאי ביטול" })
      .click();
    assert.ok(
      (await page.locator(".terms-section details[open]").innerText()).includes(
        "מיום ההרשמה ועד",
      ),
    );
    await page
      .locator(".terms-section summary")
      .filter({ hasText: "תנאי ביטול" })
      .click();
    // Existing source fragments land on their relevant section, including collapsed terms.
    await page.goto(`${processes.origin}/tours/china-may-2027/#include`);
    if (await page.locator("#include").count()) {
      assert.equal(
        await page.locator("#include").evaluate((element) => {
          const details = element.closest("details");
          return !details || details.open;
        }),
        true,
      );
    }
    await page.goto(`${processes.origin}/tours/china-may-2027/`);
    await page.waitForLoadState("networkidle");
    await capture("tour", width);
    measurements.push({
      page: "china-may-2027",
      width,
      defaultScrollHeight: await page.evaluate(
        () => document.documentElement.scrollHeight,
      ),
    });
    await page.locator("#journy").scrollIntoViewIfNeeded();
    await capture("itinerary", width);
    await page.locator("#terms").scrollIntoViewIfNeeded();
    await capture("terms", width);
    await page.locator('.trip-overview a[href="#contact"]').click();
    assert.ok(
      (
        await page.locator('#contact a[href^="tel:"]').getAttribute("href")
      ).startsWith("tel:"),
    );
    for (const [name, path] of [
      ["guides", "/guides/"],
      ["blog", "/blog/"],
      ["article", "/blog/uzbekistan-silk-road/"],
      ["privacy", "/privacy/"],
    ]) {
      await page.goto(processes.origin + path);
      await page.waitForLoadState("networkidle");
      await capture(name, width);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} horizontal overflow at ${width}`,
      );
    }
    if (width === 390) {
      await page.locator(".mobile-reading-index > summary").click();
      await page.locator(".mobile-reading-index a").nth(1).click();
      await page.waitForURL("**/#reading-section-*");
      // Mobile menu works by keyboard, including Escape and returning focus.
      const summary = page.locator(".mobile-menu > summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator(".mobile-menu").evaluate((el) => el.open),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(".mobile-menu").evaluate((el) => el.open),
        false,
      );
      assert.equal(
        await summary.evaluate((el) => el === document.activeElement),
        true,
      );
    }
    await page.goto(`${processes.origin}/guides/`);
    assert.equal(await page.locator(".guide-card").count(), 5);
    await page.locator(".guide-card summary").first().click();
    assert.ok(
      (await page.locator(".guide-card .prose").first().innerText()).length >
        300,
    );
  }
  // Check the complete long-form tour content, even when a disclosure starts closed.
  await page.goto(`${processes.origin}/testimonials/`);
  assert.equal(await page.locator(".review-card").count(), 9);
  await page.locator(".review-full > summary").first().click();
  assert.ok(
    (await page.locator(".review-full[open] p").innerText()).length > 100,
  );
  for (const tour of content.pages.filter((p) => p.pageType === "tour")) {
    await page.goto(processes.origin + tour.path);
    const text = normalize(await page.locator("main").textContent());
    for (const block of tour.blocks) {
      const parts =
        block.type === "paragraph" || block.type === "heading"
          ? [block.text]
          : block.type === "list"
            ? block.items.flatMap((item) => [
                item.text,
                ...item.children.flatMap((child) => child.items),
              ])
            : block.rows.flatMap((row) => row.map((cell) => cell.text));
      for (const part of parts.filter((part) => part.length > 80))
        assert.ok(
          text.includes(normalize(part)),
          `Missing source text on ${tour.path}: ${part.slice(0, 70)}`,
        );
    }
    const ids = await page
      .locator("[id]")
      .evaluateAll((els) => els.map((el) => el.id));
    assert.equal(
      ids.length,
      new Set(ids).size,
      `Duplicate anchor IDs: ${tour.path}`,
    );
    for (const summary of await page.locator(".day-card > summary").all()) {
      await summary.click();
      await summary.click();
    }
  }
  // Native navigation and disclosures also work with scripts disabled.
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`${processes.origin}/tours/china-may-2027/`);
  const lastDay = staticPage.locator(".day-card").last();
  await lastDay.locator("summary").click();
  assert.ok((await lastDay.locator(".prose").innerText()).includes("להתראות"));
  await staticPage
    .locator(".terms-section summary")
    .filter({ hasText: "תנאי ביטול" })
    .click();
  assert.ok(
    (
      await staticPage.locator(".terms-section details[open]").innerText()
    ).includes("מיום ההרשמה ועד"),
  );
  await staticPage.locator(".mobile-menu > summary").click();
  await staticPage
    .locator("header nav a:visible")
    .filter({ hasText: "בלוג" })
    .click();
  await staticPage.locator(".card h2 a").first().click();
  assert.ok((await staticPage.locator("main").innerText()).length > 1000);
  await noJs.close();
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("measurements.json", screenshots),
    JSON.stringify(measurements, null, 2) + "\n",
  );
  console.log(
    "PASS: desktop/mobile home → tours → detail → pricing → contact, hydrated navigation, keyboard itinerary/menu, terms, article contents, five guide profiles, all six tours' full text and unique anchors, JavaScript-disabled navigation/disclosures, no console errors",
  );
  console.log("Screenshots and measurements: rebuild/.qa/ux-after/");
} catch (error) {
  console.error(processes.logs());
  throw error;
} finally {
  await browser?.close();
  await processes.stop();
}
