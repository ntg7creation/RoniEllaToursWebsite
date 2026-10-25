import { useLocale } from "../../i18n/LocaleContext.jsx";
import { NavLink } from "react-router-dom";
import { mainNavigation } from "../../content/navigation.js";
export default function MobileNav({
  isOpen,
  onSelect
}) {
  const {
    t
  } = useLocale();
  return <nav id="mobile-navigation" className={`mobile-nav ${isOpen ? "is-open" : ""}`} aria-label={t("ניווט מובייל")} hidden={!isOpen}>
      <div className="container mobile-nav-inner">
        {mainNavigation.map(item => <NavLink key={item.path} to={item.path} onClick={onSelect} className={({
        isActive
      }) => isActive ? "active" : undefined}>
            {t(item.label)}
          </NavLink>)}
      </div>
    </nav>;
}
