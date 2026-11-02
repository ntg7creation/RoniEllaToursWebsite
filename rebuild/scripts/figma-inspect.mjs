import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
await mkdir(new URL('../.qa/figma-inspection/',import.meta.url),{recursive:true});
try {
  const page=await browser.newPage();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:3999/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(()=>document.fonts.ready);
    for(const img of await page.locator('img').all()) { await img.scrollIntoViewIfNeeded(); await img.evaluate(e=>e.decode().catch(()=>{})); }
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`.qa/figma-inspection/reference-${width}.png`});
    await page.screenshot({path:`.qa/figma-inspection/reference-${width}-full.png`,fullPage:true});
    await writeFile(`.qa/figma-inspection/styles-${width}.json`,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('h1,h2,p,header,section')].slice(0,40).map(e=>{const s=getComputedStyle(e);return {tag:e.tagName,text:e.textContent.slice(0,90),font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,background:s.backgroundColor,padding:s.padding}})),null,2));
  }
  console.log('Figma reference screenshots and computed typography captured.');
} finally {await browser.close();}
