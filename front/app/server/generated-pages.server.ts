import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createContext, type MiddlewareFunction } from "react-router";
import { contentRevisionSource, type PublicSiteContent } from "@roniella/shared/site-content";
import { requestPublicContent } from "./content.server";
import { serverConfig, applyResponseHeaders } from "./config.server";

export const publicContentContext = createContext<PublicSiteContent>();
declare const __RONIELLA_SSG_DIRECTORY__: string | undefined;
type Generated = {origin:string;noindex:boolean;revision:string;pages:Record<string,string>};
const directory = typeof __RONIELLA_SSG_DIRECTORY__ === "string" ? new URL(__RONIELLA_SSG_DIRECTORY__,import.meta.url) : undefined;
const manifest = directory ? readFile(new URL("manifest.json",directory),"utf8").then(value=>JSON.parse(value) as Generated) : Promise.resolve(undefined);
let revision = "";
const rendered = new Map<string,{body:string;headers:Headers}>();
const limit = 100;

// Validate the current publication state before serving any generated HTML. This
// keeps deletions, new routes, navigation and metadata in sync with database edits.
export const generatedPageMiddleware: MiddlewareFunction<Response> = async ({request,url,context},next) => {
  const content = await requestPublicContent(request);
  const currentRevision = createHash("sha256").update(contentRevisionSource(content)).digest("hex");
  context.set(publicContentContext,content);
  const page=content.pages.find(page=>page.path===url.pathname);
  const eligible = !process.env.RONIELLA_BUILD_CONTENT && request.method === "GET" && !new URL(request.url).pathname.endsWith(".data") && !url.search && page && page.pageType !== "gallery";
  if (!eligible) return next();
  if (revision !== currentRevision) { rendered.clear(); revision=currentRevision; }
  const cached=rendered.get(url.pathname);
  const response = (body:string,headers:Headers,mode:string) => {
    const copy=new Headers(headers); applyResponseHeaders(copy); copy.set("X-Roniella-Render",mode);
    return new Response(body,{headers:copy});
  };
  if (cached) return response(cached.body,cached.headers,"cached");
  const built=await manifest;
  if (built && built.origin===serverConfig.siteOrigin && built.noindex===serverConfig.noindex && built.revision===currentRevision && built.pages[url.pathname]) {
    const body=await readFile(new URL(built.pages[url.pathname]!,directory!),"utf8");
    const headers=new Headers({"Content-Type":"text/html; charset=utf-8"});
    if(rendered.size>=limit) rendered.delete(rendered.keys().next().value!);
    rendered.set(url.pathname,{body,headers});
    return response(body,headers,"static");
  }
  // Regenerate via exactly the same loaders and SEO builder as the build-time HTML.
  const result=await next();
  if(result.status!==200 || !result.headers.get("content-type")?.includes("text/html")) return result;
  const generated={body:await result.text(),headers:result.headers};
  if(revision===currentRevision) {
    if(rendered.size>=limit) rendered.delete(rendered.keys().next().value!);
    rendered.set(url.pathname,generated);
  }
  return response(generated.body,generated.headers,"regenerated");
};
