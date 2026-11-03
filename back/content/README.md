# Editable website content

This is the content store for `CONTENT_PROVIDER=files` and the initial source for Supabase migration. All data files are pretty-printed UTF-8 JSON. The backend reads this directory in file mode; online Supabase mode reads database tables through the same API. See the [deployment and database guide](../../documents/deployment.md). After migration, database edits are authoritative online and are not synchronized back into these JSON files.

| File / folder | Edit here for |
| --- | --- |
| `pages/home.json` | Original homepage source blocks and cards |
| `presentation.json` | Display copy for the redesigned homepage, principles, destination previews, shared contact/footer and April route highlights |
| `pages/tours-china-may-2027.json` | China May tour text, itinerary, terms and SEO |
| `pages/tours-uzbekistan-april-2027.json` | Updated nine-day April itinerary, including Khiva |
| `pages/blog-uzbekistan-silk-road.json` | Full article text and metadata |
| `pages/guides.json` | All five original guide biographies |
| Other `pages/*.json` | All remaining tours, articles, archives and information pages (40 total) |
| `site-settings.json` | Business/contact details, navigation, footer links and featured page IDs |
| `media.json` | Photo assignments: local URLs, variants, dimensions, alt text, caption and attribution |
| `gallery.json` | Google Photos album link, gallery copy, number displayed and synchronized photo manifest |
| `media/` | Actual photo originals and resized JPEGs, plus provenance registries; no travel photos live in frontend public |
| `index.json` | Stable page ID → public path → JSON filename registry |
| `redirects.json` | Existing legacy path/query redirects |
| `source-map.json` | Public source URL and retrieval date for each page; unavailable source records |

The complete public text was refreshed from **https://roniellatours.com/** on **2 November 2026**, crawl `2026-11-02-live-refresh`. Original source text remains in ordered blocks rather than arbitrary HTML. Presentation copy is separate so the homepage can be edited without changing original SEO titles or source evidence. The original archive/snapshots under `docs/live-site-content/` are provenance and import tooling; the application no longer reads them at startup or build time.

In file-mode development, `npm.cmd run dev` watches JSON changes and restarts the API; refresh the browser after editing. In a file-mode production preview, restart the API after edits. **No frontend rebuild is needed for text, metadata, image assignments or public path changes:** page routes and redirects resolve through the API at runtime. Supabase mode refreshes its validated content cache every 30 seconds by default. JPEG bytes remain backend files; deploy new files before updating their database references.

Keep existing IDs and paths stable. Edit text values, not block `type` or structural field names. Blocks support headings, paragraphs, lists and tables. `displayTitle`, where present, is the shorter display heading; `seo.title` remains separate. `heroMediaId` selects an ID from `media.json`; a null value leaves a page without invented destination photography. Keep required presentation keys. Invalid data, missing files, unsafe paths, unresolved card/media references and duplicate IDs/paths stop startup with a diagnostic.

Photos use same-origin URLs such as `/media/samarkand-1920.jpg`. The frontend resource route streams the backend's registered image response. Only registered image files are exposed; JSON, source snapshots and media provenance files are not public media endpoints. Preserve photo author/license records. UI icons and fonts remain frontend assets.

The `ContentRepository` interface in `back/src/content-repository.ts` is the storage boundary. Both the file adapter and Supabase adapter preserve the content API, React components, SSR rendering and public URLs. No Firebase service, editing API or upload system is required. File mode still runs without a database.

The gallery's public album link is stored in `gallery.json`, separate from React code. Run `npm.cmd run sync:gallery` from the repository root after adding/removing photos in Google Photos or changing the link. This explicitly imports the public album, downloads proportional JPEG variants (480/1600 pixel maximum edge) into backend `media/`, validates dimensions and atomically replaces the manifest after all downloads succeed. Restart the API after syncing (automatic in development). It needs internet only for this import; page rendering and cached media work offline. No Google login, API key, Firebase service or frontend image hotlink is used.

`displayCount` currently selects **24 of 123** photos at random on each gallery request. The server sends the selected order with its SSR data, so hydration keeps that order. The two “לגלות עוד רגעים” controls request a new selection and work without JavaScript. Edit `photos[].alt` for individual photo descriptions; imports preserve these by stable photo ID. The initial descriptions identify the album and photo number, without inventing subjects or locations.

Google Photos has no documented shared-album HTML interface. If its page format changes, sharing is disabled, the album is paginated, or an unsupported item is encountered, the sync command fails and retains the last complete manifest. The website continues using the existing cache. Removed photos disappear from the published gallery after a successful sync; unregistered old files are not publicly served. Repeated syncs can leave obsolete JPEGs on disk for later maintenance. See [gallery implementation and review](../../documents/google-photos-gallery.md).

For a Supabase-backed deployment, follow a local gallery sync with `npm.cmd run db:gallery`, review its generated SQL, deploy the new backend image files, then apply the SQL manually. This changes gallery membership/import metadata while preserving database-edited gallery copy and existing alt descriptions. Do not reapply the initial site seed to refresh photos.

See [implementation, architecture and verification](../../documents/local-content-and-figma-update.md).
