# RoniElla Tours — implemented redesign and verification

This records the first reference-led redesign. See the [subsequent Figma/font/content-storage update](local-content-and-figma-update.md) for the current implementation and moved asset locations.

Completed locally on 2 November 2026. The existing React Router / React / Vite / TypeScript SSR architecture and separate read-only backend are retained. No database, content migration, dependency installation, production write, commit or deployment was performed.

## What changed

The homepage now opens with panoramic Samarkand photography and a solid ivory invitation panel. A personal welcome leads into an asymmetric Uzbekistan/China destination spread, then a full-width travel-philosophy band, source-based upcoming departures, guide introductions, genuine archived reviews, journal previews and a direct phone invitation. Rectangular buttons, thin rules, one restrained image arch, forest ink, ivory surfaces and clay labels form one visual identity.

Frank Ruhl Libre 500/600 supplies Hebrew display typography; Noto Sans Hebrew 400/500/600 handles paragraphs, labels and trip facts. The existing licensed fonts remain local, with two Hebrew-subset preloads and swap rendering. Body copy is 20px desktop / 19px mobile with generous line height. Dates, English names and contact details retain direction isolation.

The masthead, native mobile menu, footer, listing cards, individual tours, articles, guide profiles and other archive pages share the same visual language. Tour listings gain real destination imagery and explicit missing-photo placeholders where appropriate. The China tour gains a broad image/text introduction; articles use relevant photography above a constrained reading column. Existing itinerary, terms, source-conflict and print interactions are preserved.

The specific influences and all eleven reference analyses are in [design-research.md](design-research.md). The strongest influences were Blonde Atlas/Lozano for display hierarchy and photographic welcome; Avenue H/Savoir/Travelista for varied split compositions; Milk + Honey/Huffman for personal trust; Explorateur for restrained clay detail; Pack Up + Go/Lozano for plain-language process clarity.

## Visual review and corrections

Rendered locally in installed headless Chrome using the repository's Playwright tooling. The interactive browser connector reported no available sessions; no interactive browser preview is claimed. Screenshots were actually displayed and reviewed, including the full homepage at desktop/mobile, tablet homepage, listings, China tour, article, itinerary, contact page and 200% text sample.

Corrections made from review/testing:

- Removed narrow-screen masthead overflow at 320px; allowed header wrapping for enlarged text.
- Refined the opening headline width/size and made the image grow with its invitation panel, keeping the caption below both.
- Corrected a legacy tour-heading width constraint so the photograph/text split uses the available content width.
- Removed an anchor from contact-grid flow, restoring the intended text/action columns.
- Replaced the footer's inherited horizontal text flow with a proper brand column and trimmed duplicated bottom navigation.
- Kept journal numbers on one line.
- Loaded below-the-fold photos before full-page QA captures; a full-page browser screenshot alone does not trigger lazy loading.

Representative final captures:

| Template | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Homepage | [1440px full page](../.qa/redesign/home-1440-full.png) | [768px](../.qa/redesign/home-768.png) | [390px full page](../.qa/redesign/home-390-full.png), [320px](../.qa/redesign/home-320.png) |
| Tours | [1440px](../.qa/redesign/tours-1440.png) | [1024px](../.qa/redesign/tours-1024.png) | [390px](../.qa/redesign/tours-390.png) |
| China tour | [1440px](../.qa/redesign/china-1440.png) | [768px](../.qa/redesign/china-768.png) | [390px](../.qa/redesign/china-390.png) |
| April Uzbekistan tour | [1440px](../.qa/redesign/uzbekistan-1440.png) | [768px](../.qa/redesign/uzbekistan-768.png) | [390px](../.qa/redesign/uzbekistan-390.png) |
| Article | [1440px](../.qa/redesign/article-1440.png) | [768px](../.qa/redesign/article-768.png) | [390px](../.qa/redesign/article-390.png) |
| Destination | [1440px](../.qa/redesign/destination-1440.png) | [768px](../.qa/redesign/destination-768.png) | [390px](../.qa/redesign/destination-390.png) |
| Contact | [1440px](../.qa/redesign/contact-1440.png) | [768px](../.qa/redesign/contact-768.png) | [390px](../.qa/redesign/contact-390.png) |

Additional evidence: [font/size/overflow metrics](../.qa/redesign/metrics.json), [actual Hebrew type specimen](../.qa/editorial/type-specimen.png), [200% text](../.qa/editorial/home-text-200.png), [itinerary](../.qa/editorial/tour-itinerary-desktop.png), [print PDF](../.qa/editorial/uzbekistan-print.pdf). QA artifacts are local and Git-ignored; the supplied scripts regenerate them.

## Verification results

All commands passed. Production tests launch their own local SSR front/backend processes and clean them up.

