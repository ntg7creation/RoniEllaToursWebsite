import { useId, useState, type ReactNode } from 'react';
import type { PageSettings } from '@roniella/shared/admin';
import { MediaField, type MediaOption } from './admin-photo-picker';
import { seoRows, type SeoDefaults, type ShareImage } from './seo-metadata';

export type SeoPreview = { base: SeoDefaults; images: Record<string,ShareImage>; fallbackImage?: ShareImage };
export function SeoTable({ settings, change, preview, media }: { settings: PageSettings; change: (value:PageSettings)=>void; preview:SeoPreview; media: MediaOption[] }) {
  const [keywords,setKeywords] = useState(settings.keywords.join(', '));
  const [chosen,setChosen] = useState<MediaOption>();
  const id = useId(), base = preview.base;
  const image = settings.heroMediaId ? preview.images[settings.heroMediaId] ?? (chosen && {url:new URL(chosen.src,base.canonical).href, alt:chosen.alt}) : preview.fallbackImage;
  const rows = seoRows(base,{title:settings.seoTitle, description:settings.seoDescription, keywords:settings.keywords,
    socialTitle:settings.socialTitle, socialDescription:settings.socialDescription, noindex:settings.noindex,
    author:settings.authorName, image: image && chosen && settings.heroMediaId === chosen.id ? {...image,alt:chosen.alt} : image});
  function editor(key: 'seoTitle'|'seoDescription'|'socialTitle'|'socialDescription'|'authorName', label:string, fallback:string) {
    return <label>{label}<textarea rows={key.endsWith('escription') ? 3 : 1} value={settings[key]} placeholder={fallback}
      maxLength={key.endsWith('Title') ? 300 : 2000} onChange={event=>change({...settings,[key]:event.target.value})} /></label>;
  }
  return <div className="admin-seo">
    <p>העמודה האחרונה מציגה את ערך התג. שדה ריק משתמש בערך האוטומטי המוצג בו.
      <span lang="en" dir="ltr">Edit the last column. An empty field uses its displayed default. Linked rows update together.</span></p>
    <table className="admin-seo-table"><caption className="sr-only">תגיות העמוד / Page metadata</caption>
      <thead><tr><th scope="col">תג / Element</th><th scope="col">מאפיין / Attribute</th><th scope="col">תוכן / Content</th></tr></thead>
      <tbody>{rows.map((row,index) => {
        let control: ReactNode;
        switch (row.key) {
          case 'title': control = editor('seoTitle','כותרת לתוצאות החיפוש / Search title', base.title); break;
          case 'description': control = editor('seoDescription','תיאור לתוצאות החיפוש / Search description',base.description); break;
          case 'og:title': control = editor('socialTitle','כותרת לשיתוף / Social title',settings.seoTitle || base.title); break;
          case 'og:description': control = editor('socialDescription','תיאור לשיתוף / Social description',settings.seoDescription || base.description); break;
          case 'author': control = editor('authorName','שם הכותב או הכותבת / Author',''); break;
          case 'keywords': control = <label>תוויות ונושאים — הפרדה בפסיקים / Topics, separated by commas<input value={keywords} maxLength={5000} onChange={event=>{
            setKeywords(event.target.value); change({...settings,keywords:[...new Set(event.target.value.split(/[,،]/).map(v=>v.trim()).filter(Boolean))]}); }} /></label>; break;
          case 'robots': control = <><output dir="ltr">{row.value}</output><label><input type="checkbox" checked={settings.noindex} onChange={event=>change({...settings,noindex:event.target.checked})} /> הסתרת העמוד מהחיפוש / Exclude this page from search</label>
            {base.siteNoindex && <small>אתר התצוגה מוגדר כנסתר / Indexing is disabled on this review site.</small>}</>; break;
          case 'og:image': control = <><bdi>{row.value}</bdi><MediaField label="תמונת העמוד והשיתוף / Page and sharing image" value={settings.heroMediaId} media={media} change={(value,option)=>{ setChosen(option); change({...settings,heroMediaId:value}); }} /></>; break;
          default: control = <output dir="auto">{row.value || 'לא הוגדר / Unset'}</output>;
        }
        return <tr key={row.key+index}><td><code>{row.element}</code></td><th scope="row" id={id+index}><code dir="ltr">{row.attribute ? row.attribute+'="'+row.key+'"' : '<title>'}</code></th><td>{control}</td></tr>;
      })}</tbody>
    </table>
    <p className="admin-field-hint">הנושאים מופיעים גם בנתונים המובנים (JSON-LD). / Topics also appear in the page’s structured data.</p>
  </div>;
}
