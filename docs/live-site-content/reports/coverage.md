# Public crawl coverage — 2026-10-25-live-01

Generated from manifest.txt and immutable HTTP evidence. This is a bounded public-site archive, not a claim about undiscoverable/private pages.

43 distinct page records and snapshots: 40 successful pages, 3 unavailable source records. 77 HTML candidates were requested. The candidate inventory has 299 URLs, including 222 non-page references (221 image references; the sitemap index is also listed there as a resource excluded from the HTML queue). Robots and all sitemap resources were fetched separately: 307 unique same-site URLs across candidate/resource inventories. 4 external navigational references were recorded without fetching their contents. Video/embed/image/metadata URL references also remain in individual records.

## URL outcomes

Outcome | Count
--- | ---
extracted | 40
failed | 3
redirected | 34
excluded | 222

## Distinct page types

Page type | Count
--- | ---
blog | 1
article | 15
home | 1
accessibility | 1
testimonials | 1
terms | 1
videos | 1
gallery | 1
about | 1
privacy | 1
contact | 1
guides | 1
tours | 1
tour | 6
categoryArchive | 1
destinationArchive | 3
leadStatusTaxonomy | 1
authorArchive | 3
unavailable | 2

## Discovery evidence

- robots.txt: HTTP 200; snapshots/2026-10-25-live-01/robots.raw. Its empty Disallow permits this crawl.
- Fresh index and all 7 child sitemaps were read, without assuming a fixed list.
- Sitemaps: https://roniellatours.com/sitemap_index.xml, https://roniellatours.com/post-sitemap.xml, https://roniellatours.com/page-sitemap.xml, https://roniellatours.com/trips-sitemap.xml, https://roniellatours.com/category-sitemap.xml, https://roniellatours.com/trips_cats-sitemap.xml, https://roniellatours.com/lead_status-sitemap.xml, https://roniellatours.com/author-sitemap.xml.
- Followed same-site header/footer, article/tour/category/archive links, canonical/shortlink aliases and next/previous pagination links. No pagination links remained pending. No tag archive link/sitemap was discovered; this is absence in the observed graph, not proof that none exist.
- Rate: at least 1000ms between requests, 20-second timeout, at most two retries with exponential backoff, at most eight same-site redirect hops and 400 candidates. No login, form submission, private endpoint, external site, video or photo download.
- No browser surface was connected to the available browser tool. Primary text was present in HTML; the testimonials page contains image references instead of text quotes, so no OCR/transcription was invented. Video URLs were present in public Elementor settings; missing titles/descriptions stay missing.
- No WordPress REST supplementation was necessary. Sitemap lastmod remains discovery evidence only.

## All failed/blocked/pending HTML candidates

Requested URL | HTTP status | Decision / gap
--- | --- | ---
https://roniellatours.com/lead-status/new/ | 404 | Source returns an error; public path unresolved; do not redirect to homepage
https://roniellatours.com/הטיולים-שלנו/סין-צונג-גואה-4/ | 404 | Source returns an error; public path unresolved; do not redirect to homepage
https://roniellatours.com/הטיולים-שלנו/אוזבקיסטן/ | 404 | Source returns an error; public path unresolved; do not redirect to homepage

## Content gaps and review

- Image-only testimonials: original image URL/alt/caption references retained; quote and attribution text cannot be recovered without a separately approved transcription/OCR task.
- Individual video titles/descriptions not present in source remain null. External video availability/content was not checked.
- Public 404s include a sitemap-listed lead-status taxonomy and old tour links; these remain unresolved, not silently retired.
- All source wording, SEO, guide bios, travel terms and conflicting values are evidence requiring review, not approved production facts.
- Fidelity check: 40 successful pages compared; 0 pages with unmatched readable text nodes.
- Manual spot comparisons are documented in manual-review.md; these do not certify every source claim.
- Unavailable publicly: SEO-plugin private settings, rankings/traffic history, unpublished content and server redirect rules not observable through these requests. None were inferred.

## Inventory and explicit decisions

Every discovered page/asset candidate is listed in manifest.urls and url-map.csv; robots/sitemap resources are additionally listed in manifest.resources. Asset/non-HTML/API/query exclusions are retrieval decisions, not editorial retirement of taxonomy/content. External references are recorded separately. All 40 available pages have explicit saved ASCII path proposals; unavailable pages are unresolved. No successful taxonomy page was automatically excluded.

