import { useLocale } from "../i18n/LocaleContext.jsx";
import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Section from '../components/ui/Section.jsx';
import VideoLibrary from '../components/ui/VideoLibrary.jsx';
import ImageViewer from '../components/ui/ImageViewer.jsx';
import { galleryAlbums, mixedGalleryImages } from '../content/gallery.js';
import { videos } from '../content/videos.js';
import '../styles/gallery.css';
export default function GalleryPage() {
  const {
    t
  } = useLocale();
  const [selected, setSelected] = useState('all');
  const [viewer, setViewer] = useState(null);
  const albums = selected === 'all' ? [{
    id: 'all',
    images: mixedGalleryImages
  }] : galleryAlbums.filter(album => album.id === selected);
  const total = albums.reduce((count, album) => count + album.images.length, 0);
  return <>
    <PageHeader eyebrow={t("רגעים מהמסע")} title={t("גלריה")} description={t("סין, יוון, מצרים ואוזבקיסטן — מבט אל היעדים שלנו.")} />
    <Section className="gallery-section">
      <div className="gallery-intro">
        <div><h2>{t("המסעות שלנו בתמונות")}</h2><p>{t("איורים להמחשה, עד להוספת התמונות מהטיולים.")}</p></div>
        <a className="text-link" href="#videos">{t("לסרטונים שלנו ↓")}</a>
      </div>
      <div className="gallery-filters" role="group" aria-label={t("סינון תמונות לפי יעד")}>
        {[{
          id: 'all',
          title: 'הכל'
        }, ...galleryAlbums].map(album => <button key={album.id} aria-pressed={selected === album.id} onClick={() => setSelected(album.id)}>
            {t(album.title)}
          </button>)}
      </div>
      <p className="sr-only" role="status">{t(total)}{t(" תמונות להמחשה")}</p>
      {albums.map(album => <section className="gallery-album" key={album.id} aria-label={t(album.id === 'all' ? 'כל התמונות' : undefined)} aria-labelledby={album.id === 'all' ? undefined : `album-${album.id}`}>
        {album.id !== 'all' && <div className="album-heading"><h2 id={`album-${album.id}`}>{t(album.title)}</h2></div>}
        <div className="gallery-grid">
          {album.images.map((image, index) => <button className={`gallery-image${image.placeholder ? ' is-placeholder' : ''}`} style={image.placeholder ? {
            '--tile-ratio': image.ratio
          } : undefined} key={image.id} onClick={() => setViewer({
            images: album.images,
            index
          })} aria-label={t("הגדלת תמונה: {0}", {
            "0": image.alt
          })}>
            <img src={image.src} alt={t(image.alt)} loading="lazy" />
          </button>)}
        </div>
      </section>)}
    </Section>
    <Section id="videos" className="soft-band" eyebrow={t("בואו לראות מקרוב")} title={t("הסרטונים שלנו")}>
      <VideoLibrary videos={videos} />
    </Section>
    {viewer && <ImageViewer {...viewer} onChange={index => setViewer(current => ({
      ...current,
      index
    }))} onClose={() => setViewer(null)} />}
  </>;
}
