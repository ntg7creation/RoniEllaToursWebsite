import { readFile, writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
import { validateArchive } from "./validate.mjs";
import { safePath, readJson, writeJson } from "./common.mjs";
const base = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "";
const { records, manifest } = await validateArchive(base);
const norm = (s) => s.replace(/\s+/g, " ").trim();
const strings = (value) =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === "object"
        ? Object.entries(value)
            .filter(([k]) =>
              [
                "text",
                "caption",
                "items",
                "children",
                "rows",
                "question",
                "answerText",
                "blocks",
              ].includes(k),
            )
            .flatMap(([, v]) => strings(v))
        : [];
const rows = [];
for (const p of records.filter((p) => p.httpStatus === 200)) {
  const $ = load(await readFile(safePath(p.snapshotPath), "utf8"));
  let root = $("main").first();
  if (!root.length)
    root = $(
      '[data-elementor-type="single-post"],[data-elementor-type="archive"],[data-elementor-type="wp-page"],[data-elementor-type="wp-post"]',
    ).first();
  root = root.clone();
  root.find("script,style,noscript,template,svg,form,iframe").remove();
  const corpus = norm(
    [
      ...strings(p.main.blocks),
      ...p.shared.widgets.flatMap((w) => strings(w.blocks)),
    ].join(" "),
  );
  const snippets = [];
  function visit(n) {
    if (n.type === "text") {
      const s = norm(n.data ?? "");
      if (s) snippets.push(s);
    } else for (const c of n.children ?? []) visit(c);
  }
  if (root[0]) visit(root[0]);
  const missing = [...new Set(snippets.filter((s) => !corpus.includes(s)))];
  rows.push({
    pageId: p.pageId,
    publicPath: p.publicPath,
    pageType: p.pageType,
    sourceTextNodes: snippets.length,
    preservedTextNodes: snippets.filter((s) => corpus.includes(s)).length,
    missingText: missing,
    sourceH1: p.sourceSeo.headings
      .filter((h) => h.level === 1)
      .map((h) => h.text),
    itinerarySections: p.tour.itinerary.map((s) => ({
      heading: s.heading,
      start: s.startBlockOrder,
      end: s.endBlockOrder,
    })),
    termsSections: p.tour.termsSections.map((s) => ({
      heading: s.heading,
      start: s.startBlockOrder,
      end: s.endBlockOrder,
    })),
    sourceTitle: p.sourceSeo.htmlTitles,
    sourceDescription: p.sourceSeo.sourceMetaDescriptions,
    sourceCanonical: p.sourceSeo.sourceCanonicalUrl,
  });
}
await writeJson(`${base}review-evidence.json`, {
  schemaVersion: 1,
  crawlRunId: manifest.crawlRunId,
  method:
    "Compare every readable text node in the immutable primary HTML document (forms/scripts/SVG excluded) against ordered content blocks plus separated widget evidence. This is automated fidelity evidence, not editorial approval.",
  rows,
});
const gaps = rows.filter((r) => r.missingText.length);
console.log(
  JSON.stringify(
    {
      pages: rows.length,
      withUnmatchedText: gaps.length,
      gaps: gaps.map((r) => ({
        path: r.publicPath,
        missing: r.missingText.slice(0, 12),
      })),
    },
    null,
    2,
  ),
);
if (gaps.length) process.exitCode = 1;
