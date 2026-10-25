import { useLocale } from "../i18n/LocaleContext.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Section from "../components/ui/Section.jsx";
import { aboutPage } from "../content/pages.js";
import { whyTravelWithUs } from "../content/site.js";
export default function AboutPage() {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("טיולי העולם העתיק")} title={t(aboutPage.title)} description={t(aboutPage.eyebrow)} source={aboutPage.source} />
      <Section>
        <div className="rich-content">
          {aboutPage.intro.map(paragraph => <p key={paragraph}>{t(paragraph)}</p>)}
        </div>
      </Section>
      <Section className="soft-band" title={t(whyTravelWithUs.title)}>
        <div className="benefit-grid">
          {whyTravelWithUs.points.map(point => <div className="benefit-item" key={point}>
              <span>{t(point)}</span>
            </div>)}
        </div>
      </Section>
    </>;
}
