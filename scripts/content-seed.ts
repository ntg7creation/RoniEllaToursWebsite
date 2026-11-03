import type { PublicSiteContent, SiteMedia, GalleryPhoto } from "../shared/src/site-content.js";

type Value = string | number | boolean | null | object;
const literal = (value: Value): string => value === null ? "null" : typeof value === "number" || typeof value === "boolean"
  ? String(value) : `'${(typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;

// Offline and deterministic. This generator never connects to or modifies a database.
export function createContentSeed(content: PublicSiteContent): string {
  const statements = [
    "-- Generated from back/content by npm run db:seed. Review and import into an EMPTY schema only.",
    "begin;", "set local standard_conforming_strings = on;",
    "do $$ begin if exists(select 1 from public.content_site) or exists(select 1 from public.content_pages) then raise exception 'Content already exists; bootstrap refused. Edit existing rows or write a reviewed content migration.'; end if; end; $$;",
  ];
  const insert = (table: string, columns: string[], rows: Value[][]) => {
    if (rows.length) statements.push(`insert into public.${table} (${columns.join(", ")}) values\n${rows.map(row => `(${row.map(literal).join(", ")})`).join(",\n")};`);
  };
  const settings = content.siteSettings;
  const pageId = (path: string) => {
    const page = content.pages.find(page => page.path === path);
    if (!page) throw Error(`Missing page for ${path}`);
    return page.id;
  };
  insert("content_site", ["id","schema_version","content_source","crawl_run_id","notice","business_name","language","timezone","contact_phone","contact_email","contact_address"],
    [[true,content.schemaVersion,content.contentSource,content.crawlRunId,content.notice,settings.businessName,settings.language,settings.timezone,settings.contact.phone,settings.contact.email,settings.contact.address ?? null]]);
  const assets: ({asset:SiteMedia;position:number;kind:"site"} | {asset:GalleryPhoto;position:number;kind:"gallery"})[] = [
    ...content.media.map((asset,position) => ({asset,position,kind:"site" as const})),
    ...(content.gallery?.photos ?? []).map((asset,position) => ({asset,position,kind:"gallery" as const})),
  ];
  insert("content_media", ["id","kind","position","src","width","height","alt","caption","author","source_url","license","license_url","sizes"],
    assets.map(({asset,position,kind}) => [asset.id,kind,position,asset.src,asset.width,asset.height,asset.alt,
      ...(kind === "site" ? [asset.caption,asset.author,asset.source,asset.license,asset.licenseUrl,asset.sizes] : Array(6).fill(null))]));
  insert("content_media_variants", ["media_id","position","src","width"],
    assets.flatMap(({asset}) => asset.variants.map((variant,i) => [asset.id,i,variant.src,variant.width])));
  insert("content_pages", ["id","path","page_type","title","display_title","hero_media_id","seo_title","seo_description","publication_date","modification_date","source_retrieved_at","position","published","author_name","author_page_id"],
    content.pages.map((p,i) => [p.id,p.path,p.pageType,p.title,p.displayTitle ?? null,p.heroMediaId ?? null,p.seo.title,p.seo.description,p.publicationDate,p.modificationDate,p.sourceRetrievedAt,i,true,p.author?.name ?? null,p.author?.pageId ?? null]));
  insert("content_blocks", ["page_id","position","block_type","text","heading_level","anchor_ids","links","list_ordered","list_items","table_caption","table_rows"],
    content.pages.flatMap(p => p.blocks.map((b,i) => [p.id,i,b.type,"text" in b ? b.text : null,"level" in b ? b.level : null,b.anchorIds,b.links,
      b.type === "list" ? b.ordered : null,b.type === "list" ? b.items : null,b.type === "table" ? b.caption : null,b.type === "table" ? b.rows : null])));
  insert("content_page_cards", ["page_id","position","target_page_id","summary"],content.pages.flatMap(p => p.cards.map((c,i) => [p.id,i,c.pageId,c.summary])));
  insert("content_videos", ["page_id","position","title","description","external_url"],content.pages.flatMap(p => p.videos.map((v,i) => [p.id,i,v.title,v.description,v.externalUrl])));
  insert("content_navigation", ["location","position","label","page_id"],
    [...settings.navigation.map((n,i) => ["header",i,n.label,pageId(n.path)]),...settings.footerLinks.map((n,i) => ["footer",i,n.label,pageId(n.path)])]);
  insert("content_featured", ["collection","position","page_id"],
    [...settings.featuredTourIds.map((id,i) => ["tours",i,id]),...settings.featuredPostIds.map((id,i) => ["posts",i,id])]);
  insert("content_copy", ["area","slot","value"],Object.entries(content.presentation).map(([key,value]) => {
    const dot = key.lastIndexOf("."); if (dot < 1) throw Error(`Copy key needs area.slot: ${key}`);
    return [key.slice(0,dot),key.slice(dot+1),value];
  }));
  insert("content_redirects", ["position","from_path","from_query","to_page_id"],content.redirects.map((r,i) => [i,r.fromPath,r.fromQuery,pageId(r.toPath)]));
  const g = content.gallery;
  if (g) {
    insert("content_gallery", ["id","album_url","heading","introduction","source_label","shuffle_label","open_album_label","photo_alt_prefix","display_count","synced_at","album_title"],
      [[true,g.albumUrl,g.heading,g.introduction,g.sourceLabel,g.shuffleLabel,g.openAlbumLabel,g.photoAltPrefix,g.displayCount,g.syncedAt,g.albumTitle]]);
    insert("content_gallery_photos", ["position","media_id"],g.photos.map((p,i) => [i,p.id]));
  }
  statements.push("commit;", "");
  return statements.join("\n\n");
}

// Reviewed maintenance SQL for photos only. Database-edited prose/alt text stays authoritative.
export function createGalleryUpdate(content: PublicSiteContent): string {
  const gallery = content.gallery;
  if (!gallery || !gallery.photos.length || !gallery.syncedAt) throw Error("Sync a complete gallery before generating its database update");
  if (gallery.photos.some(photo => content.media.some(asset => asset.id === photo.id))) throw Error("Gallery IDs must not overlap editorial media IDs");
  const statements = ["-- Deploy the updated backend image files BEFORE applying this photo-membership update.","begin;","set local standard_conforming_strings = on;",
    "do $$ begin if not exists(select 1 from public.content_gallery) then raise exception 'Bootstrap the site before updating its gallery'; end if; end; $$;",
    `do $$ begin if exists(select 1 from public.content_media where kind <> 'gallery' and id = any(array[${gallery.photos.map(photo=>literal(photo.id)).join(",")}]::text[])) then raise exception 'Gallery IDs conflict with editorial media'; end if; end; $$;`];
  for (const [position,photo] of gallery.photos.entries()) {
    statements.push(`insert into public.content_media(id,kind,position,src,width,height,alt) values (${[photo.id,"gallery",position,photo.src,photo.width,photo.height,photo.alt].map(literal).join(",")})
on conflict(id) do update set src=excluded.src,width=excluded.width,height=excluded.height,position=excluded.position where content_media.kind='gallery';`);
    statements.push(`delete from public.content_media_variants where media_id=${literal(photo.id)};`);
    statements.push(`insert into public.content_media_variants(media_id,position,src,width) values ${photo.variants.map((variant,i)=>`(${[photo.id,i,variant.src,variant.width].map(literal).join(",")})`).join(",")};`);
  }
  statements.push("delete from public.content_gallery_photos;",
    `insert into public.content_gallery_photos(position,media_id) values ${gallery.photos.map((photo,i)=>`(${i},${literal(photo.id)})`).join(",")};`,
    `update public.content_gallery set album_url=${literal(gallery.albumUrl)},album_title=${literal(gallery.albumTitle)},synced_at=${literal(gallery.syncedAt)} where id;`,"commit;","");
  return statements.join("\n\n");
}
