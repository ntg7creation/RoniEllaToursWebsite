import { useEffect } from "react";
import { Link } from "react-router";
import { paths } from "@roniella/shared";
import type {
  SitePage,
  PublicSiteContent,
} from "@roniella/shared/site-content";
import { PageHeading, ContactLinks } from "./layout";
import { ArchiveBlocks, Inline } from "./archive-blocks";
import {
  blockText,
  cardCopy,
  cleanLabel,
  groupBlocks,
  homeReviews,
  readingBlocks,
  sourceCard,
  tourSections,
} from "./content-sections";
import { EditorialHome, EditorialTour } from "./editorial-pages";
import { editorialTourId } from "./editorial-config";
import { PagePhotograph, photoForPage } from "./travel-visuals";
import { GalleryPage } from "./gallery-page";

type PageProps = { page: SitePage; content: PublicSiteContent };
function Anchors({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <span className="section-anchor" id={id} key={id} />
      ))}
    </>
  );
}
function PageCards({ page, content, ids }: PageProps & { ids?: string[] }) {
  const cards = ids
    ? page.cards.filter((c) => ids.includes(c.pageId))
    : page.cards;
  const Heading = page.path === "/" ? "h3" : "h2";
  return (
    <div className="grid page-cards">
      {cards.map((card, index) => {
        const target = content.pages.find((p) => p.id === card.pageId)!;
        const copy = cardCopy(target, card.summary);
        const tour = target.pageType === "tour";
        return (
          <article
            className={`card destination-card ${tour ? "tour-card" : "post-card"}`}
            key={target.id}
          >
            <PagePhotograph page={target} placeholder={tour} />
            <div className="card-topline">
              <span className="eyebrow">{tour ? "המסעות שלנו" : "מהבלוג"}</span>
              <span className="card-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="card-body">
              <Heading>
                <Link to={target.path}>{target.title}</Link>
              </Heading>
              {copy.summary && (
                <p className="card-description">{copy.summary}</p>
              )}
              {tour && (
                <dl className="trip-facts">
                  {copy.duration && (
                    <div>
                      <dt>
                        {copy.duration.includes("ימים")
                          ? "משך המסע"
                          : "משך כפי שפורסם"}
                      </dt>
                      <dd>{copy.duration}</dd>
                    </div>
                  )}
                  {copy.dates && (
                    <div>
                      <dt>תאריכים כפי שפורסמו</dt>
                      <dd dir="ltr">{copy.dates}</dd>
                    </div>
                  )}
                  {copy.status && (
                    <div>
                      <dt>סטטוס שפורסם</dt>
                      <dd>
                        <span className="status-pill">{copy.status}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <Link
                className="card-link"
                to={target.path}
                aria-label={`${tour ? "למסלול ולפרטי המסע" : "לקריאת המאמר"}: ${target.title}`}
              >
                {tour ? "למסלול ולפרטי המסע" : "לקריאת המאמר"}
                <span aria-hidden="true">←</span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Reviews({
  content,
  preview = false,
}: {
  content: PublicSiteContent;
  preview?: boolean;
}) {
  const reviews = homeReviews(content);
  return (
    <div className="grid review-grid">
      {(preview ? reviews.slice(0, 3) : reviews).map((r) => (
        <figure className="review-card" key={r.name}>
          <span className="quote-mark" aria-hidden="true">
            ״
          </span>
          <blockquote>
            <p className="quote-preview">{r.quote}</p>
          </blockquote>
          <figcaption>
            <strong>{r.name}</strong>
            <span>{r.source}</span>
          </figcaption>
          <details className="review-full">
            <summary>לקריאת ההמלצה המלאה</summary>
            <p>{r.quote}</p>
          </details>
        </figure>
      ))}
    </div>
  );
}

function ContactPanel({ content }: { content: PublicSiteContent }) {
  return (
    <section className="contact-panel" id="contact">
      <div>
        <p className="eyebrow">נשמח לשוחח</p>
        <h2>בואו נדבר על המסע הבא</h2>
        <p>לבירור מועדים, מחירים ופרטי הטיול העדכניים.</p>
      </div>
      <ContactLinks settings={content.siteSettings} />
    </section>
  );
}

function Videos({ page }: { page: SitePage }) {
  if (!page.videos.length) return null;
  return (
    <section className="video-section">
      <h2>{page.pageType === "videos" ? "הסרטונים שלנו" : "וידיאו מהטיול"}</h2>
      <div className="grid">
        {page.videos.map((v, i) => (
          <article className="card video-card" key={v.externalUrl}>
            <span className="play-symbol" aria-hidden="true">
              ▷
            </span>
            <h3>
              <a href={v.externalUrl} rel="noreferrer">
                {v.title || `צפייה בסרטון ${i + 1}`}
              </a>
            </h3>
            {v.description && <p>{v.description}</p>}
            <span className="eyebrow">ייפתח באתר הסרטונים</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Tour({ page, content }: PageProps) {
  const sections = tourSections(page);
  const card = sourceCard(page, content);
  const facts = card ? cardCopy(page, card.summary) : undefined;
  const byline = page.blocks.find(
    (b) => b.type === "heading" && b.level === 2 && b.text.includes("עם "),
  );
  const lead = sections.overview.find((b) => blockText(b).length > 130);
  return (
    <article className="tour-page">
      <header className={`tour-heading ${photoForPage(page) ? "has-photograph" : ""}`}>
        <div className="tour-title-copy">
        <p className="eyebrow">המסעות שלנו · תרבות והיסטוריה</p>
        <h1>{page.title}</h1>
        {byline && (
          <p className="tour-byline">
            {blockText(byline).split(/\n+/).filter(Boolean).at(-1)}
          </p>
        )}
        <a className="editorial-text-link" href="#journy">לגלות את המסלול <span aria-hidden="true">↓</span></a>
        </div>
        <PagePhotograph page={page} priority />
      </header>
      <div className="tour-layout">
        <aside className="tour-sidebar">
          <div className="trip-overview">
            <p className="eyebrow">המסע במבט אחד</p>
            <h2>פרטי המסע</h2>
            <dl className="trip-facts">
              {facts?.duration && (
                <div>
                  <dt>
                    {facts.duration.includes("ימים")
                      ? "משך המסע"
                      : "משך כפי שפורסם"}
                  </dt>
                  <dd>{facts.duration}</dd>
                </div>
              )}
              {facts?.dates && (
                <div>
                  <dt>תאריכים כפי שפורסמו</dt>
                  <dd dir="ltr">{facts.dates}</dd>
                </div>
              )}
              {facts?.status && (
                <div>
                  <dt>סטטוס שפורסם</dt>
                  <dd>
                    <span className="status-pill">{facts.status}</span>
                  </dd>
                </div>
              )}
            </dl>
            <a href="#cost" className="button">
              מועדים ומחירים
            </a>
            <a href="#contact" className="text-link">
              לשיחה על המסע ←
            </a>
            <p className="source-note">
              המידע מהאתר הקיים. יש לאמת זמינות, מחיר ותנאים לפני הזמנה.
            </p>
          </div>
        </aside>
        <div className="tour-main">
          <nav className="section-nav" aria-label="תוכן עמוד הטיול">
            <a href="#overview">על המסע</a>
            <a href="#journy">מסלול יומי</a>
            <a href="#cost">מועדים ומחירים</a>
            <a href="#terms">תנאים</a>
          </nav>
          <section className="tour-intro" id="overview">
            <p className="eyebrow">לפני שיוצאים</p>
            <h2>על המסע</h2>
            {lead && <p className="intro-preview">{blockText(lead)}</p>}
            <details className="disclosure">
              <summary>עוד על היעד ועל המסע</summary>
              <ArchiveBlocks blocks={sections.overview} />
            </details>
          </section>
          <section className="itinerary-section" id="journy">
            <div className="section-heading">
              <div>
                <p className="eyebrow">צעד אחר צעד</p>
                <h2>מסלול הטיול</h2>
              </div>
            </div>
            <p className="section-note">
              פתחו כל יום כדי לקרוא את התוכנית המלאה.
            </p>
            <div className="day-list">
              {sections.days.map((day, i) =>
                day.title ? (
                  <details className="day-card" key={i} open={i === 0}>
                    <summary>
                      <Anchors ids={day.anchors} />
                      <span className="day-number" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3>{day.title}</h3>
                      <span className="expand-icon" aria-hidden="true" />
                    </summary>
                    <ArchiveBlocks blocks={day.blocks} />
                  </details>
                ) : (
                  <ArchiveBlocks key={i} blocks={day.blocks} />
                ),
              )}
            </div>
          </section>
          <section
            className="price-section"
            id={sections.priceAnchors.includes("cost") ? undefined : "cost"}
          >
            <Anchors ids={sections.priceAnchors} />
            <p className="eyebrow">לקראת היציאה</p>
            <h2>תאריכי יציאה ומחירים</h2>
            <ArchiveBlocks blocks={sections.prices} />
            <p className="source-note">
              זהו נוסח המקור, כפי שפורסם. לבירור פרטים עדכניים{" "}
              <Link to={paths.contact}>צרו קשר</Link>.
            </p>
          </section>
          <section id="terms" className="terms-section">
            <p className="eyebrow">כל הפרטים, במקום אחד</p>
            <h2>תנאים והערות</h2>
            <p className="section-note">
              תשלום, ביטול, מה כלול ועוד — לפי הנוסח באתר הקיים.
            </p>
            {sections.terms.map((s, i) =>
              s.title ? (
                <details className="disclosure" key={i}>
                  <summary>
                    <Anchors ids={s.anchors} />
                    {cleanLabel(s.title)}
                    <span className="expand-icon" aria-hidden="true" />
                  </summary>
                  <ArchiveBlocks blocks={s.blocks} />
                </details>
              ) : (
                <ArchiveBlocks blocks={s.blocks} key={i} />
              ),
            )}
          </section>
          {sections.more.length > 0 && (
            <details className="disclosure about-disclosure">
              <summary>למה לטייל איתנו</summary>
              <ArchiveBlocks blocks={sections.more} />
            </details>
          )}
          <Videos page={page} />
        </div>
      </div>
      <ContactPanel content={content} />
    </article>
  );
}

function Guides({ page, content }: PageProps) {
  const first = page.blocks.findIndex((b) =>
    b.anchorIds.some((id) => id.startsWith("guide-")),
  );
  const end = page.blocks.findIndex(
    (b, i) => i > first && b.type === "heading" && b.level === 2,
  );
  const guides = groupBlocks(
    page.blocks.slice(first, end < 0 ? undefined : end),
    (b) =>
      b.type === "heading" && b.anchorIds.some((id) => id.startsWith("guide-")),
  );
  return (
    <article>
      <PageHeading
        title={page.title}
        summary="נעים להכיר — האנשים שמאחורי המסעות שלנו"
      />
      <div className="guide-grid">
        {guides.map((g, i) => {
          const bio = g.blocks.find((b) => b.type === "paragraph");
          const firstLine = bio && blockText(bio).split(/\n+/)[0];
          return (
            <article className="guide-card" key={g.title}>
              <Anchors ids={g.anchors} />
              <div className="guide-monogram" aria-hidden="true">
                {g.title
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="guide-copy">
                <p className="eyebrow">צוות המדריכים · 0{i + 1}</p>
                <h2>{g.title}</h2>
                <p className="guide-role">{firstLine}</p>
                <details className="disclosure">
                  <summary>להיכרות עם {g.title}</summary>
                  <ArchiveBlocks blocks={g.blocks} />
                </details>
              </div>
            </article>
          );
        })}
      </div>
      <details className="disclosure guide-background">
        <summary>על צוות המדריכים ועל הדרך שלנו</summary>
        <ArchiveBlocks
          blocks={[
            ...page.blocks.slice(0, first),
            ...page.blocks.slice(end < 0 ? page.blocks.length : end),
          ]}
        />
      </details>
      <ContactPanel content={content} />
    </article>
  );
}

function ReadingPage({ page, content }: PageProps) {
  const legal = ["privacy", "accessibility"].includes(page.pageType);
  const blocks = readingBlocks(page);
  const sections = groupBlocks(
    blocks,
    (b) =>
      (b.type === "heading" && b.level === 2 && b.text.length < 130) ||
      (page.pageType === "privacy" &&
        b.type === "list" &&
        b.ordered &&
        b.items.length === 1),
  );
  const toc = sections
    .map((s, i) => ({ ...s, id: `reading-section-${i}` }))
    .filter((s) => s.title);
  const tocLinks = (
    <ol>
      {toc.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`}>{s.title}</a>
        </li>
      ))}
    </ol>
  );
  return (
    <article className="reading-page">
      <PageHeading title={page.title} />
      {page.pageType === "article" && <PagePhotograph page={page} priority />}
      {legal && (
        <p className="draft-notice">
          נוסח מהאתר הקיים — טעון בדיקה ואישור לפני פרסום.
        </p>
      )}
      <div className={`reading-layout ${toc.length > 1 ? "has-toc" : ""}`}>
        {toc.length > 1 && (
          <aside className="reading-sidebar">
            <nav className="reading-toc" aria-label="תוכן המאמר">
              <p className="eyebrow">בעמוד הזה</p>
              {tocLinks}
            </nav>
          </aside>
        )}
        <div className="reading-body">
          {toc.length > 1 && (
            <details className="mobile-reading-index disclosure">
              <summary>תוכן העניינים · {toc.length} נושאים</summary>
              <nav aria-label="תוכן המאמר במובייל">{tocLinks}</nav>
            </details>
          )}
          {sections.map((s, i) => (
            <section
              className="reading-section"
              id={`reading-section-${i}`}
              key={i}
            >
              <Anchors ids={s.anchors} />
              {s.title && (
                <h2>
                  <Inline text={s.title} links={s.links} />
                </h2>
              )}
              <ArchiveBlocks blocks={s.blocks} />
            </section>
          ))}
        </div>
      </div>
      {page.pageType === "contact" && <ContactPanel content={content} />}
      <Videos page={page} />
    </article>
  );
}

export function ArchivePageContent({ page, content, totalGalleryPhotos = 0 }: PageProps & { totalGalleryPhotos?: number }) {
  useEffect(() => {
    // Fragments can point into a collapsed source section. Reveal its ancestors.
    const reveal = () => {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      let ancestor = target.parentElement;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [page.id]);
  if (page.path === "/") return <EditorialHome page={page} content={content} />;
  if (page.pageType === "gallery") return <GalleryPage page={page} content={content} total={totalGalleryPhotos} />;
  if (page.id === editorialTourId)
    return <EditorialTour page={page} content={content} />;
  if (page.pageType === "tour") return <Tour page={page} content={content} />;
  if (page.pageType === "guides")
    return <Guides page={page} content={content} />;
  if (page.pageType === "testimonials")
    return (
      <article>
        <PageHeading
          title={page.title}
          summary="המלצות מטיילים שהופיעו בעמוד הבית של האתר הקיים"
        />
        <Reviews content={content} />
      </article>
    );
  const listing = [
    "tours",
    "blog",
    "destinationArchive",
    "categoryArchive",
    "authorArchive",
  ].includes(page.pageType);
  if (listing && page.cards.length) {
    const firstTitle = content.pages.find(
      (p) => p.id === page.cards[0]?.pageId,
    )?.title;
    const firstIndex = page.blocks.findIndex(
      (b) => b.type === "heading" && b.text === firstTitle,
    );
    const labels = new Set(
      content.pages
        .filter((p) => p.pageType === "destinationArchive")
        .map((p) => p.title),
    );
    const intro =
      firstIndex < 0
        ? []
        : page.blocks
            .slice(0, firstIndex)
            .filter(
              (b) =>
                b.type !== "heading" ||
                (!labels.has(b.text) && b.text !== page.title),
            );
    return (
      <article className="listing-page">
        <PageHeading title={page.title} summary={page.pageType === "tours" ? "מסעות של תרבות, היסטוריה ומפגש אנושי. מצאו את הדרך שמסקרנת אתכם." : page.pageType === "blog" ? "מקומות, אנשים וסיפורים. ההיכרות עם העולם מתחילה עוד לפני שיוצאים לדרך." : undefined} />
        {intro.length > 0 && (
          <div className="listing-intro">
            <ArchiveBlocks blocks={intro} />
          </div>
        )}
        <p className="listing-count">
          {page.cards.length}{" "}
          {page.pageType === "tours" ? "מסעות להכיר" : "כתבות ומסעות לקריאה"}
        </p>
        <PageCards page={page} content={content} />
      </article>
    );
  }
  return <ReadingPage page={page} content={content} />;
}
