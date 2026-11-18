import { SiteText } from "./site-content-context";
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
  guideProfiles,
  homeReviews,
  readingBlocks,
  sourceCard,
  tourSections,
} from "./content-sections";
import { EditorialHome, EditorialTour } from "./editorial-pages";
import { editorialTourId } from "./editorial-config";
import { Photograph, PagePhotograph, photoForPage } from "./travel-visuals";
import { guidePortrait, sectionBounds } from './editor-sections';
import { GalleryPage } from "./gallery-page";
import {CallbackForm} from "./callback-form";
import {socialLinks} from "@roniella/shared/callback";
import { AdminBlockButton, AdminEditButton, AdminManageButton } from './admin-context';

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
              {tour ? <AdminEditButton scope="trip" contentKey={target.id}>עריכת כל פרטי הטיול / Edit tour details and dates</AdminEditButton> : <AdminManageButton pageId={target.id} mode="settings" collection="article">עריכת המאמר והתמונה / Edit article and photo</AdminManageButton>}
              <Heading>
                <Link to={target.path}>{target.displayTitle ?? target.title}</Link>
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
                  {copy.guide && <div><dt>הדרכה</dt><dd>{copy.guide}</dd></div>}
                  {copy.price && <div><dt>מחיר</dt><dd>{copy.price}</dd></div>}
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
            <summary><SiteText contentKey="text.pages.text1" /></summary>
            <p>{r.quote}</p>
          </details>
        </figure>
      ))}
    </div>
  );
}

function ContactPanel({ content, legacyLeadAnchor = false }: { content: PublicSiteContent; legacyLeadAnchor?: boolean }) {
  return (
    <section className="contact-panel" id="contact">
      {legacyLeadAnchor && <span id="lead" className="section-anchor" />}
      <div>
        <p className="eyebrow">נשמח לשוחח</p>
        <h2><SiteText contentKey="text.pages.text2" /></h2>
        <p><SiteText contentKey="text.pages.text3" /></p>
      </div>
      <div><a className="editorial-button light" href={socialLinks(content.presentation).whatsapp} target="_blank" rel="noopener noreferrer">לשיחה בוואטסאפ <span aria-hidden="true">←</span></a><ContactLinks settings={content.siteSettings} presentation={content.presentation}/></div>
      <CallbackForm content={content}/>
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
  const facts = cardCopy(page, card?.summary ?? '');
  const byline = page.blocks.find(
    (b) => b.type === "heading" && b.level === 2 && b.text.includes("עם "),
  );
  const lead = sections.overview.find((b) => blockText(b).length > 130);
  return (
    <article className="tour-page">
      <header className={`tour-heading ${photoForPage(page) ? "has-photograph" : ""}`}>
        <div className="tour-title-copy">
        <p className="eyebrow"><SiteText contentKey="text.pages.text4" /></p>
        <h1>{page.displayTitle ?? page.title}</h1>
        {(page.tourDetails ? page.tourDetails.guide : byline) && (
          <p className="tour-byline">
            {page.tourDetails ? page.tourDetails.guide : blockText(byline!).split(/\n+/).filter(Boolean).at(-1)}
          </p>
        )}
        <a className="editorial-text-link" href="#journy">לגלות את המסלול <span aria-hidden="true">↓</span></a>
        </div>
        <PagePhotograph page={page} priority />
      </header>
      <div className="tour-layout">
        <aside className="tour-sidebar">
          <div className="trip-overview">
            <p className="eyebrow"><SiteText contentKey="text.pages.text5" /></p>
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
                {facts?.price && <div><dt>מחיר</dt><dd>{facts.price}</dd></div>}
                {facts?.guide && <div><dt>הדרכה</dt><dd>{facts.guide}</dd></div>}
              </dl>
            <a href="#cost" className="button">
              מועדים ומחירים
            </a>
            <a href="#contact" className="text-link">
              לשיחה על המסע ←
            </a>
            <p className="source-note"><SiteText contentKey="text.pages.text6" /></p>
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
            <p className="eyebrow"><SiteText contentKey="text.pages.text7" /></p>
            <h2>על המסע</h2>
            {lead && <p className="intro-preview">{blockText(lead)}</p>}
            <details className="disclosure">
              <summary><SiteText contentKey="text.pages.text8" /></summary>
              <ArchiveBlocks blocks={sections.overview} />
            </details>
          </section>
          <section className="itinerary-section" id="journy">
            <div className="section-heading">
              <div>
                <p className="eyebrow"><SiteText contentKey="text.pages.text9" /></p>
                <h2>{sections.itineraryTitle}</h2>
              </div>
            </div>
            <p className="section-note"><SiteText contentKey="text.pages.text11" /></p>
            <div className="day-list">
              <AdminManageButton pageId={page.id} mode="itinerary">הוספה, עריכה והסרה של ימים / Edit itinerary days</AdminManageButton>
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
                    {day.heading && <AdminBlockButton block={day.heading} />}
                    <ArchiveBlocks blocks={day.blocks} />
                    {!day.blocks.length && <p>פרטי היום יתווספו בהמשך.</p>}
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
            <p className="eyebrow"><SiteText contentKey="text.pages.text12" /></p>
            <h2>{sections.priceTitle}</h2>
            <ArchiveBlocks blocks={sections.prices} />
            <p className="source-note">
              זהו נוסח המקור, כפי שפורסם. לבירור פרטים עדכניים{" "}
              <Link to={paths.contact}>צרו קשר</Link>.
            </p>
          </section>
          <section id="terms" className="terms-section">
            <p className="eyebrow"><SiteText contentKey="text.pages.text14" /></p>
            <h2>{sections.termsTitle}</h2>
            <p className="section-note"><SiteText contentKey="text.pages.text16" /></p>
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
              <summary><SiteText contentKey="text.pages.text17" /></summary>
              <ArchiveBlocks blocks={sections.more} />
            </details>
          )}
          <Videos page={page} />
        </div>
      </div>
      {page.blocks.some(block => block.links.some(link => link.href === `${page.path}#photos`)) && !page.blocks.some(block => block.anchorIds.includes("photos")) && (
        <section id="photos" className="section-heading"><div><h2><SiteText contentKey="text.pages.text18" /></h2><p><SiteText contentKey="text.pages.text19" /></p></div></section>
      )}
      <ContactPanel content={content} legacyLeadAnchor={!page.blocks.some(block => block.anchorIds.includes("lead"))} />
    </article>
  );
}

