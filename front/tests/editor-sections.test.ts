import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteBlock } from '../../shared/src/site-content.js';
import { editableSections, guidePortrait, setGuidePortrait, insertSection, moveSection, removeSection } from '../app/components/editor-sections.js';
import { guideProfiles, tourSections } from '../app/components/content-sections.js';
import { LocalContentRepository } from '../../back/src/content-repository.js';

test('days can be inserted anywhere, renamed freely, moved and removed with their entire contents', async () => {
  const content = await (await LocalContentRepository.load()).getPublicContent();
  const page = content.pages.find(p => p.pageType === 'tour' && tourSections(p).days.length > 2)!;
  let blocks = insertSection(page.blocks, 'itinerary', 1, 'added-day');
  let groups = editableSections(blocks, 'itinerary');
  const added = groups[1]!; added.heading.text = 'טשקנט והיכרות עם העיר';
  assert.ok(tourSections({ ...page, blocks }).days.some(day => day.title === added.heading.text));
  const original = blocks.slice(added.start, added.end);
  blocks = moveSection(blocks, groups, 1, -1); groups = editableSections(blocks, 'itinerary');
  assert.deepEqual(blocks.slice(groups[0]!.start, groups[0]!.end), original);
  blocks = removeSection(blocks, groups[0]!);
  assert.equal(editableSections(blocks, 'itinerary').length, editableSections(page.blocks, 'itinerary').length);
  assert.ok(!blocks.some(b => b.anchorIds.includes('editor-day-added-day')));
  assert.deepEqual(blocks, page.blocks);
});
test('guide profiles preserve introduction, trailing content and stable links across additions/removals', async () => {
  const content = await (await LocalContentRepository.load()).getPublicContent();
  const page = content.pages.find(p => p.pageType === 'guides')!;
  const blocks = insertSection(page.blocks, 'guides', 1, 'new-guide');
  const groups = editableSections(blocks, 'guides');
  assert.equal(groups.length, editableSections(page.blocks, 'guides').length + 1);
  assert.equal(groups[1]!.heading.anchorIds[0], 'guide-new-guide');
  assert.deepEqual(removeSection(blocks, groups[1]!), page.blocks);
  let emptied = blocks;
  for (const group of [...editableSections(emptied, 'guides')].reverse()) emptied = removeSection(emptied, group);
  assert.equal(editableSections(emptied, 'guides').length, 0);
  const restored = insertSection(emptied, 'guides', 0, 'restored');
  assert.equal(editableSections(restored, 'guides').length, 1);
});
test('an empty trip receives its itinerary section and first day together', () => {
  const original: SiteBlock[] = [{ type: 'paragraph', text: 'Introduction', links: [], anchorIds: [] }];
  const blocks = insertSection(original, 'itinerary', 0, 'first');
  assert.equal(editableSections(blocks, 'itinerary').length, 1);
  assert.equal(original.length, 1);
});

test('guide portraits stay with their profile when edited, reordered or removed', async () => {
  const content = await (await LocalContentRepository.load()).getPublicContent();
  const page = content.pages.find(p => p.pageType === 'guides')!;
  const groups = editableSections(page.blocks, 'guides'), anchor = groups[1]!.heading.anchorIds[0]!;
  const original = structuredClone(page.blocks);
  let blocks = setGuidePortrait(page.blocks, anchor, 'drive-profile', groups[1]!.heading.text);
  const profiles = guideProfiles({ ...page, blocks });
  assert.equal(profiles.length, groups.length);
  assert.equal(guidePortrait(profiles[1]!.blocks)!.mediaId, 'drive-profile');
  assert.equal(guidePortrait(profiles[0]!.blocks), undefined);
  assert.deepEqual(page.blocks, original, 'Choosing a photo does not mutate the original body');
  assert.deepEqual(setGuidePortrait(blocks, anchor, null, 'name'), original, 'Removing the portrait preserves every other field');
  blocks = setGuidePortrait(blocks, anchor, 'another-photo', 'name');
  assert.equal(blocks.filter(b => b.type === 'image').length, original.filter(b => b.type === 'image').length + 1);
  blocks = moveSection(blocks, editableSections(blocks, 'guides'), 1, -1);
  assert.equal(guidePortrait(guideProfiles({ ...page, blocks })[0]!.blocks)!.mediaId, 'another-photo');
  blocks = setGuidePortrait(blocks, anchor, null, 'name');
  assert.equal(guidePortrait(guideProfiles({ ...page, blocks })[0]!.blocks), undefined);
  assert.deepEqual(setGuidePortrait(original, 'guide-missing', 'drive-profile', 'name'), original);
});
