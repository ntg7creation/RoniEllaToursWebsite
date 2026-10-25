import { useLocale } from "../i18n/LocaleContext.jsx";
import { Link, useParams } from "react-router-dom";
import InterestForm from "../components/forms/InterestForm.jsx";
import RegistrationForm from "../components/forms/RegistrationForm.jsx";
import ItineraryDay from "../components/tours/ItineraryDay.jsx";
import TourFacts from "../components/tours/TourFacts.jsx";
import PlaceholderImage from "../components/ui/PlaceholderImage.jsx";
import Section from "../components/ui/Section.jsx";
import { getTourBySlug } from "../content/tours.js";
import NotFoundPage from "./NotFoundPage.jsx";
export default function TourDetailPage() {
  const {
    t
  } = useLocale();
  const {
    slug
  } = useParams();
  const tour = getTourBySlug(slug);
  if (!tour) {
    return <NotFoundPage />;
  }
  return <>
      <section className="tour-hero">
        <div className="container tour-hero-grid">
          <div className="text-stack">
            <p className="eyebrow">{t(tour.country)}</p>
            <h1>{t(tour.title)}</h1>
            <p>{t(tour.teaser)}</p><a className="text-link" href="#itinerary">{t("למסלול היומי ↓")}</a>
          </div>
          <PlaceholderImage src={tour.image} alt={t("איור להמחשה: {0}", {
          "0": tour.title
        })} label={t("תמונה זמנית - תוחלף במדיה מקורית")} />
        </div>
      </section>

      <Section>
        <TourFacts tour={tour} />
      </Section>

      <Section className="soft-band">
        <div className="tour-content-layout">
          <article className="rich-content">
            <h2>{t("על הטיול")}</h2>
            {tour.intro.map(paragraph => <p key={paragraph}>{t(paragraph)}</p>)}
            <h2>{t("נקודות מרכזיות")}</h2>
            <ul className="check-list">
              {tour.highlights.map(highlight => <li key={highlight}>{t(highlight)}</li>)}
            </ul>
          </article>
          <aside className="aside-panel">
            <h2>{t("רוצים לדעת עוד?")}</h2>
            <InterestForm compact />
          </aside>
        </div>
      </Section>

      <Section id="itinerary" eyebrow={t("מסלול יומי")} title={t("מסלול הטיול")}>
        {tour.itinerary.length > 0 ? <div className="itinerary-list">
            {tour.itinerary.map(item => <ItineraryDay key={`${tour.slug}-${item.day}`} item={item} />)}
          </div> : <div className="placeholder-panel">
            <p>{t("לפרטי המסלול המלא, מוזמנים ליצור איתנו קשר.")}</p>
          </div>}
      </Section>

      <Section className="soft-band" eyebrow={t("מחיר ותנאים")} title={t("תנאים ועלויות")}>
        <div className="split-layout">
          <div className="rich-content">
            <h3>{t("תאריכי יציאה ומחירים")}</h3>
            <p dir="auto">{t(tour.departure || "למועדי היציאה, צרו איתנו קשר.")}</p>
            <p>{t(tour.price || "לקבלת המחיר ופרטי הטיול, צרו איתנו קשר.")}</p>
            {tour.priceNotes.map(note => <p key={note}>{t(note)}</p>)}
          </div>
          <div className="two-column-lists">
            <div>
              <h3>{t("המחיר כולל")}</h3>
              {tour.included.length > 0 ? <ul>
                  {tour.included.map(item => <li key={item}>{t(item)}</li>)}
                </ul> : <p>{t("לפרטים המלאים, צרו איתנו קשר.")}</p>}
            </div>
            <div>
              <h3>{t("המחיר לא כולל")}</h3>
              {tour.notIncluded.length > 0 ? <ul>
                  {tour.notIncluded.map(item => <li key={item}>{t(item)}</li>)}
                </ul> : <p>{t("לפרטים המלאים, צרו איתנו קשר.")}</p>}
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow={t("טופס הרשמה לטיול")} title={t("מתעניינים בהרשמה?")}>
        <RegistrationForm tourTitle={tour.title} />
        <p className="form-footnote">{t("הטופס אינו שולח או שומר נתונים. ")}<Link to="/privacy-policy">{t("מדיניות פרטיות")}</Link>
        </p>
      </Section>
    </>;
}
