import { useLocale } from "../../i18n/LocaleContext.jsx";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
export default function TourCard({
  tour
}) {
  const {
    t
  } = useLocale();
  return <article className="tour-card">
      <img src={tour.image} alt={t("איור להמחשה: {0}", {
      "0": tour.title
    })} />
      <div className="card-content">
        <p className="card-meta">
          <MapPin size={17} aria-hidden="true" />
          {t(tour.country)}
        </p>
        <h3>{t(tour.title)}</h3>
        <p>{t(tour.teaser)}</p>
        <p className="card-meta">
          <CalendarDays size={17} aria-hidden="true" />
          {t(tour.duration)}
        </p>
        <Link className="text-link" to={`/tours/${tour.slug}`}>{t("לפרטי הטיול")}<ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>;
}