| Command | Result / coverage |
| --- | --- |
| `npm.cmd run typecheck` | PASS — shared, backend, frontend route generation and TypeScript |
| `npm.cmd test` | PASS — 20 existing tests |
| `npm.cmd run build` | PASS — shared/backend compilation and Vite client + SSR production build |
| `npm.cmd run smoke` | PASS — 40 pages, six complete itineraries/terms, article prose, metadata, canonicals, 72 one-hop aliases, 404s and useful backend-failure 503s |
| `npm.cmd run smoke:browser` | PASS — all 40 pages at 1280/390px; hydrated navigation, refresh, fragment redirects, skip-link focus, no overflow or console/external-network errors; JavaScript-disabled content/navigation |
| `npm.cmd run test:e2e` | PASS — desktop/mobile home → tours → detail → pricing → contact, keyboard menu/itinerary, terms, article contents, five guide profiles, nine genuine reviews, full source tour text and unique anchors |
| `npm.cmd run test:editorial` | PASS — home/April tour at 1440/768/390/320px, actual local font faces/weights, loaded photos/credits, selected contrast and control sizes, 200% text, keyboard, source disclosures, print state restoration/PDF, no-JS navigation |
| `npm.cmd run test:design` | PASS — seven representative templates × 1440/1024/768/390/320px (35 combinations), single H1, correct Hebrew font families, no horizontal overflow/page errors, loaded full-page captures |

Final CSS bundle: approximately 61.3kB uncompressed / 11.6kB gzip. No runtime package dependencies were added. Responsive photo variants reduce transfer size; the 1920px Samarkand image is about 78% smaller than the retained original. Photos remain self-hosted, dimensioned and attributed. This is selected automated accessibility coverage plus visual inspection, not a formal accessibility audit, a real-device study or testing with the target audience.

## Modified and added files

All paths below are relative to the repository root.

| File | Change |
| --- | --- |
| `front/app/design.css` | New shared tokens, responsive editorial compositions and internal-template styling |
| `front/app/editorial.css` | Updated scope documentation; retained tour/print behavior |
| `front/app/root.tsx` | Loads the shared design layer and preloads local Hebrew font subsets |
| `front/app/components/layout.tsx` | Shared masthead, original compass motif, bilingual branding, grouped footer |
| `front/app/components/editorial-pages.tsx` | Restructured homepage, welcome/destination sections, reordered philosophy/departures, reusable photographs |
| `front/app/components/travel-visuals.tsx` | New shared responsive photograph/credit, destination assignment, missing-photo and compass components |
| `front/app/components/archive-content.tsx` | Listing photography, broader tour hero and article visuals; preserved content/disclosures |
| `front/app/routes/content.tsx` | Applies shared design shell to every content page; loader/meta/canonical logic unchanged |
| `front/public/assets/editorial/samarkand-{480,960,1280,1600,1920}.jpg` | Five local delivery variants |
| `front/public/assets/editorial/bukhara-{480,960,1280}.jpg` | Three local delivery variants |
| `front/public/assets/editorial/china-{480,960}.jpg` | Two local delivery variants |
| `front/public/assets/editorial/image-variants.json` | Variant dimensions, sizes, source filenames and SHA-256 hashes |
| `scripts/reference-research.mjs` | Reproducible public-reference DOM/CSS/screenshot research |
| `scripts/redesign-review.mjs` | Representative-template browser verification and screenshots |
| `scripts/optimize-travel-images.ps1` | Optional Windows image-variant generation from repository originals |
| `package.json` | Adds `test:design`; dependencies unchanged |
| `README.md` | Current design entrypoints, scope and QA instructions |
| `documents/design-research.md` | All eleven reference analyses and coherent design rationale |
| `documents/redesign-review.md` | This delivery/verification record |

Original photo/font files and their licenses remain intact. Backend, shared schemas, archived content, route registry, canonical helpers, metadata generation and server response protections were not edited. Existing SSR metadata behavior remains covered by smoke tests; no new structured-data schema was introduced.

## Preview locally

Use the existing Node 24 / npm 11 setup. Dependencies are already installed in this workspace. From PowerShell:

```powershell
cd D:\repos\RoniEllaToursWebsite
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. Useful routes: `/tours/`, `/tours/china-may-2027/`, `/tours/uzbekistan-april-2027/`, `/blog/uzbekistan-silk-road/`, `/destinations/china/` and `/contact/`. Stop with Ctrl+C. On a fresh checkout run `npm.cmd ci` first. For a production preview, `npm.cmd run build` then `npm.cmd start`, and open http://localhost:3000/.

## Remaining content boundaries

This is a local visual redesign. Existing source conflicts in dates, guide assignments and prices remain flagged for editorial approval. Approved company photography and guide portraits can replace the current licensed destination photographs later. Missing photographs are labeled rather than substituting an unrelated location. The default noindex/no-store staging protections remain active. No user input or production action is needed to review the result locally.
