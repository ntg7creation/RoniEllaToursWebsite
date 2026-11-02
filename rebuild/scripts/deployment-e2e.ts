import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migratedTestDatabase } from "./database-test-support.js";

const root = fileURLToPath(new URL("../",import.meta.url));
const vercel = process.argv.includes("--vercel");
const harness = resolve(root,"scripts/serve-vercel-output.mjs");
const bypass = "local-only-vercel-protection-test";
const protectionHeaders: Record<string,string> = vercel ? { "x-vercel-protection-bypass": bypass } : {};
const require = createRequire(new URL("../frontend/package.json",import.meta.url));
const serve = resolve(dirname(require.resolve("@react-router/serve/package.json")),"dist/cli.js");
const db = await migratedTestDatabase();
const secret = "sb_secret_deployment_test_not_a_real_key", token = "deployment-test-interservice-token-1234567890";
const origin = "http://127.0.0.1:4100", apiOrigin = "http://127.0.0.1:4101", canonical = "https://roniellatours.com";
let available = true, calls = 0;
const children: (ChildProcess & { output?:string })[] = [];
const bridge = createServer(async (req,res) => {
  if (req.url !== "/rest/v1/rpc/read_site_content" || req.method !== "POST") { res.writeHead(404).end(); return; }
  if (req.headers.apikey !== secret || req.headers.authorization) { res.writeHead(401).end(); return; }
  calls++;
  if (!available) { res.writeHead(503).end("Private upstream diagnostic must not be exposed"); return; }
  try {
    const result = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{content:unknown}>("select public.read_site_content() as content");
    });
    res.setHeader("Content-Type","application/json"); res.end(JSON.stringify(result.rows[0]!.content));
  } catch { res.writeHead(500).end(); }
});
function start(args:string[],cwd:string,env:NodeJS.ProcessEnv) {
  const child = spawn(process.execPath,args,{cwd:resolve(root,cwd),windowsHide:true,env:{...process.env,NODE_ENV:"production",...env},stdio:["ignore","pipe","pipe"]}) as ChildProcess & {output?:string};
  child.output="";
  for(const stream of [child.stdout,child.stderr]) stream?.on("data",data=>{child.output=(child.output+String(data)).slice(-8000);});
  children.push(child); return child;
}
async function stop(child:ChildProcess) {
  if(child.exitCode!==null || child.signalCode!==null) return;
  const closed=once(child,"exit"); child.kill(); await closed;
}
async function ready(url:string,child:ChildProcess & {output?:string}) {
  for(let i=0;i<100;i++) {
    if(child.exitCode!==null) throw Error(`Test process exited: ${child.output}`);
    try { if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error(`Local deployment test did not become ready: ${child.output}`);
}
const htmlText = (html:string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"");
try {
  await db.exec(await readFile(new URL("../supabase/seed.sql",import.meta.url),"utf8"));
  await new Promise<void>(resolve=>bridge.listen(0,"127.0.0.1",resolve));
  const address=bridge.address(); assert.ok(address && typeof address!=="string");
  const api=start(vercel ? [harness] : ["dist/server.js"],"backend",{
    DEPLOYMENT_ENV:"local",CONTENT_PROVIDER:"supabase",API_HOST:"127.0.0.1",API_PORT:"4101",
    SUPABASE_URL:`http://127.0.0.1:${address.port}`,SUPABASE_SECRET_KEY:secret,BACKEND_API_TOKEN:token,
    CONTENT_CACHE_MS:"0",SUPABASE_TIMEOUT_MS:"1000",
    PORT:"4101", ...(vercel ? { TEST_BACKEND_PROTECTION:bypass } : {}),
  });
  await ready(apiOrigin+"/ready",api);
  const webEnv={HOST:"127.0.0.1",PORT:"4100",BACKEND_ORIGIN:apiOrigin,BACKEND_API_TOKEN:token,SITE_ORIGIN:canonical,CONTENT_TIMEOUT_MS:"3000", ...(vercel ? { BACKEND_VERCEL_BYPASS_SECRET:bypass } : {})};
  const webArgs=vercel ? [harness] : [serve,"./build/server/index.js"];
  const web=start(webArgs,"frontend",{...webEnv,DEPLOYMENT_ENV:"production",ALLOW_INDEXING:"true"});
  await ready(origin+"/health",web);
  assert.equal((await fetch(apiOrigin+"/api/v1/content",{headers:protectionHeaders})).status,401);
  const content=await(await fetch(apiOrigin+"/api/v1/content",{headers:{...protectionHeaders,Authorization:`Bearer ${token}`}})).json();
  assert.equal(content.pages.length,40);
  for(const page of content.pages) {
    const response=await fetch(origin+page.path);
    assert.equal(response.status,200,page.path);
    const html=await response.text();
    assert.ok(html.includes(`rel="canonical" href="${canonical}${page.path}"`),page.path);
    assert.equal((htmlText(html).match(/<h1[ >]/g)??[]).length,1);
    assert.ok(!html.includes(secret) && !html.includes(token));
  }
  const robots=await(await fetch(origin+"/robots.txt")).text();
  assert.match(robots,/^Allow: \/$/m); assert.ok(robots.includes(`Sitemap: ${canonical}/sitemap.xml`));
  assert.equal(((await(await fetch(origin+"/sitemap.xml")).text()).match(/<url>/g)??[]).length,40);
  for(const rule of content.redirects) {
    const url=new URL(rule.fromPath,origin);
    for(const [key,value] of Object.entries(rule.fromQuery)) url.searchParams.set(key,String(value));
    const response=await fetch(url,{redirect:"manual"}); assert.equal(response.status,301);
    assert.equal(new URL(response.headers.get("location")!,origin).pathname,rule.toPath);
  }
  const galleryHtml=await(await fetch(origin+"/gallery/")).text();
  assert.equal([...galleryHtml.matchAll(/data-photo-id="/g)].length,24);
  const mediaResponse=await fetch(origin+content.gallery.photos[0].src);
  assert.equal(mediaResponse.status,200); assert.ok((await mediaResponse.arrayBuffer()).byteLength>1000);
  if (vercel) {
    const photo=content.gallery.photos[0].src.split("/").at(-1);
    const redirect=await fetch(apiOrigin+"/api/v1/media/"+photo,{redirect:"manual",headers:{...protectionHeaders,Authorization:`Bearer ${token}`}});
    assert.equal(redirect.status,307); assert.equal(redirect.headers.get("location"),"/photos/"+photo);
    assert.equal((await fetch(origin+"/media/not-in-album.jpg")).status,404);
    assert.equal((await fetch(apiOrigin+"/photos/content.json",{headers:protectionHeaders})).status,404);
    assert.equal((await fetch(origin+"/assets/fonts/assistant.css")).status,200);
    const script=galleryHtml.match(/(?:src|href)="(\/assets\/entry\.client-[^"]+\.js)"/);
    assert.ok(script); assert.equal((await fetch(origin+script[1])).status,200);
    const dataRedirect=await fetch(origin+"/gallery.data"); assert.equal(dataRedirect.status,202);
    assert.ok((await dataRedirect.text()).includes("/gallery/"));
    const data=await fetch(origin+"/gallery/_.data"); assert.equal(data.status,200);
    assert.match(data.headers.get("content-type") ?? "", /text\/x-script/);
    assert.ok((await data.text()).includes("gallery"));
    for(const project of ["frontend","backend"]) {
      const base=new URL(`../${project}/.vercel/output/`,import.meta.url);
      const functionFiles=await readdir(new URL("functions/server.func/",base));
      assert.deepEqual(functionFiles.sort(),[".vc-config.json","index.mjs"]);
      const config=JSON.parse(await readFile(new URL("config.json",base),"utf8"));
      assert.equal(config.version,3); assert.equal(config.routes.at(-1).dest,"/server");
      const code=await readFile(new URL("functions/server.func/index.mjs",base),"utf8");
      assert.ok(!code.includes(secret) && !code.includes(token) && !code.includes(bypass));
    }
  }
  await db.exec("update public.content_copy set value='כותרת מעודכנת מתוך מסד הנתונים' where area='home.hero' and slot='heading'");
  assert.ok(htmlText(await(await fetch(origin)).text()).includes("כותרת מעודכנת מתוך מסד הנתונים"));
  await db.exec(`insert into public.content_pages(id,path,page_type,title,seo_title,source_retrieved_at,position,published)
    values('page-deployment-test','/deployment-new-page/','article','New database page','New database page SEO',now(),9999,true);
    insert into public.content_blocks(page_id,position,block_type,text) values('page-deployment-test',0,'paragraph','New database paragraph');`);
  const newPage=await fetch(origin+"/deployment-new-page/"); assert.equal(newPage.status,200);
  assert.ok(htmlText(await newPage.text()).includes("New database paragraph"));
  assert.ok((await(await fetch(origin+"/sitemap.xml")).text()).includes("/deployment-new-page/"));
  await db.exec("update public.content_pages set published=false where id='page-deployment-test'");
  assert.equal((await fetch(origin+"/deployment-new-page/")).status,404);
  assert.ok(!(await(await fetch(origin+"/sitemap.xml")).text()).includes("/deployment-new-page/"));
  assert.equal((await fetch(origin+"/missing/")).status,404);
  available=false;
  assert.equal((await fetch(apiOrigin+"/ready")).status,503);
  assert.equal((await fetch(origin+"/health")).status,503);
  const failure=await fetch(origin); assert.equal(failure.status,503);
  assert.ok(!(await failure.text()).includes("Private upstream diagnostic"));
  available=true; assert.equal((await fetch(origin)).status,200);
  await stop(web);
  const previewEnv:NodeJS.ProcessEnv={...webEnv,DEPLOYMENT_ENV:"preview",ALLOW_INDEXING:"false"};
  if (vercel) { previewEnv.SITE_ORIGIN=undefined; previewEnv.VERCEL_URL="roniella-preview-test.vercel.app"; }
  const preview=start(webArgs,"frontend",previewEnv);
  await ready(origin+"/health",preview);
  const previewResponse=await fetch(origin); assert.match(previewResponse.headers.get("x-robots-tag")!,/noindex/);
  if (vercel) assert.ok((await previewResponse.text()).includes('rel="canonical" href="https://roniella-preview-test.vercel.app/"'));
  assert.match(await(await fetch(origin+"/robots.txt")).text(),/Disallow: \/\n/);
  assert.equal((await fetch(origin+"/sitemap.xml")).status,404);
  const assets=new URL("../frontend/build/client/assets/",import.meta.url);
  for(const file of (await readdir(assets)).filter(file=>file.endsWith(".js"))) {
    const js=await readFile(new URL(file,assets),"utf8");
    assert.ok(!js.includes("SUPABASE_SECRET_KEY") && !js.includes("BACKEND_API_TOKEN") && !js.includes("BACKEND_VERCEL_BYPASS_SECRET") && !js.includes(secret) && !js.includes(token),"Server secrets must never enter browser bundles");
  }
  assert.ok(calls>40);
  if (vercel) console.log("PASS: actual Vercel function bundles under local HTTP harness; static backend photos, protected API/CDN requests, streamed same-origin images, client assets/data route, preview origin, no photos/secrets bundled into functions. Hosted Vercel runtime not exercised.");
  console.log("PASS: production SSR → authenticated backend → Supabase HTTP adapter → real PostgreSQL; 40 pages/72 redirects; live database edits and new routes without rebuild; drafts/404s; gallery/backend media; production sitemap/canonicals; preview noindex; failed database readiness/503/recovery; no secrets in HTML/client bundles. Local test only, no hosted services contacted.");
} catch(error) {
  for(const child of children) console.error(child.output);
  throw error;
} finally {
  await Promise.all(children.map(stop));
  bridge.closeAllConnections();
  await new Promise<void>(resolve=>bridge.close(()=>resolve()));
  await db.close();
}
