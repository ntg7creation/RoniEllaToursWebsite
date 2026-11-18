import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
import {launchProduction} from "./processes.mjs";

const servers=launchProduction({webPort:4700,apiPort:4701});
const output=new URL("../.qa/accessibility-audit/",import.meta.url);
const layouts=[],failures=[],pageErrors=[];
let browser;
try {
  await mkdir(output,{recursive:true});await servers.ready();
  const content=await(await fetch(servers.backendOrigin+"/api/v1/content")).json();
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of process.argv.includes("--interactions-only")?[]:[320,390]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});
    const page=await context.newPage();page.on("pageerror",error=>pageErrors.push(error.message));
    await page.goto(servers.origin,{waitUntil:"networkidle"});
    await page.getByRole("button",{name:"פתיחת תפריט נגישות",exact:true}).click();
    for(let i=0;i<4;i++)await page.getByRole("dialog",{name:"תפריט נגישות"}).getByRole("button",{name:"הגדלת טקסט",exact:true}).click();
    await page.keyboard.press("Escape");
    for(const [index,record] of content.pages.entries()){
      await page.goto(servers.origin+record.path,{waitUntil:"networkidle"});
      const measurement=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rootFont:getComputedStyle(document.documentElement).fontSize,
        outside:[...document.querySelectorAll("main button,main input,main select,main textarea,main summary")].filter(e=>{
          const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=="hidden"&&(r.left<-.5||r.right>innerWidth+.5);
        }).map(e=>({tag:e.tagName,text:e.textContent.slice(0,60),name:e.getAttribute("name")}))}));
      layouts.push({path:record.path,...measurement});
      if(measurement.scrollWidth>width+1||measurement.outside.length||parseFloat(measurement.rootFont)<31.9)failures.push({path:record.path,...measurement});
      if((index+1)%20===0)console.log(`Checked ${index+1}/${content.pages.length} pages with 200% text at ${width}px`);
    }
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:1000}}),page=await context.newPage();
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.goto(servers.origin,{waitUntil:"networkidle"});
  await page.keyboard.press("Tab");await page.keyboard.press("Enter");
  assert.equal(await page.locator("main").evaluate(e=>e===document.activeElement),true,"Skip link focuses main content");
  const summary=page.locator(".mobile-menu > summary");
  await summary.focus();await page.keyboard.press("Enter");
  await page.locator('.mobile-menu a[href="/tours/"]').waitFor({state:"visible"});
  await page.keyboard.press("Escape");
  assert.equal(await summary.evaluate(e=>e===document.activeElement),true);
  await summary.press("Enter");
  await page.locator('.mobile-menu a[href="/tours/"]').click();
  await page.waitForURL(servers.origin+"/tours/");
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest("details:not([open]),[inert],[hidden]"))),false,"Navigation must not strand focus in a closed menu");
  await page.goto(servers.origin+"/gallery/",{waitUntil:"networkidle"});
  const first=page.locator(".gallery-memory a").first();await first.focus();await page.keyboard.press("Enter");
  const modal=page.locator(".gallery-viewer[open]");await modal.waitFor();
  const close=modal.locator("button").first(),last=modal.locator("button").last();
  await last.focus();await page.keyboard.press("Tab");
  assert.equal(await close.evaluate(e=>e===document.activeElement),true,"Native dialog traps Tab; active="+await page.evaluate(()=>document.activeElement.outerHTML.slice(0,400)));
  await page.keyboard.press("Shift+Tab");assert.equal(await last.evaluate(e=>e===document.activeElement),true);
  const before=await page.locator("#gallery-photo-description").innerText();
  await page.keyboard.press("ArrowLeft");assert.notEqual(await page.locator("#gallery-photo-description").innerText(),before);
  await page.keyboard.press("Escape");assert.equal(await first.evaluate(e=>e===document.activeElement),true);
  await page.goto(servers.origin+"/contact/",{waitUntil:"networkidle"});
  await page.locator('.callback-form button[type="submit"]').click();
  await page.waitForFunction(()=>document.activeElement.getAttribute("name")==="name");
  for(const field of await page.locator('[aria-invalid="true"]').all()){
    const ids=await field.getAttribute("aria-describedby");assert.ok(ids);
    for(const id of ids.split(/\s+/))assert.ok(await page.locator(`[id="${id}"]`).count());
  }
  await context.close();
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:1000}}),staticPage=await noJs.newPage();
  for(const path of ["/","/tours/china-may-2027/","/contact/","/accessibility/"]){
    await staticPage.goto(servers.origin+path);assert.ok((await staticPage.locator("main").innerText()).length>100);
  }
  await noJs.close();
  await writeFile(new URL(process.argv.includes("--interactions-only")?"interactive-only.json":"interaction-layout.json",output),JSON.stringify({checkedAt:new Date().toISOString(),layouts,failures,pageErrors,
    flows:["skip link","keyboard mobile navigation","dialog Tab/Shift+Tab/Escape","dynamic photo descriptions","form error focus and descriptions","no-JavaScript content"]},null,2)+"\n");
  assert.deepEqual(failures,[],"200% text layout failures: "+JSON.stringify(failures));assert.deepEqual(pageErrors,[]);
  console.log(`PASS: ${layouts.length} page/viewport checks at 200% text; skip link, mobile navigation, native dialog keyboard/focus, photo announcements, form errors and no-JavaScript content. No real email or screen-reader certification.`);
} catch(error){await writeFile(new URL(process.argv.includes("--interactions-only")?"interaction-debug-failure.json":"interaction-layout-failure.json",output),JSON.stringify({layouts,failures,pageErrors,error:String(error)},null,2)+"\n");console.error(servers.logs());throw error;}
finally{await browser?.close();await servers.stop();}
