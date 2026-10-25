import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { tours } from '../src/content/tours.js';
import { articles } from '../src/content/articles.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const routes = ['/', '/tours', ...tours.map(t => `/tours/${t.slug}`), '/about', '/guides', '/gallery', '/reviews', '/blog', ...articles.map(a => `/blog/${a.slug}`), '/contact', '/terms', '/privacy-policy', '/accessibility', '/missing'];
await fs.mkdir('screenshots/languages', { recursive: true });
try {
  await page.goto(base);
  await page.locator('.language-control select').selectOption('en');
  for (const width of [1241, 1280, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `Header at ${width}`).toBeLessThanOrEqual(1);
    for (const control of await page.locator('.desktop-nav a, .language-control select').all()) {
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
  for (const language of process.env.INTERACTIONS_ONLY ? [] : ['en', 'he']) {
    await page.locator('.language-control select').selectOption(language);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(base + route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await expect(page.locator('html')).toHaveAttribute('dir', language === 'he' ? 'rtl' : 'ltr');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(overflow, `${language} ${width} ${route} overflow`).toBeLessThanOrEqual(1);
        if (language === 'en') {
          const untranslated = await page.locator('main, .site-footer').evaluateAll(roots => {
            const found = [];
            for (const root of roots) {
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
              while (walker.nextNode()) if (/[\u0590-\u05ff]/.test(walker.currentNode.textContent)) found.push(walker.currentNode.textContent);
              for (const el of root.querySelectorAll('[aria-label], [alt], [placeholder]')) for (const attr of ['aria-label', 'alt', 'placeholder']) if (/[\u0590-\u05ff]/.test(el.getAttribute(attr) || '')) found.push(el.getAttribute(attr));
            }
            return [...new Set(found)];
          });
          expect(untranslated, `Untranslated copy ${route}`).toEqual([]);
        }
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        expect(await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
      }
      await page.goto(base);
      await page.screenshot({ path: `screenshots/languages/${language}-${width}.png` });
      console.log(`PASS ${language} ${width}px: ${routes.length} pages, translations, direction, sticky header and overflow`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/contact');
  await page.locator('input[name=fullName]').fill('Test name');
  await page.locator('.language-control select').selectOption('en');
  await expect(page.locator('input[name=fullName]')).toHaveValue('Test name');
  await page.getByRole('button', { name: 'Check form', exact: true }).click();
  await expect(page.locator('form')).toContainText('Phone is required');
  await page.locator('.language-control select').selectOption('he');
  await expect(page.locator('form')).toContainText('טלפון הוא שדה חובה');
  await page.locator('.language-control select').selectOption('en');
  await page.goto(base + '/tours/china-zhong-guo');
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < fullHeight; y += 700) {
    await page.evaluate(y => scrollTo(0, y), y);
    expect(await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
  }
  await page.locator('.desktop-nav a[href="/gallery"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.gallery-image').first().click();
  await expect(page.locator('.image-viewer')).toBeVisible();
  const firstImage = await page.locator('.image-viewer img').getAttribute('src');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('.image-viewer img').getAttribute('src')).not.toBe(firstImage);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.image-viewer img')).toHaveAttribute('src', firstImage);
  await page.keyboard.press('Escape');
  await expect(page.locator('.image-viewer')).toHaveCount(0);
  await page.getByRole('searchbox').fill('Greece');
  expect(await page.locator('.video-card').count()).toBeGreaterThan(0);
  await page.locator('.language-control select').selectOption('ru');
  await expect(page.locator('.translation-notice')).toContainText('Перевод сейчас недоступен', { timeout: 35000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'screenshots/languages/ru-fallback-390.png' });
  await page.locator('.language-control select').selectOption('en');
  await page.locator('.mobile-menu-button').click();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await page.locator('.mobile-nav a[href="/about"]').click();
  await expect(page.locator('.mobile-nav')).toBeHidden();
  await expect(page.locator('h1')).toContainText('About');
  await page.locator('.language-control select').focus();
  expect(await page.locator('.language-control').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.route('**/api/translate', async route => {
    const { namespaces } = route.request().postDataJSON();
    const copy = Object.assign({}, ...await Promise.all(namespaces.map(async name => JSON.parse(await fs.readFile(`src/locales/en/${name}.json`, 'utf8')))));
    for (const key of Object.keys(copy)) copy[key] = `Перевод: ${copy[key]}`;
    await route.fulfill({ json: { copy } });
  });
  await page.locator('.language-control select').selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru-x-mtfrom-en');
  await expect(page.locator('h1')).toContainText('Перевод:');
  await expect(page.locator('.translation-notice')).toContainText('Автоматический перевод');
  await page.locator('.language-control select').selectOption('he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(errors).toEqual([]);
  console.log('PASS form state/errors, route persistence, video search, mobile menu, focus, missing service fallback, mocked Russian translation');
} finally { await browser.close(); }
