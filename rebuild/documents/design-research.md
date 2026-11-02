# RoniElla Tours — reference research and design direction

**Latest revision:** the user's subsequent Figma export now leads the visual direction, and regular text uses Assistant. See [Figma, local content and SSR update](local-content-and-figma-update.md). The eleven-site observations below remain research evidence for the initial direction.

Research date: 2 November 2026. Scope: local frontend redesign; no production changes.

## Method and evidence

All eleven requested homepages returned HTTP 200 in installed headless Chrome. `node scripts/reference-research.mjs` visits each at **1440 × 1000** and **390 × 1000**, captures viewport/full-page PNGs, and records rendered element bounds, DOM classes, computed fonts, line heights, colors, padding, object fit, Grid/Flexbox containers and navigation. Evidence lives in [`.qa/references/observations.json`](../.qa/references/observations.json). Screenshots follow `<domain>-<width>.png` and `<domain>-<width>-full.png` in that directory. These are local research artifacts, excluded from Git. No competitor assets or source code enter the product.

The interactive browser connector had no available session. The repository's existing Playwright/Chrome setup did work, providing rendered DOM/CSS and screenshots. This is browser research, not a source-code reconstruction. Measurements below are computed **samples at the stated widths**, not claims about every stylesheet rule or exact breakpoint. Many references use Squarespace: visible `.content-wrapper` elements use Flexbox, with nested `.fluid-engine` CSS grids for compositions. Their proprietary layout system is not reused.

Limitations: consent banners and Pack Up + Go's marketing dialog were left visible; some full-page captures retain blank areas where scroll/entrance animation or lazy media was not fully resolved. Huffman's hero media did not appear in the capture. Avenue H uses mostly Framer `div`/rich-text elements, so the semantic-heading query returned no headings; its rendered text and layout containers were inspected separately. Explorateur's custom containers did not match the generic Grid/Flexbox selector; no unsupported claim about its layout engine is made. Screenshots are evidence of the captured state, not proof that missing imagery is absent from the live site.

## 1. Blonde Atlas

URL: https://www.blondeatlas.com/ · [desktop](../.qa/references/blondeatlas.com-1440.png) · [mobile](../.qa/references/blondeatlas.com-390.png)

- **Identity / typography:** warm near-white `#fdfbf9`, charcoal, sage and muted blue. Perfectly Nineties display face: sampled H1 96.5px/96.5px, light weight; compact Commuters Sans labels; Work Sans paragraphs 16.7px/30.1px. Mobile H1 about 41.9px.
- **Architecture:** announcement and light masthead → three-panel photographic hero → founder introduction → publication marks → tailored services/team → journal → related group travel brand → large inquiry section → blue footer with secondary navigation.
- **HTML/CSS:** fixed header with Flexbox inner container; full-width sections around constrained editorial content; nested fluid CSS grids place image and text blocks. Hero is approximately 911px including its header allowance at desktop. Photographs carry the composition without card borders.
- **Navigation / mobile:** four primary labels plus a separate inquiry action; compact mobile masthead and reduced headline width. Desktop collage simplifies around the central image.
- **Adapt:** display/body contrast, founder-first trust, spacious editorial rhythm and a distinct contact finale. **Avoid:** thin decorative italics in Hebrew, entrance-dependent content and a separate shop competing with tours.

## 2. Milk + Honey Travels

URL: https://www.milkandhoneytravels.com/ · [desktop](../.qa/references/milkandhoneytravels.com-1440.png) · [mobile](../.qa/references/milkandhoneytravels.com-390.png)

- **Identity / typography:** cream `#fcf7f2`, taupe, charcoal; Gotu display lettering, Oakley Script accents, Josefin Sans body sampled at 17px/30.6px. Main desktop display 62px/71px; mobile sample 50px.
- **Architecture:** cinematic image with navigation over it → three-link action strip → overlapping introduction → experience discovery → dark statement → content teaser → founder story → process → testimonials → social invitation → organized footer.
- **HTML/CSS:** Flexbox masthead split around the centered logo; fluid grid with 11px gaps; image blocks and text occupy overlapping columns. Full-width background changes distinguish sections. First hero about 663px at desktop.
- **Navigation / mobile:** short service/inspiration/about/contact choices become a compact menu. Headline wraps into several lines; action strip becomes narrow columns, a density to improve on.
- **Adapt:** personal voice, alternating photographic/text sections, generous line height and background transitions. **Avoid:** cursive Hebrew labels, quiz-led discovery and several equally prominent hero actions for older visitors.

