import { randomInt } from "node:crypto";
import type { GalleryPhoto } from "@roniella/shared/site-content";

// Run in the loader only. The selected order travels with SSR data into hydration.
export function selectGalleryPhotos(photos: GalleryPhoto[], count: number, pick = randomInt): GalleryPhoto[] {
  const shuffled = [...photos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}
