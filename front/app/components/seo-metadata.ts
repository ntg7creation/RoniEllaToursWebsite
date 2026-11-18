export type ShareImage = { url: string; alt: string; width?: number; height?: number };
export type SeoDefaults = {
  canonical: string; siteName: string; title: string; description: string; siteNoindex: boolean;
  article: boolean; published?: string; modified?: string; verification?: string;
};
export type SeoValues = { title: string; description: string; keywords?: string[]; socialTitle?: string; socialDescription?: string; noindex?: boolean; author?: string; image?: ShareImage };
export type SeoRow = { element: 'title' | 'link' | 'meta'; attribute: '' | 'rel' | 'name' | 'property'; key: string; value: string };

// The marketing table and the server-rendered head use this same catalog.
export function seoRows(base: SeoDefaults, edits: SeoValues): SeoRow[] {
  const title = edits.title.trim() || base.title, description = (edits.description.trim() || base.description).replace(/\s+/g, ' ');
  const shareTitle = edits.socialTitle?.trim() || title, shareDescription = edits.socialDescription?.trim() || description;
  const tags: SeoRow[] = [{ element: 'title', attribute: '', key: 'title', value: title }];
  const meta = (attribute: 'name' | 'property', key: string, value?: string) => tags.push({element:'meta',attribute,key,value:value ?? ''});
  meta('name','description',description);
  tags.push({element:'link',attribute:'rel',key:'canonical',value:base.canonical});
  meta('name','robots',base.siteNoindex || edits.noindex ? 'noindex, nofollow' : 'index, follow');
  meta('name','keywords',edits.keywords?.join(', '));
  meta('name','author',edits.author);
  meta('property','og:type', base.article ? 'article' : 'website');
  meta('property','og:title', shareTitle);
  meta('property','og:description', shareDescription);
  meta('property','og:url', base.canonical);
  meta('property','og:site_name', base.siteName);
  meta('property','og:locale', 'he_IL');
  const image = edits.image;
  meta('property','og:image', image?.url);
  meta('property','og:image:alt', image?.alt);
  meta('property','og:image:width',image?.width?.toString());
  meta('property','og:image:height',image?.height?.toString());
  meta('property','og:image:type',image && /\.jpe?g$/i.test(new URL(image.url).pathname) ? 'image/jpeg' : '');
  meta('name','twitter:card',image ? 'summary_large_image' : 'summary');
  meta('name','twitter:title',shareTitle);
  meta('name','twitter:description',shareDescription);
  meta('name','twitter:image',image?.url);
  meta('name','twitter:image:alt',image?.alt);
  if (base.article) {
    meta('property','article:published_time',base.published);
    meta('property','article:modified_time',base.modified);
    for (const keyword of edits.keywords?.length ? edits.keywords : ['']) meta('property','article:tag',keyword);
  }
  if (base.verification) meta('name','google-site-verification',base.verification);
  return tags;
}
