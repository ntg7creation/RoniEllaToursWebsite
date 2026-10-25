# Gallery and video content

- `/gallery` is linked from desktop/mobile navigation, footer, and the homepage video section.
- The old gallery's destination-filter approach is retained: https://roniellatours.com/גלריה/
- `src/content/gallery.js` contains album/image records. `src/content/videos.js` contains the video catalog. There are 12 images each for China, Greece, Egypt and Uzbekistan (48), plus two general journey images (50 total).
- Fifty local SVG illustrations are under `public/placeholders/gallery/`. Regenerate them with `node scripts/generate-gallery-placeholders.mjs`. These are illustrative placeholders, not photographs or claims about particular itinerary stops.
- Replace each image's `src`, `alt` and `caption` independently. Stable IDs let a future album adapter reuse the existing filtering and viewer components. Filter totals derive from the image arrays.
- Google Photos is **not connected**. Album access, authentication, refresh strategy and a supported integration must be decided in the later integration task; no credentials, API calls or automatic synchronization have been added.
- YouTube metadata titles were read through public oEmbed for the supplied IDs. The video designated by the owner as the company feature (`0ig45aOXt7A`) appears on the homepage and first in the gallery. Its YouTube title refers to the China trip; the homepage label follows the owner's intended placement.
- Thumbnails load lazily; embeds load only after pressing Play, using youtube-nocookie.com. Every video also has a direct YouTube link. If a thumbnail fails, a local illustration is used.
- Image viewing supports native modal focus containment, Escape, restored opener focus, previous/next buttons and RTL arrow keys (Left = next, Right = previous), wrapping within the selected album.
- Gallery images now fill wide tiles across nearly the full viewport. The visible numbered caption strips and card framing were removed; hover and keyboard focus lift the image, and clicking keeps the visitor on the gallery page in the image viewer.
- The gallery now uses five masonry columns on desktop, four on tablets, and three on phones. Placeholder illustrations use varied portrait and landscape ratios. Future photo records can omit `placeholder` and `ratio`, so real images display at their own natural proportions, including vertical phone photos.
- The “All” filter uses a stable mixed order across the albums in one continuous gallery. Destination filters still show one album each; the image viewer follows the same order as the selected view.

## Adding more videos

Add a record to `videos` in `src/content/videos.js` with the unique YouTube `id` (the value after `v=` in its URL) and an accurate Hebrew `title`. Array order controls display order; insert at the top to highlight a new upload. No page/component edits are needed. Keep IDs unique. `featuredVideoId` independently selects the homepage video and must match a catalog entry.

The video library searches the entire catalog, including videos not yet displayed. It renders eight cards initially and reveals eight more per click, showing a live result count and an empty-search message. Keyboard focus moves to the first newly revealed video. Thumbnails are lazy-loaded and only one gallery player is mounted at a time; choosing another video stops the previous one. The existing seven videos remain visible initially. This is still a local content catalog, not automatic YouTube-channel synchronization.

## Verification

`node scripts/verify-video-library.mjs` runs a 25-video development-only fixture against the Vite dev server. It checks progressive loading, focus, search for unrevealed items, reset/empty results, and single-player behavior at desktop and mobile widths. No fixture videos appear in the actual site or production build.

`npm run build` and `node scripts/verify-gallery.mjs` against production preview. Gallery checked at 1440, 1101, 768, 390 and 320px: counts, all destination filters, viewer controls/focus, video embed activation, anchor clearance, sticky navigation, and no horizontal overflow or page errors. The homepage feature's actual YouTube player loaded and began playback in local Chromium. Other video IDs/titles and embed wiring were checked; complete playback of all seven clips was not watched. Screenshots: `screenshots/gallery/`.

Use `SITE_URL` and `BROWSER_PATH` to override the local production preview URL and Chromium executable for the gallery test. Real devices and other browser engines remain untested.
