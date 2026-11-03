import { z } from "zod";
import { PathSchema, SiteSettingsSchema } from "./index.js";

const text = z.string().min(1);
const sourceLink = z.object({
  text: z.string(),
  href: z.string(),
  resolvedUrl: z.string().nullable(),
  sourceSelector: z.string(),
});
const sourceList = z.object({
  ordered: z.boolean(),
  items: z.array(z.string()),
});
const sourceItem = z.object({
  text: z.string(),
  links: z.array(sourceLink),
  children: z.array(sourceList),
});
export const ArchiveBlockSchema = z
  .object({
    order: z.number().int().nonnegative(),
    type: z.enum(["heading", "paragraph", "list", "table", "caption", "text"]),
    sourceTag: z.string(),
    sourceSelector: z.string(),
    anchorIds: z.array(z.string()),
    links: z.array(sourceLink),
    text: z.string().optional(),
    level: z.number().int().min(1).max(6).optional(),
    ordered: z.boolean().optional(),
    items: z.array(sourceItem).optional(),
    caption: z.string().nullable().optional(),
    rows: z
      .array(
        z.array(
          z.object({
            text: z.string(),
            isHeader: z.boolean(),
            rowspan: z.string().nullable(),
            colspan: z.string().nullable(),
            links: z.array(sourceLink),
          }),
        ),
      )
      .optional(),
  })
  .superRefine((block, ctx) => {
    if (block.type === "heading" && (!block.text || !block.level))
      ctx.addIssue({
        code: "custom",
        message: "Source heading requires text and original level",
      });
    if (
      ["paragraph", "text", "caption"].includes(block.type) &&
      block.text === undefined
    )
      ctx.addIssue({
        code: "custom",
        message: "Source text block requires text",
      });
    if (block.type === "list" && !block.items)
      ctx.addIssue({ code: "custom", message: "Source list requires items" });
    if (block.type === "table" && !block.rows)
      ctx.addIssue({ code: "custom", message: "Source table requires rows" });
  });
export const ArchiveEntityLinksSchema = z.object({
  schemaVersion: z.literal(1),
  entities: z.array(
    z.object({
      entityId: text,
      pageId: text,
      headingBlockOrder: z.number().int().nonnegative(),
    }),
  ),
  relationships: z.array(
    z.object({
      fromPageId: text,
      toPageId: text.optional(),
      toEntityId: text.optional(),
    }),
  ),
});
export const ArchiveManifestSchema = z.object({
  schemaVersion: z.literal(1),
  crawlRunId: text,
  pages: z.array(
    z.object({
      pageId: text,
      file: text,
      publicPath: PathSchema.nullable(),
      httpStatus: z.number().nullable(),
    }),
  ),
  urls: z.array(
    z.object({
      requestedUrl: z.url(),
      pageId: z.string().nullable(),
      outcome: z.string(),
    }),
  ),
});
export const ArchivePageSchema = z.object({
  schemaVersion: z.literal(1),
  pageId: text,
  pageType: text,
  sourceUrl: z.url(),
  finalUrl: z.url(),
  publicPath: PathSchema.nullable(),
  publicSlug: z.string().nullable(),
  httpStatus: z.number().nullable(),
  retrievedAt: z.iso.datetime(),
  decision: z.enum(["preserve", "alias", "unresolved", "excluded"]),
  sourceSeo: z.object({
    htmlTitles: z.array(z.string()),
    sourceMetaDescriptions: z.array(z.string().nullable()),
    headings: z.array(z.object({ level: z.number(), text: z.string() })),
  }),
  main: z.object({
    blocks: z.array(ArchiveBlockSchema),
    text: z.string(),
    links: z.array(sourceLink),
    anchorIds: z.array(z.object({ id: z.string() })),
  }),
  cards: z.array(z.object({ text: z.string(), links: z.array(sourceLink) })),
  article: z.object({
    title: z.string().nullable(),
    excerpt: z.string().nullable(),
    structuredPublicationDate: z.string().nullable(),
    structuredModificationDate: z.string().nullable(),
  }),
  videos: z.array(
    z.object({
      title: z.string().nullable(),
      description: z.string().nullable(),
      urlReferences: z.array(z.object({ url: z.string() })),
      embedUrls: z.array(z.string().nullable()),
    }),
  ),
});
export const ArchiveSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  navigation: z.array(z.object({ links: z.array(sourceLink) })),
  footer: z.array(z.object({ links: z.array(sourceLink) })),
  contactEvidence: z.array(
    z.object({
      contactText: z.string().nullable(),
      links: z.array(sourceLink),
    }),
  ),
});

