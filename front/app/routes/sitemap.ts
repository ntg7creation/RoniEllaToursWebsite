import type { LoaderFunctionArgs } from "react-router";
import { requestPublicContent } from "../server/content.server";
import { serverConfig } from "../server/config.server";
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
export async function loader({ request }: LoaderFunctionArgs) {
  if (serverConfig.noindex) return new Response("Not found", { status: 404 });
  const content = await requestPublicContent(request);
  const urls = content.pages.map(page => `<url><loc>${xml(serverConfig.siteOrigin + page.seo.canonicalPath)}</loc></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
