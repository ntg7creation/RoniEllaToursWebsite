import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expectedHeading, launchProduction } from "./processes.mjs";

const processes = launchProduction({ webPort: 3700, apiPort: 3701 });
const output = new URL("../.qa/editorial/", import.meta.url);
const tourPath = "/tours/uzbekistan-april-2027/";
const errors = [],
  external = [],
  metrics = [];
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
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  page.on("request", (request) => {
    if (!request.url().startsWith(processes.origin))
      external.push(request.url());
  });
  const content = await (
    await fetch(`${processes.backendOrigin}/api/v1/content`)
  ).json();
  async function ready() {
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
  }
  async function screenshot(name, fullPage = false) {
    await page.screenshot({
      path: fileURLToPath(new URL(`${name}.png`, output)),
      fullPage,
    });
  }
  async function noOverflow(label) {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Horizontal overflow: ${label}`,
    );
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of [
      ["home", "/"],
      ["tour", tourPath],
    ]) {
      const response = await page.goto(processes.origin + path);
      await ready();
      assert.equal(response.status(), 200);
      assert.match(response.headers()["x-robots-tag"], /noindex/);
      const record = content.pages.find((p) => p.path === path);
      assert.equal(
        await page.locator("h1").innerText(),
        expectedHeading(record),
      );
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.title(), record.seo.title);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        processes.origin + path,
      );
      await noOverflow(`${name} ${width}`);
      assert.equal(await page.locator("form,input,iframe").count(), 0);
      const hero = page.locator(".editorial-hero-photo img");
      assert.equal(
        await hero.evaluate((img) => img.complete && img.naturalWidth > 0),
        true,
      );
      assert.ok((await hero.getAttribute("alt")).length > 15);
      assert.equal(
        await page
          .locator(".photo-credit")
          .first()
          .locator('a[href*="creativecommons.org"]')
          .count(),
        1,
      );
      // Verify actual Hebrew + Latin variable font faces at all selected weights.
      const fonts = await page.evaluate(async () => {
        const specimen = "אוזבקיסטן 2027";
        const results = [];
        for (const [family, weights] of [
          ["Frank Ruhl Libre", [500, 600]],
          ["Assistant", [400, 500, 600]],
        ])
          for (const weight of weights)
            results.push(
              (
                await document.fonts.load(
                  `${weight} 20px "${family}"`,
                  specimen,
                )
              ).length > 0,
            );
        return results;
      });
      assert.ok(fonts.every(Boolean));
      assert.ok(
        (
          await page
            .locator("h1")
            .evaluate((e) => getComputedStyle(e).fontFamily)
        ).includes("Frank Ruhl Libre"),
      );
      metrics.push({
        name,
        width,
        bodySize: await page
          .locator(".editorial-shell")
          .evaluate((e) => getComputedStyle(e).fontSize),
        h1Size: await page
          .locator("h1")
          .evaluate((e) => getComputedStyle(e).fontSize),
      });
      for (const control of await page
        .locator(
          "button:visible,.editorial-button:visible,.editorial-section-nav > a:visible,.mobile-menu > summary:visible",
        )
        .all()) {
        const box = await control.boundingBox();
        assert.ok(
          box.height >= 44 && box.width >= 24,
          `Small control: ${await control.innerText()}`,
        );
      }
      await screenshot(`${name}-${width}`);
      if (width === 1440 || width === 390)
        await screenshot(`${name}-${width}-full`, true);
      // Selected text contrast checks: flat foreground/background pairs, no text over photos.
      const contrastFailures = await page.evaluate(() => {
        const color = (s) => s.match(/[\d.]+/g)?.map(Number);
        const luminance = (rgb) =>
          rgb
            .slice(0, 3)
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const failures = [];
        for (const element of document.querySelectorAll(
          ".editorial-shell h1,.editorial-shell h2,.editorial-shell h3,.editorial-shell p,.editorial-shell a,.editorial-shell button,.editorial-shell summary,.editorial-shell dt,.editorial-shell dd,.editorial-shell span",
        )) {
          if (
            !element.getClientRects().length ||
            ![...element.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
            )
          )
            continue;
          const style = getComputedStyle(element),
            fg = color(style.color);
          let parent = element,
            bg;
          while (parent) {
            const candidate = color(getComputedStyle(parent).backgroundColor);
            if (
              candidate &&
              (candidate[3] === undefined || candidate[3] === 1)
            ) {
              bg = candidate;
              break;
            }
            parent = parent.parentElement;
          }
          if (!fg || !bg) continue;
          const a = luminance(fg),
            b = luminance(bg),
            ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const minimum = parseFloat(style.fontSize) >= 24 ? 3 : 4.5;
          if (ratio + 0.01 < minimum)
            failures.push({
              text: element.textContent.trim().slice(0, 50),
              ratio,
              minimum,
            });
        }
        return failures;
      });
      assert.deepEqual(contrastFailures, [], `Contrast: ${name} ${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(processes.origin);
  await ready();
  await page.evaluate(() => {
    window.editorialSentinel = "preserved";
  });
  await page.locator(`.editorial-trip-copy h3 a[href="${tourPath}"]`).click();
  await page.locator(".editorial-tour").waitFor();
  assert.equal(
    await page.evaluate(() => window.editorialSentinel),
    "preserved",
  );
  assert.equal(await page.locator(".editorial-day").count(), 9);
  await page.getByRole("button", { name: "פתיחת כל הימים" }).click();
  assert.equal(await page.locator(".editorial-day[open]").count(), 9);
  await page.getByRole("button", { name: "סגירת כל הימים" }).click();
  assert.equal(await page.locator(".editorial-day[open]").count(), 0);
  const summary = page.locator(".editorial-day > summary").last();
  await summary.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".editorial-day[open]").count(), 1);
  assert.ok(
    (await page.locator(".editorial-day[open] .prose").innerText()).length > 80,
  );
  await page.locator('a[href="#source-facts"]').first().click();
  await page.waitForFunction(
    () => document.getElementById("source-facts").open,
  );
  const unresolved = await page.locator("#source-facts").innerText();
  assert.match(unresolved, /אישור/);
  assert.match(unresolved, /רחלי קרייסברג/);
  await page.reload();
  await ready();
  assert.equal(
    await page.locator("#source-facts").evaluate((e) => e.open),
    true,
  );
  await page.goto(processes.origin + tourPath);
  await ready();
  await page.locator("#journy").scrollIntoViewIfNeeded();
  await screenshot("tour-itinerary-desktop");
  const initialStates = await page
    .locator(".editorial-journey-printable details")
    .evaluateAll((els) => els.map((e) => e.open));
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  assert.ok(
    await page
      .locator(".editorial-journey-printable details")
      .evaluateAll((els) => els.every((e) => e.open)),
  );
  await page.emulateMedia({ media: "print" });
  assert.equal(
    await page.locator('.editorial-contact .contact-links a[href^="tel:"]').isVisible(),
    true,
  );
  assert.equal(
    await page
      .locator(
        '.editorial-hero-photo .photo-credit a[href*="creativecommons.org"]',
      )
      .isVisible(),
    true,
  );
  assert.equal(
    await page.locator(".editorial-day").last().locator(".prose").isVisible(),
    true,
  );
  await page.pdf({
    path: fileURLToPath(new URL("uzbekistan-print.pdf", output)),
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.deepEqual(
    await page
      .locator(".editorial-journey-printable details")
      .evaluateAll((els) => els.map((e) => e.open)),
    initialStates,
  );
  // Text-only 200% enlargement, separately from the 320px reflow checks above.
  for (const [name, path] of [
    ["home", "/"],
    ["tour", tourPath],
  ]) {
    await page.goto(processes.origin + path);
    await ready();
    const size = await page
      .locator("h1")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    assert.ok(
      (await page
        .locator("h1")
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) >=
        size * 1.99,
    );
    await noOverflow(`${name} text 200%`);
    await screenshot(`${name}-text-200`);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
  }
  // Keyboard focus is visible and the browser can bring each focused control into view.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(processes.origin + tourPath);
  await ready();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    // Native focus scrolling can finish on the following animation frame.
    await page.waitForFunction(() => {
      const element = document.activeElement, rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
        && getComputedStyle(element).outlineStyle !== "none";
    }, null, { timeout: 2000 }).catch(async error => {
      console.error("Keyboard failure", i, await page.evaluate(() => {
        const element = document.activeElement, rect = element.getBoundingClientRect();
        return { html: element.outerHTML, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, outline: getComputedStyle(element).outlineStyle, focusVisible: element.matches(":focus-visible"), url: location.href };
      }));
      await screenshot("keyboard-failure");
      throw error;
    });
    assert.equal(
      await page.evaluate(() => {
        const e = document.activeElement,
          r = e.getBoundingClientRect(),
          s = getComputedStyle(e);
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.top < innerHeight &&
          r.bottom > 0 &&
          s.outlineStyle !== "none"
        );
      }),
      true,
      `Keyboard stop ${i}`,
    );
  }
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(processes.origin + tourPath);
  await staticPage.locator(".editorial-day > summary").last().click();
  assert.ok(
    (
      await staticPage
        .locator(".editorial-day")
        .last()
        .locator(".prose")
        .innerText()
    ).length > 80,
  );
  await staticPage.locator(".source-pricing > summary").click();
  assert.ok(
    (await staticPage.locator(".source-pricing .prose").innerText()).length >
      100,
  );
  await staticPage.locator(".mobile-menu > summary").click();
  await staticPage
    .locator("header nav a:visible")
    .filter({ hasText: "הטיולים שלנו" })
    .click();
  assert.ok(
    (await staticPage.locator("h1").innerText()).includes("הטיולים שלנו"),
  );
  await noJs.close();
  // Actual Hebrew type specimen, rendered with the exact local faces used by the prototype.
  // Give the standalone specimen its own no-JavaScript page. Replacing the app's
  // active document can otherwise race its hydration and favicon lifecycle.
  const specimenPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1200, height: 1000 } });
  await specimenPage.goto(processes.origin);
  const specimen = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="icon" href="${processes.origin}/assets/compass.svg"><link rel="stylesheet" href="${processes.origin}/assets/editorial/fonts.css"><link rel="stylesheet" href="${processes.origin}/assets/fonts/assistant.css"><style>body{margin:0;padding:48px;background:#f8f4eb;color:#173f3b;font-family:'Assistant',Arial,sans-serif;font-synthesis:none}section{padding:24px 0;border-top:1px solid #d8d4c6}h1{font-size:24px}h2{font-family:'Frank Ruhl Libre';font-size:56px;line-height:1.2;margin:10px 0}p{font-size:20px;line-height:1.75;max-width:65ch}small{font-size:16px;color:#53655f}</style></head><body><h1>דוגמת טיפוגרפיה · טיולי העולם העתיק</h1><section><small>Frank Ruhl Libre · 500</small><h2 style="font-weight:500">מסעות אל הסיפורים שמאחורי המקומות</h2></section><section><small>Frank Ruhl Libre · 600</small><h2 style="font-weight:600">אוזבקיסטן — על דרך המשי</h2></section><section><small>Assistant · 400 / 500 / 600 · 20px / 35px</small><p style="font-weight:400">בין ערי דרך המשי לסיפורה של יהדות בוכרה. מסעות של היסטוריה ותרבות, עם מקום להקשיב, להכיר ולהבין.</p><p style="font-weight:500">לראות את הטיולים · לשיחה על הטיול</p><p style="font-weight:600">אפריל 2027 · הפרטים המדויקים ממתינים לאישור</p></section></body></html>`;
  await specimenPage.setContent(specimen);
  await specimenPage.waitForLoadState("networkidle");
  await specimenPage.evaluate(() => document.fonts.ready);
  await specimenPage.screenshot({ path: fileURLToPath(new URL("type-specimen.png", output)), fullPage: true });
  await specimenPage.close();
  await writeFile(new URL("type-specimen.html", output), specimen);
  await writeFile(
    new URL("metrics.json", output),
    JSON.stringify(metrics, null, 2) + "\n",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS: two editorial pages at 1440/768/390/320, real local fonts/weights, loaded photos/credits, selected contrast/target checks, 200% text resize, keyboard, hydrated navigation, source-conflict disclosure/deep refresh, open/close itinerary, print restoration/PDF, JavaScript-disabled controls/navigation, no browser errors/external requests",
  );
  console.log(
    "Review screenshots, typography specimen, PDF and metrics: .qa/editorial/",
  );
} catch (error) {
  console.error(processes.logs());
  throw error;
} finally {
  await browser?.close();
  await processes.stop();
}
