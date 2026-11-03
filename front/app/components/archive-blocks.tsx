import { createElement, type ReactNode } from "react";
import { Link } from "react-router";
import type { SiteBlock } from "@roniella/shared/site-content";

type PublicLink = { text: string; href: string };
export function Inline({ text, links }: { text: string; links: PublicLink[] }) {
  const matches: { start: number; end: number; link: PublicLink }[] = [];
  for (const link of links) {
    const start = text.indexOf(link.text);
    if (
      start < 0 ||
      matches.some((m) => start < m.end && start + link.text.length > m.start)
    )
      continue;
    matches.push({ start, end: start + link.text.length, link });
  }
  matches.sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const match of matches) {
    // The source's WhatsApp button opens an Elementor popup that no longer exists.
    // Use our real contact section; do not invent a WhatsApp account/phone number.
    const legacyPopup = /^\/contact\/#elementor-action(?:%3A|:)/i.test(match.link.href);
    const href = legacyPopup ? "/contact/#contact" : match.link.href;
    const label = legacyPopup ? "יצירת קשר" : match.link.text;
    nodes.push(text.slice(offset, match.start));
    nodes.push(
      href.startsWith("/") ? (
        <Link key={match.start} to={href}>
          {label}
        </Link>
      ) : (
        <a key={match.start} href={href} rel="noreferrer">
          {label}
        </a>
      ),
    );
    offset = match.end;
  }
  nodes.push(text.slice(offset));
  return <>{nodes}</>;
}
export function ArchiveBlocks({ blocks }: { blocks: SiteBlock[] }) {
  return (
    <div className="prose archive-prose">
      {blocks.map((block, i) => (
        <div key={i} className="content-block">
          {block.anchorIds.map((id) => (
            <span className="section-anchor" id={id} key={id} />
          ))}
          {block.type === "heading" ? (
            createElement(
              block.text.length > 130 ? "p" : `h${block.level}`,
              null,
              <Inline text={block.text} links={block.links} />,
            )
          ) : block.type === "paragraph" ? (
            <p>
              <Inline text={block.text} links={block.links} />
            </p>
          ) : block.type === "list" ? (
            createElement(
              block.ordered ? "ol" : "ul",
              null,
              block.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item.text} links={item.links} />
                  {item.children.map((list, k) =>
                    createElement(
                      list.ordered ? "ol" : "ul",
                      { key: k },
                      list.items.map((text, n) => <li key={n}>{text}</li>),
                    ),
                  )}
                </li>
              )),
            )
          ) : (
            <div className="table-scroll">
              <table>
                {block.caption && <caption>{block.caption}</caption>}
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) =>
                        createElement(
                          cell.isHeader ? "th" : "td",
                          {
                            key: k,
                            rowSpan: cell.rowspan ?? undefined,
                            colSpan: cell.colspan ?? undefined,
                          },
                          <Inline text={cell.text} links={cell.links} />,
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
