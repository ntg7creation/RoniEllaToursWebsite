import type { SitePage } from "@roniella/shared/site-content";

// Presentation choices only. Source records, editorial titles and URLs stay unchanged.
export const editorialTourId = "page-1259e55f-578c-4db2-90b6-274d43d51283";
export function isEditorialPage(page: SitePage) {
  return page.path === "/" || page.id === editorialTourId;
}
export function displayHeading(page: SitePage) {
  return page.displayTitle ?? page.title;
}

