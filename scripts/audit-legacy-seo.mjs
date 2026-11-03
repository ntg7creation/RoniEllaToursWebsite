import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const origin="https://roniellatours.com";
const directory=new URL("../.qa/legacy-seo/",import.meta.url);
await mkdir(directory,{recursive:true});
const manifest=JSON.parse(await readFile(new URL("../back/content/index.json",import.meta.url),"utf8"));
const pages=await Promise.all(manifest.pages.map(async page=>JSON.parse(await readFile(new URL(`../back/content/${page.file}`,import.meta.url),"utf8"))));
const rules=JSON.parse(await readFile(new URL("../back/content/redirects.json",import.meta.url),"utf8"));
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const parser=await browser.newPage();
  const queue=[origin+"/",origin+"/הטיולים-שלנו/",origin+"/בלוג/"];
  const rows=[];
  for(let index=0;index<queue.length;index++) {
    const url=queue[index];
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    const html=await response.text();
    await writeFile(new URL(`page-${index}.html`,directory),html);
    const extracted=await parser.evaluate(({html,url})=>{
      const doc=new DOMParser().parseFromString(html,"text/html");
      const metadata=[...doc.querySelectorAll("meta[name],meta[property]")].map(node=>({key:node.getAttribute("name")??node.getAttribute("property"),value:node.getAttribute("content")}));
      const schema=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(node=>{try{return JSON.parse(node.textContent)}catch{return {invalid:true}}});
      return {title:doc.title,metadata,canonical:doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),schema,
        h1:[...doc.querySelectorAll("h1")].map(n=>n.textContent.trim()),
        articles:[...doc.querySelectorAll("article a[href],.elementor-post a[href]")].map(a=>new URL(a.getAttribute("href"),url).href)};
    },{html,url});
    if(index===2) for(const article of [...new Set(extracted.articles)]) if(article.startsWith(origin+"/")&&!queue.includes(article)) queue.push(article);
    const legacyPath=decodeURIComponent(new URL(url).pathname);
    const rule=rules.find(rule=>decodeURIComponent(rule.fromPath)===legacyPath && !Object.keys(rule.fromQuery).length);
    const target=pages.find(page=>page.path===(index===0?"/":rule?.toPath));
    const description=extracted.metadata.find(item=>item.key==="description")?.value??null;
    rows.push({url:response.url,status:response.status,target:target?.path??null,...extracted,
      rebuildTitle:target?.seo.title??null,titlePreserved:target?.seo.title===extracted.title,
      descriptionPreserved:!description||target?.seo.description===description});
    console.log(`${response.status} ${target?.path??"UNMAPPED"} title:${target?.seo.title===extracted.title?"preserved":"REVIEW"}`);
  }
  await writeFile(new URL("report.json",directory),JSON.stringify({checkedAt:new Date().toISOString(),rows},null,2)+"\n");
  console.log(`Inspected ${rows.length} original HTML responses; ${rows.filter(r=>r.target?.startsWith("/blog/")&&r.target!=="/blog/").length} mapped blog articles. Evidence: .qa/legacy-seo/report.json`);
} finally {await browser.close();}
