import { chromium, expect } from '@playwright/test';
import { tours } from '../src/content/tours.js';
import { articles } from '../src/content/articles.js';

const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const base = process.env.SITE_URL || 'http://127.0.0.1:5173';
const routes = ['/', '/tours', ...tours.map(t => `/tours/${t.slug}`), '/about', '/guides', '/gallery', '/reviews', '/blog', ...articles.map(a => `/blog/${a.slug}`), '/contact', '/terms', '/privacy-policy', '/accessibility'];
try {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(base + route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('body').innerText()).not.toMatch(/ארכיון|תבנית|הגירה|בשלב זה|roniella_archive|React|Vite|API/);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
    }
    await page.goto(base + '/tours/china-zhong-guo');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 650) {
      await page.evaluate(y => scrollTo(0, y), y);
      await expect.poll(() => page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
    }
    await page.goto(base + '/');
    for (const selector of ['.hero h1', '.hero-content', '.hero .button-row']) {
      const box = await page.locator(selector).boundingBox();
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
    }
    console.log(`PASS: ${width}px — ${routes.length} routes, overflow, copy, full itinerary scroll, hero centering`);
  }
  await page.setViewportSize({ width: 390, height: 650 });
  const menu = page.locator('.mobile-menu-button');
  await menu.click();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  const before = await page.locator('.hero').boundingBox();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect((await page.locator('.hero').boundingBox()).y).toBe(before.y);
  await menu.click();
  await page.locator('.mobile-nav a[href="/tours"]').click();
  await expect(page).toHaveURL(base + '/tours');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await menu.click();
  await page.locator('.mobile-nav a[href="/tours"]').click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  const openMenuBounds = await page.locator('.mobile-nav').boundingBox();
  await page.mouse.click(8, openMenuBounds.y + openMenuBounds.height + 12);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 700, height: 320 });
  await menu.click();
  const mobileNav = page.locator('.mobile-nav');
  expect(await mobileNav.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await mobileNav.locator('a[href="/contact"]').click();
  await expect(page).toHaveURL(base + '/contact');
  console.log('PASS: menu Escape, focus return, same/new route close, outside close, no layout jump, landscape menu scroll');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  expect(await page.locator('.skip-link').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.locator('.desktop-nav a[href="/tours"]').click();
  await expect(page.locator('.desktop-nav a[href="/tours"]')).toHaveAttribute('aria-current','page');
  await page.locator('.tour-card').first().click();
  await expect(page).toHaveURL(base + '/tours/china-zhong-guo');
  await page.locator('a[href="#itinerary"]').click();
  const anchor = await page.locator('#itinerary').boundingBox();
  const header = await page.locator('.site-header').boundingBox();
  expect(anchor.y).toBeGreaterThanOrEqual(header.height);
  console.log('PASS: keyboard skip/focus, active route, full card link, anchor offset');

  for (const [route, formSelector, fields] of [
    ['/contact', 'form', {fullName:'בדיקה', phone:'0501234567', email:'test@example.com'}],
    ['/', 'form', {firstName:'בדיקה', phone:'0501234567', email:'test@example.com', destination:'china'}],
    ['/tours/china-zhong-guo', '.registration-form', {firstNameLatin:'Test', lastNameLatin:'Visitor', mobile:'0501234567', email:'test@example.com'}],
  ]) {
    await page.goto(base + route);
    const form = page.locator(formSelector);
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[aria-invalid="true"]').first()).toBeFocused();
    for(const [name,value] of Object.entries(fields)) {
      const field = form.locator(`[name="${name}"]`);
      if(name === 'destination') await field.selectOption(value); else await field.fill(value);
    }
    await form.locator('[name="email"]').fill('invalid');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[name="email"]')).toHaveAttribute('aria-invalid','true');
    await form.locator('[name="email"]').fill('test@example.com');
    await form.locator('[name="consent"]').check();
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[role="status"]')).toContainText('לא נשלחו ולא נשמרו');
  }
  expect(errors).toEqual([]);
  console.log('PASS: all three forms required fields, invalid email, focus, honest status; no browser errors');
} finally { await browser.close(); }
