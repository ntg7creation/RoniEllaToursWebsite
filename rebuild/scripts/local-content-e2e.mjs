import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir, readdir, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { launchProduction } from './processes.mjs';

const qaRoot=fileURLToPath(new URL('../.qa/',import.meta.url));
await mkdir(qaRoot,{recursive:true});
const directory=await mkdtemp(resolve(qaRoot,'file-content-'));
let processes,browser;
try {
  await cp(new URL('../backend/content/',import.meta.url),directory,{recursive:true});
  let executablePath;
  for(const path of [process.env.BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
    try {await access(path);executablePath=path;break;}catch{}
  }
  browser=await chromium.launch({headless:true,executablePath});
  const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:1440,height:1000}});
  for(const revision of [1,2]) {
    const copyPath=resolve(directory,'presentation.json');
    const presentation=JSON.parse(await readFile(copyPath,'utf8'));
    presentation['home.hero.description']=`Local JSON revision ${revision}, rendered before browser JavaScript.`;
    await writeFile(copyPath,JSON.stringify(presentation));
    const homePath=resolve(directory,'pages/home.json');
    const home=JSON.parse(await readFile(homePath,'utf8'));
    home.seo.description=`Local metadata revision ${revision}`;
    await writeFile(homePath,JSON.stringify(home));
    processes=launchProduction({webPort:3900,apiPort:3901,contentDirectory:directory});
    await processes.ready();
    const html=await(await fetch(processes.origin)).text();
    const visible=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    assert.ok(visible.includes(presentation['home.hero.description']));
    assert.ok(visible.includes(home.seo.description));
    assert.match(visible,/<img[^>]+src="\/media\//);
    await page.goto(processes.origin);
    assert.equal(await page.locator('.editorial-hero-description').innerText(),presentation['home.hero.description']);
    const img=page.locator('.editorial-hero-photo img');
    try { await img.evaluate(img=>img.decode()); }
    catch(error) { console.error(await img.evaluate(img=>({src:img.src,currentSrc:img.currentSrc,complete:img.complete,naturalWidth:img.naturalWidth})),processes.logs());throw error; }
    assert.ok(await img.evaluate(img=>img.naturalWidth>0));
    const photo=await fetch(processes.origin+await img.getAttribute('src'));
    assert.equal(photo.status,200);assert.match(photo.headers.get('content-type'),/^image\/jpeg/);
    assert.equal((await fetch(processes.origin+'/media/credits.json')).status,404);
    await page.goto(processes.origin+'/tours/');
    await page.locator('header .desktop-nav a[href="/"]').click();
    assert.equal(new URL(page.url()).pathname,'/');
    await processes.stop();processes=undefined;
  }
  const publicFiles=await readdir(new URL('../frontend/public/assets/editorial/',import.meta.url));
  assert.ok(!publicFiles.some(name=>/\.(jpg|jpeg|webp|png|avif)$/i.test(name)));
  console.log('PASS: two edited local JSON revisions render as SSR HTML and metadata without a frontend rebuild or browser JavaScript; registered backend photos load through the same-origin resource route; explicit Home navigation works; no travel photos in frontend public.');
} finally {
  await browser?.close();await processes?.stop();
  assert.ok(resolve(directory).startsWith(resolve(qaRoot)+sep),'Cleanup must remain inside task QA directory');
  await rm(directory,{recursive:true});
}
