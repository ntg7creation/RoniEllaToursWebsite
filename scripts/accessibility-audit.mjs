import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { launchProduction } from "./processes.mjs";

// Automated WCAG checks are one part of the documented review, not a legal
// certification. Keep incomplete results so human checks cannot disappear.
const baseline = process.argv.includes("--baseline");
const output = new URL("../.qa/accessibility-audit/", import.meta.url);
const servers = launchProduction({ webPort: 4600, apiPort: 4601 });
const scans = [], pageErrors = [];
let browser;
async function scan(page, path, state, width) {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const reduce = items => items.map(item => ({
    id: item.id, impact: item.impact, tags: item.tags, help: item.help, helpUrl: item.helpUrl,
    nodes: item.nodes.map(node => ({
      target: node.target, html: node.html, failureSummary: node.failureSummary,
      checks: [...node.any, ...node.all, ...node.none].map(check => ({ id: check.id, data: check.data, message: check.message })),
    })),
  }));
  scans.push({ path, state, width, violations: reduce(result.violations), incomplete: reduce(result.incomplete), passes: result.passes.length, inapplicable: result.inapplicable.length });
}
function summarize(kind) {
  const groups = new Map();
  for (const scan of scans) for (const item of scan[kind]) {
    const group = groups.get(item.id) ?? { id: item.id, help: item.help, impact: item.impact, occurrences: 0, affectedScans: 0, examples: [] };
    group.occurrences += item.nodes.length; group.affectedScans++;
    if (group.examples.length < 4) group.examples.push({ path: scan.path, state: scan.state, width: scan.width, ...item.nodes[0] });
    groups.set(item.id, group);
  }
  return [...groups.values()];
}
try {
  await mkdir(output, { recursive: true });
  await servers.ready();
  const content = await (await fetch(servers.backendOrigin + "/api/v1/content")).json();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [index, record] of content.pages.entries()) {
      await page.goto(servers.origin + record.path, { waitUntil: "networkidle" });
      await scan(page, record.path, "default", width);
      if ((index + 1) % 10 === 0) console.log(`Scanned ${index + 1}/${content.pages.length} pages at ${width}px`);
    }
  }
  await page.goto(servers.origin, { waitUntil: "networkidle" });
  await page.locator(".mobile-menu > summary").click();
  await scan(page, "/", "mobile navigation open", 390);
  await page.locator(".mobile-menu > summary").click();
  await page.locator('.callback-form button[type="submit"]').click();
  await scan(page, "/", "invalid callback form", 390);
  await page.getByRole("button", { name: "פתיחת תפריט נגישות", exact: true }).click();
  await scan(page, "/", "accessibility toolbar open", 390);
  await page.keyboard.press("Escape");
  await page.goto(servers.origin + "/gallery/", { waitUntil: "networkidle" });
  await page.locator(".gallery-memory a").first().click();
  await page.locator(".gallery-viewer[open]").waitFor();
  await scan(page, "/gallery/", "photo dialog open", 390);
  await page.keyboard.press("Escape");
  await page.goto(servers.origin + "/tours/china-may-2027/", { waitUntil: "networkidle" });
  await page.locator("main details").evaluateAll(elements => { for (const element of elements) element.open = true; });
  await scan(page, "/tours/china-may-2027/", "all native disclosures open", 390);
  await context.close();
  const violations = summarize("violations"), incomplete = summarize("incomplete");
  const report = { auditedAt: new Date().toISOString(), scope: "Local production build; all content pages at desktop/mobile plus interactive states", engine: "axe-core 4.14.0", tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    limitations: "Not a conformance determination. Manual screen-reader, content, legal-applicability and business-information checks remain separate.", pageErrors, summary: { pages: content.pages.length, scans: scans.length, violations, incomplete }, scans };
  await writeFile(new URL(baseline ? "baseline.json" : "latest.json", output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ pages: content.pages.length, scans: scans.length, violations, incomplete, pageErrors }, null, 2));
  if (!baseline && (violations.length || pageErrors.length)) process.exitCode = 1;
} finally { await browser?.close(); await servers.stop(); }
