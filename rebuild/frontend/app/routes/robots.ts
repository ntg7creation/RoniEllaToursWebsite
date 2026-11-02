import { serverConfig } from "../server/config.server";
export function loader() {
  const body = serverConfig.noindex ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /health\nSitemap: ${serverConfig.siteOrigin}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
