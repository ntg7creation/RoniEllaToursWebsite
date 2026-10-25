# Website languages

The navbar offers Hebrew, English and Russian. The visitor’s choice is saved in local storage, survives navigation/reload, and does not clear form entries. Hebrew is RTL; English and Russian are LTR. Existing page URLs are unchanged.

## Editing Hebrew and English

All authored copy is in `src/locales/he/` and `src/locales/en/`. Each page has its own matching JSON file:

- `home.json`, `about.json`, `tours.json`, `guides.json`, `gallery.json`, `reviews.json`, `blog.json`, `contact.json`.
- Each tour has `tour-<slug>.json`, including its full description, itinerary and conditions.
- Each article has `article-<slug>.json`.
- `privacy.json`, `accessibility.json`, `terms.json`, `not-found.json` cover the remaining pages.
- `common.json` holds navigation, footer, forms, shared components and validation messages. `tour-detail.json`, `article.json`, `legal.json` hold shared page-layout labels.

Edit the **value on the right**, keeping the key on the left unchanged. The existing Hebrew phrases are stable lookup keys, not an instruction to use Hebrew as the automatic translation source. Example in `en/common.json`:

```json
"הטיולים שלנו": "Our tours"
```

Keep tokens such as `{number}`, `{field}` and `{0}` in both languages. Their position can change to suit the sentence. Text is rendered as plain text, never HTML.

The existing `src/content/` modules still own routes, IDs, image/video URLs, itinerary structure and source metadata. Their source phrases identify entries in the language files. To change displayed wording, edit the locale value. For new content, add matching keys/values to both language files. Content reused on the homepage or cards reads its original page’s catalog through `pageNamespaces` in `src/i18n/languages.js`.

The English translation preserves the supplied content and its existing facts; it is not a new fact-check of historical claims, prices, departure information or policies. Customer-authored Google reviews remain in their original language. Changing the UI language does not dub videos or translate their audio/captions.

## Automatic translation

For a selected language without a complete authored catalog, `/api/translate` translates the **English catalog values** using Google Cloud Translation Basic v2. Russian is the first such language. The site never sends visitor form data or live Google review text to translation.

**Activation is still required.** Enable Cloud Translation in a Google Cloud project with billing, create an API key restricted to Cloud Translation, and set `GOOGLE_TRANSLATE_API_KEY` in the server environment (local `.env`, or the hosting provider’s secret settings). Never use `VITE_` or place a key in source files. Restart Vite after changing `.env`. This is separate from the Google Business Profile connection used for reviews and does not use WordPress.

The adapter is registered for local Vite development/preview and as `api/translate.js` for Vercel. Vercel includes the English catalog files using `vercel.json`. A static-only host needs a compatible server endpoint: the static build alone cannot safely call a paid provider with a secret key.

Google may charge for translated characters. Only allowlisted website namespaces/targets are accepted, requests are batched, concurrent work is shared, and translated pages are cached for 24 hours in each server process. Editing English text changes the cache hash. This memory cache is not persistent across server restarts or different serverless instances; configure provider quotas/budget alerts before public use. No database has been added.

While loading, and when the service is unconfigured or unavailable, the site displays English with an explicit notice. Successful output is marked as automatic translation. Missing placeholders or incomplete responses are rejected. Switching languages or routes cancels stale client requests. The actual displayed language controls the document’s `lang` and `dir` attributes.

## More languages later

Add a supported Google translation target with its native label and direction to `src/i18n/languages.js`. With no authored folder, it uses English-based automatic translation. To replace automatic translation with reviewed copy, add a complete matching `src/locales/<code>/` folder; authored files take precedence. `src/i18n/translationMessages.js` contains the small status messages used before a translation is available.

## Verification

- `npm run build`
- `npm run test:translations`: catalog parity/placeholders, service validation, caching/invalidation, batching and failure handling with a mocked provider.
- `npm run test:languages`: browser checks on the local server, default `http://127.0.0.1:5175`; override `SITE_URL` if needed. Tests all existing routes at desktop/mobile sizes, direction, translated text/labels, overflow, sticky navigation, form state, search and the language control. Russian success is mocked, and the missing-configuration state is tested against the local endpoint.

No real Google translation has been requested or verified without credentials. Screenshots are in `screenshots/languages/`.

Automatic translation uses [Google Cloud Translation](https://cloud.google.com/translate). Successful results include Google's official attribution badge, a provider notice, and a machine-translation language tag, following the [attribution](https://docs.cloud.google.com/translate/attribution) and [markup](https://docs.cloud.google.com/translate/markup) guidance. The unchanged badge in `public/translation/png/color-regular.png` comes from Google's official attribution asset ZIP.
