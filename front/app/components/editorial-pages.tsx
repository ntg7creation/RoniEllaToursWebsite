import { SiteText } from "./site-content-context";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { paths } from "@roniella/shared";
import type {
  PublicSiteContent,
  SiteBlock,
  SitePage,
} from "@roniella/shared/site-content";
import { copy } from "./site-content-context";
import { ArchiveBlocks } from "./archive-blocks";
import { ContactLinks } from "./layout";
import {CallbackForm} from "./callback-form";
import {WhatsAppIcon} from "./social-links";
import {socialLinks} from "@roniella/shared/callback";
import { AdminBlockButton, AdminEditButton, AdminManageButton, AdminPhotoButton } from "./admin-context";
import {
  blockText,
  cardCopy,
  groupBlocks,
  guideProfiles,
  homeReviews,
  sourceCard,
  tourSections,
} from "./content-sections";
import {
  displayHeading,
  editorialTourId,
} from "./editorial-config";

type PageProps = { page: SitePage; content: PublicSiteContent };
import { Photograph, CompassRose, PagePhotograph } from "./travel-visuals";
import { guidePortrait } from './editor-sections';
const reservedAnchors = new Set([
  "journy",
  "cost",
  "include",
  "contact",
  "lead",
]);
const sourceBlocks = (blocks: SiteBlock[]) =>
  blocks.map((b) => ({
    ...b,
    anchorIds: b.anchorIds.filter((id) => !reservedAnchors.has(id)),
  }));

function EditorialContact({ content }: { content: PublicSiteContent }) {
  return (
    <section className="editorial-contact" id="contact">
      <span id="lead" className="section-anchor" />
      <p className="editorial-print-contact-title">
        {content.siteSettings.businessName} · יצירת קשר
      </p>
      <div>
        <AdminEditButton scope="copy" contentKey="contact">עריכת אזור יצירת הקשר / Edit contact section</AdminEditButton>
        <p className="editorial-kicker">{copy(content, "contact.kicker")}</p>
        <h2>{copy(content, "contact.title")}</h2>
        <p>{copy(content, "contact.body")}</p>
      </div>
      <div>
        <a
          className="editorial-button light"
          href={socialLinks(content.presentation).whatsapp} target="_blank" rel="noopener noreferrer"
        >
          <WhatsAppIcon/> לשיחה בוואטסאפ <span aria-hidden="true">←</span>
        </a>
        <ContactLinks settings={content.siteSettings} presentation={content.presentation} />
      </div>
      <CallbackForm content={content}/>
    </section>
  );
}

