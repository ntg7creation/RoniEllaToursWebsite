// Saved public URL vocabulary. Hebrew labels are content, never slug inputs.
export const paths = {
  home: "/",
  tours: "/tours/",
  about: "/about/",
  guides: "/guides/",
  blog: "/blog/",
  gallery: "/gallery/",
  videos: "/videos/",
  testimonials: "/testimonials/",
  contact: "/contact/",
  privacy: "/privacy/",
  accessibility: "/accessibility/",
} as const;
export const demoPostPaths = [
  "/blog/travel-journal-demo/",
  "/blog/greece-notes-demo/",
] as const;
export function tourPath(slug: string): string {
  return `${paths.tours}${savedSlug(slug)}/`;
}
export function postPath(slug: string): string {
  return `${paths.blog}${savedSlug(slug)}/`;
}
function savedSlug(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error("Use a saved lowercase ASCII slug");
  return slug;
}
export const scaffoldRedirects: Readonly<Record<string, string>> = {
  "/הטיולים-שלנו/": paths.tours,
  "/מי-אנחנו/": paths.about,
  "/המדריכים-שלנו/": paths.guides,
  "/בלוג/": paths.blog,
  "/גלריה/": paths.gallery,
  "/וידיאו/": paths.videos,
  "/המלצות/": paths.testimonials,
  "/יצירת-קשר/": paths.contact,
  "/privacy-policy/": paths.privacy,
  "/הצהרת-נגישות/": paths.accessibility,
  "/הטיולים-שלנו/דרך-המשי-לדוגמה/": "/tours/silk-road-demo/",
  "/הטיולים-שלנו/יוון-לדוגמה/": "/tours/greece-demo/",
  "/יומן-מסע-לדוגמה/": demoPostPaths[0],
  "/מבט-על-יוון-לדוגמה/": demoPostPaths[1],
};
export function normalizePath(pathname: string): string {
  let decoded: string;
  try {
    decoded = decodeURI(pathname).normalize("NFC");
  } catch {
    return "!invalid";
  }
  return decoded === "/" ? "/" : `${decoded.replace(/\/+$/, "")}/`;
}
export function absoluteUrl(path: string, origin: string): string {
  return new URL(path, origin).href;
}
