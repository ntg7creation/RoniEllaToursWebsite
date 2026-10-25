import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const base = process.env.SITE_URL || 'http://127.0.0.1:4173';
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await fs.mkdir('screenshots/gallery', { recursive: true });
try {
  for (const width of [1440, 1101, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/gallery');
    await expect(page.locator('.gallery-image')).toHaveCount(50);
    await expect(page.locator('.gallery-album')).toHaveCount(1);
    const firstDestinations = await page.locator('.gallery-image').evaluateAll(items =>
      items.slice(0, 20).map(item => item.querySelector('img')?.getAttribute('src')?.split('/').pop()?.split('-')[0]));
    expect(new Set(firstDestinations).size).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.video-card')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const columns = await page.locator('.gallery-album').first().locator('.gallery-image').evaluateAll(items =>
      new Set(items.map(item => Math.round(item.getBoundingClientRect().left))).size);
    expect(columns).toBe(width > 1100 ? 5 : width > 700 ? 4 : 3);
    const galleryBounds = await page.locator('.gallery-grid').first().boundingBox();
    expect(Math.abs(galleryBounds.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(galleryBounds.x + galleryBounds.width - width)).toBeLessThanOrEqual(1);
    const heights = await page.locator('.gallery-album').first().locator('.gallery-image').evaluateAll(items =>
      new Set(items.map(item => Math.round(item.getBoundingClientRect().height))).size);
    expect(heights).toBeGreaterThan(2);
    for (const label of ['סין', 'יוון', 'מצרים', 'אוזבקיסטן']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.gallery-image')).toHaveCount(12);
      await expect(page.locator('.gallery-album h2')).toHaveText(label);
    }
    const opener = page.locator('.gallery-image').first();
    await opener.click();
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'סגירת תמונה' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.viewer-toolbar [aria-live]')).toContainText('2 מתוך 12');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.viewer-toolbar [aria-live]')).toContainText('1 מתוך 12');
    await page.getByRole('button', { name: 'התמונה הקודמת' }).click();
    await expect(page.locator('.viewer-toolbar [aria-live]')).toContainText('12 מתוך 12');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.getByRole('button', { name: 'הכל', exact: true }).click();
    await expect(page.locator('.gallery-album')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'הכל', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => scrollTo(0, 0));
    if ([1440, 390].includes(width)) await page.screenshot({ path: `screenshots/gallery/${width}-gallery.png` });
    await page.locator('.gallery-album').first().scrollIntoViewIfNeeded();
    if ([1440, 390].includes(width)) await page.screenshot({ path: `screenshots/gallery/${width}-photos.png` });
    await page.locator('a[href="#videos"]').click();
    const top = (await page.locator('#videos').boundingBox()).y;
    expect(top).toBeGreaterThanOrEqual((await page.locator('.site-header').boundingBox()).height);
    await expect(page.locator('iframe')).toHaveCount(0);
    if ([1440, 390].includes(width)) await page.screenshot({ path: `screenshots/gallery/${width}-videos.png` });
    await page.locator('.video-poster').first().click();
    await expect(page.locator('iframe')).toHaveAttribute('src', /embed\/0ig45aOXt7A/);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
    console.log(`PASS ${width}px: 50 images, filters, viewer keyboard/wrapping/focus, videos, anchor, header, overflow`);
  }
  await page.goto(base + '/');
  await page.locator('.company-video').scrollIntoViewIfNeeded();
  await expect(page.locator('.company-video a')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=0ig45aOXt7A');
  await page.locator('.company-video button').click();
  await expect(page.locator('.company-video iframe')).toHaveAttribute('src', /embed\/0ig45aOXt7A/);
  await page.screenshot({ path: 'screenshots/gallery/home-company-video.png' });
  expect(errors).toEqual([]);
  console.log('PASS homepage company video and no page errors');
} finally { await browser.close(); }
