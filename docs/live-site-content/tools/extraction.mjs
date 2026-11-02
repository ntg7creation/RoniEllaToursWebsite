import { load } from "cheerio";
import { sameSite, readableUrl, publicIdentity } from "./common.mjs";
export const clean = (s) =>
  (s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const ignored = "script,style,noscript,template,svg";
export function extractHtml(html, finalUrl) {
  const $ = load(html);
  const text = (node) => {
    if (!node) return "";
    if (node.type === "text") return node.data ?? "";
    if (ignored.split(",").includes(node.tagName)) return "";
    if (node.tagName === "br") return "\n";
    return (node.children ?? []).map(text).join("");
  };
  const nodeText = (el) => clean(text(el));
  function locator(el) {
    const id = $(el).attr("id");
    if (id) return `${el.tagName}[id=${JSON.stringify(id)}]`;
    const eid = $(el).attr("data-id");
    if (eid) return `[data-id=${JSON.stringify(eid)}]`;
    const parts = [];
    let n = el;
    while (n && n.tagName && parts.length < 7) {
      const siblings =
        n.parent?.children?.filter((s) => s.tagName === n.tagName) ?? [];
      parts.unshift(`${n.tagName}:nth-of-type(${siblings.indexOf(n) + 1})`);
      n = n.parent;
    }
    return parts.join(" > ");
  }
  const resolveUrl = (href) => {
    try {
      return new URL(href, finalUrl).href;
    } catch {
      return null;
    }
  };
  const links = (root) =>
    $(root)
      .find("a[href]")
      .toArray()
      .map((el) => ({
        text: nodeText(el),
        href: $(el).attr("href"),
        resolvedUrl: resolveUrl($(el).attr("href")),
        rel: ($(el).attr("rel") ?? "").split(/\s+/).filter(Boolean),
        anchorId: $(el).attr("id") ?? null,
        sourceSelector: locator(el),
      }));
  const anchorIds = (root) =>
    $(root)
      .find("[id],a[name]")
      .addBack("[id],a[name]")
      .toArray()
      .map((el) => ({
        id: $(el).attr("id") ?? $(el).attr("name"),
        sourceSelector: locator(el),
      }));
  function blocksFor(root) {
    const blocks = [];
    const duplicateRemovals = [];
    function push(el, kind, value) {
      if (!value.text && !value.items?.length && !value.rows?.length) return;
      blocks.push({
        order: blocks.length,
        type: kind,
        sourceTag: el.tagName ?? "#text",
        sourceSelector: locator(el),
        anchorIds: [$(el).attr("id"), $(el).attr("name")].filter(Boolean),
        links: links(el),
        ...value,
      });
    }
    function walk(el) {
      if (
        !el?.tagName ||
        ignored.split(",").includes(el.tagName) ||
        el.tagName === "form"
      )
        return;
      const n = $(el),
        tag = el.tagName;
      if (/^h[1-6]$/.test(tag)) {
        push(el, "heading", { level: Number(tag[1]), text: nodeText(el) });
        return;
      }
      if (tag === "p") {
        push(el, "paragraph", { text: nodeText(el) });
        return;
      }
      if (tag === "ul" || tag === "ol") {
        push(el, "list", {
          ordered: tag === "ol",
          start: n.attr("start") ?? null,
          items: n
            .children("li")
            .toArray()
            .map((li) => ({
              text: nodeText(li),
              links: links(li),
              anchorIds: anchorIds(li),
              children: $(li)
                .children("ul,ol")
                .toArray()
                .map((sub) => ({
                  ordered: sub.tagName === "ol",
                  items: $(sub).children("li").toArray().map(nodeText),
                })),
            })),
        });
        return;
      }
      if (tag === "table") {
        push(el, "table", {
          caption: nodeText(n.find("caption")[0]) || null,
          rows: n
            .find("tr")
            .toArray()
            .map((tr) =>
              $(tr)
                .children("th,td")
                .toArray()
                .map((cell) => ({
                  text: nodeText(cell),
                  isHeader: cell.tagName === "th",
                  rowspan: $(cell).attr("rowspan") ?? null,
                  colspan: $(cell).attr("colspan") ?? null,
                  links: links(cell),
                })),
            ),
        });
        return;
      }
      if (tag === "figcaption" || tag === "caption") {
        push(el, "caption", { text: nodeText(el) });
        return;
      }
      if (tag === "img" || tag === "input" || tag === "iframe") return;
      // Preserve inline-only text containers (prices, dates, statuses, captions, accordion titles).
      const children = n.children().toArray();
      if (!children.length) {
        push(el, "text", { text: nodeText(el) });
        return;
      }
      if (
        !n.find(
          "h1,h2,h3,h4,h5,h6,p,ul,ol,table,div,section,article,form,figure,blockquote,dl,details",
        ).length
      ) {
        push(el, "text", { text: nodeText(el) });
        return;
      }
      let pending = "";
      function flush() {
        if (clean(pending)) push(el, "text", { text: clean(pending) });
        pending = "";
      }
      for (const child of el.children ?? []) {
        if (child.type === "text") {
          pending += child.data;
          continue;
        }
        if (!child.tagName) continue;
        flush();
        walk(child);
      }
      flush();
    }
    walk(root);
    // Only remove an exact repeated adjacent widget/section sequence when explicitly responsive.
    // No text/paragraph-level global deduplication: repeated itinerary/terms content can be meaningful.
    return { blocks, duplicateRemovals };
  }
  const meta = $("head meta")
    .toArray()
    .map((el, order) => ({
      order,
      attributes: { ...el.attribs },
      name: $(el).attr("name") ?? null,
      property: $(el).attr("property") ?? null,
      httpEquiv: $(el).attr("http-equiv") ?? null,
      content: $(el).attr("content") ?? null,
    }));
  const headLinks = $("head link")
    .toArray()
    .map((el, order) => ({
      order,
      attributes: { ...el.attribs },
      rel: ($(el).attr("rel") ?? "").split(/\s+/).filter(Boolean),
      href: $(el).attr("href") ?? null,
      resolvedUrl: resolveUrl($(el).attr("href") ?? ""),
      hreflang: $(el).attr("hreflang") ?? null,
    }));
  const canonicals = headLinks.filter((l) => l.rel.includes("canonical"));
  const jsonLd = $('script[type="application/ld+json"]')
    .toArray()
    .map((el, order) => {
      const rawText = $(el).text();
      try {
        return {
          order,
          rawText,
          parseStatus: "valid",
          parsed: JSON.parse(rawText),
          error: null,
        };
      } catch (e) {
        return {
          order,
          rawText,
          parseStatus: "invalid",
          parsed: null,
          error: e.message,
        };
      }
    });
  const headings = $("h1,h2,h3,h4,h5,h6")
    .toArray()
    .map((el, order) => ({
      order,
      level: Number(el.tagName[1]),
      text: nodeText(el),
      anchorId: $(el).attr("id") ?? null,
      sourceSelector: locator(el),
    }));
  const breadcrumbs = $(
    '.rank-math-breadcrumb,.yoast-breadcrumb,.breadcrumbs,[aria-label*="breadcrumb"],[aria-label*="Breadcrumb"],[itemtype*="BreadcrumbList"]',
  )
    .toArray()
    .map((el) => ({
      text: nodeText(el),
      links: links(el),
      sourceSelector: locator(el),
    }));
  const sourceSeo = {
    htmlTitles: $("head title").toArray().map(nodeText),
    sourceMetaDescriptions: meta
      .filter((m) => m.name?.toLowerCase() === "description")
      .map((m) => m.content),
    sourceCanonicalUrl: canonicals.length === 1 ? canonicals[0].href : null,
    canonicalEntries: canonicals,
    alternateLanguageLinks: headLinks.filter(
      (l) => l.rel.includes("alternate") && l.hreflang,
    ),
    robots: meta.filter((m) =>
      ["robots", "googlebot", "googlebot-news"].includes(m.name?.toLowerCase()),
    ),
    openGraph: meta.filter((m) => m.property?.startsWith("og:")),
    twitter: meta.filter(
      (m) =>
        m.name?.startsWith("twitter:") || m.property?.startsWith("twitter:"),
    ),
    verificationTags: meta.filter((m) =>
      /verification|verify|msvalidate|p:domain/i.test(
        m.name ?? m.property ?? "",
      ),
    ),
    metaKeywords: meta.filter((m) => m.name?.toLowerCase() === "keywords"),
    metaEntries: meta,
    headLinks,
    jsonLd,
    headings,
    breadcrumbs,
    htmlLanguage: $("html").attr("lang") ?? null,
    htmlDirection: $("html").attr("dir") ?? null,
    microdataRdfa: $("[itemscope],[itemprop],[typeof],[property]:not(meta)")
      .toArray()
      .map((el) => ({
        tag: el.tagName,
        attributes: Object.fromEntries(
          Object.entries(el.attribs).filter(([k]) =>
            /^(?:item|typeof|property|resource|vocab|prefix|content|href|about)/.test(
              k,
            ),
          ),
        ),
        text: nodeText(el),
        sourceSelector: locator(el),
      })),
  };
  let main = $("main").first();
  let selector = "main";
  if (!main.length) {
    main = $(
      '[data-elementor-type="single-post"],[data-elementor-type="archive"],[data-elementor-type="wp-page"],[data-elementor-type="wp-post"]',
    )
      .filter(
        (_i, el) =>
          !$(el).parents(
            '[data-elementor-type="header"],[data-elementor-type="footer"]',
          ).length,
      )
      .first();
    selector = "primary Elementor document";
  }
  if (!main.length) {
    main = $("body").clone();
    main
      .find(
        'header,footer,[data-elementor-type="header"],[data-elementor-type="footer"],[data-elementor-type="popup"],#acwp-toolbar',
      )
      .remove();
    selector = "body minus explicit shared chrome (fallback)";
  }
  const shared = {
    navigation: [],
    footer: [],
    widgets: [],
    presentationDuplicates: [],
  };
  const seenShared = new Map();
  for (const [kind, query] of [
    ["navigation", '[data-elementor-type="header"] nav'],
    ["footer", '[data-elementor-type="footer"]'],
    ["widgets", '[data-elementor-type="popup"],#acwp-toolbar'],
  ]) {
    $(query).each((_i, el) => {
      const result = {
        text: nodeText(el),
        links: links(el),
        blocks: blocksFor(el).blocks,
        anchorIds: anchorIds(el),
        sourceSelector: locator(el),
      };
      const key = JSON.stringify([
        kind,
        result.text,
        result.links.map((l) => [l.text, l.resolvedUrl]),
      ]);
      if (seenShared.has(key)) {
        shared.presentationDuplicates.push({
          kind,
          sourceSelector: locator(el),
          sameAs: seenShared.get(key),
          reason: "identical shared navigation/footer/widget copy",
        });
      } else {
        seenShared.set(key, locator(el));
        shared[kind].push(result);
      }
    });
  }
  const root = main.clone();
  root.find(ignored).remove();
  root
    .find(
      '[data-elementor-type="header"],[data-elementor-type="footer"],[data-elementor-type="popup"]',
    )
    .remove();
  if (($("body").attr("class") ?? "").includes("single-post")) {
    root
      .find(
        ".elementor-widget-posts,.elementor-widget-jet-listing-grid,.elementor-widget-share-buttons",
      )
      .each((_i, el) => {
        const parent = $(el).parent();
        const move = parent.find(".elementor-widget-theme-post-content").length
          ? $(el)
          : parent;
        shared.widgets.push({
          kind: "relatedContent",
          text: nodeText(move[0]),
          links: links(move[0]),
          blocks: blocksFor(move[0]).blocks,
          anchorIds: anchorIds(move[0]),
          sourceSelector: locator(move[0]),
        });
        move.remove();
      });
  }
  // Exclude only clearly identical responsive section copies, with an evidence trail.
  const seenResponsive = new Map();
  root
    .find(
      ".elementor-hidden-desktop,.elementor-hidden-mobile,.elementor-hidden-tablet",
    )
    .each((_i, el) => {
      const t = nodeText(el);
      if (t.length < 30) return;
      const key = JSON.stringify([t, links(el).map((l) => [l.text, l.href])]);
      if (seenResponsive.has(key)) {
        shared.presentationDuplicates.push({
          kind: "responsiveSection",
          sourceSelector: locator(el),
          sameAs: seenResponsive.get(key),
          reason: "exact same text and links in responsive-only containers",
        });
        $(el).remove();
      } else seenResponsive.set(key, locator(el));
    });
  const mainBlocks = blocksFor(root[0]).blocks;
  const forms = $("form")
    .toArray()
    .map((el) => ({
      sourceSelector: locator(el),
      id: $(el).attr("id") ?? null,
      name: $(el).attr("name") ?? null,
      method: $(el).attr("method") ?? null,
      action: $(el).attr("action") ?? null,
      documentationOnly: true,
      labels: $(el).find("label").toArray().map(nodeText),
      consentText: $(el)
        .find(".elementor-field-type-acceptance")
        .toArray()
        .map(nodeText),
      fields: $(el)
        .find('input:not([type="hidden"]),select,textarea,button')
        .toArray()
        .map((field) => ({
          tag: field.tagName,
          type: $(field).attr("type") ?? null,
          name: $(field).attr("name") ?? null,
          id: $(field).attr("id") ?? null,
          label:
            $(field).attr("aria-label") ??
            $(field)
              .closest(".elementor-field-group")
              .find("label")
              .first()
              .text()
              .trim() ??
            null,
          placeholder: $(field).attr("placeholder") ?? null,
          required: $(field).attr("required") !== undefined,
          options: $(field)
            .find("option")
            .toArray()
            .map((o) => ({
              label: nodeText(o),
              value: $(o).attr("value") ?? null,
            })),
          text: field.tagName === "button" ? nodeText(field) : null,
        })),
    }));
  const videos = [];
  $('[data-widget_type="video.default"]').each((_i, el) => {
    let settings = null;
    try {
      settings = JSON.parse($(el).attr("data-settings") ?? "{}");
    } catch {}
    const urls = settings
      ? Object.entries(settings)
          .filter(([k, v]) => /url|link/.test(k) && typeof v === "string")
          .map(([field, url]) => ({ field, url }))
      : [];
    videos.push({
      sourceSelector: locator(el),
      title:
        $(el).find("[title]").first().attr("title") ??
        $(el).find("img").first().attr("alt") ??
        null,
      description: null,
      urlReferences: urls,
      settingsRaw: $(el).attr("data-settings") ?? null,
      embedUrls: $(el)
        .find("iframe")
        .toArray()
        .map((f) => $(f).attr("src") ?? $(f).attr("data-src") ?? null),
    });
  });
  $("iframe[src]").each((_i, el) =>
    videos.push({
      sourceSelector: locator(el),
      title: $(el).attr("title") ?? null,
      description: null,
      urlReferences: [],
      settingsRaw: null,
      embedUrls: [$(el).attr("src")],
    }),
  );
  const imageReferences = root
    .find("img")
    .toArray()
    .map((el) => ({
      src: $(el).attr("src") ?? $(el).attr("data-src") ?? null,
      alt: $(el).attr("alt") ?? null,
      title: $(el).attr("title") ?? null,
      caption: $(el).closest("figure").find("figcaption").text().trim() || null,
      sourceSelector: locator(el),
      downloaded: false,
    }));
  const faq = root
    .find(".elementor-accordion-item,details,.elementor-toggle-item")
    .toArray()
    .map((el) => ({
      question:
        nodeText($(el).find(".elementor-tab-title,summary").first()[0]) || null,
      answerText:
        nodeText($(el).find(".elementor-tab-content").first()[0]) || null,
      sourceSelector: locator(el),
      anchorIds: anchorIds(el),
    }));
  const taxonomyLinks = $(
    'a[rel~="category"],a[rel~="tag"],.cat-links a,.tags-links a',
  )
    .toArray()
    .map((el) => ({
      text: nodeText(el),
      url: resolveUrl($(el).attr("href")),
      rel: $(el).attr("rel") ?? null,
    }));
  const dates = $('time,[itemprop="datePublished"],[itemprop="dateModified"]')
    .toArray()
    .map((el) => ({
      text: nodeText(el),
      datetime: $(el).attr("datetime") ?? $(el).attr("content") ?? null,
      sourceSelector: locator(el),
    }));
  const authors = $(
    'a[rel~="author"],.author-name,.author .fn,[itemprop="author"]',
  )
    .toArray()
    .map((el) => ({
      name: nodeText(el) || null,
      url: $(el).attr("href") ? resolveUrl($(el).attr("href")) : null,
      sourceSelector: locator(el),
    }));
  const allLinks = links($("body")[0]);
  const bodyClass = $("body").attr("class") ?? "";
  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text);
  const jsonLdNodes = jsonLd.flatMap(
    (j) => j.parsed?.["@graph"] ?? (j.parsed ? [j.parsed] : []),
  );
  const articleNode =
    jsonLdNodes.find((n) =>
      ["Article", "BlogPosting", "NewsArticle"].includes(n["@type"]),
    ) ?? null;
  const article = {
    title: h1[0] ?? articleNode?.headline ?? null,
    excerpt: meta.find((m) => m.property === "og:description")?.content ?? null,
    bodyBlockOrders: mainBlocks.map((b) => b.order),
    visibleAuthors: authors,
    visibleDates: dates,
    structuredAuthorReferences: articleNode?.author ?? null,
    structuredPublicationDate: articleNode?.datePublished ?? null,
    structuredModificationDate: articleNode?.dateModified ?? null,
    categories: taxonomyLinks.filter((l) => !/tag/.test(l.rel ?? "")),
    tags: taxonomyLinks.filter((l) => /tag/.test(l.rel ?? "")),
    structuredArticleSections: articleNode?.articleSection ?? [],
  };
  const sectionRanges = [];
  mainBlocks.forEach((b, i) => {
    if (b.type === "heading")
      sectionRanges.push({
        heading: b.text,
        level: b.level,
        startBlockOrder: i,
        endBlockOrder: mainBlocks.length - 1,
      });
  });
  sectionRanges.forEach((s, i) => {
    const next = sectionRanges.slice(i + 1).find((n) => n.level <= s.level);
    if (next) s.endBlockOrder = next.startBlockOrder - 1;
  });
  const observations = [];
  for (const block of mainBlocks) {
    const t =
      block.text ??
      block.items?.map((i) => i.text).join("\n") ??
      block.rows
        ?.map((row) => row.map((cell) => cell.text).join(" | "))
        .join("\n") ??
      "";
    if (!t) continue;
    for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
      const [, d, mo, y] = m;
      const candidate = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const date = new Date(`${candidate}T12:00:00Z`);
      const valid =
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === candidate;
      observations.push({
        kind: "date",
        rawValue: m[0],
        normalizedValue: valid ? candidate : null,
        resolution: valid ? "unverifiedCandidate" : "unresolved",
        blockOrder: block.order,
        context: t,
      });
    }
    for (const m of t.matchAll(
      /(?:(\$|€|₪)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(\$|€|₪|דולרים|דולר|אירו|ש"ח|USD|EUR|ILS))/g,
    )) {
      const rawAmount = m[2] ?? m[3],
        unit = m[1] ?? m[4];
      const currency =
        unit === "$" || /דולר|USD/.test(unit)
          ? "USD"
          : unit === "€" || /אירו|EUR/.test(unit)
            ? "EUR"
            : "ILS";
      observations.push({
        kind: "price",
        rawValue: m[0],
        normalizedValue: {
          minorUnits: Math.round(Number(rawAmount.replaceAll(",", "")) * 100),
          currency,
        },
        resolution: "unverifiedCandidate",
        blockOrder: block.order,
        context: t,
      });
    }
    if (/סטטוס|בהרשמה|אזלו|הסתיים|הרשמה מוקדמת|מקומות אחרונים/.test(t))
      observations.push({
        kind: "bookingStatus",
        rawValue: t,
        normalizedValue: /בהרשמה/.test(t)
          ? "enquiryOpen"
          : /הסתיים/.test(t)
            ? "closed"
            : null,
        resolution: "unverifiedCandidate",
        blockOrder: block.order,
        context: t,
      });
    for (const m of t.matchAll(/\b(\d{1,2})\s*(?:ימים|לילות)/g))
      observations.push({
        kind: "duration",
        rawValue: m[0],
        normalizedValue: Number(m[1]),
        resolution: "unverifiedCandidate",
        blockOrder: block.order,
        context: t,
      });
  }
  const itinerary = sectionRanges.filter((s) =>
    /^(?:ה?יום|היום)\s|^ימים?\s*\d|^יום\s*\d/.test(s.heading),
  );
  const labeledSections = mainBlocks
    .filter(
      (b) =>
        b.text &&
        b.text.length < 70 &&
        /^(?:המחיר כולל|מה לא כלול|המחיר לא כולל|תנאי תשלום|תנאי ביטול|תנאים ומדיניות המארגנים|כח עליון|חיסונים ובריאות|טיסות)[:?]?$/.test(
          b.text,
        ),
    )
    .map((b) => ({
      heading: b.text,
      level: b.level ?? null,
      sourceTag: b.sourceTag,
      startBlockOrder: b.order,
      endBlockOrder: mainBlocks.length - 1,
    }));
  labeledSections.forEach((s, i) => {
    const next = labeledSections[i + 1];
    if (next) s.endBlockOrder = next.startBlockOrder - 1;
  });
  const tour = {
    observations,
    sectionRanges,
    labeledSections,
    itinerary,
    inclusionSections: sectionRanges.filter((s) =>
      /מחיר כולל|כלול במחיר/.test(s.heading),
    ),
    exclusionSections: sectionRanges.filter((s) =>
      /לא כולל|אינו כולל/.test(s.heading),
    ),
    termsSections: sectionRanges.filter((s) =>
      /תנאי|הערות|ביטול|תשלום/.test(s.heading),
    ),
    guideMentions: mainBlocks
      .filter(
        (b) => b.text && /מדרי[ךכ]|אייל מירון|איל מירון|רוני אלה/.test(b.text),
      )
      .map((b) => ({ blockOrder: b.order, rawValue: b.text })),
    note: "All normalized values are extraction candidates, never approved facts. Exact source strings and block order remain authoritative evidence.",
  };
  const testimonials = root
    .find(
      ".elementor-testimonial-wrapper,.elementor-testimonial,.ti-review-item,blockquote",
    )
    .toArray()
    .map((el) => ({
      quote:
        nodeText(
          $(el)
            .find(
              ".elementor-testimonial-content,.ti-review-content,blockquote",
            )
            .first()[0],
        ) || nodeText(el),
      attribution:
        nodeText(
          $(el).find(".elementor-testimonial-name,.ti-name,cite").first()[0],
        ) || null,
      sourceSelector: locator(el),
    }));
  const cards = $(".jet-listing-grid__item,.elementor-post")
    .toArray()
    .map((el) => ({
      text: nodeText(el),
      links: links(el),
      sourceSelector: locator(el),
    }));
  return {
    bodyClass,
    sourceIdentity: publicIdentity(bodyClass),
    sourceSeo,
    main: {
      selector,
      text: clean(
        mainBlocks
          .map(
            (b) =>
              b.text ??
              b.items?.map((i) => i.text).join("\n") ??
              b.rows?.map((r) => r.map((c) => c.text).join(" | ")).join("\n") ??
              "",
          )
          .join("\n\n"),
      ),
      blocks: mainBlocks,
      links: links(root[0]),
      anchorIds: anchorIds(main[0]),
      faq,
      imageReferences,
    },
    shared,
    forms,
    videos,
    article,
    tour,
    testimonials,
    cards,
    internalLinks: allLinks.filter(
      (l) => l.resolvedUrl && sameSite(l.resolvedUrl),
    ),
    externalLinks: allLinks.filter(
      (l) => l.resolvedUrl && !sameSite(l.resolvedUrl),
    ),
    taxonomyLinks,
    jsonLdNodes,
  };
}
export function classify(path, bodyClass, status) {
  if (path.startsWith("/lead-status/")) return "leadStatusTaxonomy";
  if (status !== 200) return "unavailable";
  if (bodyClass.includes("single-trips")) return "tour";
  if (bodyClass.includes("single-post")) return "article";
  if (bodyClass.includes("tax-trips_cats")) return "destinationArchive";
  if (bodyClass.includes("category-")) return "categoryArchive";
  if (bodyClass.includes("author-")) return "authorArchive";
  const known = {
    "/": "home",
    "/בלוג/": "blog",
    "/הטיולים-שלנו/": "tours",
    "/מי-אנחנו/": "about",
    "/המדריכים-שלנו/": "guides",
    "/גלריה/": "gallery",
    "/וידיאו/": "videos",
    "/המלצות/": "testimonials",
    "/יצירת-קשר/": "contact",
    "/privacy-policy/": "privacy",
    "/הצהרת-נגישות/": "accessibility",
    "/מחירים-ותנאים/": "terms",
  };
  return known[path] ?? (bodyClass.includes("archive") ? "archive" : "page");
}
