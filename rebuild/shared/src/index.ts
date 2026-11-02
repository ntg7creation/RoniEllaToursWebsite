import { z } from "zod";
import { tourPath, postPath } from "./urls.js";
export * from "./urls.js";

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z][a-z0-9-]*$/, "Use a stable lowercase ID");
const slug = text.regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "Use a saved lowercase ASCII slug",
);
export const PathSchema = z
  .string()
  .refine(
    (p) =>
      p === "/" ||
      /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/$/.test(p),
    "Use a lowercase ASCII public path ending in / (no query or fragment)",
  );
export const SeoSchema = z.strictObject({
  title: text,
  description: text,
  canonicalPath: PathSchema,
});
export const ContentBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), text }),
  z.strictObject({
    type: z.literal("heading"),
    text,
    level: z.union([z.literal(2), z.literal(3)]),
  }),
  z.strictObject({
    type: z.literal("list"),
    items: z.array(text).min(1),
    ordered: z.boolean(),
  }),
  z.strictObject({ type: z.literal("image"), mediaId: id }),
]);
const blocks = z.array(ContentBlockSchema);
const link = z.strictObject({ label: text, path: PathSchema });
export const SiteSettingsSchema = z.strictObject({
  businessName: text,
  language: z.literal("he"),
  timezone: z.literal("Asia/Jerusalem"),
  contact: z.strictObject({
    phone: text.regex(/^\+?[\d -]+$/),
    email: z.email(),
    address: text.optional(),
  }),
  navigation: z.array(link).min(1),
  footerLinks: z.array(link),
  featuredTourIds: z.array(id),
  featuredPostIds: z.array(id),
});
export const PageSchema = z.strictObject({
  id,
  path: PathSchema,
  pageType: z.enum([
    "home",
    "tours",
    "about",
    "guides",
    "blog",
    "gallery",
    "videos",
    "testimonials",
    "contact",
    "privacy",
    "accessibility",
  ]),
  title: text,
  seo: SeoSchema,
  blocks,
  draft: z.boolean().optional(),
});
export const DestinationSchema = z.strictObject({
  id,
  slug,
  name: text,
  summary: text,
  heroMediaId: id.optional(),
});
export const TourSchema = z.strictObject({
  id,
  slug,
  path: PathSchema,
  title: text,
  summary: text,
  seo: SeoSchema,
  destinationId: id,
  guideIds: z.array(id).min(1),
  durationDays: z.number().int().positive(),
  heroMediaId: id,
  highlights: z.array(text),
  itinerary: z
    .array(
      z.strictObject({ day: z.number().int().positive(), title: text, blocks }),
    )
    .min(1),
  inclusions: z.array(text),
  exclusions: z.array(text),
  generalTerms: blocks,
});
const isoCurrencies = new Set(Intl.supportedValuesOf("currency"));
export const MoneySchema = z.strictObject({
  minorUnits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z
    .string()
    .refine((c) => isoCurrencies.has(c), "Use an ISO 4217 currency code"),
});
export const DepartureSchema = z
  .strictObject({
    id,
    tourId: id,
    startDate: z.iso.date().nullish(),
    endDate: z.iso.date().nullish(),
    bookingStatus: z.enum([
      "enquiryOpen",
      "limited",
      "full",
      "waitlist",
      "cancelled",
      "closed",
    ]),
    price: MoneySchema.nullish(),
    singleRoomSupplement: MoneySchema.nullish(),
    terms: blocks.optional(),
  })
  .superRefine((d, ctx) => {
    if (Boolean(d.startDate) !== Boolean(d.endDate))
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Supply both travel dates, or leave both absent/null",
      });
    if (d.startDate && d.endDate && d.endDate < d.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    if (
      d.price &&
      d.singleRoomSupplement &&
      d.price.currency !== d.singleRoomSupplement.currency
    )
      ctx.addIssue({
        code: "custom",
        path: ["singleRoomSupplement"],
        message: "Supplement currency must match price currency",
      });
  });