## 3. Savoir Travel

URL: https://www.savoir-travel.com/ · [desktop](../.qa/references/savoir-travel.com-1440.png) · [mobile](../.qa/references/savoir-travel.com-390.png)

- **Identity / typography:** pale stone `#ebe6e6`, brown and muted sage. Freight Neo Pro headings sampled at 61.2px/66.1px; Freight Display Pro body 18px/25.2px. Mobile hero 43px.
- **Architecture:** opaque masthead → three-image hero with centered heading/button → offset two-image introduction → testimonials → three expectations → partner marks → dark contact section → brand/navigation footer and newsletter.
- **HTML/CSS:** Flexbox header and section wrappers, nested grid composition with 11px gutters. Sample intro wrapper has about 95px vertical padding; hero wrapper about 115px. Cropped images form a coordinated collage rather than separate boxed cards.
- **Navigation / mobile:** very few primary links, inquiry clearly separated; mobile narrows the headline and stacks introduction images/text.
- **Adapt:** warm stone surfaces, sparse navigation, layered imagery and contact continuity. **Avoid:** low-contrast pale labels, hotel-booking emphasis, large partner-logo walls and testimonial carousels as the sole way to read reviews.

## 4. Avenue H

URL: https://www.avenueh.com/ · [desktop](../.qa/references/avenueh.com-1440.png) · [mobile](../.qa/references/avenueh.com-390.png)

- **Identity / typography:** quiet cream, olive and sand; small restrained editorial type against expansive photography. Computed rich-text sample: Catalogue LL Regular 16px/25.6px, Mabry Pro auxiliary text. No semantic H1–H4 appeared in the heading selector.
- **Architecture:** viewport-scale film/image introduction → image/text manifesto → olive photographic collage → alternating service split → sand collage → working philosophy → photographic inquiry → multi-column contact form/footer.
- **HTML/CSS:** Framer Flexbox stacks and a measured seven-column grid inside a 1296px container at 1440px. Deliberate differing image heights and overlapping composition; full-width color bands. Mobile outer stack sampled 50px 30px 90px padding.
- **Navigation / mobile:** the opening makes brand/contact the dominant choices, with a vertically spread mobile arrangement.
- **Adapt:** controlled asymmetry, image captions, alternating image/text direction and calm pacing. **Avoid:** referral-only positioning, tiny text, minimal discovery navigation and cinematic interactions that obscure what a group-tour business offers.

## 5. Trolley Lane Travel

URL: https://www.trolleylanetravel.com/ · [desktop](../.qa/references/trolleylanetravel.com-1440.png) · [mobile](../.qa/references/trolleylanetravel.com-390.png)

- **Identity / typography:** blue, pale pink and light blue-gray. Alice serif H1 sampled 51.6px/56.5px; Adelle Sans paragraphs 17.6px/31.7px. Mobile H1 39.8px.
- **Architecture:** announcement → masthead → split text/photo-postcard hero → destination introduction → horizontal service list → reasons to choose → accreditation → reviews → invitation → newsletter and comprehensive footer.
- **HTML/CSS:** Flexbox wrappers; 57.6px desktop horizontal inset becomes 23.4px at mobile. Overlapping tilted image frames create an informal scrapbook effect. Repeated service blocks appear in a horizontal list rather than simply extending the page.
- **Navigation / mobile:** three principal groups plus a quote button; mobile hamburger and single-column hero, with photo collage following copy.
- **Adapt:** approachable serif/sans pairing, clear service introduction and immediately legible contact action. **Avoid:** theme-park motifs, playful photo rotations, long service carousels and overly tall promotional masthead.

## 6. Pack Up + Go

