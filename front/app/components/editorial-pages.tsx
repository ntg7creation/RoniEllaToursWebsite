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
import {
  blockText,
  cardCopy,
  groupBlocks,
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
  const groups = groupBlocks(
    page.blocks,
    (b) =>
      b.type === "heading" && b.anchorIds.some((id) => id.startsWith("guide-")),
  )
    .filter((g) => g.anchors.length)
    .slice(0, 2);
  return (
    <section className="editorial-team" id={tour ? "guides" : undefined}>
      <div className="editorial-section-intro">
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
          return (
            <article className="editorial-person" key={g.title}>
              <span className="person-initials" aria-hidden="true">
                {g.title
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
              </span>
              <div>
                <h3>{g.title}</h3>
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
          const china = target.path.includes("china");
          const knownDestination = china || target.path.includes("uzbekistan");
          const facts = cardCopy(target, card.summary);
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
                <p className="editorial-kicker">
                  {period} · מסע תרבות והיסטוריה
                </p>
                <h3>
                  <Link to={target.path} aria-label={target.title}>
                    {!knownDestination ? target.title : china
                      ? copy(content, "tour.china.title")
                      : copy(content, "tour.uzbekistan.title")}
                  </Link>
                </h3>
                <p>
                  {!knownDestination ? facts.summary : china
                    ? copy(content, "tour.china.body")
                    : copy(content, "tour.uzbekistan.body")}
                </p>
                <dl className="editorial-card-facts">
                  <div>
                    <dt>מועד ומשך</dt>
                    <dd>
                      {april ? (
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
                      {april || !sourceGuide
                        ? "שיבוץ הצוות באישור"
                        : `${blockText(sourceGuide).split(/\n+/).filter(Boolean).at(-1)} · לפי המקור`}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="editorial-text-link"
                  to={target.path}
                  aria-label={`לפרטי המסע: ${target.title}`}
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
    .slice(0, 2);
  return (
    <article className="editorial-home">
      <header className="editorial-home-hero">
        <div className="editorial-hero-copy">
          <p className="editorial-kicker">{copy(content, "home.hero.kicker")}</p>
          <h1>{copy(content, "home.hero.heading")}</h1>
          <p className="editorial-hero-description">{copy(content, "home.hero.description")}</p>
          <Link className="editorial-button" to={paths.tours}>
            לראות את הטיולים <span aria-hidden="true">←</span>
          </Link>
          <a className="hero-discover-link" href="#destinations">להכיר את היעדים שלנו <span aria-hidden="true">↓</span></a>
        </div>
        <Photograph name="samarkand" priority className="editorial-hero-photo" />
      </header>
      <section className="travel-welcome">
        <div className="welcome-heading">
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
        <div className="editorial-section-heading">
          <div><p className="editorial-kicker">{copy(content, "home.destinations.kicker")}</p><h2>{copy(content, "home.destinations.title")}</h2></div>
          <p className="destination-intro">{copy(content, "home.destinations.intro")}</p>
        </div>
        <div className="destination-spread">
          <article className="destination-feature destination-uzbekistan">
            <Photograph name="bukhara" />
            <div className="destination-feature-copy">
              <div><p className="editorial-kicker"><bdi>01</bdi> · {copy(content, "home.uzbekistan.kicker")}</p><h3><Link to="/destinations/uzbekistan/">{copy(content, "home.uzbekistan.title")}</Link></h3></div>
              <div><p>{copy(content, "home.uzbekistan.body")}</p><Link to="/destinations/uzbekistan/" className="editorial-text-link">לגלות את אוזבקיסטן <span aria-hidden="true">←</span></Link></div>
            </div>
          </article>
          <article className="destination-feature destination-china">
            <Photograph name="china" />
            <div className="destination-feature-copy">
              <div><p className="editorial-kicker"><bdi>02</bdi> · {copy(content, "home.china.kicker")}</p><h3><Link to="/destinations/china/">{copy(content, "home.china.title")}</Link></h3></div>
              <div><p>{copy(content, "home.china.body")}</p><Link to="/destinations/china/" className="editorial-text-link">לגלות את סין <span aria-hidden="true">←</span></Link></div>
            </div>
          </article>
        </div>
      </section>
      <section className="editorial-approach">
        <Photograph name="samarkand" />
        <div>
          <p className="editorial-kicker">{copy(content, "home.approach.kicker")}</p>
          <h2>{copy(content, "home.approach.title")}</h2>
          <p>{copy(content, "home.approach.body")}</p>
          <ul className="editorial-principles">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <h3>{copy(content, "home.principle.1.title")}</h3>
                <p>{copy(content, "home.principle.1.body")}</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <h3>{copy(content, "home.principle.2.title")}</h3>
                <p>{copy(content, "home.principle.2.body")}</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <h3>{copy(content, "home.principle.3.title")}</h3>
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
            <h2>{copy(content, "home.departures.title")}</h2>
          </div>
          <Link className="editorial-text-link" to={paths.tours}>
            כל הטיולים <span aria-hidden="true">←</span>
          </Link>
        </div>
        <DepartureCards page={page} content={content} />
        <p className="editorial-source-note">
          המועדים המוצגים הם מהאתר הקיים וטעונים אישור. מחיר וזמינות עדכניים
          מבררים בשיחה.
        </p>
      </section>
      <Team content={content} />
      <section className="editorial-traveler-stories">
        <div className="editorial-section-heading">
          <div>
            <p className="editorial-kicker">{copy(content, "home.reviews.kicker")}</p>
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
                <summary>לקריאת הסיפור המלא</summary>
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
                  <p className="editorial-kicker">תרבות · היסטוריה · מקומות</p>
                  <h3>
                    <Link to={post.path}>{post.title}</Link>
                  </h3>
                  <p>{cardCopy(post, card.summary).summary}</p>
                  <Link
                    className="editorial-text-link"
                    to={post.path}
                    aria-label={`לקריאת המאמר: ${post.title}`}
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
      <summary>מה דורש אישור במידע הקיים?</summary>
      <p>
        לא נקבע כאן איזה נוסח נכון. לפני הזמנה יש לקבל מהחברה פרטים מאושרים
        ואחידים.
      </p>
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
          <p className="editorial-kicker">אפריל 2027 · מסע תרבות והיסטוריה</p>
          <h1>{displayHeading(page)}</h1>
          <p className="editorial-tour-subtitle">
            בין ערי דרך המשי
            <br />
            לסיפורה של יהדות בוכרה
          </p>
          <dl className="editorial-hero-facts">
            <div>
              <dt>מועדי המסע</dt>
              <dd>
                אפריל 2027 <small>תאריכים מדויקים באישור</small>
              </dd>
            </div>
            <div>
              <dt>משך והדרכה</dt>
              <dd>
                ממתינים לאישור{" "}
                <small>
                  <a href="#source-facts">למה הפרטים בבדיקה?</a>
                </small>
              </dd>
            </div>
          </dl>
          <a href="#contact" className="editorial-button">
            לשיחה על הטיול <span aria-hidden="true">←</span>
          </a>
        </div>
        <Photograph
          name="samarkand"
          priority
          className="editorial-hero-photo"
        />
      </header>
      <p className="editorial-fact-notice">
        התוכנית עודכנה מהאתר הקיים. מועדים, מחירים ושיבוץ ההדרכה דורשים אימות לפני הזמנה.
      </p>
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
            <p className="editorial-kicker">מפגש עם הלב של דרך המשי</p>
            <h2>
              ערים שהן סיפור.
              <br />
              מסע שמחבר ביניהן.
            </h2>
          </div>
          <div>
            <ArchiveBlocks blocks={sourceBlocks(intro.slice(0, 2))} />
            <details className="editorial-disclosure">
              <summary>עוד על היעד ועל המסע</summary>
              <ArchiveBlocks blocks={sourceBlocks(sections.overview)} />
            </details>
          </div>
        </section>
        <section className="editorial-highlights">
          {[1,2,3].map(number => <article key={number}>
            <span aria-hidden="true">0{number}</span>
            <h3>{copy(content, `april.highlight.${number}.title`)}</h3>
            <p>{copy(content, `april.highlight.${number}.body`)}</p>
          </article>)}
        </section>
        <section id="route" className="editorial-route">
          <div>
            <p className="editorial-kicker">קו מחבר בין תרבויות</p>
            <h2>הדרך שלנו</h2>
            <p>סדר הערים לפי התוכנית שבאתר המקור. פרטי המסלול טעונים אישור.</p>
          </div>
          <ol aria-label="סדר הערים במסלול">
            {copy(content, "april.route.stops").split("\n").map((city, index) => <li key={`${city}-${index}`}>{city}</li>)}
          </ol>
        </section>
        <section id="journy" className="editorial-itinerary">
          <div className="editorial-section-heading">
            <div>
              <p className="editorial-kicker">לאורך הדרך</p>
              <h2>המסע, יום אחר יום</h2>
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
          <p className="editorial-source-note">
            התוכנית שלהלן נשמרה מהאתר הקיים. מספר הימים והנוסח הסופי ייקבעו לאחר
            אישור המידע.
          </p>
          <div className="editorial-day-list">
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
                  <ArchiveBlocks blocks={sourceBlocks(day.blocks)} />
                </details>
              ) : (
                <ArchiveBlocks key={i} blocks={sourceBlocks(day.blocks)} />
              ),
            )}
          </div>
        </section>
        <Photograph name="bukhara" className="editorial-interlude-photo" />
        <Team content={content} tour />
        <section id="include" className="editorial-logistics">
          <div className="editorial-section-heading">
            <div>
              <p className="editorial-kicker">לתכנן בנחת</p>
              <h2>הפרטים שעושים את הדרך</h2>
            </div>
          </div>
          <p className="editorial-source-note">
            לפי רשימות המקור, לעיון בלבד עד אישור. שמות המלונות ופרטי הטיסות
            אינם מאושרים כאן.
          </p>
          <div className="editorial-logistics-grid">
            <div>
              <h3>מה כלול בנוסח הקיים</h3>
              {included && (
                <ArchiveBlocks blocks={sourceBlocks(included.blocks)} />
              )}
            </div>
            <div>
              <h3>מה לא כלול בנוסח הקיים</h3>
              {excluded && (
                <ArchiveBlocks blocks={sourceBlocks(excluded.blocks)} />
              )}
              <p className="editorial-source-note">
                מידע נוסף ותנאים בנוסח המקור מופיעים בהמשך.
              </p>
            </div>
          </div>
        </section>
        <section id="cost" className="editorial-pricing">
          <div>
            <p className="editorial-kicker">מחיר, מועדים ותנאים</p>
            <h2>
              מתעניינים במסע?
              <br />
              בואו נדבר על הפרטים.
            </h2>
            <p>
              המחיר, התאריכים והצוות למועד הזה עדיין דורשים אישור. בשיחה אפשר
              לברר את הפרטים העדכניים.
            </p>
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
              <summary>תאריכי יציאה ומחירים — הנוסח הקיים</summary>
              <p className="editorial-source-note">
                הטקסט הבא נשמר כמקור לעיון, וכולל מידע סותר שטרם אושר.
              </p>
              <ArchiveBlocks blocks={sourceBlocks(sections.prices)} />
            </details>
          </div>
        </section>
        <section id="terms" className="editorial-terms">
          <p className="editorial-kicker">קוראים לפני שמחליטים</p>
          <h2>תנאים והערות</h2>
          <p className="editorial-source-note">
            נוסח המקור, לעיון. תנאים מאושרים יש לקבל מהחברה לפני הזמנה.
          </p>
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
          <h2>לפני שיוצאים לדרך</h2>
          <details className="editorial-disclosure">
            <summary>איך מבררים את התאריכים ואת שיבוץ המדריכים?</summary>
            <p>
              פרטים אלה אינם אחידים בעמוד המקור.{" "}
              <a href="#contact">פנו אלינו לשיחה</a> לקבלת המידע המאושר.
            </p>
          </details>
          <details className="editorial-disclosure">
            <summary>איפה אפשר לקרוא את המסלול המלא?</summary>
            <p>
              כל תיאורי הימים מופיעים <a href="#journy">בתוכנית היומית</a>. ניתן
              לפתוח כל יום בנפרד או להדפיס את העמוד לקריאה נוחה.
            </p>
          </details>
        </section>
        {sections.more.length > 0 && (
          <details className="editorial-disclosure editorial-more">
            <summary>על הדרך שלנו — מידע נוסף מהאתר הקיים</summary>
            <ArchiveBlocks blocks={sourceBlocks(sections.more)} />
          </details>
        )}
      </div>
      <EditorialContact content={content} />
    </article>
  );
}
