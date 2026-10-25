import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Phone, X } from "lucide-react";
import { mainNavigation } from "../../content/navigation.js";
import { siteInfo } from "../../content/site.js";
import MobileNav from "./MobileNav.jsx";
import LanguageControl from './LanguageControl.jsx';
export default function Header() {
  const {
    t,
    language
  } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  useEffect(() => {
    setIsOpen(false);
  }, [location.key, language]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--header-height', `${entry.target.offsetHeight}px`);
    });
    observer.observe(headerRef.current);
    const media = matchMedia('(min-width: 1241px)');
    const close = () => setIsOpen(false);
    media.addEventListener('change', close);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', close);
    };
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const dismiss = event => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.type === 'pointerdown' && !headerRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [isOpen]);
  return <header ref={headerRef} className="site-header" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  }}>
      <a className="skip-link" href="#main-content">{t("דילוג לתוכן המרכזי")}</a>
      <div className="container header-inner">
        <Link className="brand" to="/" aria-label={t("דף הבית")}>
          <span className="brand-mark">RE</span>
          <span>
            <span className="brand-name">{t(siteInfo.name)}</span>
            <span className="brand-subtitle">{t(siteInfo.latinName)}</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label={t("ניווט ראשי")}>
          {mainNavigation.map(item => <NavLink key={item.path} to={item.path} className={({
          isActive
        }) => isActive ? "active" : undefined}>
              {t(item.label)}
            </NavLink>)}
        </nav>

        <div className="header-actions">
          <LanguageControl />
          <a className="phone-link" href={`tel:${siteInfo.phone}`} aria-label={t("התקשרו אלינו: {0}", {
          "0": siteInfo.phone
        })}>
            <Phone size={18} aria-hidden="true" />
            <span dir="ltr">{t(siteInfo.phone)}</span>
          </a>
          <button ref={menuButtonRef} className="icon-button mobile-menu-button" type="button" aria-label={t(isOpen ? "סגירת תפריט" : "פתיחת תפריט")} aria-controls="mobile-navigation" aria-expanded={isOpen} onClick={() => setIsOpen(current => !current)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      <MobileNav isOpen={isOpen} onSelect={() => setIsOpen(false)} />
    </header>;
}