function Team({
  content,
  tour = false,
}: {
  content: PublicSiteContent;
  tour?: boolean;
}) {
  const page = content.pages.find((p) => p.pageType === "guides");
  if (!page) return null;
  const groups = guideProfiles(page);
  return (
    <section className="editorial-team" id={tour ? "guides" : undefined}>
      <div className="editorial-section-intro">
        <AdminEditButton scope="copy" contentKey="team">עריכת פתיח הצוות / Edit guides introduction</AdminEditButton>
        <AdminManageButton pageId={page.id} mode="guides">הוספה, עריכה והסרה של אנשי צוות / Manage guides</AdminManageButton>
        <p className="editorial-kicker">{copy(content, "team.kicker")}</p>
        <h2>{tour ? "הדרכה שעושה את ההבדל" : copy(content, "team.title")}</h2>
        <p>
          {tour
            ? "במקור מופיעים שמות מדריכים שונים. שיבוץ הצוות למועד הזה דורש אישור; אפשר להכיר כאן את אנשי החברה."
            : copy(content, "team.body")}
        </p>
        <Link className="editorial-text-link" to={paths.guides}>
          להיכרות עם הצוות <span aria-hidden="true">←</span>
        </Link>
      </div>
      <div className="editorial-people">
        {groups.map((g) => {
          const bio = g.blocks.find((b) => b.type === "paragraph");
          const portrait=guidePortrait(g.blocks);
          return (
            <article className="editorial-person" key={g.title}>
              {portrait?<Photograph name={portrait.mediaId} alt={portrait.alt} showCaption={false} className="guide-portrait"/>:<span className="person-initials" aria-hidden="true">
                {g.title
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
              </span>}
              <div>
                <h3>{g.title}</h3>
                <AdminManageButton pageId={page.id} mode="guides" guideAnchor={g.anchors.find(id=>id.startsWith('guide-'))}>עריכת איש הצוות והתמונה / Edit guide profile and portrait</AdminManageButton>
                <p>{bio ? blockText(bio).split(/\n+/)[0] : ""}</p>
                <Link to={`${paths.guides}#${g.anchors[0]}`}>
                  להמשך ההיכרות <span aria-hidden="true">←</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DepartureCards({ page, content }: PageProps) {
  return (
    <div className="editorial-trip-grid">
      {content.siteSettings.featuredTourIds
        .map(pageId=>page.cards.find(card=>card.pageId===pageId) ?? {pageId,summary:""})
        .map((card) => {
          const target = content.pages.find((p) => p.id === card.pageId)!;
          const april = target.id === editorialTourId;
          const displayTitle = target.displayTitle ?? target.title;
          const facts = cardCopy(target, sourceCard(target, content)?.summary ?? card.summary);
          const period =
            target.title.match(/[א-ת]+\s+\d{4}/)?.[0] ?? "לבירור מועדים";
          const sourceGuide = target.blocks.find(
            (b) =>
              b.type === "heading" && b.level === 2 && b.text.includes("עם "),
          );
          return (
            <article className="editorial-trip-card" key={target.id}>
              <PagePhotograph page={target} placeholder />
              <div className="editorial-trip-copy">
                <AdminEditButton scope="trip" contentKey={target.id}>עריכת כל פרטי הטיול / Edit tour details and dates</AdminEditButton>
                <p className="editorial-kicker">
                  {(target.tourDetails ? facts.dates : period) || 'מועד יפורסם בהמשך'} · מסע תרבות והיסטוריה
                </p>
                <h3>
                  <Link to={target.path} aria-label={`${displayTitle} — ${target.title}`}>
                    {displayTitle}
                  </Link>
                </h3>
                <p>
                  {facts.summary}
                </p>
                <dl className="editorial-card-facts">
                  <div>
                    <dt>מועד ומשך</dt>
                    <dd>
                      {april && !target.tourDetails ? (
                        "ממתינים לאישור"
                      ) : (
                        <>
                          <bdi dir="ltr">{facts.dates}</bdi>
                          {facts.duration && <span> · {facts.duration}</span>}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>הדרכה</dt>
                    <dd>
                      {target.tourDetails ? facts.guide : april || !sourceGuide
                        ? "שיבוץ הצוות באישור"
                        : `${blockText(sourceGuide).split(/\n+/).filter(Boolean).at(-1)} · לפי המקור`}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="editorial-text-link"
                  to={target.path}
                  aria-label={`למסלול ולפרטי המסע: ${target.title}`}
                >
                  למסלול ולפרטי המסע <span aria-hidden="true">←</span>
                </Link>
              </div>
            </article>
          );
        })}
    </div>
  );
}

export function EditorialHome({ page, content }: PageProps) {
  const reviews = homeReviews(content).slice(0, 2);
  const posts = content.siteSettings.featuredPostIds
    .map(pageId=>page.cards.find(card=>card.pageId===pageId) ?? {pageId,summary:""})
    .sort((a, b) => (content.pages.find(p => p.id === b.pageId)?.publicationDate ?? '').localeCompare(content.pages.find(p => p.id === a.pageId)?.publicationDate ?? ''))
    .slice(0, 2);
  return (
    <article className="editorial-home">
      <header className="editorial-home-hero">
        <div className="editorial-hero-copy">
          <div className="admin-hero-controls">
            <AdminEditButton scope="copy" contentKey="home.hero">עריכת פתיח דף הבית / Edit homepage introduction</AdminEditButton>
            <AdminPhotoButton slot="home.hero">עריכת תמונת הרקע / Edit hero image</AdminPhotoButton>
          </div>
          <p className="editorial-kicker">{copy(content, "home.hero.kicker")}</p>
          <h1>{copy(content, "home.hero.heading")}</h1>
          <p className="editorial-hero-description">{copy(content, "home.hero.description")}</p>
          <Link className="editorial-button" to={paths.tours}>
            לראות את הטיולים <span aria-hidden="true">←</span>
          </Link>
          <a className="hero-discover-link" href="#destinations">להכיר את היעדים שלנו <span aria-hidden="true">↓</span></a>
        </div>
        <Photograph name="samarkand" slot="home.hero" priority className="editorial-hero-photo" showEditButton={false} />
      </header>
      <section className="travel-welcome">
        <div className="welcome-heading">
          <AdminEditButton scope="copy" contentKey="home.welcome">עריכת ההיכרות / Edit welcome text</AdminEditButton>
          <CompassRose />
          <p className="editorial-kicker">{copy(content, "home.welcome.kicker")}</p>
          <h2>{copy(content, "home.welcome.title")}</h2>
        </div>
        <div className="welcome-copy">
          {copy(content, "home.welcome.body").split("\n\n").map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <Link className="editorial-text-link" to={paths.about}>להיכרות עם טיולי העולם העתיק <span aria-hidden="true">←</span></Link>
        </div>
      </section>
      <section className="travel-destinations" id="destinations">
        <AdminEditButton scope="copy" contentKey="home.destinations">עריכת פתיח היעדים / Edit destinations introduction</AdminEditButton>
        <AdminManageButton collection="destinationArchive">הוספה והסרה של יעדים / Manage destinations</AdminManageButton>
        <div className="editorial-section-heading">
          <div><p className="editorial-kicker">{copy(content, "home.destinations.kicker")}</p><h2>{copy(content, "home.destinations.title")}</h2></div>
          <p className="destination-intro">{copy(content, "home.destinations.intro")}</p>
        </div>
        <div className="destination-spread">
          {content.pages.filter(destination => destination.pageType === 'destinationArchive').map((destination, index) => {
            const legacy = destination.path.includes('uzbekistan') ? 'uzbekistan' : destination.path.includes('china') ? 'china' : '';
            const details = destination.destinationDetails;
            return <article className={`destination-feature destination-${index % 2 ? 'china' : 'uzbekistan'}`} key={destination.id}>
              <PagePhotograph page={destination} placeholder />
              <div className="destination-feature-copy">
                <AdminManageButton pageId={destination.id} mode="settings" collection="destinationArchive">עריכת היעד, המועד והתמונה / Edit destination, dates and photo</AdminManageButton>
                <div><p className="editorial-kicker"><bdi>{String(index + 1).padStart(2, '0')}</bdi> · {legacy ? copy(content, `home.${legacy}.kicker`) : 'היעדים שלנו'}</p><h3><Link to={destination.path}>{destination.displayTitle ?? destination.title}</Link></h3></div>
                <div><p>{details?.summary ?? (legacy ? copy(content, `home.${legacy}.body`) : '')}</p>{details?.dates && <p className="destination-date">מועד הנסיעה: <bdi>{details.dates}</bdi></p>}<Link to={destination.path} className="editorial-text-link">לגלות את היעד <span aria-hidden="true">←</span></Link></div>
              </div>
            </article>;
          })}
        </div>
      </section>
      <section className="editorial-approach">
        <Photograph name="samarkand" slot="home.approach" />
        <div>
          <p className="editorial-kicker">{copy(content, "home.approach.kicker")}</p>
          <AdminEditButton scope="copy" contentKey="home.approach">עריכת הגישה שלנו / Edit our approach</AdminEditButton>
          <h2>{copy(content, "home.approach.title")}</h2>
          <p>{copy(content, "home.approach.body")}</p>
          <ul className="editorial-principles">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <h3>{copy(content, "home.principle.1.title")}</h3>
                <AdminEditButton scope="copy" contentKey="home.principle.1">עריכת עיקרון ראשון / Edit first principle</AdminEditButton>
                <p>{copy(content, "home.principle.1.body")}</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <h3>{copy(content, "home.principle.2.title")}</h3>
                <AdminEditButton scope="copy" contentKey="home.principle.2">עריכת עיקרון שני / Edit second principle</AdminEditButton>
                <p>{copy(content, "home.principle.2.body")}</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <h3>{copy(content, "home.principle.3.title")}</h3>
                <AdminEditButton scope="copy" contentKey="home.principle.3">עריכת עיקרון שלישי / Edit third principle</AdminEditButton>
                <p>{copy(content, "home.principle.3.body")}</p>
              </div>
            </li>
          </ul>
          <Link to={paths.about} className="editorial-text-link">
            על הדרך שלנו <span aria-hidden="true">←</span>
          </Link>
        </div>
      </section>
      <section className="editorial-departures" id="departures">
        <div className="editorial-section-heading">
          <div>
            <p className="editorial-kicker">{copy(content, "home.departures.kicker")}</p>
            <AdminEditButton scope="copy" contentKey="home.departures">עריכת פתיח המסעות / Edit tours introduction</AdminEditButton>
            <AdminManageButton>הוספה והסרה של טיולים / Manage tours</AdminManageButton>
            <h2>{copy(content, "home.departures.title")}</h2>
          </div>
          <Link className="editorial-text-link" to={paths.tours}>
            כל הטיולים <span aria-hidden="true">←</span>
          </Link>
        </div>
        <DepartureCards page={page} content={content} />
        <p className="editorial-source-note"><SiteText contentKey="text.editorial.text1" /></p>
      </section>
      <Team content={content} />
      <section className="editorial-traveler-stories">
        <div className="editorial-section-heading">
          <div>
            <p className="editorial-kicker">{copy(content, "home.reviews.kicker")}</p>
            <AdminEditButton scope="copy" contentKey="home.reviews">עריכת כותרת ההמלצות / Edit testimonials heading</AdminEditButton>
            <h2>{copy(content, "home.reviews.title")}</h2>
          </div>
          <Link className="editorial-text-link" to={paths.testimonials}>
            לכל ההמלצות ←
          </Link>
        </div>
        <div className="editorial-quotes">
          {reviews.map((r) => (
            <figure key={r.name}>
              <span className="editorial-quote-mark" aria-hidden="true">
                ״
              </span>
              <blockquote>
                <p>{r.quote}</p>
              </blockquote>
              <figcaption>
                <strong>
                  <bdi>{r.name}</bdi>
                </strong>
                <span>{r.source} · מהאתר הקיים</span>
              </figcaption>
              <details>
                <summary><SiteText contentKey="text.editorial.text2" /></summary>
                <p>{r.quote}</p>
              </details>
            </figure>
          ))}
        </div>
      </section>
      <section className="travel-journal">
        <div className="editorial-section-heading">
          <div>
            <p className="editorial-kicker">{copy(content, "home.journal.kicker")}</p>
            <AdminEditButton scope="copy" contentKey="home.journal">עריכת פתיח המאמרים / Edit journal introduction</AdminEditButton>
            <AdminManageButton collection="article">הוספה, עריכה והסרה של מאמרים / Manage articles</AdminManageButton>
            <h2>{copy(content, "home.journal.title")}</h2>
          </div>
          <Link className="editorial-text-link" to={paths.blog}>
            לכל המאמרים ←
          </Link>
        </div>
        <div className="editorial-articles">
          {posts.map((card, i) => {
            const post = content.pages.find((p) => p.id === card.pageId)!;
            return (
              <article key={post.id}>
                <span className="editorial-article-number" aria-hidden="true">
                  0{i + 1}
                </span>
                <div>
                  <p className="editorial-kicker"><SiteText contentKey="text.editorial.text3" /></p>
                  <PagePhotograph page={post} />
                  <AdminManageButton pageId={post.id} mode="settings" collection="article">עריכת המאמר והתמונה / Edit article and photo</AdminManageButton>
                  <h3>
                    <Link to={post.path}>{post.title}</Link>
                  </h3>
                  <p>{cardCopy(post, card.summary).summary}</p>
                  <Link
                    className="editorial-text-link"
                    to={post.path}
                    aria-label={`להמשך הקריאה: ${post.title}`}
                  >
                    להמשך הקריאה ←
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <EditorialContact content={content} />
    </article>
  );
}

function useJourneyControls() {
  const root = useRef<HTMLDivElement>(null);
  const saved = useRef<boolean[] | null>(null);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(true);
    const beforePrint = () => {
      if (saved.current) return;
      const details = [...(root.current?.querySelectorAll("details") ?? [])];
      saved.current = details.map((d) => d.open);
      details.forEach((d) => {
        d.open = true;
      });
    };
    const afterPrint = () => {
      root.current?.querySelectorAll("details").forEach((d, i) => {
        d.open = saved.current?.[i] ?? d.open;
      });
      saved.current = null;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return {
    root,
    interactive,
    setDaysOpen(open: boolean) {
      root.current
        ?.querySelectorAll<HTMLDetailsElement>(".editorial-day")
        .forEach((d) => {
          d.open = open;
        });
    },
  };
}

function SourceFacts({
  page,
  content,
  prices,
}: PageProps & { prices: SiteBlock[] }) {
  const card = sourceCard(page, content);
  const copy = card ? cardCopy(page, card.summary) : undefined;
  const bodyDates = prices.find(
    (b) => "text" in b && /\d{1,2}\/\d{1,2}/.test(b.text),
  );
  return (
    <details className="editorial-source-details" id="source-facts">
      <summary><SiteText contentKey="text.editorial.text4" /></summary>
      <p><SiteText contentKey="text.editorial.text5" /></p>
      <table>
        <caption>הבדלים בין חלקי עמוד המקור</caption>
        <thead>
          <tr>
            <th scope="col">נושא</th>
            <th scope="col">המידע שפורסם</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">כרטיס הטיול</th>
            <td>
              <bdi dir="ltr">{copy?.dates ?? "לא צוין"}</bdi> · משך שפורסם:{" "}
              <bdi>{copy?.duration ?? "לא צוין"}</bdi>
            </td>
          </tr>
          <tr>
            <th scope="row">פרק המחיר</th>
            <td>
              {bodyDates ? blockText(bodyDates) : "התאריכים טעונים בירור"}
            </td>
          </tr>
          <tr>
            <th scope="row">הדרכה</th>
            <td>
              {page.blocks.filter(block => /רחלי|רוני|מירון/.test(blockText(block))).slice(0, 3).map(block => <p key={blockText(block)}>{blockText(block)}</p>)}
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

export function EditorialTour({ page, content }: PageProps) {
  const sections = tourSections(page);
  const details = page.tourDetails;
  const controls = useJourneyControls();
  const intro = sections.overview.filter(
    (b) =>
      (b.type === "paragraph" || b.type === "heading") &&
      blockText(b).length > 130,
  );
  const logistics = groupBlocks(sections.prices, (b) =>
    /^(?:המחיר כולל|מה לא כלול|המחיר לא כולל)[:?]?$/.test(blockText(b)),
  );
  const included = logistics.find((s) => s.title.startsWith("המחיר כולל"));
  const excluded = logistics.find(
    (s) =>
      s.title.startsWith("מה לא כלול") || s.title.startsWith("המחיר לא כולל"),
  );
  return (
    <article className="editorial-tour">
      <header className="editorial-tour-hero">
        <div className="editorial-hero-copy">
          <p className="editorial-kicker">{details?.dates ?? 'אפריל 2027'} · מסע תרבות והיסטוריה</p>
          <h1>{displayHeading(page)}</h1>
          <p className="editorial-tour-subtitle">
            {details ? details.summary : <>בין ערי דרך המשי<br />לסיפורה של יהדות בוכרה</>}
          </p>
          <dl className="editorial-hero-facts">
            <div>
              <dt>מועדי המסע</dt>
              <dd>
                {details ? details.dates : <>אפריל 2027 <small>תאריכים מדויקים באישור</small></>}
              </dd>
            </div>
            <div>
              <dt>משך והדרכה</dt>
              <dd>
                {details ? [cardCopy(page,'').duration, details.guide].filter(Boolean).join(' · ') : <>ממתינים לאישור{" "}
                <small>
                  <a href="#source-facts">למה הפרטים בבדיקה?</a>
                </small></>}
              </dd>
            </div>
            {details?.price && <div><dt>מחיר</dt><dd>{details.price}</dd></div>}
            {details?.status && <div><dt>סטטוס הרשמה</dt><dd>{details.status}</dd></div>}
          </dl>
          <a href="#contact" className="editorial-button">
            לשיחה על הטיול <span aria-hidden="true">←</span>
          </a>
        </div>
        <PagePhotograph page={page} priority placeholder />
      </header>
      <p className="editorial-fact-notice"><SiteText contentKey="text.editorial.text6" /></p>
      <nav className="editorial-section-nav" aria-label="תוכן עמוד הטיול">
        <a href="#overview">על המסע</a>
        <a href="#route">הדרך</a>
        <a href="#journy">יום אחר יום</a>
        <a href="#guides">הדרכה</a>
        <a href="#include">מה כלול</a>
        <a href="#cost">מחיר ותנאים</a>
        <a href="#questions">שאלות</a>
      </nav>
      <div className="editorial-journey-printable" ref={controls.root}>
        <section className="editorial-overview" id="overview">
          <div>
            <p className="editorial-kicker"><SiteText contentKey="text.editorial.text7" /></p>
            <h2>
              ערים שהן סיפור.
              <br />
              מסע שמחבר ביניהן.
            </h2>
          </div>
          <div>
            <ArchiveBlocks blocks={sourceBlocks(intro.slice(0, 2))} />
            <details className="editorial-disclosure">
              <summary><SiteText contentKey="text.editorial.text8" /></summary>
              <ArchiveBlocks blocks={sourceBlocks(sections.overview)} />
            </details>
          </div>
        </section>
        <section className="editorial-highlights">
          {[1,2,3].map(number => <article key={number}>
            <AdminEditButton scope="copy" contentKey={`april.highlight.${number}`}>עריכת נקודת עניין / Edit highlight</AdminEditButton>
            <span aria-hidden="true">0{number}</span>
            <h3>{copy(content, `april.highlight.${number}.title`)}</h3>
            <p>{copy(content, `april.highlight.${number}.body`)}</p>
          </article>)}
        </section>
        <section id="route" className="editorial-route">
          <div>
            <AdminEditButton scope="copy" contentKey="april.route">עריכת תחנות המסלול / Edit route stops</AdminEditButton>
            <p className="editorial-kicker"><SiteText contentKey="text.editorial.text9" /></p>
            <h2>הדרך שלנו</h2>
            <p><SiteText contentKey="text.editorial.text10" /></p>
          </div>
          <ol aria-label="סדר הערים במסלול">
            {copy(content, "april.route.stops").split("\n").map((city, index) => <li key={`${city}-${index}`}>{city}</li>)}
          </ol>
        </section>
        <section id="journy" className="editorial-itinerary">
          <div className="editorial-section-heading">
            <div>
              <p className="editorial-kicker">לאורך הדרך</p>
              <h2><SiteText contentKey="text.editorial.text11" /></h2>
            </div>
            {controls.interactive && (
              <div className="editorial-itinerary-controls">
                <button
                  type="button"
                  onClick={() => controls.setDaysOpen(true)}
                >
                  פתיחת כל הימים
                </button>
                <button
                  type="button"
                  onClick={() => controls.setDaysOpen(false)}
                >
                  סגירת כל הימים
                </button>
                <button type="button" onClick={() => window.print()}>
                  הדפסה
                </button>
              </div>
            )}
          </div>
          <p className="editorial-source-note"><SiteText contentKey="text.editorial.text12" /></p>
          <div className="editorial-day-list">
            <AdminManageButton pageId={page.id} mode="itinerary">הוספה, עריכה והסרה של ימים / Edit itinerary days</AdminManageButton>
            {sections.days.map((day, i) =>
              day.title ? (
                <details className="editorial-day" key={i} open={i === 0}>
                  <summary>
                    <span className="editorial-day-number" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3>{day.title}</h3>
                    <span className="editorial-toggle" aria-hidden="true" />
                  </summary>
                  {day.heading && <AdminBlockButton block={day.heading} />}
                  <ArchiveBlocks blocks={sourceBlocks(day.blocks)} />
                  {!day.blocks.length && <p>פרטי היום יתווספו בהמשך.</p>}
                </details>
              ) : (
                <ArchiveBlocks key={i} blocks={sourceBlocks(day.blocks)} />
              ),
            )}
          </div>
        </section>
        <Photograph name="bukhara" slot="tour.april.interlude" className="editorial-interlude-photo" />
        <Team content={content} tour />
        <section id="include" className="editorial-logistics">
          <div className="editorial-section-heading">
            <div>
              <p className="editorial-kicker">לתכנן בנחת</p>
              <h2><SiteText contentKey="text.editorial.text13" /></h2>
            </div>
          </div>
          <p className="editorial-source-note"><SiteText contentKey="text.editorial.text14" /></p>
          <div className="editorial-logistics-grid">
            <div>
              <h3><SiteText contentKey="text.editorial.text15" /></h3>
              {included && (
                <ArchiveBlocks blocks={sourceBlocks(included.blocks)} />
              )}
            </div>
            <div>
              <h3><SiteText contentKey="text.editorial.text16" /></h3>
              {excluded && (
                <ArchiveBlocks blocks={sourceBlocks(excluded.blocks)} />
              )}
              <p className="editorial-source-note"><SiteText contentKey="text.editorial.text17" /></p>
            </div>
          </div>
        </section>
        <section id="cost" className="editorial-pricing">
          <div>
            <p className="editorial-kicker"><SiteText contentKey="text.editorial.text18" /></p>
            <h2>
              מתעניינים במסע?
              <br />
              בואו נדבר על הפרטים.
            </h2>
            <p><SiteText contentKey="text.editorial.text19" /></p>
            <a className="editorial-button" href="#contact">
              לשיחה על הטיול <span aria-hidden="true">←</span>
            </a>
          </div>
          <div>
            <SourceFacts
              page={page}
              content={content}
              prices={sections.prices}
            />
            <details className="editorial-disclosure source-pricing">
              <summary><SiteText contentKey="text.editorial.text20" /></summary>
              <p className="editorial-source-note"><SiteText contentKey="text.editorial.text21" /></p>
              <ArchiveBlocks blocks={sourceBlocks(sections.prices)} />
            </details>
          </div>
        </section>
        <section id="terms" className="editorial-terms">
          <p className="editorial-kicker"><SiteText contentKey="text.editorial.text22" /></p>
          <h2><SiteText contentKey="text.editorial.text23" /></h2>
          <p className="editorial-source-note"><SiteText contentKey="text.editorial.text24" /></p>
          {sections.terms.map((s, i) =>
            s.title ? (
              <details className="editorial-disclosure" key={i}>
                <summary>{s.title}</summary>
                <ArchiveBlocks blocks={sourceBlocks(s.blocks)} />
              </details>
            ) : (
              <ArchiveBlocks key={i} blocks={sourceBlocks(s.blocks)} />
            ),
          )}
        </section>
        <section id="questions" className="editorial-questions">
          <p className="editorial-kicker">טוב לדעת</p>
          <h2><SiteText contentKey="text.editorial.text25" /></h2>
          <details className="editorial-disclosure">
            <summary><SiteText contentKey="text.editorial.text26" /></summary>
            <p>
              פרטים אלה אינם אחידים בעמוד המקור.{" "}
              <a href="#contact">פנו אלינו לשיחה</a> לקבלת המידע המאושר.
            </p>
          </details>
          <details className="editorial-disclosure">
            <summary><SiteText contentKey="text.editorial.text27" /></summary>
            <p>
              כל תיאורי הימים מופיעים <a href="#journy">בתוכנית היומית</a>. ניתן
              לפתוח כל יום בנפרד או להדפיס את העמוד לקריאה נוחה.
            </p>
          </details>
        </section>
        {sections.more.length > 0 && (
          <details className="editorial-disclosure editorial-more">
            <summary><SiteText contentKey="text.editorial.text28" /></summary>
            <ArchiveBlocks blocks={sourceBlocks(sections.more)} />
          </details>
        )}
      </div>
      <EditorialContact content={content} />
    </article>
  );
}
