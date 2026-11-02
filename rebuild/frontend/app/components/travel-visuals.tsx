import type { SitePage } from "@roniella/shared/site-content";
import { useSiteContent } from "./site-content-context";

export type PhotoName = string;

export function Photograph({ name, priority = false, className = "" }: {
  name: PhotoName; priority?: boolean; className?: string;
}) {
  const photo = useSiteContent().media.find(asset => asset.id === name);
  if (!photo) throw Error(`Missing media asset: ${name}`);
  return (
    <figure className={`editorial-photograph ${className}`}>
      <img src={photo.src}
        srcSet={photo.variants.map(variant => `${variant.src} ${variant.width}w`).join(", ")}
        sizes={photo.sizes}
        width={photo.width} height={photo.height}
        alt={photo.alt} loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"} decoding="async" />
      <figcaption>
        <span>{photo.caption}</span>
        <details className="photo-credit">
          <summary>צילום ורישיון</summary>
          <p><a href={photo.source} rel="noreferrer"><bdi>{photo.author}</bdi></a>{" · "}
            <a href={photo.licenseUrl} rel="noreferrer"><bdi>{photo.license}</bdi></a>
            . התצלום הוקטן ונחתך לתצוגה לפי גודל המסך.</p>
        </details>
      </figcaption>
    </figure>
  );
}

// Image assignments are editable backend content, not inferred by the browser.
export function photoForPage(page: SitePage): PhotoName | undefined {
  return page.heroMediaId ?? undefined;
}

export function PagePhotograph({ page, priority = false, placeholder = false }: {
  page: SitePage; priority?: boolean; placeholder?: boolean;
}) {
  const photo = photoForPage(page);
  if (photo) return <Photograph name={photo} priority={priority} className="page-photograph" />;
  return placeholder ? (
    <div className="travel-photo-placeholder" role="img" aria-label="מקום לתצלום מהמסע">
      <CompassRose /><span>צילום מהמסע יתווסף בהמשך</span>
    </div>
  ) : null;
}

export function CompassRose({ className = "" }: { className?: string }) {
  return <svg className={`compass-rose ${className}`} viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <circle cx="60" cy="60" r="44" /><circle cx="60" cy="60" r="54" />
    <path d="M60 3 68 52 117 60 68 68 60 117 52 68 3 60 52 52Z" />
    <path d="m60 18 0 42 42 0M60 60v42H60M60 60H18M29 29l62 62M91 29 29 91" />
    <circle cx="60" cy="60" r="5" />
  </svg>;
}
