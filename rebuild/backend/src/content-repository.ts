import { readFile, realpath, stat } from "node:fs/promises";
import { relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LocalContentManifestSchema, parseSiteContent, type PublicSiteContent } from "@roniella/shared/site-content";
import { registeredMedia, validateRuntimeContent } from "./runtime-content.js";

export interface MediaFile { path: string; filename: string }
export interface ContentRepository {
  getPublicContent(): Promise<PublicSiteContent>;
  getMedia?(filename: string): Promise<MediaFile | undefined>;
}
export const defaultContentDirectory = new URL("../content/", import.meta.url);

// A future database adapter can replace this boundary without changing SSR pages.
export class LocalContentRepository implements ContentRepository {
  private constructor(private readonly content: PublicSiteContent, private readonly files: Map<string, MediaFile>) {}

  static async load(directory: URL = defaultContentDirectory): Promise<LocalContentRepository> {
    const root = await realpath(fileURLToPath(directory));
    const resolveFile = async (file: string) => {
      const resolved = await realpath(fileURLToPath(new URL(file, directory)));
      const rel = relative(root, resolved);
      if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
        throw Error(`Content file escapes its directory: ${file}`);
      if (!(await stat(resolved)).isFile()) throw Error(`Not a content file: ${file}`);
      return resolved;
    };
    const read = async (file: string) => {
      try { return JSON.parse(await readFile(await resolveFile(file), "utf8")) as unknown; }
      catch (error) { throw Error(`Cannot read local content ${file}: ${error instanceof Error ? error.message : "invalid JSON"}`); }
    };
    const manifest = LocalContentManifestSchema.parse(await read("index.json"));
    const pages = [];
    const pageFiles = new Set<string>();
    for (const entry of manifest.pages) {
      if (pageFiles.has(entry.file)) throw Error(`Duplicate page file: ${entry.file}`);
      pageFiles.add(entry.file);
      const page = await read(entry.file) as PublicSiteContent["pages"][number];
      if (page.id !== entry.id || page.path !== entry.path) throw Error(`Local manifest/page mismatch: ${entry.file}`);
      pages.push(page);
    }
    const content = parseSiteContent({
      schemaVersion: manifest.apiSchemaVersion,
      contentSource: manifest.contentSource,
      crawlRunId: manifest.crawlRunId,
      notice: manifest.notice,
      siteSettings: await read("site-settings.json"),
      redirects: await read("redirects.json"),
      presentation: await read("presentation.json"),
      media: await read("media.json"),
      gallery: await read("gallery.json"),
      pages,
    });
    validateRuntimeContent(content);
    const files = await registeredMedia(content, new URL("media/", directory));
    return new LocalContentRepository(content, files);
  }
  async getPublicContent() { return this.content; }
  async getMedia(filename: string) { return this.files.get(filename); }
}
