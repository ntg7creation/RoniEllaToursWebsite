import { useId, type ReactNode } from 'react';
import type { PageSettings } from '@roniella/shared/admin';
import { MediaField, type MediaOption } from './admin-photo-picker';
export { MediaField, type MediaOption } from './admin-photo-picker';
export function Field({ label, value, change, required = false, single = false, maxLength, children }: { label: string; value: string; change: (value: string) => void; required?: boolean; single?: boolean; maxLength?: number; children?: ReactNode }) {
  const id = useId();
  return <div className="admin-field"><label htmlFor={id}>{label}</label>{single
    ? <input id={id} value={value} required={required} maxLength={maxLength ?? 2000} onChange={e => change(e.target.value)} />
    : <textarea id={id} value={value} required={required} rows={3} maxLength={maxLength ?? 20000} onChange={e => change(e.target.value)} />}{children}</div>;
}
export function PageSettingsFields({ settings, change, media, pageType }: { settings: PageSettings; change: (value: PageSettings) => void; media: MediaOption[]; pageType: string }) {
  const field = (key: 'title'|'displayTitle'|'summary'|'dates'|'authorName'|'publicationDate', label: string, required = false, single = false, maxLength?: number) =>
    <Field label={label} value={settings[key]} required={required} single={single} maxLength={maxLength ?? 2000} change={value => change({ ...settings, [key]: value })} />;
  return <>
    {field('title', 'שם העמוד / Page name', true, true, 300)}
    {field('displayTitle', 'כותרת מוצגת (ריק לשימוש בשם העמוד) / Display heading (defaults to page name)', false, true)}
    {pageType !== 'tour' && field('summary', 'תקציר לכרטיסים / Summary on listing cards')}
    {pageType === 'destinationArchive' && <>{field('dates', 'מועד הנסיעה / Travel dates', false, true)}<p className="admin-field-hint">תאריך מדויק, חודש, טרם נקבע או ריק. / Enter a date, a month, a tentative note, or leave blank.</p></>}
    <MediaField label="תמונה ראשית ולכרטיסים / Main image and listing cards" value={settings.heroMediaId} media={media} change={value => change({ ...settings, heroMediaId: value })} />
    {pageType === 'article' && <>{field('authorName', 'שם הכותב או הכותבת / Author name', false, true)}{field('publicationDate', 'תאריך פרסום (YYYY-MM-DD) / Publication date', false, true)}</>}
  </>;
}
