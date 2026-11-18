import type { SiteBlock } from '@roniella/shared/site-content';

export type SectionKind = 'itinerary' | 'guides';
export type EditableSection = { start: number; end: number; heading: Extract<SiteBlock, { type: 'heading' }> };
export const guidePortrait=(blocks:SiteBlock[])=>blocks.find((block):block is Extract<SiteBlock,{type:'image'}>=>block.type==='image'&&block.anchorIds.some(id=>id.startsWith('editor-guide-photo-')))
  ??blocks.find((block):block is Extract<SiteBlock,{type:'image'}>=>block.type==='image');
export function setGuidePortrait(blocks:SiteBlock[],anchor:string,mediaId:string|null,alt:string):SiteBlock[]{
  const next=structuredClone(blocks),group=editableSections(next,'guides').find(item=>item.heading.anchorIds.includes(anchor));
  if(!group)return blocks;
  const existing=guidePortrait(next.slice(group.start+1,group.end)),index=existing?next.indexOf(existing):group.start+1;
  if(mediaId===null){if(existing)next.splice(index,1);return next;}
  const marker='editor-guide-photo-'+anchor;
  const image:Extract<SiteBlock,{type:'image'}>={type:'image',mediaId,alt,caption:'',align:'full',links:[],anchorIds:existing?[...existing.anchorIds]:[]};
  if(!image.anchorIds.some(id=>id.startsWith('editor-guide-photo-')))image.anchorIds.push(marker);
  next.splice(index,existing?1:0,image);return next;
}
const isSection = (b: SiteBlock, anchor: string, title: string) => b.type === 'heading' && (b.anchorIds.includes(anchor) || b.text === title);
export function sectionBounds(blocks: SiteBlock[], kind: SectionKind) {
  if (kind === 'guides') {
    const start = blocks.findIndex(b => b.type === 'heading' && b.anchorIds.some(id => id.startsWith('guide-')));
    const end = blocks.findIndex((b, i) => i > start && b.type === 'heading' && b.level === 2 && !b.anchorIds.some(id => id.startsWith('guide-')));
    return { start: start < 0 ? blocks.length : start, end: end < 0 ? blocks.length : end };
  }
  const start = blocks.findIndex(b => isSection(b, 'editor-itinerary', 'מסלול הטיול'));
  const end = blocks.findIndex((b, i) => i > start && (isSection(b, 'editor-prices', 'תאריכי יציאה ומחירים') || isSection(b, 'editor-terms', 'תנאים והערות')));
  return { start: start < 0 ? blocks.length : start + 1, end: end < 0 ? blocks.length : end };
}
export function editableSections(blocks: SiteBlock[], kind: SectionKind): EditableSection[] {
  const bounds = sectionBounds(blocks, kind);
  const sections: EditableSection[] = [];
  blocks.forEach((block, index) => {
    if (index < bounds.start || index >= bounds.end || block.type !== 'heading') return;
    const match = kind === 'guides' ? block.anchorIds.some(id => id.startsWith('guide-'))
      : block.anchorIds.some(id => id.startsWith('editor-day-')) || /^(?:היום|יום|ימים)\s/.test(block.text);
    if (match) {
      if (sections.length) sections.at(-1)!.end = index;
      sections.push({ start: index, end: bounds.end, heading: block });
    }
  });
  return sections;
}
export function insertSection(blocks: SiteBlock[], kind: SectionKind, position: number, token: string): SiteBlock[] {
  const next = structuredClone(blocks), sections = editableSections(next, kind);
  if (kind === 'itinerary' && !next.some(b => isSection(b, 'editor-itinerary', 'מסלול הטיול'))) {
    const boundary = next.findIndex(b => isSection(b, 'editor-prices', 'תאריכי יציאה ומחירים') || isSection(b, 'editor-terms', 'תנאים והערות'));
    next.splice(boundary < 0 ? next.length : boundary, 0, { type: 'heading', level: 2, text: 'מסלול הטיול', anchorIds: ['editor-itinerary'], links: [] });
  }
  const index = sections[position]?.start ?? sectionBounds(next, kind).end;
  next.splice(index, 0,
    { type: 'heading', level: 3, text: kind === 'guides' ? 'שם המדריך או המדריכה' : `יום ${position + 1} — כותרת היום`, anchorIds: [kind === 'guides' ? `guide-${token}` : `editor-day-${token}`], links: [] },
    { type: 'paragraph', text: kind === 'guides' ? 'תפקיד ורקע מקצועי' : 'תיאור היום', anchorIds: [], links: [] });
  return next;
}
export function removeSection(blocks: SiteBlock[], section: EditableSection) {
  return blocks.filter((_, index) => index < section.start || index >= section.end);
}

// A new day starts with just its heading. Keep original block references and
// stable ordering so shrinking a schedule never deletes authored text or images.
export function scheduledBlocks(blocks: SiteBlock[], count: number | null, includeHidden = false): SiteBlock[] {
  if (count === null) return blocks;
  const sections = editableSections(blocks, 'itinerary');
  if (sections.length >= count) {
    if (includeHidden || sections.length === count) return blocks;
    return [...blocks.slice(0, sections[count]!.start), ...blocks.slice(sections.at(-1)!.end)];
  }
  const next = [...blocks];
  if (!next.some(block => isSection(block, 'editor-itinerary', 'מסלול הטיול'))) {
    const boundary = next.findIndex(block => isSection(block, 'editor-prices', 'תאריכי יציאה ומחירים') || isSection(block, 'editor-terms', 'תנאים והערות'));
    next.splice(boundary < 0 ? next.length : boundary, 0, { type: 'heading', level: 2, text: 'מסלול הטיול', anchorIds: ['editor-itinerary'], links: [] });
  }
  const insertion = sectionBounds(next, 'itinerary').end;
  const used = new Set(blocks.flatMap(block => block.anchorIds));
  const headings: SiteBlock[] = [];
  for (let day = sections.length + 1; day <= count; day++) {
    let anchor = 'editor-day-scheduled-' + day;
    while (used.has(anchor)) anchor += '-new';
    used.add(anchor);
    headings.push({ type: 'heading', level: 3, text: 'יום ' + day, anchorIds: [anchor], links: [] });
  }
  next.splice(insertion, 0, ...headings);
  return next;
}
export function moveSection(blocks: SiteBlock[], sections: EditableSection[], index: number, direction: -1 | 1) {
  const current = sections[index], adjacent = sections[index + direction];
  if (!current || !adjacent) return blocks;
  const next = [...blocks], group = next.splice(current.start, current.end - current.start);
  next.splice(direction < 0 ? adjacent.start : adjacent.end - group.length, 0, ...group);
  return next;
}
