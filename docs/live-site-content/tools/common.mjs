import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const origin = "https://roniellatours.com";
export const hash = (text) =>
  `sha256:${createHash("sha256").update(text).digest("hex")}`;
export function publicIdentity(bodyClass) {
  const post = bodyClass.match(/\b(?:page-id|postid)-(\d+)\b/);
  if (post) return `wordpress:post:${post[1]}`;
  const author = bodyClass.match(/\bauthor-(\d+)\b/);
  if (author) return `wordpress:author:${author[1]}`;
  const category = bodyClass.match(/\bcategory-(\d+)\b/);
  if (category) return `wordpress:category:${category[1]}`;
  const tax = bodyClass.match(/\btax-([a-z_]+)\b/),
    term = bodyClass.match(/\bterm-(\d+)\b/);
  return tax && term ? `wordpress:taxonomy:${tax[1]}:${term[1]}` : null;
}
export const safePath = (path) => {
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel))
    throw new Error(`Path escapes archive: ${path}`);
  return target;
};
export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(safePath(path), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT" && fallback !== undefined) return fallback;
    throw e;
  }
}
export async function writeJson(path, value) {
  const target = safePath(path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2) + "\n", "utf8");
}
export function sameSite(value) {
  try {
    const u = new URL(value, origin);
    return (
      ["http:", "https:"].includes(u.protocol) &&
      ["roniellatours.com", "www.roniellatours.com"].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.port
    );
  } catch {
    return false;
  }
}
export function urlKey(value) {
  const u = new URL(value, origin);
  u.hash = "";
  try {
    u.pathname = decodeURI(u.pathname).normalize("NFC");
  } catch {}
  return u.href;
}
export function readableUrl(value) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}
export function crawlDecision(value) {
  let u;
  try {
    u = new URL(value, origin);
  } catch {
    return "invalid URL";
  }
  if (!sameSite(u.href)) return "external reference; not fetched";
  if (
    /\/(?:wp-admin|wp-login\.php|wp-json|xmlrpc\.php|feed)(?:\/|$|\?)/i.test(
      u.pathname,
    )
  )
    return "administrative/API/feed URL; not an HTML content page";
  if (
    /\.(?:jpg|jpeg|png|webp|gif|svg|ico|pdf|docx?|xlsx?|zip|mp4|mp3|css|js|woff2?|ttf|xml|txt)$/i.test(
      u.pathname,
    )
  )
    return "asset or non-HTML reference; no download";
  if (u.search) {
    const pairs = [...u.searchParams];
    if (
      !(
        pairs.length === 1 &&
        /^(?:p|page_id|paged|page|cat|tag|author)$/.test(pairs[0][0]) &&
        /^\d{1,7}$/.test(pairs[0][1])
      )
    )
      return "query variant excluded to bound crawl (not a content exclusion decision)";
  }
  return null;
}
