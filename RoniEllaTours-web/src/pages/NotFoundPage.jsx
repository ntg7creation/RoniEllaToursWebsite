import { useLocale } from "../i18n/LocaleContext.jsx";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import Section from "../components/ui/Section.jsx";
export default function NotFoundPage() {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("404")} title={t("העמוד לא נמצא")} description={t("ייתכן שהקישור עדיין לא הועבר לאתר החדש.")} />
      <Section>
        <Link className="primary-button" to="/">{t("חזרה לדף הבית")}</Link>
      </Section>
    </>;
}
