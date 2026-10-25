# Website improvement pass — 24 September 2026

## Implemented

- Replaced the cold theme at its source with shared ivory, sand, terracotta, and warm brown tokens. Reworked shared responsive styles, 18px body text, 44–48px targets, readable itinerary widths, consistent cards, clear focus, hover and pressed states, and reduced-motion behavior.
- Kept React, JavaScript, Vite, all existing routes, factual tour content and source metadata. No deployment or external service was added.
- Corrected blank destination headings (`tour.destination` did not exist; `tour.country` does). China and Uzbekistan retain prominent, consistently sized illustrations. Placeholder SVGs remain replaceable at the existing paths, with no instructions embedded in their artwork.
- Removed source paths, migration statuses, development copy and the empty testimonials section from visitor pages. Source references and migration statuses remain in content metadata. Removed the unused SourceNote component.
- Added scroll and focus management on navigation, page titles, a daily-itinerary anchor, full-card links, bidirectional isolation for phone/email/date values and a scrollable mobile menu. The menu closes on selection (including the current route), Escape, outside pointer interaction, focus leaving the header and desktop breakpoint changes.
- Forms explain their unavailable submission state before data entry and link to real phone/email contact methods. Required fields, email validation, autocomplete, error associations, first-error focus and live status are provided. No submission, storage or success claim is made.

## Sticky-header diagnosis

The existing header already used `position: sticky; top: 0`. Its ancestors `html`, `body` and `#root` had `overflow-x: hidden`. Browser-computed overflow on `#root` was `hidden auto`, making it the sticky element's nearest scroll container even though the document was the element actually scrolling. At the bottom of the original desktop China page the header was at -7453px; on the mobile page it was at -13849px.

Removed ancestor overflow rules rather than adding another positioning override. The shell has no fixed height or transform, and the document is the scroll container. The header remains in normal flow, uses an opaque background and z-index 100. A ResizeObserver supplies its actual height for anchor clearance and the menu's available viewport height. The menu is positioned below the header, so opening it does not move content.

## Verification

- Production build: `npm run build`.
- Local Chromium browser checks: all 18 routes at 1440, 768, 390 and 320px; no horizontal document overflow or visible development copy; header stays at top at page bottom.
- China itinerary: checked at 650px scroll intervals through the complete document at all four widths.
- Hero heading, content and action group centers measured within 2px of viewport center.
- Tested mobile menu opening, Escape with focus return, current/new route selection, outside dismissal, stable page position and scrolling at 700×320.
- Tested keyboard skip link and visible outline, active navigation, full-card click, daily-itinerary anchor clearance, and all three forms' required fields, invalid email, first-error focus and honest status. No JavaScript page errors.
- Inspected desktop/mobile screenshots for homepage, tours, tour details, About, guides, blog/article and contact. Before/after screenshots and ancestor measurements are in `screenshots/before/` and `screenshots/after/`.
- Browser tests use Playwright and the locally installed Chromium executable. Set `BROWSER_PATH` to another installed Chromium executable and `SITE_URL` for a different local port. Start the server before running `npm run test:browser` or `npm run review:browser`.
- Not tested on physical devices, Safari/Firefox, a screen reader, or live hosting. Phone/email targets were inspected; no calls or messages were sent. This is not a legal or accessibility certification.

## Unresolved source/content issues

- All illustrations are placeholders; approved destination and guide photography is still needed.
- China says 18 days but the supplied itinerary contains days 1–17. Preserved both rather than inventing day 18.
- Uzbekistan has no supplied price. Navruz lacks dates, price, itinerary and inclusion details. North Greece has only three itinerary headings and lacks dates, price and detailed conditions. Missing details direct visitors to the team.
- Several blog articles contain only excerpts; two have no full body. They retain their routes and clearly state when the full article is unavailable.
- Terms/cancellation content needs completion. The retained privacy and accessibility text includes legacy claims and dates that need owner review against the finished site; no certification was added.
- Forms intentionally do not send or persist data. Users must contact the business by telephone or email.

Original archive files were not changed. No Git metadata was present in this workspace, so a Git diff/commit was unavailable.
