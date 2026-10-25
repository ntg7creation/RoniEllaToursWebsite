import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.SITE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await fs.mkdir('screenshots/reviews', { recursive: true });
try {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/reviews');
    await expect(page.locator('.google-reviews-notice')).toContainText('מוזמנים לקרוא');
    await expect(page.locator('.google-story')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `screenshots/reviews/${width}-page.png`, fullPage: true });
    await page.locator('.recommendations-jumps a[href="#google-reviews"]').click();
    expect((await page.locator('#google-reviews').boundingBox()).y).toBeGreaterThanOrEqual((await page.locator('.site-header').boundingBox()).height);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await page.locator('.mobile-menu-button').click();
  await page.locator('.mobile-nav a[href="/reviews"]').click();
  await expect(page.locator('.mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Tab');
  await page.locator('.google-source-heading a').focus();
  expect(await page.locator('.google-source-heading a').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');

  // Synthetic network fixtures only: never included in website content.
  let version = 1;
  let fail = false;
  const review = (id, text) => ({ id, author: 'בדיקת ממשק — לא המלצה אמיתית', rating: 4, text, date: '2026-09-24T10:00:00Z' });
  await page.route('**/api/google-reviews*', route => {
    if (fail) return route.fulfill({ status: 502, json: { code: 'REVIEWS_UNAVAILABLE' } });
    const secondPage = new URL(route.request().url()).searchParams.has('pageToken');
    return route.fulfill({ json: {
      reviews: secondPage ? [review('second', 'בדיקת עמוד נוסף')] : [review('first', 'טקסט לבדיקת תצוגה בלבד. '.repeat(32)), ...(version > 1 ? [review('new', 'בדיקת ביקורת חדשה')] : [])],
      totalReviewCount: version + 1, averageRating: 4, nextPageToken: secondPage ? null : 'next',
    } });
  });
  await page.goto(base + '/reviews');
  await expect(page.locator('.google-story')).toHaveCount(1);
  await page.locator('.review-expand').click();
  await expect(page.locator('.review-expand')).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'ביקורות נוספות', exact: true }).click();
  await expect(page.locator('.google-story')).toHaveCount(2);
  version = 2;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.google-stories')).toContainText('בדיקת ביקורת חדשה');
  fail = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.google-reviews-notice')).toContainText('מוצגות הביקורות שנטענו קודם');
  await expect(page.locator('.google-story')).toHaveCount(2);
  fail = false;
  await page.getByRole('button', { name: 'ניסיון נוסף' }).click();
  await expect(page.locator('.google-reviews-notice')).toHaveCount(0);
  await page.locator('.mobile-menu-button').click();
  await page.locator('.mobile-nav a[href="/about"]').click();
  await page.locator('.mobile-menu-button').click();
  await page.locator('.mobile-nav a[href="/reviews"]').click();
  await expect(page.locator('.google-story')).toHaveCount(2);
  expect(errors).toEqual([]);
  console.log('PASS: 4 viewport sizes, inactive-state honesty, no horizontal overflow, anchors, sticky header, mobile menu, focus, pagination, refresh, retry, route remount, no runtime errors. Google responses mocked for feed interaction tests.');
} finally { await browser.close(); }
