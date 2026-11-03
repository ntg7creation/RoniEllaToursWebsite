# Reference route inventory — historical Step 1

Current runtime: all 40 successful live archive paths and their 72 known aliases are now served by the back/frontend. The demo detail routes listed below are historical and return 404. See [archive integration](archive-integration.md) and [the generated full map](live-site-content/reports/url-map.csv).

**Superseded for new public URLs by Step 2 (2026-10-25).** The observations below remain historical evidence. Current scaffold canonical paths are `/`, `/tours/`, `/about/`, `/guides/`, `/blog/`, `/gallery/`, `/videos/`, `/testimonials/`, `/contact/`, `/privacy/`, `/accessibility/`; demo detail paths are `/tours/silk-road-demo/`, `/tours/greece-demo/`, `/blog/travel-journal-demo/`, `/blog/greece-notes-demo/`. Former scaffold paths redirect once with HTTP 301. Unknown paths still return 404. Fresh live observations, older aliases, unavailable pages and proposed real-content paths are in [the full live archive map](live-site-content/reports/url-map.csv); real tour/article redirects remain inactive until their destination content exists. No distinct dated trips were merged.

Inspected on **2026-10-25**. Source: [live site](https://roniellatours.com/) and its navigation, footer, tours and blog listings; the existing local checkout of [the old repository](https://github.com/ntg7creation/RoniEllaToursWebsite) was inspected for structure only. This is a bounded inventory, not a crawl or full migration. No old application code or live prices, schedules, terms, customer quotes or photographs were copied.

## Observed navigation and footer URLs

Paths below are decoded for readability; percent-encoded Hebrew requests resolve to the same paths.

| Purpose       | Observed URL                              | Evidence / access                                                        | Foundation path                                |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| Home          | https://roniellatours.com/                | Loaded                                                                   | `/`                                            |
| Tours         | https://roniellatours.com/הטיולים-שלנו/   | Home navigation and loaded listing                                       | `/הטיולים-שלנו/`                               |
| About         | https://roniellatours.com/מי-אנחנו/       | Home navigation and loaded page                                          | `/מי-אנחנו/`                                   |
| Guides        | https://roniellatours.com/המדריכים-שלנו/  | Home navigation and loaded page                                          | `/המדריכים-שלנו/`                              |
| Blog          | https://roniellatours.com/בלוג/           | Home navigation and loaded listing                                       | `/בלוג/`                                       |
| Gallery       | https://roniellatours.com/גלריה/          | Loaded; destination filters visible                                      | `/גלריה/`                                      |
| Videos        | https://roniellatours.com/וידיאו/         | Loaded; nested beneath gallery in live navigation                        | `/וידיאו/`                                     |
| Testimonials  | https://roniellatours.com/המלצות/         | Home menu link observed; page request timed out, contents **unverified** | `/המלצות/` provisionally retains observed link |
| Contact       | https://roniellatours.com/יצירת-קשר/      | Loaded; phone/email/address visible                                      | `/יצירת-קשר/`                                  |
| Privacy       | https://roniellatours.com/privacy-policy/ | Footer link loaded successfully; earlier slashless request failed        | `/privacy-policy/` — draft                     |
| Accessibility | https://roniellatours.com/הצהרת-נגישות/   | Footer link loaded                                                       | `/הצהרת-נגישות/` — draft                       |

The reference contact page exposes `073-3744686` / `0733744686`, `roniellatours@gmail.com`, and דרך בית לחם 74 ירושלים. These are reference observations, not owner-approved production content. Only phone/email links are implemented; live forms are outside this milestone.

## Observed detail structure (not migrated)

| Observed URL                                        | Evidence                  | Treatment                                                             |
| --------------------------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| https://roniellatours.com/הטיולים-שלנו/צפון-יוון-2/ | Loaded from tours listing | Confirms nested Hebrew tour detail pattern; not added as a demo alias |
| https://roniellatours.com/בייגינג-בירת-סין/         | Loaded from blog listing  | Confirms articles can live at root, outside `/בלוג/`                  |
| https://roniellatours.com/טיול-לקהיר/               | Loaded from blog listing  | Another verified root-level article                                   |

The live tour detail includes introduction, destination/guide, duration, departures/prices, itinerary, inclusions/exclusions and terms. The new sample tour demonstrates these sections with original short demo text. Each itinerary is attached to the tour; dated departures are separate records.

## Proposed additions (demo only, not observed legacy URLs)

| Purpose                             | Proposed new path                | Status                       |
| ----------------------------------- | -------------------------------- | ---------------------------- |
| Sample tour with several departures | `/הטיולים-שלנו/דרך-המשי-לדוגמה/` | Implemented with Hebrew slug |
| Sample tour without departures      | `/הטיולים-שלנו/יוון-לדוגמה/`     | Implemented with empty state |
| First sample article                | `/יומן-מסע-לדוגמה/`              | Explicit root-level route    |
| Second sample article               | `/מבט-על-יוון-לדוגמה/`           | Explicit root-level route    |

Unknown page paths, unknown tour slugs, unknown root article slugs and fabricated `/בלוג/:slug/` paths return HTTP 404. Known legacy detail URLs that were not seeded also return 404; a full migration/redirect policy is deferred. Known fixture paths work directly with encoded Hebrew and with or without a final slash; metadata always uses the fixture's trailing-slash canonical and configured site origin. No inferred aliases or blanket article matcher are installed.
