import { useEffect, useId, useState } from 'react';
import { orderDrivePhotos, type DrivePhotoChoice, type DrivePhotoReference } from '@roniella/shared/google-drive';
export type MediaOption = { id: string; src: string; alt: string; googleDrive?: DrivePhotoReference };
const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(value)) : '';

export function MediaField({ label = 'תמונה / Image', value, media, change }: { label?: string; value: string | null; media: MediaOption[]; change: (value: string | null, option?: MediaOption) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false), [photos, setPhotos] = useState<DrivePhotoChoice[]>([]), [folderUrl, setFolderUrl] = useState(''), [inputUrl, setInputUrl] = useState(''), [title, setTitle] = useState('');
  const [order, setOrder] = useState('added-newest'), [limit, setLimit] = useState(48), [tab, setTab] = useState<'album' | 'site'>('album');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [loading, setLoading] = useState(false), [chosen, setChosen] = useState<MediaOption | null>(null);
  const selected = chosen?.id === value ? chosen : media.find(item => item.id === value);
  const sorted = orderDrivePhotos(photos, order);
  const [pending,setPending] = useState<DrivePhotoChoice | null>(null), [alt,setAlt] = useState('');
  const [editingAlt,setEditingAlt] = useState(false);
  function choose(option: MediaOption) {
    setChosen(option); change(option.id,option); setOpen(false); setPending(null); setEditingAlt(false);
  }
  async function saveAlt() {
    if (!selected || !alt.trim()) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/admin/photos',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operation:'save_alt',id:selected.id,expected:selected.alt,alt:alt.trim()})});
      const result = await response.json(); if (!response.ok) throw Error(result.message);
      choose({...selected,alt:result.alt}); setMessage('התיאור נשמר בספרייה / Library description saved');
    } catch(error) { setMessage(error instanceof Error ? error.message : 'שמירה נכשלה / Save failed'); }
    finally { setBusy(false); }
  }
  async function load(fresh = false, signal?: AbortSignal) {
    setLoading(true); setMessage('');
    try {
      const query = new URLSearchParams(); if (fresh) query.set('refresh', '1');
      const response = await fetch('/admin/photos?' + query, { cache: 'no-store', credentials: 'same-origin', signal });
      const data = await response.json(); if (!response.ok) throw Error(data.message);
      setPhotos(data.photos); setFolderUrl(data.folderUrl); setInputUrl(data.folderUrl); setTitle(data.title); setLimit(48);
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : 'לא ניתן לטעון תמונות.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    if (!open || photos.length) return;
    const controller = new AbortController(); void load(false, controller.signal); return () => controller.abort();
  }, [open]);
  async function saveFolder() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/admin/photos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'set_folder', folderUrl: inputUrl, expectedFolderUrl: folderUrl }) });
      const result = await response.json(); if (!response.ok) throw Error(result.message); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'לא ניתן לעדכן את התיקייה.'); }
    finally { setBusy(false); }
  }
  async function pick(photo: DrivePhotoChoice) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/admin/photos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderUrl, fileId: photo.sourceId, alt:alt.trim() }) });
      const option = await response.json(); if (!response.ok) throw Error(option.message);
      choose(option);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'לא ניתן לבחור תמונה.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-field admin-photo-field">
    <label htmlFor={id}>{label}</label>
    <div className="admin-actions"><button id={id} type="button" aria-expanded={open} aria-controls={open ? id + '-picker' : undefined} disabled={busy} onClick={() => setOpen(current => !current)}>{selected ? 'החלפת תמונה מהתיקייה / Replace photo' : 'בחירת תמונה מהתיקייה / Choose a photo'}</button>
      {value && <button type="button" disabled={busy} onClick={() => { change(null); setChosen(null); }}>הסרת התמונה / Remove image</button>}
    </div>
    {selected && <figure className="admin-selected-photo"><img className="admin-image-preview" src={selected.src} alt={selected.alt} /><figcaption>{selected.alt}</figcaption></figure>}
    {selected && !open && <div><button type="button" onClick={()=>{setAlt(selected.alt);setEditingAlt(!editingAlt);}}>עריכת תיאור הספרייה / Edit library alt text</button>
      {editingAlt && <div className="admin-field"><label>תיאור התמונה / Image alt text<input value={alt} maxLength={2000} onChange={e=>setAlt(e.target.value)} /></label>
        <small>משותף לכל שימוש בתמונת הספרייה / Used wherever this library photo appears.</small>
        <button type="button" disabled={busy || !alt.trim() || alt.trim()===selected.alt} onClick={()=>void saveAlt()}>שמירת תיאור בספרייה / Save library description</button></div>}</div>}
    {open && <section id={id + '-picker'} className="admin-photo-picker" aria-label={'בחירת ' + label}>
      <div className="admin-actions"><button type="button" disabled={busy} aria-pressed={tab === 'album'} onClick={() => setTab('album')}>Google Drive</button><button type="button" disabled={busy} aria-pressed={tab === 'site'} onClick={() => setTab('site')}>תמונות עיצוב קיימות / Site library</button><button type="button" disabled={busy} onClick={() => setOpen(false)}>סגירת בחירת תמונה / Close picker</button></div>
      {tab === 'album' ? <>
        <div className="admin-field"><label htmlFor={id + '-url'}>קישור לתיקיית Google Drive / Shared Google Drive folder URL</label><input id={id + '-url'} type="url" dir="ltr" value={inputUrl} maxLength={2000} onChange={event => setInputUrl(event.target.value)} disabled={busy || loading} /><p className="admin-field-hint">ספריית תמונות משותפת לכל האתר. / This folder supplies images across the site.</p></div>
        <div className="admin-actions"><button type="button" disabled={busy || loading} onClick={() => void load(true)}>רענון התיקייה / Refresh folder</button><button type="button" disabled={busy || loading || inputUrl === folderUrl || !folderUrl} onClick={() => void saveFolder()}>שמירת קישור לתיקייה / Save folder URL</button></div>
        {loading && <p role="status">טוענים את תמונות התיקייה… / Loading folder photos…</p>}
        {title && <p className="admin-photo-count">{title} · {photos.length} תמונות</p>}
        {!loading && title && !photos.length && <p>אין עדיין תמונות בתיקייה. הוסיפו תמונות ב־Drive ולחצו על רענון התיקייה.</p>}
        <div className="admin-field"><label htmlFor={id + '-order'}>סידור התמונות / Sort photos</label><select id={id + '-order'} value={order} disabled={busy || loading} onChange={event => { setOrder(event.target.value); setLimit(48); }}>
          <option value="album">לפי הסדר בתיקייה / Folder order</option><option value="name">לפי שם הקובץ / File name</option><option value="added-newest">נוספו לאחרונה קודם / Recently added first</option><option value="added-oldest">נוספו ראשונות קודם / Oldest additions first</option><option value="modified-newest">עודכנו לאחרונה קודם / Recently updated first</option>
        </select></div>
        {pending && <div className="admin-field admin-pending-photo"><img className="admin-image-preview" src={pending.thumbnail} alt="" />
          <label>תיאור התמונה / Image alt text<input autoFocus value={alt} maxLength={2000} onChange={e=>setAlt(e.target.value)} /></label>
          <small>תארו בקצרה מי או מה מופיע בתמונה. / Describe the people, place or activity shown.</small>
          <button type="button" disabled={busy || !alt.trim()} onClick={()=>void pick(pending)}>הוספה עם התיאור / Use photo with this description</button></div>}
        <div className="admin-photo-grid">{sorted.slice(0, limit).map(photo => <button type="button" className="admin-photo-choice" key={photo.id} disabled={busy || loading} aria-pressed={value === photo.id} aria-label={photo.alt} onClick={() => {
          const linked = media.find(item=>item.id === photo.id); if (linked) choose(linked); else { setPending(photo);setAlt(''); }
        }}>
          <img src={photo.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /><span>{photo.alt}</span><small>{dateLabel(order.startsWith('modified') ? photo.modifiedAt : photo.addedAt) || 'תאריך לא זמין'}</small>
        </button>)}</div>
        {limit < photos.length && <button type="button" disabled={busy} onClick={() => setLimit(current => current + 48)}>הצגת תמונות נוספות ({photos.length - limit})</button>}
        <p className="admin-field-hint">התמונה נשארת ב־Google Drive. הבחירה שומרת את קישור הקובץ ומתפרסמת בעמוד לאחר שמירת השינויים. / The image stays in Drive. Save the page to publish this placement.</p>
      </> : <div className="admin-photo-grid">{media.filter(photo => !photo.googleDrive).map(photo => <button type="button" className="admin-photo-choice" key={photo.id} disabled={busy} aria-pressed={value === photo.id} aria-label={photo.alt} onClick={() => { setChosen(photo); change(photo.id, photo); setOpen(false); }}><img src={photo.src} alt="" loading="lazy" /><span>{photo.alt}</span></button>)}</div>}
    </section>}
    {message && <p className="admin-message" role="alert">{message}</p>}
  </div>;
}
