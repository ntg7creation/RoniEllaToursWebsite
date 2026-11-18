import type { SiteBlock } from '@roniella/shared/site-content';
import { Field, MediaField, type MediaOption } from './admin-content-fields';

export function newBlock(type: 'paragraph' | 'heading' | 'list' | 'image', media: MediaOption[]): SiteBlock {
  const base = { anchorIds: [], links: [] };
  if (type === 'image') return { ...base, type, mediaId: media[0]?.id ?? '', alt: media[0]?.alt ?? '', caption: '', align: 'left' };
  if (type === 'list') return { ...base, type, ordered: false, items: [{ text: '', links: [], children: [] }] };
  if (type === 'heading') return { ...base, type, level: 2, text: '' };
  return { ...base, type, text: '' };
}
export function BlockFields({ block, change, media }: { block: SiteBlock; change: (change: (block: SiteBlock) => void) => void; media: MediaOption[] }) {
  return <>
    {'text' in block && <Field label={block.type === 'heading' ? 'כותרת / Heading' : 'טקסט / Text'} value={block.text} required change={value => change(b => { if ('text' in b) b.text = value; })} />}
    {block.type === 'heading' && <label>רמת הכותרת / Heading level <select value={block.level} onChange={event => change(b => { if (b.type === 'heading') b.level = Number(event.target.value) as 2; })}>{[2, 3, 4, 5, 6].map(level => <option key={level} value={level}>{level}</option>)}</select></label>}
    {block.type === 'image' && <>
      <MediaField value={block.mediaId} media={media} change={(value, option) => change(b => { if (b.type === 'image') { b.mediaId = value ?? ''; b.alt = option?.alt ?? media.find(item => item.id === value)?.alt ?? ''; } })} />
      <Field label="תיאור התמונה לנגישות ולחיפוש / Alt text for this placement" value={block.alt} required single maxLength={2000} change={value => change(b => { if (b.type === 'image') b.alt = value; })} />
      <Field label="כיתוב מתחת לתמונה / Visible caption" value={block.caption} maxLength={2000} change={value => change(b => { if (b.type === 'image') b.caption = value; })} />
      <label>מיקום התמונה / Image alignment <select value={block.align} onChange={event => change(b => { if (b.type === 'image') b.align = event.target.value as 'left'; })}><option value="left">משמאל לטקסט / Left of text</option><option value="right">מימין לטקסט / Right of text</option><option value="full">רוחב מלא / Full width</option></select></label>
    </>}
    {block.type === 'list' && <>
      <label><input type="checkbox" checked={block.ordered} onChange={event => change(b => { if (b.type === 'list') b.ordered = event.target.checked; })} /> רשימה ממוספרת / Numbered list</label>
      {block.items.map((item, j) => <div key={j}><Field label={`פריט / Item ${j + 1}`} value={item.text} change={value => change(b => { if (b.type === 'list') b.items[j]!.text = value; })} />
        {item.children.map((child, k) => child.items.map((text, n) => <Field key={`${k}-${n}`} label={`תת־פריט / Subitem ${j + 1}.${k + 1}.${n + 1}`} value={text} change={value => change(b => { if (b.type === 'list') b.items[j]!.children[k]!.items[n] = value; })} />))}
        <button type="button" onClick={() => change(b => { if (b.type === 'list') b.items.splice(j, 1); })}>הסרת פריט / Remove item {j + 1}</button>
      </div>)}
      <button type="button" onClick={() => change(b => { if (b.type === 'list') b.items.push({ text: '', links: [], children: [] }); })}>הוספת פריט / Add list item</button>
    </>}
    {block.type === 'table' && <><Field label="כותרת הטבלה / Table caption" value={block.caption ?? ''} change={value => change(b => { if (b.type === 'table') b.caption = value || null; })} />{block.rows.map((row, j) => row.map((cell, k) => <Field key={`${j}-${k}`} label={`שורה / Row ${j + 1}, עמודה / Column ${k + 1}`} value={cell.text} change={value => change(b => { if (b.type === 'table') b.rows[j]![k]!.text = value; })} />))}</>}
    {block.type !== 'image' && <details className="admin-link-fields"><summary>קישורים והפניות / Links ({block.links.length})</summary>
      {block.links.map((link, index) => <div key={index} className="admin-block-editor">
        <Field label="המילים המקושרות בטקסט / Linked words in the text" value={link.text} required single change={value => change(b => { b.links[index]!.text = value; })} />
        <Field label="כתובת הקישור / Link destination URL" value={link.href} required single change={value => change(b => { b.links[index]!.href = value; })} />
        <button type="button" onClick={() => change(b => { b.links.splice(index, 1); })}>הסרת קישור / Remove link {index + 1}</button>
      </div>)}
      <button type="button" onClick={() => change(b => { b.links.push({ text: '', href: 'https://' }); })}>הוספת קישור או הפניה / Add link</button>
    </details>}
  </>;
}
