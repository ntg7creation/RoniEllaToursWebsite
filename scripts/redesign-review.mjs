import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { launchProduction } from './processes.mjs';

const processes = launchProduction({ webPort: 3800, apiPort: 3801 });
const output = new URL('../.qa/redesign/', import.meta.url);
let executablePath, browser;
for (const path of [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
  try { await access(path); executablePath = path; break; } catch {}
}
const pages = [
  ['home', '/'], ['tours', '/tours/'], ['china', '/tours/china-may-2027/'],
  ['uzbekistan', '/tours/uzbekistan-april-2027/'], ['article', '/blog/uzbekistan-silk-road/'],
  ['destination', '/destinations/china/'], ['contact', '/contact/'],
];
const metrics = [], errors = [];
try {
  await processes.ready(); await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of pages) {
      await page.goto(processes.origin + path); await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      // Full-page screenshots do not trigger below-the-fold lazy images themselves.
      for (const img of await page.locator('main img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(img => img.decode());
      }
      await page.evaluate(() => scrollTo(0,0));
      assert.equal(await page.locator('h1').count(), 1);
      const measure = await page.evaluate(() => ({
        width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        bodyFont: getComputedStyle(document.querySelector('.editorial-shell')).fontFamily,
        headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
        headingSize: getComputedStyle(document.querySelector('h1')).fontSize,
        overflow: [...document.querySelectorAll('body *')].filter(e => {
          const r=e.getBoundingClientRect(), s=getComputedStyle(e);
          return r.width>0 && r.height>0 && s.visibility!=='hidden' && (r.left < -.5 || r.right > innerWidth+.5);
        }).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,60)})),
      }));
      metrics.push({ name, ...measure });
      await page.screenshot({path:fileURLToPath(new URL(`${name}-${width}.png`,output)),fullPage:false});
      if ([1440,390].includes(width)) await page.screenshot({path:fileURLToPath(new URL(`${name}-${width}-full.png`,output)),fullPage:true});
      await writeFile(new URL('metrics.json',output),JSON.stringify(metrics,null,2));
      assert.ok(measure.documentWidth<=width, `${name} ${width}: ${JSON.stringify(measure.overflow)}`);
      assert.match(measure.bodyFont,/Assistant/); assert.match(measure.headingFont,/Frank Ruhl Libre/);
    }
  }
  assert.deepEqual(errors, []);
  const content=await(await fetch(processes.backendOrigin+'/api/v1/content')).json();
  const specimen=content.presentation['home.welcome.body'].split('\n\n')[0];
  const specimenPage=await browser.newPage({javaScriptEnabled:false});
  await specimenPage.setViewportSize({width:1200,height:1000});
  await specimenPage.goto(processes.origin);
  await specimenPage.setContent(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><link rel="icon" href="${processes.origin}/assets/compass.svg"><link rel="stylesheet" href="${processes.origin}/assets/editorial/fonts.css"><link rel="stylesheet" href="${processes.origin}/assets/fonts/assistant.css"><style>body{margin:0;padding:50px;background:#f7f3e9;color:#173e35;font-synthesis:none}section{padding:30px;border-top:1px solid #cfc7b6}h1,h2{font:500 28px/1.4 'Assistant'}p{font-size:22px;line-height:1.8;max-width:70ch}.previous{font-family:'Noto Sans Hebrew'}.current{font-family:'Assistant'}</style></head><body><h1>השוואת הטקסט הרגיל · משקל 400</h1><section class="previous"><h2>Noto Sans Hebrew — קודם</h2><p>${specimen}</p></section><section class="current"><h2>Assistant — חדש</h2><p>${specimen}</p></section><section class="current"><h2>Assistant · מידע שימושי ומספרים</h2><p>אוזבקיסטן · סין · מסלולי תרבות והיסטוריה<br>מאי 2027 · 18 ימים · RoniElla Tours<br>073-3744686 · roniellatours@gmail.com</p></section></body></html>`);
  await specimenPage.evaluate(()=>document.fonts.ready);
  await specimenPage.screenshot({path:fileURLToPath(new URL('regular-font-comparison.png',output)),fullPage:true});
  await specimenPage.close();
  console.log('PASS: seven representative SSR templates at 1440/1024/768/390/320px, local Hebrew font families, one H1, no horizontal overflow or page errors. Screenshots: .qa/redesign/');
} finally { await browser?.close(); await processes.stop(); }
