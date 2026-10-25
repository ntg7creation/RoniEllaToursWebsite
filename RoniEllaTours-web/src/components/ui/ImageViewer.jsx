import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
export default function ImageViewer({
  images,
  index,
  onChange,
  onClose
}) {
  const {
    t, direction
  } = useLocale();
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      dialog.close();
    };
  }, []);
  const move = delta => onChange((index + delta + images.length) % images.length);
  const dismiss = () => {
    // Close while connected so the native dialog restores focus to its opener.
    dialogRef.current.close();
    onClose();
  };
  return <dialog ref={dialogRef} className="image-viewer" aria-labelledby="viewer-caption" onCancel={event => {
    event.preventDefault();
    dismiss();
  }} onClick={event => {
    if (event.target === event.currentTarget) dismiss();
  }} onKeyDown={event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(direction === 'rtl' ? 1 : -1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(direction === 'rtl' ? -1 : 1);
    }
  }}>
      <div className="viewer-panel">
        <div className="viewer-toolbar">
          <span className="sr-only" aria-live="polite">{t('תמונה {number} מתוך {total}', { number: index + 1, total: images.length })}</span>
          <button className="icon-button" onClick={dismiss} aria-label={t("סגירת תמונה")} autoFocus><X aria-hidden="true" /></button>
        </div>
        <img src={images[index].src} alt={t(images[index].alt)} />
        <div className="viewer-footer">
          <button className="icon-button" onClick={() => move(-1)} aria-label={t("התמונה הקודמת")}><ChevronRight aria-hidden="true" /></button>
          <p id="viewer-caption">{t(images[index].caption)}</p>
          <button className="icon-button" onClick={() => move(1)} aria-label={t("התמונה הבאה")}><ChevronLeft aria-hidden="true" /></button>
        </div>
      </div>
    </dialog>;
}
