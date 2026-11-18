import { z } from "zod";
import { SiteBlockSchema } from "./site-content.js";

export const EditorScopeSchema = z.enum(["page", "block", "copy", "copy_all", "site", "gallery", "media", "trip", "cards", "videos", "navigation"]);
const key = z.string().max(200).regex(/^[a-zA-Z0-9_.-]+$/);
export const EditorRequestSchema = z.strictObject({ scope: EditorScopeSchema, key });
const value = z.string().max(20000).refine(text => !text.includes("\0"), "Invalid text").nullable();
export const EditTargetSchema = z.strictObject({
  scope: z.enum(["page", "block", "copy", "site", "gallery", "media", "trip", "card", "video", "navigation"]),
  key,
  field: z.string().max(40).regex(/^[a-z_]+$/),
  position: z.number().int().min(0).max(10000).optional(),
  path: z.array(z.string().max(30).regex(/^[a-z0-9_]+$/)).max(8).optional(),
});
export const EditChangeSchema = EditTargetSchema.extend({ expected: value, value });
export const EditChangesSchema = z.array(EditChangeSchema).min(1).max(100);
export type EditTarget = z.infer<typeof EditTargetSchema>;
export type EditChange = z.infer<typeof EditChangeSchema>;
export type EditorRequest = z.infer<typeof EditorRequestSchema>;
export type EditorField = {
  target: EditTarget;
  label: string;
  value: string | null;
  required: boolean;
  multiline: boolean;
  maxLength: number;
  hint?: string;
};
export type EditorDocument = { title: string; fields: EditorField[] };
export type AdminIdentity = { email: string };

const shortText = z.string().max(2000).refine(text => !text.includes("\0"));
export const NewTripSchema = z.strictObject({
  title: shortText.trim().min(1).max(300),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: shortText.trim().min(1), overview: z.string().trim().min(1).max(20000),
  dates: shortText, duration: shortText, price: shortText, guide: shortText, status: shortText,
  syncItinerary: z.boolean().optional(),
});
export const TripDetailsSchema = NewTripSchema.pick({ summary: true, dates: true, duration: true, price: true, guide: true, status: true }).extend({
  summary: shortText, syncItinerary: z.boolean(),
});
export type TripDetails = z.infer<typeof TripDetailsSchema>;
const revision = z.string().min(1).max(100);
export const PhotoSlotSchema = z.enum(['home.hero', 'home.approach', 'tour.april.interlude']);
export type PhotoSlot = z.infer<typeof PhotoSlotSchema>;
export const ContentCollectionSchema = z.enum(['tour', 'article', 'destinationArchive']);
export type ContentCollection = z.infer<typeof ContentCollectionSchema>;
const date = z.string().refine(value => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Use YYYY-MM-DD');
export const PageSettingsSchema = z.strictObject({
  title: shortText.trim().min(1).max(300), displayTitle: shortText,
  summary: shortText, dates: shortText, heroMediaId: key.nullable(),
  seoTitle: shortText.max(300), seoDescription: shortText,
  keywords: z.array(shortText.trim().min(1).max(100)).max(50),
  socialTitle: shortText.max(300), socialDescription: shortText,
  authorName: shortText, publicationDate: date, noindex: z.boolean(),
});
export type PageSettings = z.infer<typeof PageSettingsSchema>;
export const NewEntrySchema = z.strictObject({
  title: shortText.trim().min(1).max(300), slug: NewTripSchema.shape.slug,
  summary: shortText, overview: z.string().trim().min(1).max(20000), dates: shortText,
});
export type NewEntry = z.infer<typeof NewEntrySchema>;
export const ContentCommandSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("create_trip"), requestId: z.uuid(), trip: NewTripSchema }),
  z.strictObject({ operation: z.literal("save_trip_details"), key, expectedRevision: revision, trip: TripDetailsSchema }),
  z.strictObject({ operation: z.literal("publish_trip"), key, expectedRevision: revision, published: z.boolean() }),
  z.strictObject({ operation: z.literal("save_body"), key, expectedRevision: revision, blocks: z.array(SiteBlockSchema).min(1).max(500) }),
  z.strictObject({ operation: z.literal('create_entry'), requestId: z.uuid(), collection: z.enum(['article', 'destinationArchive']), entry: NewEntrySchema }),
  z.strictObject({ operation: z.literal('publish_entry'), key, expectedRevision: revision, published: z.boolean() }),
  z.strictObject({ operation: z.literal('save_settings'), key, expectedRevision: revision, settings: PageSettingsSchema }),
  z.strictObject({ operation: z.literal('save_photo'), slot: PhotoSlotSchema, expectedRevision: revision, mediaId: key.nullable() }),
]);
export type NewTrip = z.infer<typeof NewTripSchema>;
export type ContentCommand = z.infer<typeof ContentCommandSchema>;

// Return locations are public paths on this site. Never accept an OAuth-provided
// absolute URL, an admin endpoint, encoded slashes, control characters or backslashes.
export function safeAdminReturn(value: unknown): string {
  if (typeof value !== "string" || value.length > 1500 || !value.startsWith("/") ||
      value.startsWith("//") || /[\\\u0000-\u0020]/.test(value) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(value)) return "/";
  const url = new URL(value, "https://return.invalid");
  if (url.origin !== "https://return.invalid" || !/^\/(?:[a-z0-9-]+\/?)*$/i.test(url.pathname) || /^\/admin(?:\/|$)/i.test(url.pathname)) return "/";
  return url.pathname + url.search + url.hash;
}
