import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useId, useRef, useState } from 'react';
import VideoCard from './VideoCard.jsx';
const PAGE_SIZE = 8;
export default function VideoLibrary({
  videos
}) {
  const {
    t
  } = useLocale();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeId, setActiveId] = useState(null);
  const gridRef = useRef(null);
  const gridId = useId();
  const matches = videos.filter(video => t(video.title).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const visible = matches.slice(0, visibleCount);
  function updateSearch(event) {
    setQuery(event.target.value);
    setVisibleCount(PAGE_SIZE);
    setActiveId(null);
  }
  function showMore() {
    setVisibleCount(count => count + PAGE_SIZE);
    requestAnimationFrame(() => {
      gridRef.current?.children[visibleCount]?.querySelector('button')?.focus({
        preventScroll: true
      });
    });
  }
  return <div className="video-library">
    <label className="video-search">{t("חיפוש בסרטונים")}<input type="search" value={query} onChange={updateSearch} placeholder={t("חפשו לפי כותרת, יעד או מדריך")} aria-controls={gridId} />
    </label>
    <p className="gallery-count" role="status">{t('מציגים {shown} מתוך {total} סרטונים', {
        shown: visible.length,
        total: matches.length
      })}</p>
    <div id={gridId} ref={gridRef} className="video-grid">
      {visible.map(video => <VideoCard key={video.id} video={video} active={activeId === video.id} onPlay={setActiveId} />)}
    </div>
    {matches.length === 0 && <p>{t("לא נמצאו סרטונים מתאימים. נסו לחפש במילים אחרות.")}</p>}
    {visible.length < matches.length && <button className="primary-button section-link" onClick={showMore} aria-controls={gridId}>{t("הצגת סרטונים נוספים")}</button>}
  </div>;
}
