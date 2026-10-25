import { useLocale } from "../i18n/LocaleContext.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Section from "../components/ui/Section.jsx";
export default function LegalPage({
  page
}) {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("מידע משפטי ונגישות")} title={t(page.title)} description={t(page.lead)} source={page.source} />
      <Section>
        <article className="rich-content">
          {page.sections.map(section => <section key={section.heading} className="legal-section">
              <h2>{t(section.heading)}</h2>
              {section.paragraphs.map(paragraph => <p key={paragraph}>{t(paragraph)}</p>)}
            </section>)}
        </article>
      </Section>
    </>;
}
