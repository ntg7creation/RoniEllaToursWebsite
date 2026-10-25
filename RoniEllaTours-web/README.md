# RoniElla Tours - React/Vite Foundation

First-phase rebuild of the RoniElla Tours website using React, JavaScript, and Vite. This is a reviewable layout/code foundation, not a finished public launch.

## Setup

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Project Structure

```text
src/
  components/
    blog/              Article cards
    forms/             Contact, interest, and registration forms
    layout/            Header, mobile nav, footer, shared shell
    tours/             Tour card, tour facts, itinerary day
    ui/                Page headers, sections, placeholder media
  content/
    articles.js        Blog listing and article-template content
    guides.js          Guide bios from the archive
    navigation.js      Header/footer navigation
    reviews.js         Direct Google listing link and independent traveler stories
    pages.js           About, contact, legal/accessibility page content
    site.js            Site-level text and shared "why travel with us" copy
    tours.js           Tour records, itineraries, source metadata
  pages/               Route-level page components
  services/            Future form/API integration stubs
  styles/              Design tokens and global responsive styles
public/placeholders/   Replaceable illustrative placeholder assets
roniella_archive/      Original captured source material, preserved unchanged
```

## Implemented Routes

- `/` - homepage
- `/tours` - tour listing
- `/tours/china-zhong-guo` - representative long tour detail page
- `/tours/uzbekistan` - long itinerary tour detail page
- `/tours/uzbekistan-navruz` - active tour template with partial archived copy
- `/tours/north-greece` - active tour template with partial archived copy
- `/about`
- `/guides`
- `/gallery` - destination image galleries and tour videos
- `/reviews` - traveler recommendations
- `/blog`
- `/blog/:slug`
- `/contact`
- `/privacy-policy`
- `/accessibility`
- `/terms`

`vercel.json` rewrites page routes to `index.html`, excluding `/api/`, so direct navigation to nested client-side routes works on Vercel.

## Languages

The navbar includes Hebrew, English and Russian. Editable Hebrew and English copy lives in matching per-page JSON files in `src/locales/he/` and `src/locales/en/`, including individual tours and articles. Edit the values, leaving lookup keys unchanged.

Russian and future unauthored languages use the English files through a server-side Google Cloud Translation adapter. Activation requires `GOOGLE_TRANSLATE_API_KEY`; until configured, visitors see English with an explicit translation-unavailable notice. See [language editing and setup](docs/languages.md) for instructions and checks.

## Migrated Content Sources

- Homepage core sections: `roniella_archive/pages/001_home.md`
- Tour listing structure: `roniella_archive/pages/002_הטיולים-שלנו.md`
- China tour detail and full itinerary: `roniella_archive/pages/005_הטיולים-שלנו_סין-צונג-גואה-6.md`
- Uzbekistan tour detail and full itinerary: `roniella_archive/pages/004_הטיולים-שלנו_אוזבקיסטן.md`
- Guides: `roniella_archive/pages/016_המדריכים-שלנו.md`
- About: `roniella_archive/pages/033_מי-אנחנו.md`
- Blog listing and article excerpts: `roniella_archive/pages/014_בלוג.md`
- Representative article content: `roniella_archive/pages/020_חמישה-דברים-שלא-ידעתם-על-יוון-העתיקה.md`
- Contact: `roniella_archive/pages/030_יצירת-קשר.md`
- Accessibility: `roniella_archive/pages/018_הצהרת-נגישות.md`
- Privacy: `roniella_archive/pages/041_privacy-policy.md`

Every migrated content object includes `source.archiveFile` and `source.sourceUrl` metadata for traceability.

## Placeholder Areas

- All images are intentionally marked placeholder assets in `public/placeholders/`.
- Recommendations use a direct Google Business Profile API adapter, currently inactive at the owner's request. No reviews are copied into the app. The fallback links to the supplied Google listing. See `docs/google-reviews.md` for later activation and server-only configuration.
- Approved video and written traveler recommendations can be added independently in `src/content/reviews.js`. No testimonial clips have been supplied yet.
- Uzbekistan Navruz and North Greece detail pages use the final page template but still need full body migration.
- Some blog articles currently contain only archived excerpts and template placeholders.
- `/terms` is a basic legal template and must not be treated as final legal copy.

## Future Backend Architecture

Forms validate in the browser but do not submit, store, email, or call third-party services. Future integrations should connect through `src/services/forms.js`, then to server-side endpoints such as Vercel Serverless Functions under `api/`.

Do not place API keys, webhook URLs, email-provider credentials, database connection strings, or CRM tokens in client-side code. A later phase can add endpoints like:

- `POST /api/contact`
- `POST /api/interest`
- `POST /api/registration`

Those endpoints can then handle validation, spam protection, email notifications, webhook dispatch, and persistence through whichever backend is selected.

## Next Content-Migration Tasks

- Replace placeholder image assets with approved destination, guide, and article photography.
- Migrate full tour text for Uzbekistan Navruz and North Greece.
- Migrate all remaining blog article bodies and internal links.
- Review dates, prices, inclusions, exclusions, and cancellation language against current approved business copy before launch.
- Activate and verify the direct Google review connection when the owner is ready.
- Add approved traveler video testimonials to the mixed recommendations feed.
- Finalize legal text and accessibility review before production deployment.
