import { useLocale } from "../i18n/LocaleContext.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import TourCard from "../components/tours/TourCard.jsx";
import { tourListingSource, tours } from "../content/tours.js";
export default function ToursPage() {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("מסעות תרבות והיסטוריה")} title={t("הטיולים שלנו")} description={t("בחרו את המסע שלכם — סין, אוזבקיסטן וצפון יוון, עם הדרכה בעברית.")} source={tourListingSource} />
      <section className="section">
        <div className="container">
          <div className="card-grid">
            {tours.map(tour => <TourCard key={tour.slug} tour={tour} />)}
          </div>
        </div>
      </section>
    </>;
}
