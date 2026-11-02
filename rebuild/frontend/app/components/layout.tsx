import { useEffect, useRef, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { paths, type SiteSettings } from "@roniella/shared";
import { CompassRose } from "./travel-visuals";
const fallbackSettings: SiteSettings = {
  businessName: "Roniella Tours",
  language: "he",
  timezone: "Asia/Jerusalem",
  contact: { phone: "073-3744686", email: "roniellatours@gmail.com" },
  navigation: [
    { label: "ראשי", path: paths.home },
    { label: "הטיולים שלנו", path: paths.tours },
    { label: "יצירת קשר", path: paths.contact },
  ],
  footerLinks: [
    { label: "פרטיות — טיוטה", path: paths.privacy },
    { label: "נגישות — טיוטה", path: paths.accessibility },
  ],
  featuredPostIds: [],
  featuredTourIds: [],
};
export function SiteLayout({
  settings = fallbackSettings,
  notice = "סביבת פיתוח — לבירור פרטים עדכניים פנו אלינו.",
  editorial = true,
  presentation,
  children,
}: {
  settings?: SiteSettings;
  notice?: string;
  editorial?: boolean;
  presentation?: Record<string, string>;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [location.pathname]);
  const navigationLinks = editorial
    ? settings.navigation.filter((l) =>
        [paths.home, paths.tours, paths.about, paths.guides, paths.blog, "/gallery/"].some(
          (path) => path === l.path,
        ),
      )
    : settings.navigation;
  const navigation = navigationLinks.map((link) => (
    <li key={link.path}>
      <NavLink end={link.path === "/"} to={link.path}>
        {link.path === paths.home ? "דף הבית" : link.label}
      </NavLink>
    </li>
  ));
  return (
    <div className={editorial ? "editorial-shell" : undefined}>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to={paths.home} aria-label={`${settings.businessName} — דף הבית`}>
            <CompassRose className="brand-mark" />
            <span className="brand-name">
              {settings.businessName}
              <span><bdi lang="en">RONIELLA TOURS</bdi> · תרבות והיסטוריה</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="ניווט ראשי">
            <ul>{navigation}</ul>
          </nav>
          {editorial && (
            <Link to={paths.contact} className="editorial-header-contact">
              בואו נדבר <span aria-hidden="true">←</span>
            </Link>
          )}
          <details
            className="mobile-menu"
            ref={menu}
            onKeyDown={(event) => {
              if (event.key === "Escape" && menu.current) {
                menu.current.open = false;
                menu.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>
              תפריט <span aria-hidden="true">☰</span>
            </summary>
            <nav
              aria-label="ניווט ראשי במובייל"
              onClick={() => {
                if (menu.current) menu.current.open = false;
              }}
            >
              <ul>
                {navigation}
                {editorial && (
                  <li>
                    <Link to={paths.contact}>יצירת קשר</Link>
                  </li>
                )}
              </ul>
            </nav>
          </details>
        </div>
      </header>
      <div className="sample-notice" role="note">
        <div className="container">{notice}</div>
      </div>
      <main id="main-content" className="container main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-main">
          <div className="footer-heading">
            <CompassRose />
            <p className="footer-brand">{settings.businessName}</p>
            <p>{presentation?.["footer.tagline"] ?? "היסטוריה, תרבות ואנשים. בדרך אחרת."}</p>
            <p className="footer-invitation">{presentation?.["footer.invitation"] ?? "מסעות שמתחילים בסקרנות"}</p>
          </div>
          <nav aria-label="לגלות עוד באתר">
            <p className="footer-label">להמשיך לגלות</p>
            <ul>
              {settings.navigation.filter((l) => l.path !== "/" && l.path !== paths.contact).map((l) => (
                <li key={l.path}>
                  <Link to={l.path}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="footer-contact">
            <p className="footer-label">כל מסע מתחיל בשיחה</p>
            <p>נשמח לשמוע על המסע הבא שלכם.</p>
            <ContactLinks settings={settings} />
            <Link to={paths.contact} className="editorial-text-link">לכל דרכי הקשר <span aria-hidden="true">←</span></Link>
          </div>
          </div>
          <div className="footer-bottom">
          <nav aria-label="קישורים בתחתית האתר"><ul>{settings.footerLinks.filter((link) => [paths.privacy, paths.accessibility, "/prices-and-terms/"].some(path => path === link.path)).map((link) => <li key={link.path}><Link to={link.path}>{link.label}</Link></li>)}</ul></nav>
          <p className="footer-note">
            סביבת פיתוח · התוכן מהאתר הקיים וטעון בדיקה לפני פרסום
          </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
export function ContactLinks({ settings }: { settings: SiteSettings }) {
  return (
    <div className="contact-links">
      <a dir="ltr" href={`tel:${settings.contact.phone.replace(/[ -]/g, "")}`}>
        {settings.contact.phone}
      </a>
      <a dir="ltr" href={`mailto:${settings.contact.email}`}>
        {settings.contact.email}
      </a>
      {settings.contact.address && <p>{settings.contact.address}</p>}
    </div>
  );
}
export function Breadcrumbs({
  title,
  parent,
}: {
  title: string;
  parent?: { title: string; path: string };
}) {
  return (
    <nav id="breadcrumbs" className="breadcrumbs" aria-label="מיקומך באתר">
      <ol>
        <li>
          <Link to={paths.home}>דף הבית</Link>
        </li>
        {parent && (
          <li>
            <Link to={parent.path}>{parent.title}</Link>
          </li>
        )}
        <li aria-current="page">{title}</li>
      </ol>
    </nav>
  );
}
export function PageHeading({
  title,
  summary,
}: {
  title: string;
  summary?: string;
}) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      {summary && <p className="lead">{summary}</p>}
    </header>
  );
}
