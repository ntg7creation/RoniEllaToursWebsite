// Explicit import only: runtime never scrapes or rewrites editorial JSON.
// --stage uses a reviewed public crawl, --output can generate a separate review copy.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { adaptArchive } from "../back/src/archive-adapter.js";
import { ArchiveManifestSchema, ArchivePageSchema, ArchiveEntityLinksSchema, parseSiteContent } from "@roniella/shared/site-content";

const option = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const stage = option("stage");
if (stage && !/^[a-zA-Z0-9-]+$/.test(stage)) throw Error("Unsafe stage ID");
const archive = new URL("../docs/live-site-content/", import.meta.url);
const output = new URL(option("output") ?? "../back/content/", import.meta.url);
const root = fileURLToPath(archive);
const read = async (file: string) => {
  const path = resolve(root, file), rel = relative(root, path);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw Error("Unsafe archive input");
  return JSON.parse(await readFile(path, "utf8"));
};
const prefix = stage ? `staging/${stage}/` : "";
const manifest = ArchiveManifestSchema.parse(await read(prefix + "manifest.txt"));
try { await access(new URL("index.json", output)); throw Error("Output already contains content. Import into a new --output directory and review changes."); }
catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
const pages = await Promise.all(manifest.pages.filter(p => p.httpStatus === 200 && p.publicPath).map(async p => ArchivePageSchema.parse(await read(p.file))));
const links = ArchiveEntityLinksSchema.parse(await read(prefix + "entity-links.txt"));
const content = adaptArchive(manifest, pages, await read(prefix + "site-settings.txt"), links.entities);
const presentation = JSON.parse(await readFile(new URL("presentation.json", output), "utf8"));
const media = JSON.parse(await readFile(new URL("media.json", output), "utf8"));
const entries = content.pages.map(page => ({ id: page.id, path: page.path, file: `pages/${page.path === "/" ? "home" : page.path.split("/").filter(Boolean).join("-")}.json` }));
if (new Set(entries.map(entry => entry.file)).size !== entries.length) throw Error("Page filenames would collide; assign distinct saved filenames before import");
await mkdir(new URL("pages/", output), { recursive: true });
const write = async (file: string, value: unknown) => writeFile(new URL(file, output), JSON.stringify(value, null, 2) + "\n");
const publicPages = content.pages.map(page => ({ ...page,
  ...(page.path === "/tours/uzbekistan-april-2027/" ? { displayTitle: page.blocks.find(block => block.type === "heading")?.text } : {}),
  heroMediaId: page.path.includes("china") ? "china" : page.path.includes("uzbekistan") ? "samarkand" : null,
}));
const checked = parseSiteContent({ ...content, presentation, media, pages: publicPages });
for (const [i, page] of checked.pages.entries()) await write(entries[i]!.file, page);
await write("site-settings.json", checked.siteSettings);
await write("redirects.json", checked.redirects);
await write("index.json", { schemaVersion: 1, apiSchemaVersion: 2, contentSource: checked.contentSource, crawlRunId: checked.crawlRunId, notice: checked.notice, pages: entries });
await write("source-map.json", { origin: "https://roniellatours.com/", crawlRunId: manifest.crawlRunId, pages: pages.map(p => ({ id: p.pageId, sourceUrl: p.finalUrl, retrievedAt: p.retrievedAt, path: p.publicPath })), unavailable: manifest.pages.filter(p => p.httpStatus !== 200), note: "Public crawl evidence stays in docs/live-site-content; this folder contains editable runtime content." });
console.log(`Imported ${checked.pages.length} pages (${checked.pages.filter(p => p.pageType === "tour").length} tours) from ${manifest.crawlRunId} into ${fileURLToPath(output)}`);
