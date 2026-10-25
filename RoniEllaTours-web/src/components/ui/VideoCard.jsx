import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useEffect, useRef, useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';
export default function VideoCard({
  video,
  active,
  onPlay
}) {
  const {
    t
  } = useLocale();
  const [localPlaying, setLocalPlaying] = useState(false);
  const playing = active ?? localPlaying;
  const [imageFailed, setImageFailed] = useState(false);
  const playerRef = useRef(null);
  useEffect(() => {
    if (playing) playerRef.current?.focus();
  }, [playing]);
  return <article className="video-card">
      <div className="video-frame">
        {playing ? <iframe ref={playerRef} src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`} title={t(video.title)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <button className="video-poster" onClick={() => onPlay ? onPlay(video.id) : setLocalPlaying(true)} aria-label={t("ניגון: {0}", {
        "0": video.title
      })}>
            <img src={imageFailed ? '/placeholders/hero-culture.svg' : `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} onError={() => setImageFailed(true)} alt={""} loading="lazy" width="480" height="360" />
            <span className="video-play"><Play aria-hidden="true" fill="currentColor" size={28} /></span>
            <span className="video-play-label">{t("לצפייה בסרטון")}</span>
          </button>}
      </div>
      <div className="video-caption">
        <h3>{t(video.title)}</h3>
        <a className="text-link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">{t("צפייה ב־YouTube ")}<ExternalLink size={17} aria-hidden="true" /><span className="sr-only">{t(" (בחלון חדש)")}</span>
        </a>
      </div>
    </article>;
}
