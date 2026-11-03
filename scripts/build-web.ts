import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { LocalContentRepository } from "../back/src/content-repository.js";
import { parseSiteContent, contentRevisionSource } from "../shared/src/site-content.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = resolve(root, "front"), staging = resolve(app, ".ssg");
const origin = process.env.SITE_ORIGIN ?? (process.env.DEPLOYMENT_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const hosted = process.env.VERCEL === "1";
const remote = !!process.env.BACKEND_ORIGIN;
if (hosted && (!remote || !process.env.BACKEND_API_TOKEN)) throw Error("SSG hosted build requires BACKEND_ORIGIN and BACKEND_API_TOKEN");
// One validated snapshot per build; never silently substitute sample content for a failed API.
const content = remote ? await (async () => {
  try {
    const response = await fetch(new URL("/api/v1/content", process.env.BACKEND_ORIGIN), {
      headers: { Accept:"application/json", ...(process.env.BACKEND_API_TOKEN ? {Authorization:`Bearer ${process.env.BACKEND_API_TOKEN}`} : {}),
        ...(process.env.BACKEND_VERCEL_BYPASS_SECRET ? {"x-vercel-protection-bypass":process.env.BACKEND_VERCEL_BYPASS_SECRET} : {}) },
      redirect:"error", signal:AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error();
    return parseSiteContent(await response.json());
  } catch { throw Error("SSG could not read valid published backend content; build stopped without a local-content fallback"); }
})() : await (await LocalContentRepository.load()).getPublicContent();
const snapshot = JSON.stringify(content);
const paths = content.pages.filter(page=>page.pageType !== "gallery").map(page=>page.path);
await mkdir(staging, {recursive:true});
const snapshotFile = resolve(staging,"content.json");
await writeFile(snapshotFile,snapshot);
try {
  const require=createRequire(new URL("../front/package.json",import.meta.url));
  const packageFile=require.resolve("@react-router/dev/package.json");
  const pkg=JSON.parse(await readFile(packageFile,"utf8"));
  const cli=resolve(dirname(packageFile),pkg.bin["react-router"]);
  await new Promise<void>((done,reject)=>{
    const child=spawn(process.execPath,[cli,"build"],{cwd:app,windowsHide:true,stdio:"inherit",env:{...process.env,
      SITE_ORIGIN:origin,RONIELLA_BUILD_CONTENT:snapshotFile}});
    child.on("error",reject); child.on("exit",code=>code===0?done():reject(Error(`Frontend build failed (${code})`)));
  });
  const client = resolve(app,"build/client"), output = resolve(app,"build/ssg");
  if (relative(app,output) !== ["build","ssg"].join(sep)) throw Error("Unsafe SSG output");
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  const pages: Record<string,string> = {};
  for (const [index,path] of paths.entries()) {
    const source=resolve(client,`.${path}`,"index.html"), rel=relative(client,source);
    if (rel.startsWith("..") || isAbsolute(rel)) throw Error("Unsafe generated path");
    const html=await readFile(source,"utf8");
    if (!html.includes(`rel="canonical" href="${new URL(path,origin).href}"`) || !html.includes('application/ld+json'))
      throw Error(`SSG metadata missing: ${path}`);
    const filename=`page-${index}.html`;
    await cp(source,resolve(output,filename)); pages[path]=filename;
    // HTML/data are served behind the content-aware runtime, never as stale public assets.
    await rm(source);
  }
  async function removeData(directory:string) {
    const {readdir}=await import("node:fs/promises");
    for(const entry of await readdir(directory,{withFileTypes:true})) {
      const file=resolve(directory,entry.name);
      if(entry.isDirectory()) await removeData(file);
      else if(entry.name.endsWith(".data")) await rm(file);
    }
  }
  await removeData(client);
  await writeFile(resolve(output,"manifest.json"),JSON.stringify({schemaVersion:1,origin:new URL(origin).origin,
    noindex:process.env.ALLOW_INDEXING !== "true",revision:createHash("sha256").update(contentRevisionSource(content)).digest("hex"),pages},null,2)+"\n");
  console.log(`SSG: ${paths.length} pages generated from ${remote ? "published backend" : "local development"} content. Gallery remains dynamic.`);
} finally { await rm(snapshotFile,{force:true}); }
