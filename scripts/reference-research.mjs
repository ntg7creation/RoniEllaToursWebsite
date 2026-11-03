import { chromium } from 'playwright';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const references = ['blondeatlas.com', 'milkandhoneytravels.com', 'savoir-travel.com', 'avenueh.com', 'trolleylanetravel.com', 'packupgo.com', 'lozanotravel.com', 'explorateurtravel.com', 'huffmantravel.com', 'freeyourmindtravel.com', 'thetravelista.ca'];
const output = new URL('../.qa/references/', import.meta.url);
await mkdir(output, { recursive: true });
let executablePath;
for (const candidate of [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
  try { await access(candidate); executablePath = candidate; break; } catch {}
}
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
try {
  for (const domain of references) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const result = { domain, requestedUrl: `https://${domain === 'explorateurtravel.com' ? '' : 'www.'}${domain}/`, observations: [] };
    try {
      const response = await page.goto(result.requestedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      result.status = response?.status(); result.url = page.url();
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        // Reveal scroll-triggered content before the full-page capture; do not dismiss consent/dialogs.
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 800) {
            scrollTo(0, y); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }
          scrollTo(0, 0);
        });
        await page.screenshot({ path: fileURLToPath(new URL(`${domain}-${width}.png`, output)), fullPage: false });
        await page.screenshot({ path: fileURLToPath(new URL(`${domain}-${width}-full.png`, output)), fullPage: true, timeout: 20000 }).catch(() => {});
        result.observations.push(await page.evaluate(() => {
          const visible = e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(e).visibility !== 'hidden'; };
          const describe = e => {
            const s=getComputedStyle(e), r=e.getBoundingClientRect();
            return { tag:e.tagName, class:e.className?.baseVal ?? e.className, text:e.innerText?.trim().replace(/\s+/g,' ').slice(0,110), x:Math.round(r.x), y:Math.round(r.y+scrollY), width:Math.round(r.width), height:Math.round(r.height), font:s.fontFamily, size:s.fontSize, weight:s.fontWeight, lineHeight:s.lineHeight, color:s.color, background:s.backgroundColor, display:s.display, columns:s.gridTemplateColumns, gap:s.gap, padding:s.padding, position:s.position, aspectRatio:s.aspectRatio, objectFit:s.objectFit };
          };
          return { width:innerWidth, documentWidth:document.documentElement.scrollWidth, body:describe(document.body), headings:[...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).slice(0,30).map(describe), sections:[...document.querySelectorAll('main section, .page-section, main > div, header, footer')].filter(visible).slice(0,24).map(describe), layouts:[...document.querySelectorAll('.fluid-engine,[data-framer-name],.header-inner,.content-wrapper,.sqs-layout,[id*=container]')].filter(visible).filter(e=>['grid','flex'].includes(getComputedStyle(e).display)).slice(0,18).map(describe), paragraphs:[...document.querySelectorAll('main p,[data-framer-component-type=RichTextContainer] p')].filter(visible).slice(0,5).map(describe), navigation:[...document.querySelectorAll('header nav,header a,header button')].filter(visible).slice(0,22).map(describe), images:[...document.images].filter(visible).slice(0,12).map(describe), buttons:[...document.querySelectorAll('a[class*=button],button')].filter(visible).slice(0,7).map(describe), stylesheets:[...document.styleSheets].map(s=>s.href).filter(Boolean) };
        }));
      }
      console.log(`${domain}: ${result.status}, desktop/mobile captured`);
    } catch (error) { result.error = error.message; console.log(`${domain}: ${error.message.slice(0,180)}`); }
    results.push(result);
    await writeFile(new URL('observations.json', output), JSON.stringify(results, null, 2));
    await page.close();
  }
} finally { await browser.close(); }