export const SafeHrefSchema = z.string().refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//"))
    return !/[\u0000-\u001f\\]/.test(value);
  try {
    return ["https:", "http:", "tel:", "mailto:"].includes(
      new URL(value).protocol,
    );
  } catch {
    return false;
  }
}, "Unsafe public link");
const publicLink = z.strictObject({ text: text, href: SafeHrefSchema });
const publicItem = z.strictObject({
  text: z.string(),
  links: z.array(publicLink),
  children: z.array(
    z.strictObject({ ordered: z.boolean(), items: z.array(z.string()) }),
  ),
});
const baseBlock = { anchorIds: z.array(text), links: z.array(publicLink) };
export const SiteBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...baseBlock,
    type: z.literal("heading"),
    level: z.union([
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    text,
  }),
  z.strictObject({ ...baseBlock, type: z.literal("paragraph"), text }),
  z.strictObject({
    ...baseBlock,
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(publicItem),
  }),
  z.strictObject({
    ...baseBlock,
    type: z.literal("table"),
    caption: z.string().nullable(),
    rows: z.array(
      z.array(
        z.strictObject({
          text: z.string(),
          isHeader: z.boolean(),
          rowspan: z.number().int().positive().nullable(),
          colspan: z.number().int().positive().nullable(),
          links: z.array(publicLink),
        }),
      ),
    ),
  }),
]);
export const SitePageSchema = z.strictObject({
  id: text,
  path: PathSchema,
  slug: z.string().nullable(),
  pageType: text,
  title: text,
  heroMediaId: text.nullable().optional(),
  displayTitle: text.optional(),
  author: z.strictObject({name:text,pageId:text.optional()}).optional(),
  seo: z.strictObject({
    title: text,
    description: z.string().nullable(),
    canonicalPath: PathSchema,
  }),
  blocks: z.array(SiteBlockSchema),
  cards: z.array(z.strictObject({ pageId: text, summary: z.string() })),
  publicationDate: z.string().nullable(),
  modificationDate: z.string().nullable(),
  videos: z.array(
    z.strictObject({
      title: z.string().nullable(),
      description: z.string().nullable(),
      externalUrl: z.url(),
    }),
  ),
  sourceRetrievedAt: z.iso.datetime(),
});
export const SiteRedirectSchema = z.strictObject({
  fromPath: text,
  fromQuery: z.record(z.string(), z.string()),
  toPath: PathSchema,
});
const mediaPath = z.string().regex(/^\/media\/[a-z0-9][a-z0-9.-]*\.(?:jpg|jpeg|png|webp|avif)$/);
export const GalleryPhotoSchema = z.strictObject({
  id: text,
  src: mediaPath,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: text,
  variants: z.array(z.strictObject({ src: mediaPath, width: z.number().int().positive() })).min(1),
});
export const GallerySchema = z.strictObject({
  schemaVersion: z.literal(1),
  provider: z.literal("google-photos"),
  albumUrl: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ((url.hostname === "photos.app.goo.gl" && /^\/[A-Za-z0-9_-]+$/.test(url.pathname)) ||
       (url.hostname === "photos.google.com" && /^\/share\/[A-Za-z0-9_-]+$/.test(url.pathname)));
  }, "Use a public Google Photos album sharing URL"),
  heading: text,
  introduction: text,
  sourceLabel: text,
  shuffleLabel: text,
  openAlbumLabel: text,
  photoAltPrefix: text,
  displayCount: z.number().int().min(1).max(200),
  syncedAt: z.iso.datetime().nullable(),
  albumTitle: text.nullable(),
  photos: z.array(GalleryPhotoSchema).max(2000),
}).superRefine((gallery, ctx) => {
  if (new Set(gallery.photos.map(photo => photo.id)).size !== gallery.photos.length)
    ctx.addIssue({ code: "custom", path: ["photos"], message: "Duplicate gallery photo ID" });
});
export const SiteMediaSchema = z.strictObject({
  id: text,
  src: mediaPath,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: text,
  caption: text,
  author: text,
  source: z.url().refine(value => /^https?:\/\//.test(value), "Media source must be HTTP(S)"),
  license: text,
  licenseUrl: z.url().refine(value => /^https?:\/\//.test(value), "License URL must be HTTP(S)"),
  sizes: text,
  variants: z.array(z.strictObject({ src: mediaPath, width: z.number().int().positive() })).min(1),
});
export const LocalContentManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  apiSchemaVersion: z.literal(2),
  contentSource: z.literal("liveArchive"),
  crawlRunId: text,
  notice: text,
  pages: z.array(z.strictObject({
    id: text,
    path: PathSchema,
    file: z.string().regex(/^pages\/[a-z0-9-]+\.json$/),
  })).min(1),
});
export const PublicSiteContentSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    contentSource: z.literal("liveArchive"),
    crawlRunId: text,
    notice: text,
    siteSettings: SiteSettingsSchema,
    pages: z.array(SitePageSchema),
    redirects: z.array(SiteRedirectSchema),
    media: z.array(SiteMediaSchema).default([]),
    gallery: GallerySchema.nullable().default(null),
    presentation: z.record(text, z.string()).default({}),
  })
  .superRefine((content, ctx) => {
    const ids = new Set<string>(),
      paths = new Set<string>(),
      rules = new Set<string>();
    const fail = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    content.pages.forEach((p, i) => {
      if (ids.has(p.id)) fail(["pages", i, "id"], `Duplicate page ID: ${p.id}`);
      ids.add(p.id);
      if (paths.has(p.path))
        fail(["pages", i, "path"], `Public path collision: ${p.path}`);
      paths.add(p.path);
      if (p.seo.canonicalPath !== p.path)
        fail(["pages", i, "seo"], "Canonical path must match the public path");
      if (
        p.slug !==
        (p.path === "/" ? null : p.path.split("/").filter(Boolean).at(-1))
      )
        fail(["pages", i, "slug"], "Saved slug must match public path");
    });
    const mediaIds = new Set(content.media.map(asset => asset.id));
    if (mediaIds.size !== content.media.length) fail(["media"], "Duplicate media ID");
    content.pages.forEach((page, i) => {
      if (page.heroMediaId && !mediaIds.has(page.heroMediaId))
        fail(["pages", i, "heroMediaId"], "Unknown page media reference");
      if (page.author?.pageId && !ids.has(page.author.pageId))
        fail(["pages", i, "author"], "Unknown author page reference");
    });
    content.pages.forEach((p, i) =>
      p.cards.forEach((c, j) => {
        if (!ids.has(c.pageId))
          fail(["pages", i, "cards", j], `Unknown card page: ${c.pageId}`);
      }),
    );
    for (const group of ["navigation", "footerLinks"] as const)
      content.siteSettings[group].forEach((l, i) => {
        if (!paths.has(l.path))
          fail(
            ["siteSettings", group, i],
            `Unknown navigation path: ${l.path}`,
          );
      });
    for (const [group, pageType] of [["featuredTourIds","tour"],["featuredPostIds","article"]] as const) {
      content.siteSettings[group].forEach((id,i)=>{if(!content.pages.some(page=>page.id===id&&page.pageType===pageType))fail(["siteSettings",group,i],`Unknown featured ${pageType} page: ${id}`);});
    }
    content.redirects.forEach((r, i) => {
      const key =
        r.fromPath + JSON.stringify(Object.entries(r.fromQuery).sort());
      if (rules.has(key)) fail(["redirects", i], `Duplicate redirect: ${key}`);
      rules.add(key);
      if (!paths.has(r.toPath))
        fail(
          ["redirects", i],
          `Redirect destination does not exist: ${r.toPath}`,
        );
      if (r.fromPath === r.toPath && !Object.keys(r.fromQuery).length)
        fail(["redirects", i], "Redirect loop");
      if (
        paths.has(r.fromPath) &&
        r.fromPath !== r.toPath &&
        !Object.keys(r.fromQuery).length
      )
        fail(["redirects", i], "Redirect shadows a public page");
    });
  });
export type ArchivePage = z.infer<typeof ArchivePageSchema>;
export type ArchiveManifest = z.infer<typeof ArchiveManifestSchema>;
export type SiteBlock = z.infer<typeof SiteBlockSchema>;
export type SitePage = z.infer<typeof SitePageSchema>;

// PostgreSQL jsonb orders object keys differently from local JSON files.
// Revisions must compare content, not incidental object-key insertion order.
export function contentRevisionSource(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
}
export type SiteRedirect = z.infer<typeof SiteRedirectSchema>;
export type PublicSiteContent = z.infer<typeof PublicSiteContentSchema>;
export type SiteMedia = z.infer<typeof SiteMediaSchema>;
export type Gallery = z.infer<typeof GallerySchema>;
export type GalleryPhoto = z.infer<typeof GalleryPhotoSchema>;
export function parseSiteContent(input: unknown): PublicSiteContent {
  const result = PublicSiteContentSchema.safeParse(input);
  if (!result.success)
    throw Error(
      `Public archive content validation failed:\n${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`,
    );
  return result.data;
}
