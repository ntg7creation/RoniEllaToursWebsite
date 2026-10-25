import { useLocale } from "../../i18n/LocaleContext.jsx";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { footerNavigation, mainNavigation } from "../../content/navigation.js";
import { siteInfo } from "../../content/site.js";
export default function Footer() {
  const {
    t
  } = useLocale();
  return <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-brand">{t(siteInfo.name)}</p>
          <p>{t("טיולי בוטיק גאוגרפיים ולימודיים. מסעות אל התרבויות, האנשים והסיפורים של העולם העתיק.")}</p>
        </div>
        <div>
          <h2>{t("ניווט")}</h2>
          <ul className="footer-links">
            {mainNavigation.map(item => <li key={item.path}>
                <Link to={item.path}>{t(item.label)}</Link>
              </li>)}
          </ul>
        </div>
        <div>
          <h2>{t("מידע")}</h2>
          <ul className="footer-links">
            {footerNavigation.map(item => <li key={item.path}>
                <Link to={item.path}>{t(item.label)}</Link>
              </li>)}
          </ul>
        </div>
        <address className="footer-contact">
          <h2>{t("יצירת קשר")}</h2>
          <a href={`tel:${siteInfo.phone}`}>
            <Phone size={18} aria-hidden="true" />
            <bdi dir="ltr">{t(siteInfo.phone)}</bdi>
          </a>
          <a href={`mailto:${siteInfo.email}`}>
            <Mail size={18} aria-hidden="true" />
            <bdi dir="ltr">{t(siteInfo.email)}</bdi>
          </a>
          <span>
            <MapPin size={18} aria-hidden="true" />
            {t(siteInfo.address)}
          </span>
        </address>
      </div>
    </footer>;
}
