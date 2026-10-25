import { useLocale } from "../i18n/LocaleContext.jsx";
import { ArrowDown, ArrowLeft, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import GoogleReviews from '../components/ui/GoogleReviews.jsx';
import VideoCard from '../components/ui/VideoCard.jsx';
import { travelerRecommendations } from '../content/reviews.js';
import '../styles/gallery.css';
import '../styles/reviews.css';
function TravelerStory({
  item
}) {
  const {
    t
  } = useLocale();
  if (item.type === 'written') return <article className="traveler-written">
    <blockquote dir="auto">{t(item.text)}</blockquote>
    <p><bdi>{t(item.name)}</bdi>{item.destination && <> / {t(item.destination)}</>}</p>
  </article>;
  return <article className={`traveler-film ${item.format === 'landscape' ? 'is-landscape' : 'is-portrait'}`}>
    <div className="traveler-film-player">
      {item.youtubeId ? <VideoCard video={{
        id: item.youtubeId,
        title: item.title
      }} /> : <video controls playsInline preload="none" poster={item.poster} aria-label={t(item.title)}>
          <source src={item.src} type={item.mimeType || 'video/mp4'} />
          {item.captionsSrc && <track kind="captions" src={item.captionsSrc} srcLang="he" label={t("עברית")} default />}{t("הדפדפן אינו תומך בניגון הסרטון.")}</video>}
    </div>
    <div className="traveler-film-caption">
      {!item.youtubeId && <h3>{t(item.title)}</h3>}
      <p><bdi>{t(item.name)}</bdi>{item.destination && <> / {t(item.destination)}</>}</p>
    </div>
  </article>;
}
export default function ReviewsPage() {
  const {
    t
  } = useLocale();
  return <div className="recommendations-page">
    <header className="recommendations-hero">
      <div className="container recommendations-hero-inner">
        <div className="recommendations-heading">
          <p className="eyebrow">{t("טיולי העולם העתיק · המטיילים מספרים")}</p>
          <h1>{t("המלצות")}<span>{t("קולות מהדרך.")}</span></h1>
          <p className="recommendations-lead">{t("האנשים, המקומות והרגעים שלוקחים הביתה.")}<br />{t("כאן נותנים למטיילים לספר.")}</p>
          <div className="recommendations-jumps">
            <a href="#google-reviews">{t("ביקורות Google")}<ArrowDown size={18} aria-hidden="true" /></a>
            <a href="#traveler-stories">{t("סיפורי מטיילים")}<ArrowDown size={18} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="recommendations-art" aria-hidden="true">
          <svg className="story-trail" viewBox="0 0 500 470" fill="none"><path d="M15 315C135 430 30 90 230 90S480 345 310 390S410 530 492 350" /><circle cx="230" cy="90" r="6" /><circle cx="310" cy="390" r="6" /></svg>
          <div className="story-arch"><span>{t("״")}</span><p>{t("כל מסע.")}<br />{t("והסיפור שלו.")}</p></div>
          <span className="story-note">{t("זיכרונות שנשארים")}</span>
          <span className="story-stamp">{t("מהדרך")}<br />{t("אל הלב")}</span>
        </div>
      </div>
    </header>
    <section className="recommendations-google" id="google-reviews" tabIndex={-1} aria-labelledby="google-reviews-heading">
      <div className="container recommendations-google-inner">
        <div className="recommendations-margin">
          <span className="story-section-number" aria-hidden="true">{t("01 / במילים")}</span>
          <h2 id="google-reviews-heading">{t("מה מספרים")}<br />{t(" אחרי שחוזרים?")}</h2>
          <p>{t("ביקורות המטיילים שלנו ב־")}<span dir="ltr">Google</span>.</p>
          <span className="margin-flourish" aria-hidden="true">↙</span>
        </div>
        <GoogleReviews />
      </div>
    </section>
    <section className="recommendations-films" id="traveler-stories" tabIndex={-1} aria-labelledby="traveler-stories-heading">
      <div className="container">
        <div className="films-intro">
          <div><span className="story-section-number">{t("02 / בקולם")}</span><h2 id="traveler-stories-heading">{t("יש דברים שטוב לשמוע.")}</h2></div>
          <p>{t("החיוך, ההתרגשות, הרגע שנשאר.")}<br />{t("סיפורים קצרים מהאנשים שהיו שם.")}</p>
        </div>
        {travelerRecommendations.length ? <div className="traveler-film-strip">
          {travelerRecommendations.map(item => <TravelerStory key={item.id} item={item} />)}
        </div> : <div className="films-coming-soon">
          <div className="film-silhouette" aria-hidden="true"><Mic size={54} strokeWidth={1} /><span>{t("קולות")}<br />{t("מהדרך")}</span><i /></div>
          <div className="films-coming-copy"><span className="eyebrow">{t("בקרוב כאן")}</span><h3>{t("המטיילים,")}<br />{t("במילים שלהם.")}</h3><p>{t("סרטונים קצרים מהטיולים שלנו יתווספו כאן בהמשך.")}</p></div>
        </div>}
      </div>
    </section>
    <section className="recommendations-invitation container">
      <div><p className="eyebrow">{t("המסע הבא שלכם")}</p><h2>{t("אולי הסיפור הבא יהיה שלכם?")}</h2></div>
      <Link className="primary-button" to="/tours">{t("לגלות את הטיולים")}<ArrowLeft size={20} aria-hidden="true" /></Link>
    </section>
  </div>;
}