URL: https://www.packupgo.com/ · [desktop](../.qa/references/packupgo.com-1440.png) · [mobile](../.qa/references/packupgo.com-390.png)

- **Identity / typography:** mint/teal, deep green, mustard and orange; friendly New Spirit serif with Poppins. Display sample 43.9px/41.3px, body 21.5px/36.5px; mobile display 32.2px.
- **Architecture:** compact masthead → overlapping solid text panel/photo hero → three numbered steps → trust statement → benefits → large colored FAQ rows → press → journal → human-support form → CTA and grouped footer links.
- **HTML/CSS:** fluid grid with 11px gaps; rounded large surfaces, overlapping horizontal regions, typography rather than icons for strong hierarchy. Mobile rearranges the hero photo above the copy; clear vertically stacked process.
- **Navigation / mobile:** extensive desktop link set and separate booking button; mobile hamburger. Marketing dialog obscured part of captured hero.
- **Adapt:** plain-language explanations, readable body size, visible human help and a numbered philosophy. **Avoid:** surprise-destination product model, many simultaneous colors, popups, multiple H1s and survey/booking funnel complexity.

## 7. Lozano Travel

URL: https://www.lozanotravel.com/ · [desktop](../.qa/references/lozanotravel.com-1440.png) · [mobile](../.qa/references/lozanotravel.com-390.png)

- **Identity / typography:** warm off-white, black and subtle gold. Lora serif H1 sampled 85.1px/100.1px; H2 50.6px/65.1px; Work Sans body 17.7px/26.6px. Mobile H1 59.2px.
- **Architecture:** photographic hero → introduction beside experience previews → philosophy → experience figures → reviews → detailed numbered process → founding story → contact/navigation/newsletter footer.
- **HTML/CSS:** full-width imagery; centered masthead logo with Flexbox inner region; nested fluid grid (11px gaps). Intro wrapper approximately 95px vertical padding. Full-width trust bands interrupt the restrained page.
- **Navigation / mobile:** approach/inspiration/about/contact and one inquiry button; compact mobile header and narrow centered heading.
- **Adapt:** serif scale, direct brand proposition, elegant horizontal rules and process clarity. **Avoid:** unverified experience figures, large all-caps Hebrew, luxury-hotel credentials and cookie banner density.

## 8. Explorateur Travel

URL: https://explorateurtravel.com/ · [desktop](../.qa/references/explorateurtravel.com-1440.png) · [mobile](../.qa/references/explorateurtravel.com-390.png)

- **Identity / typography:** terracotta, sage, pale sand, black; Analogue Regular display, Sebastian Bobby script, Montserrat supporting type. Sample script hero 150px/195px desktop and 60px mobile; serif welcome heading 50px/45px.
- **Architecture:** slim affiliation line → photographic opening → centered welcome → four vertical service images → sage process/signup strip → founder introduction → dark reviews → journal with staggered previews → press → footer and social collage.
- **HTML/CSS:** custom nonsemantic container structure; generic semantic section/container selectors did not identify its engine. Rendered measurements and screenshots show image-overlay service tiles, narrow text measures, large section bands and staggered journal arrangements. Reimplement those principles with semantic Grid, not copied positioning.
- **Navigation / mobile:** desktop labels flank centered branding with vertical dividers; mobile hamburger over the hero.
- **Adapt:** terracotta accent, photographic storytelling, compact chapter labels and memorable contact footer. **Avoid:** script-dependent readability, eight primary links and multiple H1s.

## 9. Huffman Travel

URL: https://www.huffmantravel.com/ · [desktop](../.qa/references/huffmantravel.com-1440.png) · [mobile](../.qa/references/huffmantravel.com-390.png)

- **Identity / typography:** stone/beige, black and white. Poppins H1 sampled 55.2px, H2 37.9px; body sample 19.2px/34.6px. Mobile H1 44.4px.
- **Architecture:** centered-brand masthead → viewport-height hero → family/team introduction → two service stories → image-led journal band → booking feature → paired reviews → newsletter → compact footer.
- **HTML/CSS:** Flexbox header/section wrappers; sampled content wrapper 1315px wide with 57.6px side padding. Two parallel stories contrast with a wider journal grid and contained booking feature.
- **Navigation / mobile:** four short primary items and separated waitlist action; hamburger on mobile.
- **Adapt:** readable paragraph measure, team-based trust and distinctive journal section. **Avoid:** waiting-list exclusivity, booking-engine insertion and full-screen hero with no immediate next step. **Limit:** hero background media did not load in the captured state; its subject cannot be assessed.

