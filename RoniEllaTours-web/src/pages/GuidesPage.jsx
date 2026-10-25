import { useLocale } from "../i18n/LocaleContext.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Section from "../components/ui/Section.jsx";
import { guides, guidesIntro } from "../content/guides.js";
export default function GuidesPage() {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("צוות מדריכים מקצועי ומיומן")} title={t("המדריכים שלנו")} description={t(guidesIntro.text)} source={guidesIntro.source} />
      <Section eyebrow={t("נעים להכיר")}>
        <div className="guide-grid">
          {guides.map(guide => <article className="guide-card" key={guide.id}>
              <img src={guide.image} alt={t("איור להמחשה: {0}", {
            "0": guide.name
          })} />
              <div>
                <h2>{t(guide.name)}</h2>
                <p className="guide-title">{t(guide.title)}</p>
                <p>{t(guide.bio)}</p>
              </div>
            </article>)}
        </div>
      </Section>
    </>;
}
