import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Synthetic videos exercise growth without contacting YouTube with fixture IDs.
await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Test player</p>' }));
await page.route('https://i.ytimg.com/**', route => route.abort());
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${process.env.DEV_URL || 'http://127.0.0.1:5173'}/scripts/video-library-fixture.html`);
    await expect(page.locator('.video-card')).toHaveCount(8);
    for (const count of [16, 24, 25]) {
      await page.getByRole('button', { name: 'הצגת סרטונים נוספים' }).click();
      await expect(page.locator('.video-card')).toHaveCount(count);
      await expect(page.locator('.video-poster').nth(count === 25 ? 24 : count - 8)).toBeFocused();
    }
    await expect(page.getByRole('button', { name: 'הצגת סרטונים נוספים' })).toHaveCount(0);
    await page.getByRole('searchbox').fill('סרטון בדיקה 25');
    await expect(page.locator('.video-card')).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText('1 מתוך 1');
    await page.getByRole('searchbox').fill('אין התאמה');
    await expect(page.locator('.video-card')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('0 מתוך 0');
    await page.getByRole('searchbox').fill('');
    await expect(page.locator('.video-card')).toHaveCount(8);
    await page.locator('.video-poster').first().click();
    await expect(page.locator('iframe')).toHaveCount(1);
    await page.getByRole('button', { name: 'ניגון: סרטון בדיקה 2', exact: true }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('iframe')).toHaveAttribute('title', 'סרטון בדיקה 2');
    await page.getByRole('searchbox').fill('25');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    console.log(`PASS ${width}px: 25-video pagination, focus, whole-catalog search, reset, empty state, single active player, overflow`);
  }
  expect(errors).toEqual([]);
} finally { await browser.close(); }
