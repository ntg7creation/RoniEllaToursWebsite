import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { LocalContentRepository } from "../../back/src/content-repository.js";
import { jpegDimensions } from "../../back/src/google-photos.js";
import { buildPageSeo, pageDescription } from "../app/server/seo.server.js";

test("all pages have content-derived descriptions and connected canonical schema identities", async () => {
  const content=await (await LocalContentRepository.load()).getPublicContent();
  const origin="https://roniellatours.com";
  for(const page of content.pages){
    const seo=buildPageSeo(page,content,origin),graph=seo.structuredData["@graph"];
    assert.ok(seo.description.trim());
    if(seo.image){
      const filename=new URL(seo.image.url).pathname.split("/").at(-1)!;
      const actual=jpegDimensions(await readFile(new URL(`../../back/content/media/${filename}`,import.meta.url)));
      assert.equal(seo.image.width,actual.width);assert.equal(seo.image.height,actual.height);
    }
    if(page.seo.description)assert.equal(seo.description,page.seo.description.replace(/\s+/g," ").trim());
    else assert.ok(seo.description.length<=165);
    const ids=new Set(graph.map(n=>n["@id"]));
    const visit=(value:unknown)=>{
      if(Array.isArray(value)){value.forEach(visit);return;}
      if(value&&typeof value==="object"){
        const node=value as Record<string,unknown>;
        if(typeof node["@id"]==="string")assert.ok(ids.has(node["@id"]),node["@id"]);
        Object.values(node).forEach(visit);
      }
    };
    visit(graph);
    const webpage=graph.find(n=>n["@id"]===origin+page.path+"#webpage")!;
    assert.equal(webpage.url,origin+page.seo.canonicalPath);
    const breadcrumbs=graph.find(n=>n["@type"]==="BreadcrumbList");
    assert.equal(Boolean(breadcrumbs),page.path!=="/");
    if(breadcrumbs)assert.equal((breadcrumbs.itemListElement as {item:string}[]).at(-1)!.item,origin+page.path);
    const article=graph.find(n=>n["@type"]==="BlogPosting");
    assert.equal(Boolean(article),page.pageType==="article");
    if(article){assert.equal(article.headline,page.title);assert.equal(Boolean(article.author),Boolean(page.author));assert.equal(article.aggregateRating,undefined);}
  }
});
test("SEO preserves explicit copy, escapes through React metadata, and omits unverified facts",async()=>{
  const content=await(await LocalContentRepository.load()).getPublicContent();
  const original=content.pages.find(p=>p.pageType==="article")!;
  const page={...original,title:'A </script><script>untrusted()</script> title',publicationDate:"2026-02-31",modificationDate:"not a date",seo:{...original.seo,description:" A custom description. "}};
  assert.equal(pageDescription(page,content),"A custom description.");
  const article=buildPageSeo(page,content,"https://example.com").structuredData["@graph"].find(n=>n["@type"]==="BlogPosting")!;
  assert.equal(article.datePublished,undefined);assert.equal(article.dateModified,undefined);
  assert.equal(article.headline,page.title); // Kept as data; React Router's JSON-LD renderer escapes it.
  assert.equal(article.offers,undefined);
});
