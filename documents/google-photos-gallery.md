# Google Photos gallery

The local content store now contains the user-provided public album URL in `back/content/gallery.json`: <https://photos.app.goo.gl/zgdjSyHAmB78Yfd19>. The album was successfully fetched over HTTP and contained **123 still photographs**, titled “Images for website”. The web reader could not open the short link; direct public HTTP retrieval succeeded. No Google Photos connector was available.

## Storage and SSR

`npm.cmd run sync:gallery` is an explicit backend content import. It reads the configured URL, follows only Google Photos redirects and parses JSON already embedded in the public album page. It never evaluates third-party JavaScript or accesses authenticated/private APIs. It checks completeness and fails on unsupported or changed page structures rather than silently importing a partial album.

The initial import saved **246 proportional JPEG delivery files**, approximately **69 MiB**, in `back/content/media/`. Maximum edges are 480 and 1600 pixels; actual JPEG dimensions drive responsive `srcset`, width and height attributes. Portraits retain their natural proportions. Filenames contain stable item and file-content hashes. The manifest is replaced only after every image validates. Existing images/manifest remain usable after an import failure.

`LocalContentRepository` validates the gallery and registers its image files in the same allowlist as other backend media. Existing `/media/:filename` SSR resource routes stream them from the backend. No album photographs are added to frontend public or the frontend build. Browsers make no image requests to Google. Production page rendering does not need internet, a Google account or API keys.

The gallery loader uses a server-side Fisher–Yates shuffle and selects 24 unique images from the full cache (`displayCount` is editable). It serializes the selected order with React Router's loader data. There is no randomization during React rendering, avoiding hydration mismatch. Non-gallery pages omit the gallery photo list from their serialized content. The backend's complete manifest is never mutated by shuffling. Cache-Control remains `no-store`.

## Presentation and behavior

- `/gallery/` retains its path, original H1, title, canonical behavior and existing page record. Gallery appears in both desktop and mobile primary navigation.
- Three CSS columns on desktop, two below 900px and one below 560px. Tight 6px gutters, subtle offsets and natural image ratios create an informal album wall. No image-measurement JavaScript, forced square crops or animation.
- The forest, cream, gold and Hebrew serif/sans typography follow the existing redesigned site. Photographs sit directly beside one another without padded frames.
- Each visit and “לגלות עוד רגעים” GET submission produces another random selection. Both shuffle controls work without JavaScript. The full original album is linked.
- Image links work as native same-origin JPEG links without JavaScript. With JavaScript they open a native modal dialog with previous/next, arrow keys and Escape. Native focus trapping and focus restoration keep keyboard navigation predictable. There is no automatic slideshow.
- Images have declared dimensions, responsive sources and mostly lazy loading. No motion is introduced. Alternative descriptions are editable in the manifest; initial descriptions identify the album and stable source position, without guessing image subjects.

## Updating

From `D:\repos\RoniEllaToursWebsite`:

```powershell
npm.cmd run sync:gallery
npm.cmd run dev
```

Open <http://localhost:3000/gallery/>. In development the API watches changed JSON. For a production preview, restart the API after syncing; no frontend rebuild is required for changed photo membership, gallery copy, alt text or display count.

This is a cached import, not an automatic subscription to album changes. Google’s shared-page format is undocumented and may change. Albums requiring pagination and non-photo media fail explicitly; the present 123-photo album was complete and imported successfully. Removed images are unregistered after a successful sync; obsolete cached files may remain on disk, inaccessible through the allowlisted media endpoint.

## Changed files

- `back/content/gallery.json`, `back/content/media/album-*.jpg`, `back/content/README.md`
- `back/src/content-repository.ts`, `back/src/google-photos.ts`
- `shared/src/site-content.ts`
- `front/app/routes/content.tsx`, `front/app/server/gallery.server.ts`
- `front/app/components/gallery-page.tsx`, `archive-content.tsx`, `layout.tsx`
- `front/app/gallery.css`, `front/app/root.tsx`
- `scripts/sync-gallery.ts`, `scripts/gallery-e2e.mjs`, `scripts/smoke.mjs`, `scripts/browser-smoke.mjs`
- `back/tests/gallery.test.ts`, `package.json`, this document

## Verification

TypeScript checks, unit/repository tests and the production build passed. Gallery browser checks exercised 1440, 1024, 768, 390 and 320px widths: all rendered images decoded successfully, no horizontal overflow, one H1, no hydration errors or external image requests. Keyboard enlargement, arrow navigation, Escape/focus restoration, no-JavaScript shuffle/image links and unchanged canonical were verified. The cached backend manifest remained unchanged after shuffle requests.

Screenshots and measurements: `.qa/gallery/gallery-{width}.png`, `gallery-{1440,390}-full.png`, `viewer-{1440,390}.png` and `metrics.json`. Desktop/mobile screenshots were displayed and reviewed with the image tool. The wall spacing was refined to create staggered starts as well as varied image heights, then the final desktop/tablet/mobile screenshots were displayed and reviewed again.

Final checks:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed shared, backend and frontend checks |
| `npm.cmd test` | Passed all 25 unit/repository tests, including public album parsing, image validation, unique selection, source immutability and backend media registration |
| `npm.cmd run build` | Passed shared/backend compilation and Vite client/SSR production builds |
| `npm.cmd run test:gallery` | Passed all five viewport sizes, decoded photos, SSR/randomization, modal keyboard behavior and no-JavaScript fallbacks |
| `npm.cmd run smoke` | Passed all 40 pages, six complete itineraries/terms, article text, metadata, 72 one-hop redirects, 404 and useful API-failure responses |
| `npm.cmd run smoke:browser` | Passed all 40 pages at desktop/mobile, hydration, navigation, source fragments and overflow/console/network checks |
| `npm.cmd run test:e2e` | Passed tour/contact journeys, keyboard menus/itinerary, articles, guide profiles and JavaScript-disabled navigation |
| `npm.cmd run test:files` | Passed edited local content SSR/metadata without frontend rebuild, backend image delivery and explicit Home navigation |

The previous blanket prohibition of forms in smoke tests was narrowed to permit exactly two read-only GET forms targeting `/gallery/`; data-entry forms and iframes remain rejected. No album photos were found in frontend public or the frontend client build. Test-owned servers were stopped after verification. No production website was modified.