ID | Type | Status | Proposed path | Source path
--- | --- | --- | --- | ---
page-e2ae99d4-4867-4f00-b5de-725583543af6 | blog | 200 | /blog/ | https://roniellatours.com/בלוג/
page-32a0beb0-48a4-4812-b05f-9d3dc80d9df4 | article | 200 | /blog/abu-simbel/ | https://roniellatours.com/טיול-לאבו-סימבל/
page-f3047d75-2bb0-4e63-8de0-bc4eaf27d68a | article | 200 | /blog/hanging-church/ | https://roniellatours.com/כנסייה-תלויה-כנסייה-אל-מועלק/
page-abef17c9-f313-4611-8203-e47d306b916a | article | 200 | /blog/memphis-saqqara/ | https://roniellatours.com/טיול-לממפיס-סקארה/
page-8f0d4e17-ba3f-4ff0-ad60-5097b256cfd7 | article | 200 | /blog/cairo/ | https://roniellatours.com/טיול-לקהיר/
page-0ece30a3-48a0-4586-bed3-100457f83c8d | article | 200 | /blog/alexandria/ | https://roniellatours.com/טיול-לאלכסנדריה/
page-7f6996d9-3dde-4d7a-8d00-5309944361a2 | article | 200 | /blog/dendera-zodiac/ | https://roniellatours.com/מקדשי-דנדרה-זודיאק-של-דנדרה/
page-56dcafb5-3628-4c18-953c-02b0deb8adc9 | article | 200 | /blog/aswan-dam/ | https://roniellatours.com/טיול-לסכר-אסואן/
page-1dfc1f64-9c6a-4a46-8199-47d84ad3ff19 | article | 200 | /blog/ancient-greece-facts/ | https://roniellatours.com/חמישה-דברים-שלא-ידעתם-על-יוון-העתיקה/
page-d0f02c63-5adc-429a-9207-067f632a39c3 | article | 200 | /blog/ancient-china-facts/ | https://roniellatours.com/חמישה-דברים-שלא-ידעתם-על-סין-העתיקה/
page-d642ebf1-f724-414e-8d32-a5c213cdd9be | article | 200 | /blog/pyramids/ | https://roniellatours.com/טיול-לפירמידות/
page-10d00229-15ad-48b7-9c9d-7bb2bac24a7a | article | 200 | /blog/athens/ | https://roniellatours.com/אתונה-בירת-יוון-והלב-הפועם-של-התרבות-ה/
page-a8b24e49-16c5-4b84-a519-0de512ec4252 | article | 200 | /blog/beijing/ | https://roniellatours.com/בייגינג-בירת-סין/
page-1b9cfdf5-9ee7-4d5f-8fc8-c8bdad1a7c68 | article | 200 | /blog/china-experience/ | https://roniellatours.com/טיול-מאורגן-לסין-חוויה-של-פעם-בחיים/
page-cb2d6d2e-d1b3-49dd-a9aa-530690824b91 | article | 200 | /blog/china-cultural-journey/ | https://roniellatours.com/מסע-תרבותי-אימפריה-סינית/
page-96557157-6056-4ad0-b9a5-890867a778b1 | article | 200 | /blog/uzbekistan-silk-road/ | https://roniellatours.com/טיול-מאורגן-לאוזבקיסטן/
page-11b19c6d-4634-4aaf-82ce-7e1f5fb35795 | home | 200 | / | https://roniellatours.com/
page-0e958bd7-b13b-4fa1-b49a-57bca790aa2f | accessibility | 200 | /accessibility/ | https://roniellatours.com/הצהרת-נגישות/
page-357b4143-9236-4375-a9ea-b8c86e8f5c17 | testimonials | 200 | /testimonials/ | https://roniellatours.com/המלצות/
page-4c573761-052a-4365-98fe-78b021e4cf4b | terms | 200 | /prices-and-terms/ | https://roniellatours.com/מחירים-ותנאים/
page-233e9f1f-20f0-4fdb-af54-ccea5804ee39 | videos | 200 | /videos/ | https://roniellatours.com/וידיאו/
page-df1f53e2-e60a-494d-8089-e928f7441bbb | gallery | 200 | /gallery/ | https://roniellatours.com/גלריה/
page-fe5b238c-8e40-4c47-86ac-931d5f95672d | about | 200 | /about/ | https://roniellatours.com/מי-אנחנו/
page-2e63b934-ac47-4c06-9869-8a08048796bc | privacy | 200 | /privacy/ | https://roniellatours.com/privacy-policy/
page-d17a3366-d3b4-4007-86de-6c51165a6c69 | contact | 200 | /contact/ | https://roniellatours.com/יצירת-קשר/
page-1dda50ad-a058-4262-9e38-a99f8ec1e657 | guides | 200 | /guides/ | https://roniellatours.com/המדריכים-שלנו/
page-6fce0ca4-1ad8-449d-8d01-84d8141e3f2f | tours | 200 | /tours/ | https://roniellatours.com/הטיולים-שלנו/
page-91f21a4c-b40b-431c-a1d6-6e2e966c0929 | tour | 200 | /tours/northern-greece/ | https://roniellatours.com/הטיולים-שלנו/צפון-יוון-2/
page-8b705230-ab4d-496c-8e06-f2bcc6254ac6 | tour | 200 | /tours/china-may-2027/ | https://roniellatours.com/הטיולים-שלנו/סין-צונג-גואה-מאי-2027/
page-ab41fae7-625a-40f8-8ef7-83dd3e578e47 | tour | 200 | /tours/china-september-2027/ | https://roniellatours.com/הטיולים-שלנו/סין-צונג-גואה-ספטמבר-2027/
page-ea3b483b-a1af-4c08-a715-16a97d3b0082 | tour | 200 | /tours/uzbekistan-sukkot-2027/ | https://roniellatours.com/הטיולים-שלנו/אוזבקיסטן-2027-אפריל-2/
page-99086b24-3a6e-4817-b05a-9617a417b886 | tour | 200 | /tours/uzbekistan-march-2027/ | https://roniellatours.com/הטיולים-שלנו/אוזבקיסטן-מרץ-2027/
page-1259e55f-578c-4db2-90b6-274d43d51283 | tour | 200 | /tours/uzbekistan-april-2027/ | https://roniellatours.com/הטיולים-שלנו/אוזבקיסטן-2027-אפריל/
page-496b135a-ca6c-4c36-b312-22502e4f12e1 | categoryArchive | 200 | /category/general/ | https://roniellatours.com/category/כללי/
page-60a3dc6c-c9d0-4d90-a4e4-fa1cecf71ab8 | destinationArchive | 200 | /destinations/uzbekistan/ | https://roniellatours.com/המדינות/אוזבקיסטן/
page-bf7483c1-f008-4008-902e-91ceef37abd1 | destinationArchive | 200 | /destinations/greece/ | https://roniellatours.com/המדינות/יוון/
page-8101b7c5-4a69-4feb-859a-e988f656b78c | destinationArchive | 200 | /destinations/china/ | https://roniellatours.com/המדינות/סין/
page-9a9eb7fe-463a-4a45-9ea3-57a93672d117 | leadStatusTaxonomy | 404 | UNRESOLVED | https://roniellatours.com/lead-status/new/
page-8b5c126b-4175-4479-8bf8-8581747abd8f | authorArchive | 200 | /authors/yaniv-ozana/ | https://roniellatours.com/author/yozana/
page-02732de0-5f00-435f-b924-831070d3c2bd | authorArchive | 200 | /authors/oren-tal/ | https://roniellatours.com/author/orental/
page-28aeda68-0dc8-47bd-ae07-87107734b74d | authorArchive | 200 | /authors/roni/ | https://roniellatours.com/author/roni/
page-6b2d8e43-5ffc-42de-b3ef-a80e6e98e8a2 | unavailable | 404 | UNRESOLVED | https://roniellatours.com/הטיולים-שלנו/סין-צונג-גואה-4/
page-755bedb3-7919-41b7-8ba1-2f3de93b2b47 | unavailable | 404 | UNRESOLVED | https://roniellatours.com/הטיולים-שלנו/אוזבקיסטן/

