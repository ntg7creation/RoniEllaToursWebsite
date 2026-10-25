import { useLocale } from "../i18n/LocaleContext.jsx";
import { Mail, MapPin, Phone } from "lucide-react";
import ContactForm from "../components/forms/ContactForm.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Section from "../components/ui/Section.jsx";
import { contactPage } from "../content/pages.js";
import { siteInfo } from "../content/site.js";
export default function ContactPage() {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("דברו איתנו")} title={t(contactPage.title)} description={t(contactPage.contactText)} source={contactPage.source} />
      <Section>
        <div className="contact-layout">
          <div className="contact-details">
            <h2>{t("יש לכם שאלות?")}</h2>
            <p>{t(contactPage.intro)}</p>
            <a href={`tel:${siteInfo.phone}`}>
              <Phone size={20} aria-hidden="true" />
              <bdi dir="ltr">{t(siteInfo.phone)}</bdi>
            </a>
            <a href={`mailto:${siteInfo.email}`}>
              <Mail size={20} aria-hidden="true" />
              <bdi dir="ltr">{t(siteInfo.email)}</bdi>
            </a>
            <span>
              <MapPin size={20} aria-hidden="true" />
              {t(siteInfo.address)}
            </span>
          </div>
          <ContactForm />
        </div>
      </Section>
    </>;
}
