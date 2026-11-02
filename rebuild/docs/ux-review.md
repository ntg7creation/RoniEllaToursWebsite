# Content layout and end-to-end review

This records the earlier grouping iteration. The homepage and April Uzbekistan tour now use the [two-page editorial prototype](editorial-prototype.md); the other pages retain the layout documented here.

Reviewed locally on 2026-10-25 using the real production SSR frontend and archive-backed API, installed Google Chrome headlessly, with desktop and mobile viewports. There is no connected interactive browser surface in this environment. Screenshots were captured and visually inspected as local images; automated browser tests exercised real controls and links.

## Findings and changes

The previous layout gave introductory prose, itinerary days, terms, reviews and navigation similar visual weight. Some source paragraphs were incorrectly styled as large headings. On mobile, the header's nine links wrapped into several lines, and long articles had section titles embedded in paragraphs.

- Home: a clear introduction and primary tour link, followed by separate trip cards, reasons to travel, guide introduction, review cards and article cards.
- Tours: a desktop sticky summary, mobile summary, section navigation, one initially open itinerary day, independently expandable days, visible pricing and terms grouped by their original labels. Text is preserved in the initial HTML, including closed disclosures.
- Guides: five distinct cards with role previews and expandable complete biographies. Existing stable guide anchors remain available.
- Reading pages: constrained text width, proper section headings where the source paragraph explicitly contains a short heading plus blank line, desktop section navigation and a compact expandable mobile contents list. Long prose mistakenly marked as headings is styled as prose. Only exact repeated About blocks are removed from presentation.
- Reviews: nine archived homepage text reviews retain their attribution; three appear on the homepage. Full quotes are available in native disclosures. No external review widget is loaded.
- Shared layout: compact mobile menu, consistent focus indicators, large controls, warm ivory/forest palette, consistent spacing and type hierarchy. No photos, fonts or third-party services are fetched.

Source records, snapshots, URLs, canonical metadata, source date/price wording, backend behavior and noindex protections remain intact. The layout does not resolve source contradictions or turn archived statuses into approved current availability.

## Checks actually run

`npm.cmd run typecheck`, `npm.cmd test` (20 passing tests), `npm.cmd run build`, `npm.cmd run smoke`, `npm.cmd run smoke:browser` and `npm.cmd run test:e2e` passed.

- HTTP smoke: all 40 real pages, six original itineraries/terms in HTML, article prose/metadata, 72 one-hop legacy redirects, unknown-route 404, no forms/demo data, and API failure/invalid response/timeout 503.
- Broad browser smoke: all 40 pages at 1280px and 390px, no horizontal overflow, one expected H1, no console errors/warnings or external requests, hydration/navigation, deep refresh, source-fragment redirect and skip-link focus.
- UX E2E: desktop/mobile home → tours → China detail → itinerary controls → pricing → cancellation terms → contact; keyboard Enter/Escape and mobile-menu focus; five guide profiles; article/policy section links; long source text and unique anchors for all six tours; mobile JavaScript-disabled navigation, complete final itinerary day and cancellation conditions.
- Visual inspection: homepage desktop, tour mobile, itinerary desktop, terms mobile, guides mobile, article desktop/mobile. Before/after screenshots are ignored local evidence under `rebuild/.qa/ux-before/` and `rebuild/.qa/ux-after/`.

At a 1000px-tall viewport, the default China May tour document changed from 12,109px to 5,467px at 1440px wide (55% shorter), and from 15,985px to 6,357px at 390px wide (60% shorter). These measurements describe the initial collapsed state; opening the full text increases the document length. They do not represent a user study or a formal accessibility certification.

## Repeat

From `rebuild/`:

```powershell
npm.cmd run build
npm.cmd run test:e2e
```

The test owns ports 3600/3601 and stops its production processes afterwards. Chrome/Edge is detected on Windows; `BROWSER_PATH` can specify another executable, or use installed Playwright Chromium. Screenshots and `measurements.json` are written under `.qa/ux-after/`.

Final Figma design, approved photography, editorial/legal approval, source-conflict resolution, and a formal assistive-technology audit remain separate work. No deployment, commit or push was performed.