export const GuideSchema = z.strictObject({
  id,
  name: text,
  role: text,
  biography: blocks,
  portraitMediaId: id.optional(),
});
export const PostSchema = z.strictObject({
  id,
  slug,
  path: PathSchema,
  title: text,
  excerpt: text,
  blocks,
  publicationDate: z.iso.date(),
  seo: SeoSchema,
  relatedDestinationIds: z.array(id),
  relatedTourIds: z.array(id),
});
export const MediaAssetSchema = z.strictObject({
  id,
  publicPath: z
    .string()
    .regex(
      /^\/assets\/[a-z0-9-]+\.(svg|png|webp|jpg)$/,
      "Use a local /assets/ file",
    ),
  alt: text,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: text.optional(),
  credit: text.optional(),
});
export const GallerySchema = z.strictObject({
  id,
  title: text,
  destinationId: id,
  mediaIds: z.array(id).min(1),
  externalAlbumUrl: z.url().optional(),
});
export const VideoSchema = z.strictObject({
  id,
  title: text,
  description: text,
  provider: z.enum(["youtube", "vimeo", "external"]),
  externalUrl: z.url(),
  destinationId: id.optional(),
  tourId: id.optional(),
});
export const TestimonialSchema = z.strictObject({
  id,
  displayName: text,
  quote: text,
  tourId: id.optional(),
});
export const PublicContentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    demo: z.literal(true),
    sampleNotice: text,
    siteSettings: SiteSettingsSchema,
    pages: z.array(PageSchema),
    destinations: z.array(DestinationSchema),
    tours: z.array(TourSchema),
    departures: z.array(DepartureSchema),
    guides: z.array(GuideSchema),
    posts: z.array(PostSchema),
    mediaAssets: z.array(MediaAssetSchema),
    galleries: z.array(GallerySchema),
    videos: z.array(VideoSchema),
    testimonials: z.array(TestimonialSchema),
  })
  .superRefine((c, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const groups = [
      "pages",
      "destinations",
      "tours",
      "departures",
      "guides",
      "posts",
      "mediaAssets",
      "galleries",
      "videos",
      "testimonials",
    ] as const;
    const allIds = new Set<string>();
    for (const group of groups)
      c[group].forEach((record, i) => {
        if (allIds.has(record.id))
          issue([group, i, "id"], `Duplicate stable ID: ${record.id}`);
        allIds.add(record.id);
      });
    const allPaths = new Set<string>();
    for (const group of ["pages", "tours", "posts"] as const)
      c[group].forEach((r, i) => {
        if (allPaths.has(r.path))
          issue([group, i, "path"], `Duplicate path: ${r.path}`);
        allPaths.add(r.path);
        if (r.seo.canonicalPath !== r.path)
          issue(
            [group, i, "seo", "canonicalPath"],
            "Canonical path must equal record path",
          );
      });
    for (const group of ["destinations", "tours"] as const) {
      const seen = new Set<string>();
      c[group].forEach((r, i) => {
        if (seen.has(r.slug))
          issue([group, i, "slug"], `Duplicate slug: ${r.slug}`);
        seen.add(r.slug);
      });
    }
    const ref = (
      group: (typeof groups)[number],
      value: string | undefined,
      path: (string | number)[],
    ) => {
      if (value !== undefined && !c[group].some((r) => r.id === value))
        issue(path, `Unknown ${group} reference: ${value}`);
    };
    const checkBlocks = (
      bs: z.infer<typeof blocks>,
      path: (string | number)[],
    ) =>
      bs.forEach((b, i) => {
        if (b.type === "image")
          ref("mediaAssets", b.mediaId, [...path, i, "mediaId"]);
      });
    c.pages.forEach((p, i) => checkBlocks(p.blocks, ["pages", i, "blocks"]));
    c.destinations.forEach((d, i) =>
      ref("mediaAssets", d.heroMediaId, ["destinations", i, "heroMediaId"]),
    );
    c.tours.forEach((t, i) => {
      ref("destinations", t.destinationId, ["tours", i, "destinationId"]);
      ref("mediaAssets", t.heroMediaId, ["tours", i, "heroMediaId"]);
      t.guideIds.forEach((v, j) =>
        ref("guides", v, ["tours", i, "guideIds", j]),
      );
      if (t.path !== tourPath(t.slug))
        issue(
          ["tours", i, "path"],
          "Tour path must match its saved slug under /tours/",
        );
      if (t.itinerary.length !== t.durationDays)
        issue(
          ["tours", i, "itinerary"],
          "Provide one ordered itinerary entry per day",
        );
      t.itinerary.forEach((d, j) => {
        if (d.day !== j + 1)
          issue(
            ["tours", i, "itinerary", j, "day"],
            "Itinerary days must be consecutive and ordered from 1",
          );
        checkBlocks(d.blocks, ["tours", i, "itinerary", j, "blocks"]);
      });
      checkBlocks(t.generalTerms, ["tours", i, "generalTerms"]);
    });
    c.departures.forEach((d, i) => {
      ref("tours", d.tourId, ["departures", i, "tourId"]);
      checkBlocks(d.terms ?? [], ["departures", i, "terms"]);
    });
    c.guides.forEach((g, i) => {
      ref("mediaAssets", g.portraitMediaId, ["guides", i, "portraitMediaId"]);
      checkBlocks(g.biography, ["guides", i, "biography"]);
    });
    c.posts.forEach((p, i) => {
      if (p.path !== postPath(p.slug))
        issue(
          ["posts", i, "path"],
          "Post path must match its saved slug under /blog/",
        );
      p.relatedDestinationIds.forEach((v, j) =>
        ref("destinations", v, ["posts", i, "relatedDestinationIds", j]),
      );
      p.relatedTourIds.forEach((v, j) =>
        ref("tours", v, ["posts", i, "relatedTourIds", j]),
      );
      checkBlocks(p.blocks, ["posts", i, "blocks"]);
    });
    c.galleries.forEach((g, i) => {
      ref("destinations", g.destinationId, ["galleries", i, "destinationId"]);
      g.mediaIds.forEach((v, j) =>
        ref("mediaAssets", v, ["galleries", i, "mediaIds", j]),
      );
    });
    c.videos.forEach((v, i) => {
      ref("destinations", v.destinationId, ["videos", i, "destinationId"]);
      ref("tours", v.tourId, ["videos", i, "tourId"]);
      if (!v.externalUrl.startsWith("https://"))
        issue(["videos", i, "externalUrl"], "Use an HTTPS external video URL");
    });
    c.testimonials.forEach((t, i) =>
      ref("tours", t.tourId, ["testimonials", i, "tourId"]),
    );
    for (const group of ["navigation", "footerLinks"] as const)
      c.siteSettings[group].forEach((l, i) => {
        if (!allPaths.has(l.path))
          issue(
            ["siteSettings", group, i, "path"],
            `Unknown navigation path: ${l.path}`,
          );
      });
    c.siteSettings.featuredTourIds.forEach((v, i) =>
      ref("tours", v, ["siteSettings", "featuredTourIds", i]),
    );
    c.siteSettings.featuredPostIds.forEach((v, i) =>
      ref("posts", v, ["siteSettings", "featuredPostIds", i]),
    );
  });

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Destination = z.infer<typeof DestinationSchema>;
export type Tour = z.infer<typeof TourSchema>;
export type Departure = z.infer<typeof DepartureSchema>;
export type Guide = z.infer<typeof GuideSchema>;
export type Post = z.infer<typeof PostSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type Gallery = z.infer<typeof GallerySchema>;
export type Video = z.infer<typeof VideoSchema>;
export type Testimonial = z.infer<typeof TestimonialSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type PublicContent = z.infer<typeof PublicContentSchema>;
export type Money = z.infer<typeof MoneySchema>;

export function parseContent(input: unknown): PublicContent {
  const result = PublicContentSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Content validation failed:\n${result.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`,
    );
  return result.data;
}
export function jerusalemDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function departurePhase(
  departure: Departure,
  today: string,
): "upcoming" | "inProgress" | "past" | "unknown" {
  if (!departure.startDate || !departure.endDate) return "unknown";
  if (today < departure.startDate) return "upcoming";
  return today > departure.endDate ? "past" : "inProgress";
}
export function formatTravelDate(date: string): string {
  return date.split("-").reverse().join(".");
}
export function formatMoney(money: Money): string {
  const formatter = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: money.currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(money.minorUnits / 10 ** digits);
}
