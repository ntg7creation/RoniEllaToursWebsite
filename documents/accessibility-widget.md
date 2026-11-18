# Accessibility widget and statement

The frontend integrates the existing **Accessibility 6.1.0** toolbar by Ran
Buchnik, published as the npm package `accessibility` under the MIT license.
It is free to use, including commercially, and requires no hosted account,
subscription, or activation key. The toolbar UI and display tools are supplied
by the package; this project does not implement a replacement toolbar.

Sources: [upstream project and license](https://github.com/ranbuch/accessibility),
[published package](https://www.npmjs.com/package/accessibility),
[upstream usage and translation options](https://ranbuch.github.io/accessibility/).

## Integration

- `front/app/components/accessibility-widget.tsx` loads the library after React
  hydration and retains a statement link if JavaScript is disabled or loading fails.
- `front/app/client/accessibility.client.ts` configures Hebrew labels, uses the
  package's built-in icons, disables speech/microphone features, and links to
  `/accessibility/` and its `#accessibility-feedback` section.
- The small integration adapter labels the launcher and panel, makes the closed
  panel inert, supports Space and Escape, restores focus, and exposes toggle state.
  It does not replace the library's tools or generate its toolbar UI.
- `front/app/accessibility.css` uses upstream CSS variables for RTL-friendly
  placement, dimensions, fonts, and colors, with focus and small-screen fixes.
- The exact package version and dependency integrity are recorded in the root
  lockfile. The browser loads it from the frontend's own built assets; no remote
  widget script, account identifier, or Google icon font is required.
  Redistributed MIT notices are retained in
  `front/public/assets/licenses/accessibility-widget.txt`.

The menu is a nonmodal dialog: visitors can move focus back into the page. It
does not trap keyboard users or turn ordinary keyboard navigation on and off.

Tools include text size and spacing, line spacing, inverted colors, grayscale,
link underlining, a larger cursor, a reading guide, and animation suppression.
Settings supported by the upstream session implementation use browser storage.
Not every tool is persisted by the upstream package. Storage denial leaves the
tools usable for that visit. Speech recognition and synthesis remain disabled
because Hebrew voice availability and browser permissions vary.

## Statement and CMS release

The old imported statement named the WordPress plugin CODE IN ROL, mentioned an
unrelated domain, carried a 2024 date, and made unverified compliance claims.
The new local statement describes the installed toolbar and implemented
behaviors, gives the business's existing contact methods, and records known
limitations without claiming a completed independent audit.

The bootstrap seed is regenerated for fresh databases only. For an existing
database, use migration
`database/supabase/migrations/20261103000600_accessibility_statement.sql`.
It locks the target page and replaces its blocks only when they still exactly
match the imported statement. Missing pages and an already-updated statement
are harmless; owner-edited statements are preserved and emit a notice.
If skipped, reconcile that page manually in the CMS.

Deploy the frontend containing the package and integration before applying the
statement migration to an existing database. Do not reapply the full seed to a
populated database. The migration is separate from application builds, and
preparing it does not modify the hosted database.

## Requirements and remaining review

For websites subject to the Israeli service-accessibility regulations, the
technical obligation refers to Israeli Standard 5568 at AA level, subject to
the provisions and exceptions in the regulations. The regulations do not
prescribe this particular toolbar. Installing a widget does not establish that
the website, its content, or the business's services satisfy every obligation.

Sources: [Israeli service-accessibility regulations](https://www.gov.il/BlobFolder/guide/accommodating_service_providing_rules/he/sitedocs_service_acessibility_regulations.pdf),
[Commission guidance, updated March 2026](https://www.gov.il/he/pages/website_accessibility),
[Israeli Standard 5568 part 1, September 2023](https://www.gov.il/BlobFolder/legalinfo/israeli_accessibility_standards_pdf/he/sitedocs_si-5568-1-september-2023.pdf),
[W3C guidance on accessibility statements](https://www.w3.org/WAI/planning/statements/).

The business must confirm applicability and any relevant exemption, the correct
accessibility contact or coordinator where required, and any physical-service
accessibility arrangements before final launch. Those facts cannot be inferred
from the old widget. Remaining technical review includes full screen-reader
testing, real-device
coverage, and reviewing linked media and any future documents.
All 123 gallery photographs now have scene-specific Hebrew descriptions based
on visual review. Their separate guarded migration is
`database/supabase/migrations/20261103000700_gallery_image_descriptions.sql`.
It updates only unchanged imported descriptions and preserves owner edits.
The [Israeli accessibility review](israeli-accessibility-review.md) records
the broader technical evaluation, legal sources and remaining business facts.

## Verification

Run `npm.cmd run test:accessibility:browser` after building the frontend. The
script uses local production servers and the real installed library, checks
Hebrew controls, keyboard/focus behavior, supported preference persistence,
200% text sizing, responsive layout, React Router navigation, feedback links,
blocked storage, and the no-JavaScript fallback. Screenshots and measurements
are written under the ignored `.qa/accessibility-review/` directory.

Run `npm.cmd run test:accessibility:audit` for 85 automated scans and
`npm.cmd run test:accessibility:flows` for all 40 pages at 200% text at two
mobile widths plus keyboard/form/dialog checks. Incomplete axe results remain
in the report for human evaluation.
`npm.cmd run test:accessibility:contrast` measures the homepage text against
the actual image/gradient at three widths, covering an area axe cannot assess.

Also run `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run db:verify`,
`npm.cmd run build:vercel:web`, and `npm.cmd run test:vercel` as appropriate.
These checks provide selected functional coverage and are not accessibility
certification. No real email is sent by the widget browser tests.

On 3 November 2026, TypeScript, all 38 unit/API tests, database round-trip and
privilege checks, the frontend Vercel build, and Vercel artifact integration
passed. The toolbar browser checks passed at 320/390/768/1440px, and the existing
design review passed all 35 template/viewport combinations. Final desktop and
mobile toolbar screenshots were visually reviewed. The guarded migration was
also exercised locally against the old statement, repeated application, and
owner-edited content. No hosted database changes or deployment were performed
for this implementation.

The subsequent Israeli-requirements review also passed 85 axe scans with zero
reported violations, 80 enlarged-text page/viewport checks, the targeted image
contrast check, and the callback/gallery regression suites. This remains
selected technical evidence; real screen-reader testing and the complete
criterion/business review remain open as recorded in the linked review.
