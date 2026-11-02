import { z } from "zod";
export const Id = z.string().regex(/^page-[a-f0-9-]{36}$/);
export const PublicPath = z
  .string()
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/);
const link = z.object({
  text: z.string(),
  href: z.string(),
  resolvedUrl: z.string().nullable(),
  rel: z.array(z.string()),
  sourceSelector: z.string(),
});
export const BlockSchema = z
  .object({
    order: z.number().int().nonnegative(),
    type: z.enum(["heading", "paragraph", "list", "table", "caption", "text"]),
    sourceTag: z.string(),
    sourceSelector: z.string(),
    anchorIds: z.array(z.string()),
    links: z.array(link),
    text: z.string().optional(),
    level: z.number().int().min(1).max(6).optional(),
    items: z
      .array(
        z.object({
          text: z.string(),
          links: z.array(link),
          children: z.array(z.unknown()),
        }),
      )
      .optional(),
    rows: z
      .array(
        z.array(
          z.object({
            text: z.string(),
            isHeader: z.boolean(),
            rowspan: z.string().nullable(),
            colspan: z.string().nullable(),
          }),
        ),
      )
      .optional(),
  })
  .superRefine((b, c) => {
    if (b.type === "heading" && (!b.level || !b.text))
      c.addIssue({
        code: "custom",
        message: "Heading requires original level/text",
      });
    if (b.type === "table" && !b.rows)
      c.addIssue({ code: "custom", message: "Table requires rows" });
    if (b.type === "list" && !b.items)
      c.addIssue({ code: "custom", message: "List requires structured items" });
  });
export const PageRecordSchema = z.object({
  schemaVersion: z.literal(1),
  pageId: Id,
  sourceIdentity: z.string().nullable(),
  pageType: z.string().min(1),
  sourceUrl: z.url(),
  sourcePath: z.string(),
  finalUrl: z.url(),
  publicPath: PublicPath.nullable(),
  publicSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .nullable(),
  retrievedAt: z.iso.datetime(),
  httpStatus: z.number().int().nullable(),
  redirectChain: z.array(
    z.object({
      url: z.url(),
      status: z.number().int(),
      location: z.string(),
      resolvedLocation: z.url(),
    }),
  ),
  contentHash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .nullable(),
  snapshotPath: z
    .string()
    .regex(/^snapshots\/[a-zA-Z0-9-]+\/page-[a-f0-9-]{36}\.html$/)
    .nullable(),
  retrievalMethod: z.literal("direct-http"),
  discoverySources: z.array(z.object({ kind: z.string(), url: z.string() })),
  extractionStatus: z.enum(["extracted", "needsReview", "sourceUnavailable"]),
  reviewNotes: z.array(z.string()),
  decision: z.enum(["preserve", "alias", "unresolved", "excluded"]),
  decisionReason: z.string(),
  httpHeaders: z.record(z.string(), z.string()),
  sourceSeo: z.object({
    htmlTitles: z.array(z.string()),
    sourceMetaDescriptions: z.array(z.string().nullable()),
    sourceCanonicalUrl: z.string().nullable(),
    canonicalEntries: z.array(z.unknown()),
    metaEntries: z.array(z.unknown()),
    jsonLd: z.array(
      z.object({
        order: z.number(),
        rawText: z.string(),
        parseStatus: z.enum(["valid", "invalid"]),
        parsed: z.unknown(),
        error: z.string().nullable(),
      }),
    ),
    headings: z.array(
      z.object({
        order: z.number(),
        level: z.number().int().min(1).max(6),
        text: z.string(),
        anchorId: z.string().nullable(),
      }),
    ),
  }),
  main: z.object({
    selector: z.string(),
    text: z.string(),
    blocks: z.array(BlockSchema),
    links: z.array(link),
    anchorIds: z.array(
      z.object({ id: z.string(), sourceSelector: z.string() }),
    ),
    faq: z.array(z.unknown()),
    imageReferences: z.array(z.unknown()),
  }),
  shared: z.object({
    navigation: z.array(z.unknown()),
    footer: z.array(z.unknown()),
    widgets: z.array(z.unknown()),
    presentationDuplicates: z.array(z.unknown()),
  }),
  forms: z.array(
    z.object({
      documentationOnly: z.literal(true),
      fields: z.array(z.unknown()),
      labels: z.array(z.string()),
      consentText: z.array(z.string()),
    }),
  ),
  videos: z.array(z.unknown()),
  article: z.unknown(),
  tour: z.unknown(),
  testimonials: z.array(z.unknown()),
  cards: z.array(z.unknown()),
  internalLinks: z.array(link),
  externalLinks: z.array(link),
  taxonomyLinks: z.array(z.unknown()),
  jsonLdNodes: z.array(z.unknown()),
});
export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  crawlRunId: z.string(),
  generatedAt: z.iso.datetime(),
  sourceOrigin: z.literal("https://roniellatours.com"),
  pages: z.array(
    z.object({
      pageId: Id,
      file: z.string(),
      snapshotPath: z.string().nullable(),
      finalUrl: z.url(),
      publicPath: PublicPath.nullable(),
      pageType: z.string(),
      extractionStatus: z.string(),
      httpStatus: z.number().int().nullable(),
    }),
  ),
  urls: z.array(
    z.object({
      requestedUrl: z.url(),
      pageId: Id.nullable(),
      outcome: z.enum([
        "extracted",
        "redirected",
        "failed",
        "blocked",
        "excluded",
        "pending",
      ]),
      reason: z.string().nullable(),
      discoverySources: z.array(z.unknown()),
    }),
  ),
  resources: z.array(z.unknown()),
});
export function validateRecord(record) {
  const r = PageRecordSchema.safeParse(record);
  if (!r.success)
    throw Error(
      `${record.pageId}: ${r.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("\n")}`,
    );
  return record;
}
