import { useEffect, useRef, useState } from 'react';
import { ContentCommandSchema, type ContentCollection, type ContentCommand, type NewTrip, type TripDetails, type PageSettings, type PhotoSlot } from '@roniella/shared/admin';
import { durationLabel, itineraryDayCount, maxItineraryDays, tourRange } from '@roniella/shared/tour-schedule';
import { TourScheduleFields } from './admin-tour-schedule';
import { SeoTable, type SeoPreview } from './admin-seo-table';
import type { SiteBlock } from '@roniella/shared/site-content';
import { BlockFields, newBlock } from './admin-block-fields';
import { Field, MediaField, PageSettingsFields, type MediaOption } from './admin-content-fields';
import { editableSections, guidePortrait, setGuidePortrait, insertSection, moveSection, removeSection, scheduledBlocks, type SectionKind } from './editor-sections';

type Entry = { id: string; title: string; path: string; published: boolean; revision: string };
type Body = { id: string; title: string; path: string; pageType: string; revision: string; blocks: SiteBlock[]; settings: PageSettings; media: MediaOption[]; trip?: TripDetails; preview?: SeoPreview };
export type WorkspaceTarget = { pageId?: string; collection?: ContentCollection; mode?: 'body' | 'settings' | 'seo' | 'itinerary' | 'guides' | 'schedule'; photoSlot?:PhotoSlot; guideAnchor?:string };
const emptyTrip: NewTrip = { title: '', slug: '', summary: '', overview: '', dates: '', duration: '', price: '', guide: '', status: '' };
const names = { title: 'שם הטיול / Tour name', slug: 'כתובת קצרה באנגלית / English URL slug', summary: 'תקציר לכרטיסי הטיול / Tour card summary', overview: 'פתיח לעמוד הטיול / Introduction', dates: 'מועדים / Dates', duration: 'משך הטיול / Duration', price: 'מחיר / Price', guide: 'הדרכה / Guide', status: 'סטטוס הרשמה / Registration status' };
function savedDuration<T extends Pick<NewTrip,'dates'|'duration'|'syncItinerary'>>(trip:T): T {
  const range = tourRange(trip.dates);
  return trip.syncItinerary !== false && range && range.days <= maxItineraryDays ? { ...trip, duration: durationLabel(range.days) } : trip;
}
const collectionNames = { tour: 'טיולים / Tours', article: 'מאמרים / Articles', destinationArchive: 'יעדים / Destinations' };
const singular = { tour: 'טיול', article: 'מאמר', destinationArchive: 'יעד' };

