import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MessageCircle, RotateCcw, Star } from 'lucide-react';
import { googleReviewsUrl } from '../../content/reviews.js';
function Stars({
  rating
}) {
  const {
    t
  } = useLocale();
  if (!rating) return null;
  return <span className="review-stars" aria-label={t("{0} מתוך 5 כוכבים", {
    "0": rating
  })}>
    {[1, 2, 3, 4, 5].map(value => <Star key={value} size={16} fill={value <= Math.round(rating) ? 'currentColor' : 'none'} aria-hidden="true" />)}
  </span>;
}
function Review({
  review
}) {
  const {
    t,
    contentLanguage
  } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const long = review.text.length > 420;
  const text = long && !expanded ? `${review.text.slice(0, 420)}…` : review.text;
  return <article className="google-story">
    <div className="google-story-meta"><Stars rating={review.rating} />{review.date && <time dateTime={review.date}>{new Date(review.date).toLocaleDateString(contentLanguage)}</time>}</div>
    {review.text ? <blockquote dir="auto">{text}</blockquote> : <p className="rating-only">{t("דירוג ללא תגובה כתובה")}</p>}
    {long && <button type="button" className="review-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t(expanded ? 'פחות' : 'להמשך הביקורת')}</button>}
    <footer><strong><bdi>{review.author}</bdi></strong><span>{t("ביקורת Google")}</span></footer>
  </article>;
}
export default function GoogleReviews() {
  const {
    t
  } = useLocale();
  const [feed, setFeed] = useState(null);
  const [status, setStatus] = useState('loading');
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const moreController = useRef(null);
  const refreshing = useRef(false);
  useEffect(() => {
    const current = ++generation.current;
    let controller;
    let active = false;
    let disposed = false;
    setStatus('loading');
    setMoreError(false);
    setMoreLoading(false);
    const refresh = async () => {
      if (document.hidden || active || moreController.current) return;
      active = true;
      refreshing.current = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('/api/google-reviews', {
          signal: controller.signal,
          cache: 'no-store'
        });
        const data = await response.json();
        if (data.code === 'NOT_CONFIGURED') {
          if (!disposed && current === generation.current) setStatus('unconfigured');
          return;
        }
        if (!response.ok) throw new Error('Unavailable');
        if (!Array.isArray(data.reviews)) throw new Error('Invalid response');
        if (disposed || current !== generation.current) return;
        setFeed(data);
        setStatus('ready');
      } catch {
        if (!disposed && current === generation.current) setStatus('error');
      } finally {
        clearTimeout(timeout);
        active = false;
        if (current === generation.current) refreshing.current = false;
      }
    };
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      generation.current += 1;
      refreshing.current = false;
      controller?.abort();
      moreController.current?.abort();
      moreController.current = null;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt]);
  const loadMore = async () => {
    if (!feed?.nextPageToken || moreController.current || refreshing.current) return;
    const current = generation.current;
    const controller = new AbortController();
    moreController.current = controller;
    setMoreLoading(true);
    setMoreError(false);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/google-reviews?pageToken=${encodeURIComponent(feed.nextPageToken)}`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Unavailable');
      const next = await response.json();
      if (!Array.isArray(next.reviews)) throw new Error('Invalid response');
      if (current !== generation.current) return;
      setFeed(previous => ({
        ...next,
        reviews: [...previous.reviews, ...next.reviews.filter(review => !previous.reviews.some(existing => existing.id === review.id))]
      }));
    } catch {
      if (current === generation.current) setMoreError(true);
    } finally {
      clearTimeout(timeout);
      if (current === generation.current) {
        moreController.current = null;
        setMoreLoading(false);
      }
    }
  };
  return <div className="google-reviews-live" aria-busy={status === 'loading'}>
    <div className="google-source-heading">
      <span className="google-source-label" dir="ltr">Google</span>
      {feed && <span className="google-score"><strong>{t(feed.averageRating?.toFixed(1))}</strong><span>{t(feed.totalReviewCount)}{t(" ביקורות")}</span></span>}
      <a href={googleReviewsUrl} target="_blank" rel="noopener noreferrer" className="text-link">{t("לביקורות ב־Google")}<ExternalLink size={17} aria-hidden="true" /><span className="sr-only">{t(" (בחלון חדש)")}</span></a>
    </div>
    {status === 'loading' && !feed && <p className="google-reviews-notice" role="status">{t("טוענים ביקורות מ־Google…")}</p>}
    {status === 'unconfigured' && !feed && <div className="google-reviews-notice"><MessageCircle size={38} strokeWidth={1.2} aria-hidden="true" /><h3>{t("הסיפורים שלהם, במילים שלהם.")}</h3><p>{t("מוזמנים לקרוא את חוויות המטיילים בעמוד שלנו ב־Google.")}</p></div>}
    {status === 'error' && <div className="google-reviews-notice" role="status">
      <MessageCircle size={32} strokeWidth={1.2} aria-hidden="true" />
      <p>{t(feed ? 'לא הצלחנו לרענן את הביקורות כרגע. מוצגות הביקורות שנטענו קודם.' : 'הביקורות אינן זמינות כאן כרגע. אפשר לקרוא אותן ישירות ב־Google.')}</p>
      <button className="text-link review-retry" type="button" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={18} aria-hidden="true" />{t("ניסיון נוסף")}</button>
    </div>}
    {feed && <>
      <p className="google-order">{t("לפי העדכון האחרון · כפי שפורסם ב־Google")}</p>
      <div className="google-stories">{feed.reviews.map(review => <Review review={review} key={review.id} />)}</div>
      {!feed.reviews.length && <p role="status">{t("עדיין אין ביקורות להצגה.")}</p>}
      {feed.nextPageToken && <button type="button" className="text-link review-retry" disabled={moreLoading} onClick={loadMore}>{t(moreLoading ? 'טוענים ביקורות נוספות…' : 'ביקורות נוספות')}</button>}
      {moreError && <p role="status">{t("לא הצלחנו לטעון ביקורות נוספות. אפשר לנסות שוב.")}</p>}
    </>}
  </div>;
}
