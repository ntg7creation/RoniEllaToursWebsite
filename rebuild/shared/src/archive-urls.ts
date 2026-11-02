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
  const path = normalizePath(url.pathname);
  const rule = rules
    .filter((r) => r.fromPath === path)
    .sort(
      (a, b) =>
        Object.keys(b.fromQuery).length - Object.keys(a.fromQuery).length,
    )
    .find((r) =>
      Object.entries(r.fromQuery).every(
        ([k, v]) => url.searchParams.get(k) === v,
      ),
    );
  if (!rule) return null;
  const search = new URLSearchParams(url.search);
  for (const key of Object.keys(rule.fromQuery)) search.delete(key);
  return `${rule.toPath}${search.size ? `?${search}` : ""}`;
}