export default function AdminWorkspace({ target, version, onNavigate, onClose, onSaved, onUnauthorized }: {
  target: WorkspaceTarget; version: number; onNavigate: (target: WorkspaceTarget) => void; onClose: () => void; onSaved: (removedPath?: string) => void; onUnauthorized: () => void;
}) {
  const modal = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]), [body, setBody] = useState<Body | null>(null), [media, setMedia] = useState<MediaOption[]>([]);
  const [blocks, setBlocks] = useState<SiteBlock[]>([]), [settings, setSettings] = useState<PageSettings | null>(null), [trip, setTrip] = useState<NewTrip>({ ...emptyTrip });
  const [creating, setCreating] = useState(false), [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState('');
  const [discard, setDiscard] = useState<'close' | 'reload' | WorkspaceTarget | null>(null), [publication, setPublication] = useState<Entry | null>(null);
  const [insertAt, setInsertAt] = useState(0);
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null);
  const collection = target.collection ?? 'tour', mode = target.mode ?? 'body';
  const viewKey = JSON.stringify([target.pageId, collection, mode, version]);
  const [loadedView, setLoadedView] = useState('');
  const ready = !loading && loadedView === viewKey;
  const settingsMode = mode === 'settings' || mode === 'seo';
  const kind: SectionKind | null = mode === 'itinerary' ? 'itinerary' : mode === 'guides' ? 'guides' : null;
  const targetDays = body?.trip?.syncItinerary ? itineraryDayCount(body.trip.dates, body.trip.duration) : null;
  const groups = kind ? editableSections(blocks, kind).slice(0, kind === 'itinerary' ? targetDays ?? undefined : undefined) : [];
  const dirty = body ? JSON.stringify(body.blocks) !== JSON.stringify(blocks) || JSON.stringify(body.settings) !== JSON.stringify(settings)
    || JSON.stringify(body.trip ?? null) !== JSON.stringify(tripDetails) : creating && Object.entries(trip).some(([key,value]) => key === 'syncItinerary' ? value === false : Boolean(value));
  async function read(signal?: AbortSignal) {
    setLoading(true); setMessage('');
    try {
      const query = new URLSearchParams({ collection }); if (target.pageId) query.set('key', target.pageId);
      if (mode === 'seo') query.set('mode','seo');
      const response = await fetch('/admin/manage?' + query, { cache: 'no-store', credentials: 'same-origin', signal });
      const result = await response.json();
      if (!response.ok) { if ([401, 403].includes(response.status)) onUnauthorized(); throw Error(result.message); }
      if (signal?.aborted) return;
      if (target.pageId) {
        if (mode === 'itinerary' && result.trip?.syncItinerary) result.blocks = scheduledBlocks(result.blocks, itineraryDayCount(result.trip.dates, result.trip.duration), true);
        setBody(result); setBlocks(result.blocks); setSettings(result.settings); setTripDetails(result.trip ?? null);
      } else { setBody(null); setEntries(result.entries); }
      setMedia(result.media); setDiscard(null); setPublication(null); setLoadedView(viewKey);
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : 'לא ניתן לטעון את התוכן. / Content could not be loaded.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement; modal.current?.showModal();
    return () => { modal.current?.close(); if (opener.current?.isConnected) opener.current.focus(); };
  }, []);
  useEffect(() => { const controller = new AbortController(); void read(controller.signal); return () => controller.abort(); }, [target.pageId, collection, mode, version]);
  useEffect(()=>{if(!loading&&target.guideAnchor)document.getElementById('admin-guide-'+target.guideAnchor)?.scrollIntoView({block:'start'});},[loading,target.guideAnchor]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const close = () => { if (!busy) { if (dirty) setDiscard('close'); else onClose(); } };
  const navigate = (next: WorkspaceTarget) => { if (dirty) setDiscard(next); else onNavigate(next); };
  async function submit(command: ContentCommand, removedPath?: string) {
    if (busy) return;
    const parsed = ContentCommandSchema.safeParse(command);
    if (!parsed.success) { setMessage('בדקו את השדות: טקסט חובה, קישורים מלאים ובטוחים, תמונה ותיאורה ותאריכים בפורמט YYYY-MM-DD. / Check required text, links, image descriptions and date format.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/admin/manage', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) { if ([401, 403].includes(response.status)) onUnauthorized(); throw Error(result.message); }
      const created = command.operation === 'create_trip' || command.operation === 'create_entry';
      if (created) { setCreating(false); setTrip({ ...emptyTrip }); setRequestId(crypto.randomUUID()); }
      onSaved(removedPath); await read(); setMessage(created ? 'הטיוטה נוצרה. ערכו את התוכן, בחרו תמונה ופרסמו כשהעמוד מוכן. / Draft created. Add content and an image, then publish when ready.' : 'השינויים נשמרו. / Changes saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'לא ניתן לשמור כרגע. / Changes could not be saved.'); }
    finally { setBusy(false); }
  }
  const changeBlock = (index: number, change: (block: SiteBlock) => void) => setBlocks(current => {
    const next = structuredClone(current); change(next[index]!); return next;
  });
  const add = (type: 'paragraph' | 'heading' | 'list' | 'image', at = blocks.length) => setBlocks(current => {
    const next = [...current]; next.splice(at, 0, newBlock(type, media)); return next;
  });
  const move = (index: number, direction: number) => setBlocks(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction]!, next[index]!]; return next; });
  const fields: (keyof typeof names)[] = collection === 'tour' ? ['title','slug','summary','overview','price','guide','status'] : ['title', 'slug', 'summary', 'overview', ...(collection === 'destinationArchive' ? ['dates' as const] : [])];
  const bodyNavigation = (nextMode: WorkspaceTarget['mode']) => navigate({ ...target, mode: nextMode });
  return <dialog ref={modal} className="admin-editor admin-workspace" aria-labelledby="admin-workspace-title" onCancel={e => { e.preventDefault(); close(); }}>
    <header className="admin-editor-header"><h2 id="admin-workspace-title">{target.pageId ? `עריכת תוכן — ${body?.title ?? ''}` : `ניהול ${collectionNames[collection]}`}</h2><button type="button" autoFocus disabled={busy} onClick={close}>סגירה × / Close</button></header>
    <div className="admin-editor-body">
      {!ready && !message && <p role="status">טוענים תוכן… / Loading content…</p>}
      {message && <p className="admin-message" role="status">{message}</p>}
      {discard && <div className="admin-discard" role="alert"><p>יש שינויים שלא נשמרו. לבטל אותם? / Discard unsaved edits?</p><button type="button" onClick={() => {
        if (discard === 'close') onClose(); else if (discard === 'reload') void read(); else { setBlocks(body?.blocks ?? []); setSettings(body?.settings ?? null); setCreating(false); setTrip({ ...emptyTrip }); onNavigate(discard); setDiscard(null); }
      }}>ביטול השינויים והמשך / Discard and continue</button><button type="button" onClick={() => setDiscard(null)}>המשך עריכה / Keep editing</button></div>}
      {ready && !target.pageId && <>
        <nav className="admin-actions" aria-label="אוספי תוכן / Content collections">{(Object.keys(collectionNames) as ContentCollection[]).map(value => <button key={value} type="button" aria-pressed={value === collection} disabled={busy} onClick={() => navigate({ collection: value })}>{collectionNames[value]}</button>)}</nav>
        <p>תוכן חדש נשמר כטיוטה. הסרה מורידה אותו מהאתר ושומרת אפשרות לפרסם אותו שוב. / New entries start as drafts. Unpublishing removes an entry from the public site and keeps it available for editing.</p>
        {!creating && <button type="button" disabled={busy} onClick={() => setCreating(true)}>הוספת {singular[collection]} / Add {collection === 'destinationArchive' ? 'destination' : collection}</button>}
        {creating && <form onSubmit={event => { event.preventDefault(); void submit(collection === 'tour' ? { operation: 'create_trip', requestId, trip: savedDuration(trip) } : {
          operation: 'create_entry', requestId, collection, entry: { title: trip.title, slug: trip.slug, summary: trip.summary, overview: trip.overview, dates: trip.dates },
        }); }}><fieldset disabled={busy}><legend>{singular[collection]} חדש / New {collection === 'destinationArchive' ? 'destination' : collection}</legend>
          {fields.map(key => <Field key={key} label={key === 'title' ? `שם ה${singular[collection]} / Name` : collection !== 'tour' && key === 'summary' ? 'תקציר לכרטיסים / Summary on listing cards' : collection !== 'tour' && key === 'overview' ? 'פתיח לעמוד / Page introduction' : names[key]} value={trip[key]} required={['title', 'slug', 'overview', ...(collection === 'tour' ? ['summary'] : [])].includes(key)} single={!['summary', 'overview'].includes(key)} maxLength={key === 'overview' ? 20000 : key === 'title' ? 300 : key === 'slug' ? 100 : 2000} change={value => setTrip(current => ({ ...current, [key]: value }))}>
            {key === 'slug' && <p className="admin-field-hint" dir="ltr">/{collection === 'tour' ? 'tours' : collection === 'article' ? 'blog' : 'destinations'}/{trip.slug || 'new-page'}/ — a–z, 0–9, -</p>}
            {key === 'dates' && <p className="admin-field-hint">תאריך מדויק, חודש, טרם נקבע או ריק. / Enter a date, a month, a tentative note, or leave blank.</p>}
          </Field>)}
          {collection === 'tour' && <TourScheduleFields value={{...trip,syncItinerary:trip.syncItinerary !== false}} change={value => setTrip(current => ({...current,...value}))} />}
          <button type="submit">יצירת טיוטה / Create draft</button><button type="button" onClick={() => { if (dirty) setDiscard({ collection }); else setCreating(false); }}>ביטול / Cancel</button>
        </fieldset></form>}
        {publication && <div className="admin-discard" role="alert"><p>{publication.published ? 'להסיר מהאתר את' : 'לפרסם באתר את'} ״{publication.title}״?</p><button type="button" disabled={busy} onClick={() => void submit({ operation: collection === 'tour' ? 'publish_trip' : 'publish_entry', key: publication.id, expectedRevision: publication.revision, published: !publication.published }, publication.published ? publication.path : undefined)}>{publication.published ? 'אישור הסרה מהאתר / Confirm unpublish' : 'אישור פרסום / Confirm publication'}</button><button type="button" disabled={busy} onClick={() => setPublication(null)}>ביטול / Cancel</button></div>}
        <ul className="admin-trip-list">{entries.map(item => <li key={item.id}><h3>{item.title}</h3><p>{item.published ? 'מפורסם באתר / Published' : 'טיוטה / הוסר מהאתר / Draft or unpublished'}</p><div className="admin-actions">
          {collection === 'tour' && <button type="button" disabled={busy || creating} onClick={() => navigate({ pageId: item.id, collection, mode: 'schedule' })}>פרטי הטיול / Tour details</button>}
          <button type="button" disabled={busy || creating} onClick={() => navigate({ pageId: item.id, collection, mode: 'settings' })}>פרטים ותמונה / Details and image</button>
          <button type="button" disabled={busy || creating} onClick={() => navigate({ pageId: item.id, collection, mode: 'body' })}>תוכן {collection === 'tour' ? 'ומסלול / Content and itinerary' : 'העמוד / Page content'}</button>
          <button type="button" disabled={busy || creating} onClick={() => navigate({ pageId: item.id, collection, mode: 'seo' })}>SEO ותוויות / SEO and topics</button>
          {item.published && <a href={item.path}>פתיחת ה{singular[collection]} / View page</a>}
          <button type="button" disabled={busy || creating} onClick={() => { setPublication(item); modal.current?.scrollTo({ top: 0, behavior: 'instant' }); }}>{item.published ? 'הסרה מהאתר / Unpublish' : 'פרסום באתר / Publish'}</button>
        </div></li>)}</ul>
      </>}
      {ready && body && settings && <>
        <nav className="admin-actions" aria-label="אפשרויות עריכת העמוד / Page editing options">
          {body.pageType === 'tour' && <button type="button" disabled={busy} onClick={() => bodyNavigation('schedule')} aria-pressed={mode === 'schedule'}>מועדים ומשך / Dates and duration</button>}
          <button type="button" disabled={busy} onClick={() => bodyNavigation('settings')} aria-pressed={mode === 'settings'}>פרטים ותמונה / Details and image</button>
          <button type="button" disabled={busy} onClick={() => bodyNavigation('body')} aria-pressed={mode === 'body'}>תוכן ומבנה / Page content and order</button>
          {body.pageType === 'tour' && <button type="button" disabled={busy} onClick={() => bodyNavigation('itinerary')} aria-pressed={mode === 'itinerary'}>ימי המסלול / Itinerary days</button>}
          {body.pageType === 'guides' && <button type="button" disabled={busy} onClick={() => bodyNavigation('guides')} aria-pressed={mode === 'guides'}>אנשי הצוות / Guide profiles</button>}
          <button type="button" disabled={busy} onClick={() => bodyNavigation('seo')} aria-pressed={mode === 'seo'}>SEO ותוויות / SEO and topics</button>
          {['tour', 'article', 'destinationArchive'].includes(body.pageType) && <button type="button" disabled={busy} onClick={() => navigate({ collection: body.pageType as ContentCollection })}>חזרה לרשימה / Back to list</button>}
        </nav>
        <form onSubmit={event => { event.preventDefault(); void submit(mode === 'schedule' && tripDetails ? { operation: 'save_trip_details', key: body.id, expectedRevision: body.revision, trip: savedDuration(tripDetails) } : settingsMode ? { operation: 'save_settings', key: body.id, expectedRevision: body.revision, settings } : { operation: 'save_body', key: body.id, expectedRevision: body.revision, blocks }); }}>
          <fieldset disabled={busy} className="admin-blocks"><legend className="sr-only">עריכת העמוד</legend>
            {mode === 'schedule' && tripDetails ? <>
              <TourScheduleFields value={tripDetails} change={value => setTripDetails({...tripDetails,...value})} />
              {(['summary','price','guide','status'] as const).map(key => <Field key={key} label={names[key]} value={tripDetails[key]} change={value => setTripDetails({...tripDetails,[key]:value})} />)}
            </> : mode === 'seo' && body.preview ? <SeoTable key={body.revision} settings={settings} change={setSettings} media={media} preview={body.preview} />
              : settingsMode ? <PageSettingsFields settings={settings} change={setSettings} media={media} pageType={body.pageType} /> : kind ? <>
              {kind === 'itinerary' && targetDays !== null && <p role="status">מוצגים {targetDays} ימים לפי המועדים. ימים נוספים נשמרים. / Showing {targetDays} scheduled days. Additional days are saved. <button type="button" onClick={() => bodyNavigation('schedule')}>שינוי מגבלת הימים / Change day limit</button></p>}
              <p>{kind === 'guides' ? 'הצוות משותף לדף הבית ולעמוד המדריכים. אפשר לערוך שמות, להוסיף ולהסיר אנשי צוות ולשנות את הסדר. / Profiles and portraits are shared by the homepage and guides page.' : 'אפשר לערוך את כותרת כל יום ואת התוכן, להוסיף יום בכל מקום, לשנות סדר ולהסיר יום שלם. / Edit each day’s heading and activities. Switch to manual scheduling to add or remove complete days.'}</p>
              {groups.map((group, index) => <section key={group.heading.anchorIds.join(',') || index} className="admin-block-editor" id={kind==='guides'?'admin-guide-'+group.heading.anchorIds.find(id=>id.startsWith('guide-')):undefined}>
                <div className="admin-actions"><strong>{kind === 'guides' ? 'איש צוות' : 'יום'} {index + 1}</strong>
                  <button type="button" disabled={index === 0} onClick={() => setBlocks(current => moveSection(current, groups, index, -1))}>הזזה למעלה / Move up</button>
                  <button type="button" disabled={index === groups.length - 1} onClick={() => setBlocks(current => moveSection(current, groups, index, 1))}>הזזה למטה / Move down</button>
                  {(kind !== 'itinerary' || targetDays === null) && <button type="button" onClick={() => setBlocks(current => removeSection(current, group))}>{kind === 'guides' ? 'הסרת איש צוות' : 'הסרת יום'} {index + 1} / {kind === 'guides' ? 'Remove guide' : 'Remove day'} {index + 1}</button>}
                </div>
                <Field label={kind === 'guides' ? 'שם המדריך או המדריכה / Guide name' : 'כותרת היום / Day heading'} value={group.heading.text} required single change={value => changeBlock(group.start, b => { if (b.type === 'heading') { b.text = value; if (kind === 'itinerary' && !b.anchorIds.some(id => id.startsWith('editor-day-'))) b.anchorIds.push('editor-day-' + crypto.randomUUID()); } })} />
                {kind==='guides'&&<MediaField label="תמונת איש הצוות / Guide portrait" value={guidePortrait(blocks.slice(group.start+1,group.end))?.mediaId??null} media={media} change={(value,option)=>setBlocks(current=>setGuidePortrait(current,group.heading.anchorIds.find(id=>id.startsWith('guide-'))!,value,option?.alt ?? group.heading.text))}/>}
                {kind==='guides' && (() => {
                  const portrait=guidePortrait(blocks.slice(group.start+1,group.end));
                  return portrait && <Field label="תיאור הדיוקן / Portrait alt text" required single value={portrait.alt} change={alt=>changeBlock(blocks.indexOf(portrait),b=>{if(b.type==='image') b.alt=alt;})} />;
                })()}
                {blocks.slice(group.start + 1, group.end).map((block, offset) => kind==='guides'&&block===guidePortrait(blocks.slice(group.start+1,group.end))?null:<div className="admin-block-editor" key={offset}><BlockFields block={block} media={media} change={change => changeBlock(group.start + 1 + offset, change)} /><button type="button" onClick={() => setBlocks(current => current.filter((_, i) => i !== group.start + 1 + offset))}>Remove block / הסרת קטע מתוך {kind === 'guides' ? 'הפרופיל' : 'היום'}</button></div>)}
                <div className="admin-actions"><button type="button" onClick={() => add('paragraph', group.end)}>הוספת פסקה / Add paragraph</button><button type="button" disabled={!media.length} onClick={() => add('image', group.end)}>הוספת תמונה / Add image</button></div>
              </section>)}
              {(kind !== 'itinerary' || targetDays === null) && <><label>מיקום ההוספה / Insert at <select value={Math.min(insertAt, groups.length)} onChange={event => setInsertAt(Number(event.target.value))}>{Array.from({ length: groups.length + 1 }, (_, index) => <option key={index} value={index}>{index === groups.length ? 'בסוף הרשימה / At the end' : `לפני / Before ${index + 1}`}</option>)}</select></label>
              <button type="button" onClick={() => setBlocks(current => insertSection(current, kind, Math.min(insertAt, groups.length), crypto.randomUUID()))}>{kind === 'guides' ? 'הוספת איש צוות / Add guide' : 'הוספת יום / Add day'}</button></>}
            </> : <>
              <p>ערכו כותרות וטקסטים, הוסיפו תמונות וקישורים ושנו את הסדר. השינויים מתפרסמים רק בלחיצה על שמירה. / Edit headings, text, images, links and display order. Save to apply changes.</p>
              {blocks.map((block, index) => <section key={index} className="admin-block-editor" aria-label={`קטע ${index + 1}`}>
                <div className="admin-actions"><strong>קטע {index + 1}</strong><button type="button" disabled={index === 0} aria-label={`העלאת קטע ${index + 1} / Move block up`} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === blocks.length - 1} aria-label={`הורדת קטע ${index + 1} / Move block down`} onClick={() => move(index, 1)}>↓</button><button type="button" onClick={() => setBlocks(current => current.filter((_, i) => i !== index))}>הסרת קטע / Remove block {index + 1}</button></div>
                <BlockFields block={block} media={media} change={change => changeBlock(index, change)} />
              </section>)}
              <div className="admin-actions"><button type="button" onClick={() => add('paragraph')}>הוספת פסקה / Add paragraph</button><button type="button" onClick={() => add('heading')}>הוספת כותרת / Add heading</button><button type="button" onClick={() => add('list')}>הוספת רשימה / Add list</button><button type="button" disabled={!media.length} onClick={() => add('image')}>הוספת תמונה / Add image</button></div>
            </>}
            <button type="submit" disabled={busy || (!settingsMode && mode !== 'schedule' && !blocks.length)}>שמירת {settingsMode ? mode === 'seo' ? 'SEO ותוויות' : 'פרטי העמוד' : mode === 'schedule' ? 'פרטי הטיול' : 'תוכן העמוד'} / Save changes</button>
          </fieldset>
        </form>
      </>}
    </div>
    <footer className="admin-editor-footer"><button type="button" disabled={busy || loading} onClick={() => dirty ? setDiscard('reload') : void read()}>טעינת הגרסה העדכנית / Reload saved version</button>{dirty && <span>יש שינויים שלא נשמרו / Unsaved edits</span>}</footer>
  </dialog>;
}