function Guides({ page, content }: PageProps) {
  const {start:first,end}=sectionBounds(page.blocks,'guides');
  const guides = guideProfiles(page);
  return (
    <article>
      <PageHeading
        title={page.title}
        summary="נעים להכיר — האנשים שמאחורי המסעות שלנו"
      />
      <AdminManageButton pageId={page.id} mode="guides">הוספה, עריכה והסרה של אנשי צוות / Manage guides</AdminManageButton>
      <div className="guide-grid">
        {guides.map((g, i) => {
          const bio = g.blocks.find((b) => b.type === "paragraph");
          const portrait=guidePortrait(g.blocks);
          const firstLine = bio && blockText(bio).split(/\n+/)[0];
          return (
            <article className="guide-card" key={g.title}>
              <Anchors ids={g.anchors} />
              {portrait?<Photograph name={portrait.mediaId} alt={portrait.alt} showCaption={false} className="guide-portrait"/>:<div className="guide-monogram" aria-hidden="true">
                {g.title
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>}
              <div className="guide-copy">
                <p className="eyebrow">צוות המדריכים · 0{i + 1}</p>
                <h2>{g.title}</h2>
                <AdminManageButton pageId={page.id} mode="guides" guideAnchor={g.anchors.find(id=>id.startsWith('guide-'))}>עריכת איש הצוות והתמונה / Edit guide profile and portrait</AdminManageButton>
                <p className="guide-role">{firstLine}</p>
                <details className="disclosure">
                  <summary>להיכרות עם {g.title}</summary>
                  <ArchiveBlocks blocks={g.blocks.filter(block=>block!==portrait)} />
                </details>
              </div>
            </article>
          );
        })}
      </div>
      <details className="disclosure guide-background">
        <summary><SiteText contentKey="text.pages.text20" /></summary>
        <ArchiveBlocks
          blocks={[
            ...page.blocks.slice(0, first < 0 ? page.blocks.length : first),
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
      <PageHeading title={page.displayTitle ?? page.title} />
      {page.pageType === 'article' && <div className="article-byline">{page.author && <span>{page.author.name}</span>}{page.publicationDate && <time dateTime={page.publicationDate}>{page.publicationDate}</time>}{page.seo.keywords?.map(label => <span className="article-label" key={label}>{label}</span>)}</div>}
      {page.pageType === "article" && <PagePhotograph page={page} priority />}
      {legal && page.pageType !== "privacy" && (
        <p className="draft-notice"><SiteText contentKey="text.pages.text21" /></p>
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
              {s.heading && <AdminBlockButton block={s.heading} />}
              <ArchiveBlocks blocks={s.blocks} parentLevel={s.title ? 2 : 1} />
            </section>
          ))}
        </div>
      </div>
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
  if (page.pageType === 'contact') return <article className="contact-form-page">
    <h1 className="visually-hidden">{page.displayTitle ?? page.title}</h1>
    <div id="contact"><span id="lead" className="section-anchor" /><CallbackForm content={content} headingLevel={2} /></div>
  </article>;
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
  if (listing) {
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
        ? page.pageType === 'destinationArchive' && !page.cards.length ? page.blocks : []
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
        {page.pageType === 'blog' && <AdminManageButton collection="article">הוספה, עריכה והסרה של מאמרים / Manage articles</AdminManageButton>}
        {page.pageType === 'tours' && <AdminManageButton>הוספה והסרה של טיולים / Manage tours</AdminManageButton>}
        {page.destinationDetails && <div className="listing-intro"><PagePhotograph page={page} /><p>{page.destinationDetails.summary}</p>{page.destinationDetails.dates && <p>מועד הנסיעה: <bdi>{page.destinationDetails.dates}</bdi></p>}</div>}
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
        {["blog","tours"].includes(page.pageType) && (
          <nav className="archive-discovery" aria-label={page.pageType === "blog" ? "עוד מהבלוג" : "היעדים שלנו"}>
            <h2>{page.pageType === "blog" ? "עוד מהבלוג" : "היעדים שלנו"}</h2>
            <ul>{content.pages.filter(target => page.pageType === "blog"
              ? ["authorArchive","categoryArchive"].includes(target.pageType)
              : target.pageType === "destinationArchive").map(target => (
                <li key={target.id}><Link to={target.path}>{target.title}</Link></li>
              ))}</ul>
          </nav>
        )}
      </article>
    );
  }
  return <ReadingPage page={page} content={content} />;
}
