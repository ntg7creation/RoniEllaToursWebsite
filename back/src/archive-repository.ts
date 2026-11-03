import { readFile } from "node:fs/promises";
import {
  ArchiveManifestSchema,
  ArchivePageSchema,
  ArchiveEntityLinksSchema,
  type PublicSiteContent,
} from "@roniella/shared/site-content";
import { adaptArchive } from "./archive-adapter.js";

export interface ContentRepository {
  getPublicContent(): Promise<PublicSiteContent>;
}

// File I/O is confined here; replace this adapter without changing HTTP handlers or pages.
export class ArchiveContentRepository implements ContentRepository {
  private constructor(private readonly content: PublicSiteContent) {}
  static async load(
    directory: URL = new URL(
      "../../docs/live-site-content/",
      import.meta.url,
    ),
  ): Promise<ArchiveContentRepository> {
    const read = async (path: string): Promise<unknown> => {
      try {
        return JSON.parse(await readFile(new URL(path, directory), "utf8"));
      } catch (error) {
        throw Error(
          `Cannot read archive ${path}: ${error instanceof Error ? error.message : "invalid JSON"}`,
        );
      }
    };
    const manifestResult = ArchiveManifestSchema.safeParse(
      await read("manifest.txt"),
    );
    if (!manifestResult.success)
      throw Error(
        `Archive manifest validation failed: ${manifestResult.error.message}`,
      );
    const manifest = manifestResult.data;
    const records = [];
    for (const entry of manifest.pages.filter(
      (p) => p.httpStatus === 200 && p.publicPath,
    )) {
      if (
        !/^page-[a-f0-9-]{36}$/.test(entry.pageId) ||
        entry.file !== `pages/${entry.pageId}.txt`
      )
        throw Error(`Unsafe archive page file: ${entry.file}`);
      const result = ArchivePageSchema.safeParse(await read(entry.file));
      if (!result.success)
        throw Error(
          `Archive page ${entry.pageId} failed validation: ${result.error.message}`,
        );
      if (
        result.data.pageId !== entry.pageId ||
        result.data.publicPath !== entry.publicPath ||
        result.data.httpStatus !== 200
      )
        throw Error(`Archive manifest/page mismatch: ${entry.pageId}`);
      if (result.data.main.blocks.some((b, i) => b.order !== i))
        throw Error(`Archive block order is invalid: ${entry.pageId}`);
      records.push(result.data);
    }
    const sourceLinks = ArchiveEntityLinksSchema.safeParse(
      await read("entity-links.txt"),
    );
    if (!sourceLinks.success)
      throw Error(
        `Archive entity links failed validation: ${sourceLinks.error.message}`,
      );
    const pageIds = new Set(manifest.pages.map((p) => p.pageId));
    const entityIds = new Set(sourceLinks.data.entities.map((e) => e.entityId));
    if (entityIds.size !== sourceLinks.data.entities.length)
      throw Error("Duplicate archive guide entity ID");
    for (const entity of sourceLinks.data.entities) {
      const page = records.find((p) => p.pageId === entity.pageId);
      if (!page?.main.blocks[entity.headingBlockOrder])
        throw Error(
          `Invalid archive guide section reference: ${entity.entityId}`,
        );
    }
    for (const relationship of sourceLinks.data.relationships)
      if (
        !pageIds.has(relationship.fromPageId) ||
        (relationship.toPageId && !pageIds.has(relationship.toPageId)) ||
        (relationship.toEntityId && !entityIds.has(relationship.toEntityId))
      )
        throw Error("Broken archive entity relationship reference");
    const content = adaptArchive(
      manifest,
      records,
      await read("site-settings.txt"),
      sourceLinks.data.entities,
    );
    return new ArchiveContentRepository(content);
  }
  async getPublicContent(): Promise<PublicSiteContent> {
    return this.content;
  }
}
