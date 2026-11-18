import type { SitePage } from "@roniella/shared/site-content";
import { useSiteContent } from "./site-content-context";
import type { PhotoSlot } from '@roniella/shared/admin';
import { AdminManageButton, AdminPhotoButton } from './admin-context';

export type PhotoName = string;

export function Photograph({ name, priority = false, className = "", alt, caption, slot, editPageId, showCaption=true, showEditButton=true }: {
  name: PhotoName; priority?: boolean; className?: string; alt?: string; caption?: string; slot?:PhotoSlot; editPageId?:string; showCaption?:boolean; showEditButton?:boolean;
}) {
  const content=useSiteContent();
  const selected=slot&&Object.hasOwn(content.photoSlots??{},slot)?content.photoSlots![slot]:name;
  if(selected===null)return slot&&showEditButton?<AdminPhotoButton slot={slot}/>:null;
  const photo = content.media.find(asset => asset.id === selected);
  if (!photo) throw Error(`Missing media asset: ${name}`);
  return (
    <figure className={`editorial-photograph ${className}`}>
      {showEditButton&&(slot?<AdminPhotoButton slot={slot}/>:editPageId?<AdminManageButton pageId={editPageId} mode="settings" className="admin-photo-edit">עריכת תמונה / Edit image</AdminManageButton>:null)}
      <img src={photo.src}
        srcSet={photo.variants.map(variant => `${variant.src} ${variant.width}w`).join(", ")}
        sizes={photo.sizes}
        width={photo.width} height={photo.height}
        alt={alt ?? photo.alt} loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"} decoding="async" />
      {showCaption&&<figcaption>
        <span>{caption ?? photo.caption}</span>
      </figcaption>}
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
  if (photo) return <Photograph name={photo} priority={priority} className="page-photograph" editPageId={page.id} />;
  return placeholder ? (
    <div className="travel-photo-placeholder">
      <AdminManageButton pageId={page.id} mode="settings" className="admin-photo-edit">בחירת תמונה / Choose image</AdminManageButton>
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