## 10. Free Your Mind Travel

URL: https://www.freeyourmindtravel.com/ · [desktop](../.qa/references/freeyourmindtravel.com-1440.png) · [mobile](../.qa/references/freeyourmindtravel.com-390.png)

- **Identity / typography:** warm ivory `#f7f4ed`, coral, green and purple; Butler Ultra Light headings 67.8px desktop/48.4px mobile; Aboreto labels; Lato body 17.7px/31.9px.
- **Architecture:** background landscape + central portrait hero → large positioning statement → empathy/story introduction → three services → founder portrait story → process → testimonials → resource signup → CTA/footer.
- **HTML/CSS:** nested fluid grids with 11px gaps arrange text on either side of a portrait. Full-width color bands, repeated fine dividers and mixed image ratios support storytelling.
- **Navigation / mobile:** services/membership/about/inspiration, cart and separate CTA. Mobile stacks the portrait and copy, retains an oversized heading.
- **Adapt:** emotional welcome, strong personal introduction, photographic offset and generous line heights. **Avoid:** very thin Hebrew strokes, gender-specific positioning, membership/cart and an excessive palette. Some animated sections remain unrevealed in full-page captures; DOM text/order were available.

## 11. The Travelista

URL: https://www.thetravelista.ca/ · [desktop](../.qa/references/thetravelista.ca-1440.png) · [mobile](../.qa/references/thetravelista.ca-390.png)

- **Identity / typography:** ivory, dusty rose, deep blue-green and sand. Montserrat H1 54px desktop/39.8px mobile, Lora paragraphs 18.6px/29.7px; script words are separate visual accents.
- **Architecture:** light masthead → arch-topped image beside statement → concise introduction → three experiences → colored definition strip → three-step process → testimonials → advisor introduction → contact invitation → grouped footer/newsletter.
- **HTML/CSS:** Flexbox section wrappers, image crop with rounded top, asymmetrical split hero, contained sections within full-width color treatments. Sample horizontal inset 28.8px desktop, 23.4px mobile. Process columns and thin rules organize information.
- **Navigation / mobile:** four clear groups and a separated planning action; image precedes text on mobile.
- **Adapt:** one restrained arch, clear text/image contrast, inviting color and grouped footer. **Avoid:** script interleaved in body copy, long uppercase headings, social ticker and newsletter before contact.

## Coherent direction: a Hebrew cultural travel journal

The recurring strength is **hierarchy and composition**, not a particular border radius: big display type paired with calmer text, a strong image at the opening, alternating dense/quiet regions, a personal voice, real trust evidence and one obvious inquiry path. Many effects come from nested Grid/Flexbox, constrained content inside full-width backgrounds, object-fit crops and modest overlap. Absolute positioning is appropriate for decoration, not primary Hebrew reading order.

| Decision | Specific influence | Original implementation |
| --- | --- | --- |
| Photographic opening with readable ivory copy panel | Blonde Atlas, Lozano, Pack Up + Go | Panoramic repository photo, overlapping CSS grid panel; text stays on solid paper, no slideshow |
| Personal welcome before products | Blonde Atlas, Milk + Honey, Huffman | Short introduction to the company and existing guides; no invented credentials |
| Unequal destination compositions | Avenue H, Savoir, Travelista | Wider Uzbekistan photograph and portrait China image; one restrained arch; logical RTL reading order |
| Serif display / practical body contrast | Blonde Atlas, Lozano, Trolley Lane | Hebrew-native Frank Ruhl Libre + Noto Sans Hebrew, locally hosted |
| Ivory, forest ink, clay detail | Savoir, Explorateur, Avenue H | One restrained palette, warm background bands, thin dividers; no rainbow sections |
| Numbered philosophy / clear trip information | Pack Up + Go, Lozano, Travelista | Three numbered editorial principles; static trip facts, native itinerary disclosures |
| Genuine trust and stories | Huffman, Milk + Honey, Blonde Atlas | Existing guide biographies and sourced testimonials, fully readable via disclosures |
| Welcoming contact and navigable footer | Savoir, Explorateur, Travelista | Phone/email action and grouped exploration/company links; no new forms or booking system |

