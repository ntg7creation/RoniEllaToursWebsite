import { realpath, stat } from "node:fs/promises";
import { basename, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { PublicSiteContent } from "@roniella/shared/site-content";
import type { MediaFile } from "./content-repository.js";

export function validateRuntimeContent(content: PublicSiteContent) {
  const requiredCopy = [
    "home.hero.heading", "home.hero.kicker", "home.hero.description",
    "home.welcome.kicker", "home.welcome.title", "home.welcome.body",
    "home.destinations.kicker", "home.destinations.title", "home.destinations.intro",
    ...["china", "uzbekistan"].flatMap(destination => ["kicker", "title", "body"].map(field => `home.${destination}.${field}`)),
    "home.approach.kicker", "home.approach.title", "home.approach.body",
    ...[1,2,3].flatMap(number => ["title", "body"].flatMap(field => [`home.principle.${number}.${field}`, `april.highlight.${number}.${field}`])),
    ...["departures", "reviews", "journal"].flatMap(section => ["title", "kicker"].map(field => `home.${section}.${field}`)),
    "team.kicker", "team.title", "team.body", "contact.kicker", "contact.title", "contact.body",
    ...["china", "uzbekistan"].flatMap(destination => ["title", "body"].map(field => `tour.${destination}.${field}`)),
    "april.route.stops", "footer.tagline", "footer.invitation",
  ];
  for (const key of requiredCopy)
    if (!content.presentation[key]?.trim()) throw Error(`Missing presentation content: ${key}`);
  for (const id of ["bukhara", "samarkand", "china"])
    if (!content.media.some(asset => asset.id === id)) throw Error(`Missing site media slot: ${id}`);
  if (!content.pages.some(page => page.path === "/")) throw Error("A published homepage is required");
  if (content.pages.some(page => page.path === "/health/" || page.path.startsWith("/media/")))
    throw Error("Page path conflicts with a reserved application endpoint");
}

export async function registeredMedia(content: PublicSiteContent, directory: URL) {
  const root = await realpath(fileURLToPath(directory));
  const files = new Map<string, MediaFile>();
  for (const asset of [...content.media, ...(content.gallery?.photos ?? [])]) {
    for (const src of new Set([asset.src, ...asset.variants.map(v => v.src)])) {
      const filename = basename(src);
      if (files.has(filename)) continue;
      const path = await realpath(fileURLToPath(new URL(filename, directory)));
      const rel = relative(root, path);
      if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || !(await stat(path)).isFile())
        throw Error(`Invalid registered media file: ${filename}`);
      files.set(filename, { path, filename });
    }
  }
  return files;
}
