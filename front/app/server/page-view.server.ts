import type { PublicSiteContent, SitePage } from '@roniella/shared/site-content';
import { itineraryDayCount } from '@roniella/shared/tour-schedule';
import { cardCopy, sourceCard } from '../components/content-sections';
import { scheduledBlocks } from '../components/editor-sections';
import { isEditorialPage } from '../components/editorial-config';
import { selectGalleryPhotos } from './gallery.server';

export function pageView(snapshot: PublicSiteContent, original: SitePage) {
  let page = original;
  let positions: number[] | undefined;
  if (page.pageType === 'tour' && page.syncItinerary !== false) {
    const facts = cardCopy(page, sourceCard(page, snapshot)?.summary ?? '');
    const blocks = scheduledBlocks(page.blocks, itineraryDayCount(facts.dates, facts.duration));
    if (blocks !== page.blocks) {
      positions = blocks.map(block => original.blocks.indexOf(block));
      page = { ...page, blocks };
    }
  }
  // Only the active page needs its full body. The home and testimonials views
  // additionally read guide profiles, tour bylines or reviews from another page.
  const pages = snapshot.pages.map(other => {
    if (other.id === page.id) return page;
    if (isEditorialPage(page) && other.pageType === 'guides' || page.pageType === 'testimonials' && other.path === '/') return other;
    const blocks = page.path === '/' && other.pageType === 'tour'
      ? other.blocks.filter(b => b.type === 'heading' && b.level === 2 && b.text.includes('עם ')).slice(0, 1) : [];
    return { ...other, blocks, videos: [], cards: other.pageType === 'tours' || other.path === '/' ? other.cards : [] };
  });
  const gallery = snapshot.gallery && { ...snapshot.gallery, photos: page.pageType === 'gallery'
    ? selectGalleryPhotos(snapshot.gallery.photos, snapshot.gallery.displayCount) : [] };
  const imageIds = new Set<string | null | undefined>(['bukhara', 'samarkand', 'china', ...Object.values(snapshot.photoSlots ?? {})]);
  for (const item of pages) {
    imageIds.add(item.heroMediaId);
    for (const block of item.blocks) if (block.type === 'image') imageIds.add(block.mediaId);
  }
  const media = snapshot.media.filter(asset => imageIds.has(asset.id));
  return { page, positions, content: { ...snapshot, pages, media, gallery, redirects: [] } };
}
