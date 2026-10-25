import { useLocale } from "../../i18n/LocaleContext.jsx";
import { CalendarDays, CircleDollarSign, Clock, UserRound } from "lucide-react";
export default function TourFacts({
  tour
}) {
  const {
    t
  } = useLocale();
  const facts = [{
    icon: Clock,
    label: "משך",
    value: tour.duration
  }, {
    icon: UserRound,
    label: "מדריכים",
    value: tour.guides
  }, {
    icon: CalendarDays,
    label: "יציאה",
    value: tour.departure || "לפרטים, צרו קשר",
    temporary: !tour.departure
  }, {
    icon: CircleDollarSign,
    label: "מחיר",
    value: tour.price || "לפרטים, צרו קשר",
    temporary: !tour.price
  }];
  return <dl className="facts-grid">
      {facts.map(fact => {
      const Icon = fact.icon;
      return <div key={fact.label} className={fact.temporary ? "is-temporary" : ""}>
            <dt>
              <Icon size={18} aria-hidden="true" />
              {t(fact.label)}
            </dt>
            <dd><bdi>{t(fact.value)}</bdi></dd>
          </div>;
    })}
    </dl>;
}
