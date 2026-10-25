import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const phase = process.argv[2] || 'before';
await fs.mkdir(`screenshots/${phase}`, { recursive: true });
const routes = ['/', '/tours', '/tours/china-zhong-guo', '/tours/uzbekistan', '/about', '/guides', '/blog', '/blog/five-things-ancient-greece', '/contact'];
const results = [];
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:5173'}${route}`);
    await page.locator('h1').waitFor();
    await page.screenshot({ path: `screenshots/${phase}/${width}-${route === '/' ? 'home' : route.replaceAll('/', '_')}-viewport.png` });
    await page.screenshot({ path: `screenshots/${phase}/${width}-${route === '/' ? 'home' : route.replaceAll('/', '_')}.png`, fullPage: true });
    const ancestors = await page.locator('.site-header').evaluate(el => {
      const out = [];
      for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); out.push({ tag: p.tagName, class: p.className, overflow: s.overflow, position: s.position, height: p.clientHeight, scrollHeight: p.scrollHeight }); }
      return out;
    });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    results.push({ width, route, ancestors, headerTop: await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    if (route === '/tours/china-zhong-guo') await page.screenshot({ path: `screenshots/${phase}/${width}-itinerary-bottom.png` });
    if (width === 390 && route === '/') {
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('.mobile-menu-button').click();
      await page.screenshot({ path: `screenshots/${phase}/390-menu.png` });
    }
  }
}
await fs.writeFile(`screenshots/${phase}/audit.json`, JSON.stringify(results, null, 2));
console.log(results.map(({ancestors,...r}) => r));
await browser.close();
