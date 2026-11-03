import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const origin = new URL(process.argv[2] ?? "https://roniella-web.vercel.app").origin;
const label = process.argv[3] ?? "live";
if (!/^[a-z0-9-]+$/.test(label)) throw Error("Invalid report label");
const output = new URL(`../.qa/seo-${label}/`, import.meta.url);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("../back/content/index.json", import.meta.url), "utf8"));
const redirects = JSON.parse(await readFile(new URL("../back/content/redirects.json", import.meta.url), "utf8"));
const sources = await Promise.all(manifest.pages.map(p => readFile(new URL(`../back/content/${p.file}`,import.meta.url),"utf8").then(JSON.parse)));
let executablePath;
for (const path of [process.env.BROWSER_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean))
  try { await access(path); executablePath=path; break; } catch {}
const browser = await chromium.launch({ headless:true, executablePath });
const parser = await browser.newPage();
const report = { origin, auditedAt:new Date().toISOString(), pages:[], redirects:[], resources:[], errors:[], browser:[] };
async function request(path, options={}) {
  return fetch(new URL(path,origin),{redirect:"manual",signal:AbortSignal.timeout(25000),...options});
}
async function mapLimit(items, fn, count=3) {
  let cursor=0;
  await Promise.all(Array.from({length:count},async()=>{while(cursor<items.length){const index=cursor++;await fn(items[index],index);}}));
}
function problem(page,message) { report.errors.push({page,message}); }
try {
  for (const path of ["/health","/robots.txt","/sitemap.xml","/seo-audit-missing-page/"]) {
    const r=await request(path); report.resources.push({path,status:r.status,body:(await r.text()).slice(0,10000),robots:r.headers.get("x-robots-tag")});
  }
  // Fetch before parsing: these HTML documents never execute scripts or load resources.
  const documents=[];
  await mapLimit(sources,async source=>{
    const r=await request(source.path), html=await r.text();
    documents.push({source,status:r.status,headers:Object.fromEntries(r.headers),html});
  });
  for (const {source,status,headers,html} of documents.sort((a,b)=>a.source.path.localeCompare(b.source.path))) {
    const parsed=await parser.evaluate(html=>{
      const doc=new DOMParser().parseFromString(html,"text/html");
      const all=s=>Array.from(doc.querySelectorAll(s));
      const metas={};for(const m of all("meta[name],meta[property]")){const key=m.getAttribute("name")??m.getAttribute("property");(metas[key]??=[]).push(m.getAttribute("content"));}
      const ld=all('script[type="application/ld+json"]').map(s=>{try{return JSON.parse(s.textContent)}catch{return {invalid:true}}});
      const ids=all("[id]").map(e=>e.id);
      for(const s of all("script,style"))s.remove();
      return {title:doc.title,titleCount:all("title").length,metas,canonicals:all('link[rel="canonical"]').map(e=>e.getAttribute("href")),
        lang:doc.documentElement.lang,dir:doc.documentElement.dir,h1:all("h1").map(e=>e.textContent.trim()),
        mainText:doc.querySelector("main")?.textContent.replace(/\s+/g," ").trim()??"",
        jsonLd:ld,ids,duplicateIds:ids.filter((v,i)=>ids.indexOf(v)!==i),
        links:all("a[href]").map(e=>({href:e.getAttribute("href"),text:e.textContent.trim(),label:e.getAttribute("aria-label")})),
        images:all("img").map(e=>({src:e.getAttribute("src"),srcset:e.getAttribute("srcset"),alt:e.getAttribute("alt"),width:e.getAttribute("width"),height:e.getAttribute("height")})),
        assets:all('link[rel="stylesheet"],link[rel="preload"],link[rel="icon"]').map(e=>e.getAttribute("href")),
      };
    },html);
    const result={path:source.path,pageType:source.pageType,status,bytes:Buffer.byteLength(html),headerRobots:headers["x-robots-tag"],...parsed};
    report.pages.push(result);
    await writeFile(new URL(`${source.path.replaceAll("/","_")||"home"}.html`,output),html);
    if(status!==200)problem(source.path,`HTTP ${status}`);
    if(parsed.titleCount!==1 || parsed.title!==source.seo.title)problem(source.path,"Missing/duplicate/unexpected SSR title");
    if(parsed.h1.length!==1)problem(source.path,`H1 count ${parsed.h1.length}`);
    if(parsed.lang!=="he"||parsed.dir!=="rtl")problem(source.path,"Incorrect language/direction");
    if(parsed.canonicals.length!==1||parsed.canonicals[0]!==origin+source.path)problem(source.path,"Canonical mismatch");
    if(!parsed.metas.description?.[0]?.trim())problem(source.path,"Missing meta description");
    if(parsed.mainText.length<60)problem(source.path,"Insufficient SSR body content");
    if(!parsed.jsonLd.length)problem(source.path,"Missing structured data");
    if(parsed.jsonLd.some(x=>x.invalid))problem(source.path,"Invalid JSON-LD");
    if(!parsed.metas["og:title"]||!parsed.metas["og:url"])problem(source.path,"Missing Open Graph metadata");
    if(parsed.metas["og:url"] && parsed.metas["og:url"][0]!==parsed.canonicals[0])problem(source.path,"Open Graph URL differs from canonical");
    if(parsed.metas["og:title"] && parsed.metas["og:title"][0]!==parsed.title)problem(source.path,"Open Graph title differs from page title");
    for(const schema of parsed.jsonLd){
      if(!schema["@graph"])continue;
      const ids=new Set(schema["@graph"].map(n=>n["@id"]));
      const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==="object"){
        if(value["@id"]&&!ids.has(value["@id"]))problem(source.path,`Undefined schema identity: ${value["@id"]}`);
        Object.values(value).forEach(visit);
      }};visit(schema["@graph"]);
      const node=schema["@graph"].find(n=>n["@id"]===parsed.canonicals[0]+"#webpage");
      if(!node||node.url!==parsed.canonicals[0])problem(source.path,"Schema page URL differs from canonical");
    }
    if(parsed.duplicateIds.length)problem(source.path,`Duplicate HTML IDs: ${[...new Set(parsed.duplicateIds)].join(", ")}`);
    if(parsed.images.some(i=>i.alt===null))problem(source.path,"Image lacks alt attribute");
  }
  const byPath=new Map(report.pages.map(p=>[p.path,p]));
  const extraPaths=new Set(),assets=new Set(),edges=new Map();
  for(const page of report.pages){
    edges.set(page.path,new Set());
    for(const link of page.links){
      if(!link.href||/^(tel:|mailto:)/.test(link.href))continue;
      const url=new URL(link.href,origin+page.path);
      if(url.origin!==origin)continue;
      if(byPath.has(url.pathname)){
        edges.get(page.path).add(url.pathname);
        if(url.hash){let id;try{id=decodeURIComponent(url.hash.slice(1))}catch{id=url.hash.slice(1)}
          if(!byPath.get(url.pathname).ids.includes(id))problem(page.path,`Broken fragment: ${link.href}`);}
      }else if(!url.pathname.startsWith("/media/"))extraPaths.add(url.pathname+url.search);
    }
    for(const image of page.images){assets.add(image.src);for(const variant of (image.srcset??"").split(",")){if(variant.trim())assets.add(variant.trim().split(/\s+/)[0]);}}
    for(const asset of page.assets)assets.add(asset);
    for(const image of page.metas["og:image"]??[])assets.add(image);
  }
  const reachable=new Set(["/"]),todo=["/"];while(todo.length){for(const next of edges.get(todo.pop())??[]){if(!reachable.has(next)){reachable.add(next);todo.push(next);}}}
  report.orphanPages=[...byPath.keys()].filter(p=>!reachable.has(p));
  for(const path of report.orphanPages)problem(path,"No crawlable internal-link path from homepage");
  await mapLimit([...extraPaths],async path=>{const r=await request(path);const result={path,status:r.status,location:r.headers.get("location")};report.resources.push(result);await r.body?.cancel();if(r.status>=400)problem(path,`Broken internal link: HTTP ${r.status}`);});
  await mapLimit([...assets].filter(Boolean),async path=>{const url=new URL(path,origin);if(url.origin!==origin)return;const r=await request(url.href,{method:"HEAD"});report.resources.push({path,status:r.status,type:r.headers.get("content-type")});if(r.status!==200)problem(path,`Asset HTTP ${r.status}`);});
  await mapLimit(redirects,async rule=>{
    const url=new URL(rule.fromPath,origin);for(const [key,value] of Object.entries(rule.fromQuery))url.searchParams.set(key,value);
    const r=await request(url.href);const location=r.headers.get("location");await r.body?.cancel();
    report.redirects.push({source:url.pathname+url.search,status:r.status,location,expected:rule.toPath});
    if(r.status!==301||!location||new URL(location,origin).pathname!==rule.toPath)problem(url.pathname,"Legacy redirect mismatch");
  });
  for(const js of [false,true]){
    const context=await browser.newContext({javaScriptEnabled:js,viewport:{width:1280,height:900}}),page=await context.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    for(const path of ["/","/tours/china-may-2027/","/blog/uzbekistan-silk-road/","/gallery/"]){
      const r=await page.goto(origin+path,{waitUntil:"networkidle",timeout:45000});
      const body=await page.locator("main").textContent();
      report.browser.push({path,javaScript:js,status:r.status(),bodyLength:body.length,h1:await page.locator("h1").count()});
      if(!js&&path.includes("china")){await page.locator(".day-card").nth(1).locator("summary").click();report.browser.at(-1).nativeItineraryWorks=await page.locator(".day-card").nth(1).getAttribute("open")!==null;}
      if(js&&path==="/")await page.screenshot({path:fileURLToPath(new URL("home-desktop.png",output)),fullPage:true});
    }
    if(js){await page.setViewportSize({width:390,height:844});await page.goto(origin+"/",{waitUntil:"networkidle"});await page.screenshot({path:fileURLToPath(new URL("home-mobile.png",output)),fullPage:true});}
    report.browser.push({javaScript:js,errors});await context.close();
  }
}finally{
  await browser.close();
  await writeFile(new URL("report.json",output),JSON.stringify(report,null,2)+"\n");
  const counts={};for(const e of report.errors)counts[e.message]=(counts[e.message]??0)+1;
  console.log(JSON.stringify({origin,pages:report.pages.length,redirects:report.redirects.length,resources:report.resources.length,findings:counts,orphanPages:report.orphanPages,browser:report.browser,report:fileURLToPath(new URL("report.json",output))},null,2));
}
