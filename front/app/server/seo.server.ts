import type { PublicSiteContent, SitePage } from "@roniella/shared/site-content";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
function excerpt(value: string, limit = 165) {
  const text = clean(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > limit / 2 ? cut.lastIndexOf(" ") : cut.length) + "…";
}
export function pageDescription(page: SitePage, content: PublicSiteContent) {
  if (page.seo.description?.trim()) return clean(page.seo.description);
  if (page.pageType === "gallery" && content.gallery) return excerpt(content.gallery.introduction);
  if (["tours","blog","destinationArchive","categoryArchive","authorArchive"].includes(page.pageType)) {
    const titles = page.cards.map(card => content.pages.find(p => p.id === card.pageId)?.title).filter(Boolean);
    return excerpt(`${page.title} | ${content.siteSettings.businessName}. ${titles.join(" · ")}`);
  }
  const paragraph = page.blocks.find(block => block.type === "paragraph" && clean(block.text).length > 70);
  return excerpt(`${page.title}. ${paragraph?.type === "paragraph" ? paragraph.text : content.siteSettings.businessName}`);
}
function isoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return undefined;
  const parsed = new Date(value), day = new Date(`${value.slice(0,10)}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && Number.isFinite(day.getTime()) && day.toISOString().startsWith(value.slice(0,10)) ? value : undefined;
}
export function pageBreadcrumbs(page: SitePage, content: PublicSiteContent) {
  if (page.path === "/") return [];
  const parent = page.pageType === "tour" ? content.pages.find(p => p.pageType === "tours")
    : page.pageType === "article" ? content.pages.find(p => p.pageType === "blog") : undefined;
  return [{ title: "דף הבית", path: "/" }, ...(parent ? [{title:parent.title,path:parent.path}] : []),
    { title: page.displayTitle ?? page.title, path: page.path }];
}
export function buildPageSeo(page: SitePage, content: PublicSiteContent, origin: string) {
  const url = (path: string) => new URL(path, origin).href;
  const canonical = url(page.seo.canonicalPath), description = pageDescription(page, content);
  const settings = content.siteSettings, organizationId = url("/#organization"), websiteId = url("/#website");
  const pageId = `${canonical}#webpage`;
  const breadcrumbs = pageBreadcrumbs(page, content);
  const hero = content.media.find(image => image.id === page.heroMediaId);
  const sharePhoto = hero ?? content.media.find(image => image.id === "samarkand") ?? content.media[0];
  const photoDetails = (photo: PublicSiteContent["media"][number]) => {
    // Source dimensions describe the aspect ratio; src can be a smaller variant.
    const width = photo.variants.find(variant => variant.src === photo.src)?.width ?? photo.width;
    return { url:url(photo.src), alt:photo.alt, width, height:Math.round(photo.height * width / photo.width) };
  };
  const image = sharePhoto ? photoDetails(sharePhoto) : undefined;
  const authorPage = content.pages.find(candidate=>candidate.id === page.author?.pageId);
  const authorId = page.author ? `${authorPage ? url(authorPage.path) : canonical}#author` : undefined;
  const graph: Record<string, unknown>[] = [
    { "@type":"Organization", "@id":organizationId, name:settings.businessName, url:url("/"),
      telephone:settings.contact.phone, email:settings.contact.email,
      ...(settings.contact.address ? {address:settings.contact.address} : {}) },
    { "@type":"WebSite", "@id":websiteId, url:url("/"), name:settings.businessName,
      inLanguage:settings.language, publisher:{"@id":organizationId} },
    { "@type":page.pageType === "about" ? "AboutPage" : page.pageType === "contact" ? "ContactPage"
      : ["tours","blog","destinationArchive","categoryArchive","authorArchive","gallery"].includes(page.pageType) ? "CollectionPage" : "WebPage",
      "@id":pageId, url:canonical, name:page.seo.title, description, inLanguage:settings.language,
      isPartOf:{"@id":websiteId}, ...(breadcrumbs.length ? {breadcrumb:{"@id":`${canonical}#breadcrumbs`}} : {}),
      ...(hero ? {primaryImageOfPage:{"@type":"ImageObject",contentUrl:url(hero.src),caption:hero.alt,width:photoDetails(hero).width,height:photoDetails(hero).height}} : {}),
      ...(page.pageType === "article" ? {mainEntity:{"@id":`${canonical}#article`}} : {}) },
  ];
  if (breadcrumbs.length) graph.push({ "@type":"BreadcrumbList", "@id":`${canonical}#breadcrumbs`,
    itemListElement:breadcrumbs.map((crumb,index)=>({"@type":"ListItem",position:index+1,name:crumb.title,item:url(crumb.path)})) });
  if (page.pageType === "article") graph.push({ "@type":"BlogPosting", "@id":`${canonical}#article`,
    headline:page.title, description, url:canonical, inLanguage:settings.language,
    mainEntityOfPage:{"@id":pageId}, publisher:{"@id":organizationId},
    ...(authorId ? {author:{"@id":authorId}} : {}),
    ...(isoDate(page.publicationDate) ? {datePublished:isoDate(page.publicationDate)} : {}),
    ...(isoDate(page.modificationDate) ? {dateModified:isoDate(page.modificationDate)} : {}),
    ...(hero ? {image:[url(hero.src)]} : {}),
  });
  if (page.pageType === "article" && page.author && authorId)
    graph.push({"@type":"Person","@id":authorId,name:page.author.name,...(authorPage ? {url:url(authorPage.path)} : {})});
  return { description, image, breadcrumbs,
    articleDates:page.pageType === "article" ? {published:isoDate(page.publicationDate),modified:isoDate(page.modificationDate)} : undefined,
    structuredData:{"@context":"https://schema.org","@graph":graph} };
}
