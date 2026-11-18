import type { PageSettings } from '@roniella/shared/admin';
import type { SitePage, SiteBlock, PublicSiteContent } from '@roniella/shared/site-content';
import { defaultSharePhoto, seoDefaults, shareImage } from './seo.server';
import { serverConfig } from './config.server';

export function adminSeoPreview(body: { id: string; path: string; title: string; pageType: string; blocks: SiteBlock[]; settings: PageSettings; trip?: SitePage['tourDetails'] }, content: PublicSiteContent) {
  const live = content.pages.find(page => page.id === body.id);
  const settings = body.settings, origin = serverConfig.siteOrigin;
  const page: SitePage = live ?? { id:body.id, path:body.path, slug:null, pageType:body.pageType, title:body.title,
    summary:settings.summary, blocks:body.blocks, cards:[], videos:[], publicationDate:settings.publicationDate || null,
    modificationDate:null, sourceRetrievedAt:'', seo:{title:body.title,description:null,canonicalPath:body.path}, tourDetails:body.trip };
  const photo = defaultSharePhoto(content);
  return { base:seoDefaults(page,content,origin,serverConfig.noindex), fallbackImage:photo && shareImage(photo,origin),
    images:Object.fromEntries(content.media.map(asset=>[asset.id,shareImage(asset,origin)])) };
}