### Homepage sequence

Masthead → cinematic photograph/ivory invitation → personal welcome → asymmetric Uzbekistan/China destination spread → numbered travel philosophy beside architecture photography → upcoming departures with real source facts → guide introductions → existing traveler stories → journal previews → phone invitation → grouped footer. Different compositions do distinct jobs; no endless identical card grids.

### Hebrew typography research and selection

Considered [Frank Ruhl Libre](https://fonts.google.com/specimen/Frank+Ruhl+Libre) + [Assistant](https://fonts.google.com/specimen/Assistant), [David Libre](https://fonts.google.com/specimen/David+Libre) + [Heebo](https://fonts.google.com/specimen/Heebo), and the existing Frank Ruhl Libre + [Noto Sans Hebrew](https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew). These are Hebrew families, unlike the references' Latin display fonts. Official Google Fonts specimen pages were checked, but their text extractor exposed no specimen content; the local font files and rendered Hebrew specimen are the implementation evidence. Alternative pairings were considered, **not claimed to have been visually compared in this session**.

Select the already licensed/local **Frank Ruhl Libre 500/600 + Noto Sans Hebrew 400/500/600**. The serif supplies the literary character seen in Blonde Atlas/Lozano; the sans keeps dense tour information legible. Keeping tested local files avoids another download and external font requests. Preload only the two primary Hebrew subsets, retain `font-display: swap`, prohibit synthetic weights.

| Role | Desktop target | Small-screen target | Treatment |
| --- | --- | --- | --- |
| Hero | 72px / 1.08 | 44px / 1.16 | Frank Ruhl Libre 500, short readable lines |
| Section heading | 48px / 1.2 | 34px / 1.25 | Frank Ruhl Libre 500 |
| Tour/card title | 30–36px / 1.25 | 28–30px / 1.3 | Frank Ruhl Libre 500 |
| Body / article | 20px / 1.85 | 19px / 1.8 | Noto Sans Hebrew 400, limited reading width |
| Navigation / buttons | 16–18px / 1.5 | 16px / 1.6 | 44px+ controls, descriptive labels |
| Captions / dates / facts | 15–16px / 1.65 | 15–16px / 1.65 | Sans, `bdi`/explicit LTR for dates/contact |

Sizes use rem and explicit responsive steps so browser text enlargement can scale them. No Hebrew tracking copied from Latin uppercase designs. Long titles wrap; no fixed-height text containers. Main content maximum 80rem, reading body around 42rem. Tablet collapses complex splits; mobile uses a single column and native keyboard-operable menu. Hover is supplementary, and reduced-motion disables transitions. Focus, skip link, one H1, source fragments, SSR content and SEO metadata remain intact.

### Content and asset boundaries

Use only the repository's licensed Bukhara, Samarkand and Great Wall photographs, with original author/license disclosures. No unrelated location photo stands in for Greece or an unsupported article subject; missing tour imagery is explicitly labeled. No fabricated guide portraits, trust marks, counts, prices or reviews. Source-date/guide conflicts remain visible. Font licenses and photo provenance remain in `frontend/public/assets/editorial/credits.json`.

Delivery variants (480–1920px as appropriate) are proportional resizes of those originals, recorded with hashes/dimensions in `image-variants.json`. `srcset`/`sizes` account for the panoramic photograph's cover crop; the opening image is eager/high priority, other images lazy, and all declare intrinsic dimensions. The 1920px Samarkand variant is 352,213 bytes versus 1,637,013 bytes for its original (about 78% smaller); the 960px variant is 84,982 bytes. Originals and their provenance are retained.

Implementation and final validation results are recorded in [redesign review](redesign-review.md).
