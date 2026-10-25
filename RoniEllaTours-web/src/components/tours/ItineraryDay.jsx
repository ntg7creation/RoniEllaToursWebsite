import { useLocale } from "../../i18n/LocaleContext.jsx";
export default function ItineraryDay({
  item
}) {
  const {
    t
  } = useLocale();
  return <article className={`itinerary-day ${item.isTemporary ? "is-temporary" : ""}`}>
      <div className="itinerary-marker" aria-hidden="true">
        {t(item.day)}
      </div>
      <div>
        <p className="eyebrow">{t('יום {number}', { number: item.day })}</p>
        <h3>{t(item.title)}</h3>
        {item.body.map(paragraph => <p key={paragraph}>{t(paragraph)}</p>)}
      </div>
    </article>;
}
