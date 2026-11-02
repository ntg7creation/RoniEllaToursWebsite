# Editorial prototype — review checkpoint

Implemented on 25 October 2026 for **two pages only**: `/` and `/tours/uzbekistan-april-2027/`. The other 38 pages retain their previous presentation. SSR, the read-only backend, source archive, ASCII URLs, redirects, canonical metadata and staging noindex remain intact. New display headings do not overwrite source SEO titles.

The homepage has a short human headline, destination photography, three distinct departure cards, the company's approach, guide introductions, two traveler stories, articles and contact. The tour separates destination, subtitle, month and inquiry; adds introduction/highlights and a route overview; retains all eight archived itinerary entries; and provides open/close controls, guide context, logistics, source conditions, questions and print styles.

## Design and source decisions

Local Frank Ruhl Libre 500–600 and Noto Sans Hebrew 400–600; cream, deep teal and restrained sandstone/gold; 20px desktop body text and 19px at smaller widths; 1.75 line height; relative-unit headings and right-aligned Hebrew. Photos alternate with open editorial layouts. Panels group practical information and source evidence.

Design references: [Audley Uzbekistan](https://www.audleytravel.com/uzbekistan), [Intrepid Uzbekistan Adventure](https://www.intrepidtravel.com/eu/uzbekistan/uzbekistan-adventure-174373), and [Black Tomato](https://www.blacktomato.com/). Their copy, photos, scripts and branding were not copied. No supplied brochure HTML exists in this checkout; the implementation follows the written brief and live reference URLs.

April dates, duration and guide names conflict across the source. The prototype does **not** pick an approved version, add a ninth day, invent nights, select a price or infer availability. Exact dates, duration, price and guide assignment remain awaiting confirmation; original text remains in labeled disclosures and server HTML, including the print view.

**Approved guide portraits have not been supplied**. Initials accompany real archived names/credentials; no stock or generated face stands in for a real guide. The headline is draft brand copy from the brief.

## Assets and implementation

| Local photo     | Source / attribution                                                                                                         | License                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `bukhara.jpg`   | [Po-i-Kalyan](https://commons.wikimedia.org/wiki/File:Bujar%C3%A1,_Po-i-Kalyan_01.jpg), LBM1948                              | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `samarkand.jpg` | [Registan](<https://commons.wikimedia.org/wiki/File:Samarcanda,_Regist%C3%A1n_(cropped).jpg>), LBM1948; source crop by Teseo | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `china.jpg`     | [Great Wall at Mutianyu](https://commons.wikimedia.org/wiki/File:Great_Wall_of_China_at_Mutianyu.JPG), CTLiotta              | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)   |

Files are unmodified source thumbnails, with CSS crops noted in their visible credit controls. Alt text, captions and attribution/license links accompany each photo. The fonts come from Google Fonts' [Frank Ruhl Libre](https://github.com/google/fonts/tree/main/ofl/frankruhllibre) and [Noto Sans Hebrew](https://github.com/google/fonts/tree/main/ofl/notosanshebrew) distributions under SIL OFL 1.1. Original font licenses and a source/hash registry are in `frontend/public/assets/editorial/`.

Edit `frontend/app/components/editorial-pages.tsx`, `editorial-config.ts` and scoped `frontend/app/editorial.css`. Content still comes through the validated backend; original records/snapshots were not edited for design. Runtime loads no external photo/font/map/video/tracking services. Optional acquisition: `node scripts/design-assets.mjs` (network access required).

## Review and repeat

From `rebuild/`:

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:5173/` and `http://127.0.0.1:5173/tours/uzbekistan-april-2027/`.

Repeat production QA with `npm.cmd run build` then `npm.cmd run test:editorial`. The test owns/stops ports 3700/3701 and writes ignored artifacts under `.qa/editorial/`:

- `home-1440.png`, `home-768.png`, `home-390.png`, `home-320.png`, and matching tour images.
- Full desktop/mobile pages, `tour-itinerary-desktop.png`, and `*-text-200.png`.
- `type-specimen.png`/HTML: actual Hebrew at Frank 500/600 and Noto 400/500/600.
- `uzbekistan-print.pdf`: full source itinerary/conditions, qualifications, photo credits and contact. Print events restore disclosure states afterwards.
- `metrics.json`: actual computed typography at each viewport.

## Checks actually run

- Strict type checking, 20 schema/repository/API tests and production builds passed.
- HTTP smoke passed for all 40 pages: itinerary/terms SSR, metadata, 72 one-hop aliases, 404s and API failure/invalid response/timeout 503.
- Existing browser smoke passed across all 40 pages at 1280/390: hydration, refresh, fragments, skip-link focus, no overflow, console errors/warnings or external requests.
- Existing UX E2E passed, including complete long-form source text and unique anchors across all six tours.
- New prototype E2E passed at 1440/768/390/320: actual font weights, photos/credits, selected text contrast and control sizes, 200% text enlargement, keyboard focus/traversal, hydration, source-disclosure deep links/refresh, itinerary controls, print visibility/state restoration/PDF and JavaScript-disabled navigation/disclosures.
- Home/tour desktop/mobile, itinerary, enlarged text and font specimen screenshots were visually inspected. No deployment, commit or push; owned test servers are stopped.

WCAG 2.2 AA is a **target**, not a conformance claim. The 200% test increases the root font size in Chromium; 320 CSS pixels separately checks narrow reflow. Native browser-menu zoom, screen-reader auditing, independent PDF pagination inspection and an unfamiliar-user study remain unperformed. Relevant criteria: [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).

Stop here for review before extending the design. Business facts and portraits still require approved sources.
