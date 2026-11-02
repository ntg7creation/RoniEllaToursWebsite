import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";
import type { PublicSiteContent, SitePage } from "@roniella/shared/site-content";

export function GalleryPage({ page, content, total }: { page: SitePage; content: PublicSiteContent; total: number }) {
  const gallery = content.gallery;
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const photos = gallery?.photos ?? [];
  const active = selected === null ? null : photos[selected];
  useEffect(() => {
    if (active && !dialog.current?.open) dialog.current?.showModal();
  }, [active]);
  useEffect(() => {
    dialog.current?.close();
    setSelected(null);
  }, [gallery]);
  const step = (direction: number) => setSelected(index => index === null ? null : (index + direction + photos.length) % photos.length);
  return (
    <article className="gallery-page">
      <header className="gallery-heading">
        <div>
          <p className="editorial-kicker">{gallery?.heading ?? "רגעים מהמסעות שלנו"}</p>
          <h1>{page.title}</h1>
          <p className="gallery-introduction">{gallery?.introduction}</p>
        </div>
        {gallery && <div className="gallery-actions">
          {photos.length > 0 && <Form method="get" action={page.path} preventScrollReset>
            <button className="button" type="submit">{gallery.shuffleLabel} <span aria-hidden="true">↻</span></button>
          </Form>}
          <a className="editorial-text-link" href={gallery.albumUrl} rel="noreferrer">{gallery.openAlbumLabel} <span aria-hidden="true">↗</span></a>
        </div>}
      </header>
      {photos.length > 0 ? <>
        <div className="gallery-note">
          <p>{gallery?.sourceLabel}</p>
          <p>{photos.length} מתוך {total} תצלומים <span aria-hidden="true">·</span> לחצו על תמונה להגדלה</p>
        </div>
        <div className="gallery-wall">
          {photos.map((photo, index) => <figure className="gallery-memory" key={photo.id} data-photo-id={photo.id}>
            <a href={photo.src} aria-label={`הגדלת תמונה: ${photo.alt}`} onClick={event => {
              if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); setSelected(index);
            }}>
              <img src={photo.src} srcSet={photo.variants.map(variant => `${variant.src} ${variant.width}w`).join(", ")}
                sizes="(max-width: 560px) 90vw, (max-width: 900px) 42vw, 28vw"
                width={photo.width} height={photo.height} alt={photo.alt}
                loading={index < 2 ? "eager" : "lazy"} decoding="async" />
              <span className="gallery-enlarge" aria-hidden="true">הגדלה ↗</span>
            </a>
          </figure>)}
        </div>
        <div className="gallery-ending">
          <p>יש עוד הרבה רגעים לגלות.</p>
          <Form method="get" action={page.path}>
            <button className="button" type="submit">{gallery?.shuffleLabel} <span aria-hidden="true">↻</span></button>
          </Form>
          <Link to="/tours/" className="editorial-text-link">למסעות הבאים שלנו <span aria-hidden="true">←</span></Link>
        </div>
      </> : <p className="empty-state">התמונות יופיעו כאן לאחר עדכון האלבום. בינתיים אפשר לבקר באלבום המלא.</p>}
      <dialog ref={dialog} className="gallery-viewer" aria-labelledby="gallery-photo-title"
        onClose={() => setSelected(null)}
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        onKeyDown={event => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault(); step(event.key === "ArrowLeft" ? 1 : -1);
          }
        }}>
        <div className="gallery-viewer-content">
          <div className="gallery-viewer-toolbar">
            <h2 id="gallery-photo-title">{selected === null ? "תצלום מהמסע" : `תמונה ${selected + 1} מתוך ${photos.length}`}</h2>
            <button type="button" autoFocus onClick={() => dialog.current?.close()}>סגירה <span aria-hidden="true">×</span></button>
          </div>
          {active && <img src={active.src} alt={active.alt} width={active.width} height={active.height} />}
          <div className="gallery-viewer-navigation">
            <button type="button" onClick={() => step(-1)}>→ התמונה הקודמת</button>
            <button type="button" onClick={() => step(1)}>התמונה הבאה ←</button>
          </div>
        </div>
      </dialog>
    </article>
  );
}
