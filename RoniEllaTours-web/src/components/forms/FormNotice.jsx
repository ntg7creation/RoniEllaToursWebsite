import { useLocale } from "../../i18n/LocaleContext.jsx";
import { Link } from 'react-router-dom';
import { siteInfo } from '../../content/site.js';
export default function FormNotice() {
  const {
    t
  } = useLocale();
  return <p className="form-footnote">{t("שליחת טפסים אינה זמינה כרגע. הפרטים שתמלאו לא יישלחו ולא יישמרו.")}{' '}{t("לפנייה או להרשמה,")}{' '}<a href={`tel:${siteInfo.phone}`}>{t("התקשרו אלינו")}</a>
    {' '}{t("או")}{' '}<a href={`mailto:${siteInfo.email}`}>{t("כתבו לנו במייל")}</a>.
    {' '}<Link to="/privacy-policy">{t("מדיניות פרטיות")}</Link>
  </p>;
}
