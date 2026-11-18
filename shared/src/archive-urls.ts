import { normalizePath } from "./urls.js";
import type { ArchiveManifest, SiteRedirect } from "./site-content.js";
export function sourceUrlKey(value: string): string {
  const url = new URL(value, "https://roniellatours.com");
  return (
    normalizePath(url.pathname) +
    `?${[...url.searchParams]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")}`
  );
}
export function archiveUrlCatalog(manifest: ArchiveManifest) {
  const pages = manifest.pages.filter(
    (p) => p.httpStatus === 200 && p.publicPath !== null,
  );
  const byId = new Map(pages.map((p) => [p.pageId, p.publicPath!]));
  const bySource = new Map<string, string>();
  const redirects: SiteRedirect[] = [];
  const seen = new Set<string>();
  for (const row of manifest.urls) {
    const toPath = row.pageId ? byId.get(row.pageId) : undefined;
    if (!toPath || !["extracted", "redirected"].includes(row.outcome)) continue;
    const url = new URL(row.requestedUrl);
    bySource.set(sourceUrlKey(url.href), toPath);
    const fromPath = normalizePath(url.pathname),
      fromQuery = Object.fromEntries(url.searchParams);
    if (fromPath === toPath && !url.search) continue;
    const key = sourceUrlKey(url.href);
    if (seen.has(key)) continue;
    seen.add(key);
    redirects.push({ fromPath, fromQuery, toPath });
  }
  return { pages, bySource, redirects };
}
export function archiveRedirectLocation(
  url: URL,
  rules: SiteRedirect[],
): string | null {
  const requestedPath = normalizePath(url.pathname);
  const path = requestedPath === "/index.php/" ? "/" : requestedPath;
  const query = new URLSearchParams(url.search);
  // WordPress accepts both shortlink forms. Never guess a destination for an
  // unknown ID, or carry WordPress routing parameters onto the English page.
  if (path === "/" && query.has("page_id")) {
    if (query.has("p") && query.get("p") !== query.get("page_id")) return null;
    query.set("p", query.get("page_id")!);
    query.delete("page_id");
  }
  if (path === "/" && query.get("p") === "3167") {
    query.delete("p");
    query.delete("post_type");
    return "/thank-you/" + (query.size ? "?" + query : "");
  }
  const rule = rules
    .filter((r) => r.fromPath === path)
    .sort(
      (a, b) =>
        Object.keys(b.fromQuery).length - Object.keys(a.fromQuery).length,
    )
    .find((r) => (!query.has("p") || path !== "/" || r.fromQuery.p !== undefined) &&
      Object.entries(r.fromQuery).every(
        ([k, v]) => query.get(k) === v,
      ),
    );
  if (!rule) return null;
  const search = query;
  for (const key of Object.keys(rule.fromQuery)) search.delete(key);
  if (rule.fromQuery.p) search.delete("post_type");
  return `${rule.toPath}${search.size ? `?${search}` : ""}`;
}
