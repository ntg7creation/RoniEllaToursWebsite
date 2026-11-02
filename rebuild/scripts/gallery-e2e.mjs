import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { launchProduction } from './processes.mjs';

const processes = launchProduction({ webPort: 4000, apiPort: 4001 });
const output = new URL('../.qa/gallery/', import.meta.url);
let executablePath, browser;
for (const path of [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
  try { await access(path); executablePath = path; break; } catch {}
}
const errors = [], external = [], metrics = [];
const ids = page => page.locator('.gallery-memory').evaluateAll(items => items.map(item => item.dataset.photoId));
try {
  await processes.ready(); await mkdir(output, { recursive: true });
  const content = await (await fetch(processes.backendOrigin + '/api/v1/content')).json();
  const total = content.gallery.photos.length, count = content.gallery.displayCount;
  assert.ok(total > count);
  const ssr = await (await fetch(processes.origin + '/gallery/')).text();
  assert.equal([...ssr.matchAll(/data-photo-id="/g)].length, count);
  assert.ok(ssr.includes('rel="canonical" href="' + processes.origin + '/gallery/"'));
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(processes.origin) && /^https?:/.test(request.url())) external.push(request.url()); });
  for (const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(processes.origin + '/gallery/'); await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.gallery-memory').count(), count);
    for (const image of await page.locator('.gallery-memory img').all()) {
      await image.scrollIntoViewIfNeeded(); await image.evaluate(image => image.decode());
    }
    await page.evaluate(() => scrollTo(0,0));
    const measurement = await page.evaluate(() => ({
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      columns: getComputedStyle(document.querySelector('.gallery-wall')).columnCount,
      images: [...document.querySelectorAll('.gallery-memory img')].map(img => ({ width: img.clientWidth, height: img.clientHeight, naturalWidth: img.naturalWidth })),
    }));
    assert.ok(measurement.documentWidth <= width, JSON.stringify(measurement));
    assert.equal(measurement.columns, width <= 560 ? '1' : width <= 900 ? '2' : '3');
    assert.ok(measurement.images.every(img => img.naturalWidth > 0 && img.width > 100 && img.height > 50));
    metrics.push(measurement);
    await page.screenshot({ path: fileURLToPath(new URL(`gallery-${width}.png`, output)), fullPage: false });
    if ([1440,390].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`gallery-${width}-full.png`, output)), fullPage: true });
    const first = page.locator('.gallery-memory a').first();
    await first.focus(); await page.keyboard.press('Enter');
    await page.locator('.gallery-viewer[open] img').evaluate(image => image.decode());
    assert.equal(await page.locator('.gallery-viewer[open]').count(), 1);
    const initial = await page.locator('.gallery-viewer img').getAttribute('src');
    await page.keyboard.press('ArrowLeft');
    assert.notEqual(await page.locator('.gallery-viewer img').getAttribute('src'), initial);
    if ([1440,390].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`viewer-${width}.png`, output)) });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.gallery-viewer[open]').count(), 0);
    assert.ok(await first.evaluate(link => document.activeElement === link));
    const before = await ids(page);
    await page.locator('.gallery-actions button').click(); await page.waitForLoadState('networkidle');
    await page.waitForFunction(previous => JSON.stringify([...document.querySelectorAll('.gallery-memory')].map(item => item.dataset.photoId)) !== JSON.stringify(previous), before);
    assert.equal(new Set(await ids(page)).size, count);
  }
  const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width:390, height:900 } });
  await nojs.goto(processes.origin + '/gallery/');
  assert.equal(await nojs.locator('.gallery-memory img').count(), count);
  const previous = await ids(nojs);
  await Promise.all([nojs.waitForNavigation(), nojs.locator('.gallery-actions button').click()]);
  assert.notDeepEqual(await ids(nojs), previous);
  await Promise.all([nojs.waitForNavigation(), nojs.locator('.gallery-memory a').first().click()]);
  assert.match(nojs.url(), /\/media\/album-.*\.jpg$/);
  await nojs.close();
  // The same cached backend manifest remains unchanged by all shuffle requests.
  const after = await (await fetch(processes.backendOrigin + '/api/v1/content')).json();
  assert.deepEqual(after.gallery.photos, content.gallery.photos);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(new URL('metrics.json',output), JSON.stringify({total,count,metrics},null,2));
  console.log(`PASS: ${total} cached photos; ${count} shuffled SSR photos; 1440/1024/768/390/320px; decoded local images; keyboard viewer/focus restoration; fresh mix without JavaScript; canonical unchanged; no external image requests or hydration errors.`);
} finally { await browser?.close(); await processes.stop(); }
