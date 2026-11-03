import {
  type ArchivePage,
  type ArchiveManifest,
  type SiteBlock,
  type SitePage,
  type PublicSiteContent,
  ArchiveSettingsSchema,
  parseSiteContent,
} from "@roniella/shared/site-content";
import { archiveUrlCatalog, sourceUrlKey } from "@roniella/shared/archive-urls";
import { normalizePath, type SiteSettings } from "@roniella/shared";

type SourceLink = ArchivePage["main"]["links"][number];
const singleSpace = (value: string) => value.replace(/\s+/g, " ").trim();
const uniqueBy = <T>(items: T[], key: (item: T) => string) => [
  ...new Map(items.map((item) => [key(item), item])).values(),
];
const omittedLabels = new Set([
  "שיתוף:",
  "Facebook",
  "Twitter",
  "LinkedIn",
  "Whatsapp",
  "WhatsApp",
  "Youtube",
  "Pinterest",
  "Email",
  "Print",
  "Telegram",
  "רוצים להצטרף לטיול?",
  "יש לכם שאלות?",
  "השאירו פרטים ונחזור אליכם בהקדם",
  "טופס הרשמה לטיול",
  "לחצו כאן להרשמה",
]);

export function adaptArchive(
  manifest: ArchiveManifest,
  records: ArchivePage[],
  settingsInput: unknown,
  guideAnchors: {
    entityId: string;
    pageId: string;
    headingBlockOrder: number;
  }[],
): PublicSiteContent {
  const settings = ArchiveSettingsSchema.parse(settingsInput);
  const catalog = archiveUrlCatalog(manifest);
  const published = new Map(
    records
      .filter(
        (r) =>
          r.httpStatus === 200 &&
          r.publicPath &&
          r.decision !== "excluded" &&
          r.decision !== "unresolved",
      )
      .map((r) => [r.pageId, r]),
  );
  if (published.size !== catalog.pages.length)
    throw Error("Archive manifest and published page decisions disagree");
  function href(value: string | null): string | null {
    if (!value) return null;
    let url: URL;
    try {
      url = new URL(value, "https://roniellatours.com");
    } catch {
      return null;
    }
    if (
      ["http:", "https:"].includes(url.protocol) &&
      ["roniellatours.com", "www.roniellatours.com"].includes(url.hostname)
    ) {
      const path =
        catalog.bySource.get(sourceUrlKey(url.href)) ??
        catalog.pages.find(
          (page) =>
            page.publicPath === normalizePath(url.pathname) && !url.search,
        )?.publicPath;
      return path ? `${path}${url.hash}` : null;
    }
    if (url.protocol === "tel:")
      return `tel:${decodeURIComponent(url.pathname).replace(/[^+\d]/g, "")}`;
    if (url.protocol === "mailto:")
      return `mailto:${decodeURIComponent(url.pathname).trim()}`;
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  }
  const publicLinks = (links: SourceLink[]) =>
    uniqueBy(
      links.flatMap((l) => {
        const target = href(l.resolvedUrl ?? l.href);
        return target && singleSpace(l.text)
          ? [{ text: singleSpace(l.text), href: target }]
          : [];
      }),
      (l) => `${l.text}\n${l.href}`,
    );
  function cards(record: ArchivePage): SitePage["cards"] {
    return uniqueBy(
      record.cards.flatMap((card) => {
        const target = card.links
          .map((link) =>
            catalog.bySource.get(sourceUrlKey(link.resolvedUrl ?? link.href)),
          )
          .find(Boolean);
        const page = [...published.values()].find(
          (p) => p.publicPath === target,
        );
        return page && page.pageId !== record.pageId
          ? [{ pageId: page.pageId, summary: singleSpace(card.text) }]
          : [];
      }),
      (card) => card.pageId,
    );
  }
  function blocks(record: ArchivePage): SiteBlock[] {
    const result: SiteBlock[] = [];
    const consumedIds = new Set(["breadcrumbs", "main-content"]);
    for (const block of record.main.blocks) {
      if (
        block.anchorIds.includes("breadcrumbs") ||
        block.sourceSelector.includes('id="breadcrumbs"')
      )
        continue;
      const value = block.text?.trim() ?? "";
      if (omittedLabels.has(singleSpace(value))) continue;
      if (
        block.type === "heading" &&
        block.level === 1 &&
        singleSpace(value) ===
          singleSpace(
            record.sourceSeo.headings.find((h) => h.level === 1)?.text ?? "",
          )
      )
        continue;
      const anchors = [
        ...block.anchorIds,
        ...guideAnchors
          .filter(
            (g) =>
              g.pageId === record.pageId && g.headingBlockOrder === block.order,
          )
          .map((g) => g.entityId),
      ];
      const conventional: Record<string, RegExp> = {
        journy: /^מסלול הטיול$/,
        cost: /^תאריכי יציאה ומחירים$/,
        include: /^המחיר כולל/,
      };
      for (const [id, match] of Object.entries(conventional))
        if (match.test(value) && record.main.anchorIds.some((a) => a.id === id))
          anchors.push(id);
      const anchorIds = uniqueBy(
        anchors.filter(
          (id) => !/^form-|^elementor-/.test(id) && !consumedIds.has(id),
        ),
        (v) => v,
      );
      anchorIds.forEach((id) => consumedIds.add(id));
      const links = publicLinks([
        ...block.links,
        ...record.main.links.filter(
          (l) =>
            l.sourceSelector === block.sourceSelector ||
            (singleSpace(l.text) === singleSpace(value) && Boolean(value)),
        ),
      ]);
      if (block.type === "heading" && value) {
        const level = Math.min(6, Math.max(2, block.level ?? 2)) as
          | 2
          | 3
          | 4
          | 5
          | 6;
        result.push({ type: "heading", level, text: value, anchorIds, links });
      } else if (block.type === "list" && block.items) {
        result.push({
          type: "list",
          ordered: block.ordered ?? false,
          anchorIds,
          links,
          items: block.items.map((item) => {
            let text = item.text;
            const nested = item.children.flatMap((list) => list.items).join("");
            if (nested && text.endsWith(nested))
              text = text.slice(0, -nested.length).trim();
            return {
              text,
              links: publicLinks(item.links),
              children: item.children,
            };
          }),
        });
      } else if (block.type === "table" && block.rows) {
        const span = (v: string | null) =>
          v && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null;
        result.push({
          type: "table",
          anchorIds,
          links,
          caption: block.caption ?? null,
          rows: block.rows.map((row) =>
            row.map((cell) => ({
              text: cell.text,
              isHeader: cell.isHeader,
              rowspan: span(cell.rowspan),
              colspan: span(cell.colspan),
              links: publicLinks(cell.links),
            })),
          ),
        });
      } else if (value)
        result.push({ type: "paragraph", text: value, anchorIds, links });
    }
    return result;
  }
  const pages: SitePage[] = [...published.values()].map((record) => {
    const title =
      record.sourceSeo.headings.find((h) => h.level === 1)?.text ||
      record.article.title ||
      record.sourceSeo.htmlTitles[0];
    if (!title) throw Error(`Archive page ${record.pageId} has no title`);
    const videos = uniqueBy(
      record.videos.flatMap((video) =>
        [...video.urlReferences.map((v) => v.url), ...video.embedUrls].flatMap(
          (url) => {
            if (!url) return [];
            let parsed: URL;
            try {
              parsed = new URL(url);
            } catch {
              return [];
            }
            if (
              parsed.protocol !== "https:" ||
              !/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(
                parsed.hostname,
              )
            )
              return [];
            return [
              {
                title: video.title,
                description: video.description,
                externalUrl: parsed.href,
              },
            ];
          },
        ),
      ),
      (video) => video.externalUrl,
    );
    return {
      id: record.pageId,
      path: record.publicPath!,
      slug: record.publicSlug,
      pageType: record.pageType,
      title,
      seo: {
        title: record.sourceSeo.htmlTitles[0] || title,
        description:
          record.sourceSeo.sourceMetaDescriptions.find((v): v is string =>
            Boolean(v?.trim()),
          ) ?? null,
        canonicalPath: record.publicPath!,
      },
      blocks: blocks(record),
      cards: cards(record),
      videos,
      publicationDate: record.article.structuredPublicationDate,
      modificationDate: record.article.structuredModificationDate,
      sourceRetrievedAt: record.retrievedAt,
    };
  });
  const navigation = (links: SourceLink[]): SiteSettings["navigation"] =>
    uniqueBy(
      links.flatMap((link) => {
        const target = href(link.resolvedUrl ?? link.href);
        return target?.startsWith("/") &&
          !target.includes("#") &&
          link.text.trim()
          ? [{ label: singleSpace(link.text), path: target }]
          : [];
      }),
      (link) => link.path,
    );
  const contactPage = records.find((p) => p.pageType === "contact"),
    privacy = records.find((p) => p.pageType === "privacy");
  const contactLinks = settings.contactEvidence.flatMap((c) => c.links);
  const phone = contactLinks
    .map((l) => href(l.resolvedUrl ?? l.href))
    .find((l) => l?.startsWith("tel:"))
    ?.slice(4);
  const email = contactLinks
    .map((l) => href(l.resolvedUrl ?? l.href))
    .find((l) => l?.startsWith("mailto:"))
    ?.slice(7);
  if (!phone || !email)
    throw Error("Archive does not contain public phone/email contact links");
  const businessName =
    privacy?.main.text.match(/שם חברה:\s*([^\n]+)/)?.[1]?.trim() ??
    "Roniella Tours";
  const address = contactPage?.main.text
    .match(/כתובת:\s*([^\n]+)/)?.[1]
    ?.trim();
  const home = pages.find((p) => p.path === "/");
  return parseSiteContent({
    schemaVersion: 2,
    contentSource: "liveArchive",
    crawlRunId: manifest.crawlRunId,
    notice:
      "תוכן מהאתר הקיים — מועדים, מחירים ותנאים טעונים אימות. לבירור פרטים עדכניים פנו אלינו.",
    siteSettings: {
      businessName,
      language: "he",
      timezone: "Asia/Jerusalem",
      contact: { phone, email, ...(address ? { address } : {}) },
      navigation: navigation(settings.navigation.flatMap((n) => n.links)),
      footerLinks: navigation(settings.footer.flatMap((f) => f.links)),
      featuredTourIds:
        home?.cards
          .filter(
            (c) => pages.find((p) => p.id === c.pageId)?.pageType === "tour",
          )
          .map((c) => c.pageId) ?? [],
      featuredPostIds:
        home?.cards
          .filter(
            (c) => pages.find((p) => p.id === c.pageId)?.pageType === "article",
          )
          .map((c) => c.pageId) ?? [],
    },
    pages,
    redirects: catalog.redirects,
  });
}
