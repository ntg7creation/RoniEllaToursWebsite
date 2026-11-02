import type {
  SiteBlock,
  SitePage,
  PublicSiteContent,
} from "@roniella/shared/site-content";

export const blockText = (block: SiteBlock): string =>
  "text" in block
    ? block.text
    : block.type === "list"
      ? block.items.map((i) => i.text).join(" ")
      : "";

export type ContentSection = {
  title: string;
  blocks: SiteBlock[];
  anchors: string[];
  links: SiteBlock["links"];
};

// Presentation groups reference the validated source blocks; they do not change the archive.
export function groupBlocks(
  blocks: SiteBlock[],
  isHeading: (b: SiteBlock) => boolean,
): ContentSection[] {
  const sections: ContentSection[] = [];
  for (const block of blocks) {
    if (isHeading(block))
      sections.push({
        title: blockText(block),
        blocks: [],
        anchors: block.anchorIds,
        links: block.links,
      });
    else {
      if (!sections.length)
        sections.push({ title: "", blocks: [], anchors: [], links: [] });
      sections.at(-1)!.blocks.push(block);
    }
  }
  return sections;
}

export const termLabels = new Set([
  "תנאי תשלום",
  "תנאי ביטול",
  "תנאים ומדיניות המארגנים",
  "כח עליון",
  "כוח עליון",
  "חיסונים ובריאות",
  "טיסות",
  "המחיר כולל",
  "המחיר לא כולל",
  "מה לא כלול",
]);
export const cleanLabel = (text: string) => text.trim().replace(/[:：]$/, "");

export function tourSections(page: SitePage) {
  const start = page.blocks.findIndex(
    (b) => b.type === "heading" && b.text === "מסלול הטיול",
  );
  const price = page.blocks.findIndex(
    (b) => b.type === "heading" && b.text === "תאריכי יציאה ומחירים",
  );
  const terms = page.blocks.findIndex(
    (b) => b.type === "heading" && b.text === "תנאים והערות",
  );
  const tail = page.blocks.findIndex(
    (b, i) => i > terms && b.type === "heading" && b.text === "למה לטייל איתנו",
  );
  return {
    overview: page.blocks
      .slice(0, start < 0 ? page.blocks.length : start)
      .filter(
        (b) =>
          ![
            "מסלול הטיול",
            "תנאים ועלויות",
            "רוצים שנחזור אליכם?",
            "המדריכים שלנו",
          ].includes(blockText(b)),
      ),
    days:
      start < 0
        ? []
        : groupBlocks(
            page.blocks.slice(start + 1, price < 0 ? undefined : price),
            (b) => b.type === "heading" && /^(?:היום|יום|ימים)\s/.test(b.text),
          ),
    prices:
      price < 0
        ? []
        : page.blocks.slice(price + 1, terms < 0 ? undefined : terms),
    priceAnchors: price < 0 ? [] : page.blocks[price]!.anchorIds,
    terms:
      terms < 0
        ? []
        : groupBlocks(
            page.blocks.slice(terms + 1, tail < 0 ? undefined : tail),
            (b) => termLabels.has(cleanLabel(blockText(b))),
          ),
    more: tail < 0 ? [] : page.blocks.slice(tail + 1),
  };
}

export function sourceCard(page: SitePage, content: PublicSiteContent) {
  return (
    content.pages
      .find((p) => p.pageType === "tours")
      ?.cards.find((c) => c.pageId === page.id) ??
    content.pages
      .find((p) => p.path === "/")
      ?.cards.find((c) => c.pageId === page.id)
  );
}

export function cardCopy(page: SitePage, summary: string) {
  const text = summary.startsWith(page.title)
    ? summary.slice(page.title.length).trim()
    : summary;
  const dates = text.match(
    /\d{2}\/\d{2}\/\d{4}\s*[-–]\s*\d{2}\/\d{2}\/\d{4}/,
  )?.[0];
  const duration = text.match(
    /\d+\s+ימים|\b\d+\b(?=\s+\d{2}\/\d{2}\/\d{4})/,
  )?.[0];
  const status = text.match(/סטטוס הטיול:\s*(.+?)(?:\s+לפרטים|$)/)?.[1];
  return {
    dates,
    duration,
    status,
    summary: text
      .replace(dates ?? /$^/, "")
      .replace(duration ?? /$^/, "")
      .replace(/סטטוס הטיול:.*$/, "")
      .replace(/(?:להמשך קריאה\s*»?|לפרטים)\s*$/, "")
      .trim(),
  };
}

export function readingBlocks(page: SitePage): SiteBlock[] {
  if (page.pageType === "about") {
    const seen = new Set<string>();
    return page.blocks.filter((b) => {
      const key = blockText(b).replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (page.pageType !== "article") return page.blocks;
  // Several source articles store a section title + body in one paragraph.
  // Promote only a short first line separated by a blank line. Keep every word/link.
  return page.blocks.flatMap((b): SiteBlock[] => {
    if (b.type !== "paragraph") return [b];
    const match = /^([^\n]{5,100})\n\n([\s\S]+)$/.exec(b.text);
    if (!match || /[.!。]$/.test(match[1]!)) return [b];
    return [
      { ...b, type: "heading", level: 2, text: match[1]! },
      { ...b, text: match[2]!, anchorIds: [] },
    ];
  });
}

export function homeReviews(content: PublicSiteContent) {
  const home = content.pages.find((p) => p.path === "/");
  const reviews: { name: string; quote: string; source: string }[] = [];
  home?.blocks.forEach((b, i, blocks) => {
    if (blockText(b) !== "פורסם ב-Google") return;
    const name = blocks[i + 1],
      quote = blocks[i + 3];
    if (name?.type === "paragraph" && quote?.type === "paragraph")
      reviews.push({
        name: name.text,
        quote: quote.text,
        source: blockText(b),
      });
  });
  return reviews;
}
