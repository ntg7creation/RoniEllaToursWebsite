-- One statement / one database snapshot: preserve the existing validated HTTP contract.
-- SECURITY INVOKER and explicit grants avoid a privileged, publicly executable RPC.
create function public.read_site_content() returns jsonb
language sql stable security invoker set search_path = '' as $$
with media as (
  select m.id, m.kind, m.position,
    jsonb_build_object('id',m.id,'src',m.src,'width',m.width,'height',m.height,'alt',m.alt,
      'variants',coalesce((select jsonb_agg(jsonb_build_object('src',v.src,'width',v.width) order by v.position)
        from public.content_media_variants v where v.media_id=m.id),'[]'::jsonb))
    || case when m.kind='site' then jsonb_build_object('caption',m.caption,'author',m.author,
      'source',m.source_url,'license',m.license,'licenseUrl',m.license_url,'sizes',m.sizes) else '{}'::jsonb end as value
  from public.content_media m
), pages as (
  select p.id,p.path,p.page_type,p.position,
    jsonb_build_object('id',p.id,'path',p.path,
      'slug',case when p.path='/' then null else regexp_replace(p.path,'^.*/([^/]+)/$','\1') end,
      'pageType',p.page_type,'title',p.title,'heroMediaId',p.hero_media_id,
      'seo',jsonb_build_object('title',p.seo_title,'description',p.seo_description,'canonicalPath',p.path),
      'publicationDate',p.publication_date,'modificationDate',p.modification_date,
      'sourceRetrievedAt',to_char(p.source_retrieved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'blocks',coalesce((select jsonb_agg(
        jsonb_build_object('type',b.block_type,'anchorIds',b.anchor_ids,'links',b.links) ||
        case b.block_type
          when 'paragraph' then jsonb_build_object('text',b.text)
          when 'heading' then jsonb_build_object('text',b.text,'level',b.heading_level)
          when 'list' then jsonb_build_object('ordered',b.list_ordered,'items',b.list_items)
          when 'table' then jsonb_build_object('caption',b.table_caption,'rows',b.table_rows)
        end order by b.position) from public.content_blocks b where b.page_id=p.id),'[]'::jsonb),
      'cards',coalesce((select jsonb_agg(jsonb_build_object('pageId',c.target_page_id,'summary',c.summary) order by c.position)
        from public.content_page_cards c join public.content_pages target on target.id=c.target_page_id and target.published
        where c.page_id=p.id),'[]'::jsonb),
      'videos',coalesce((select jsonb_agg(jsonb_build_object('title',v.title,'description',v.description,'externalUrl',v.external_url) order by v.position)
        from public.content_videos v where v.page_id=p.id),'[]'::jsonb))
    || case when p.display_title is not null then jsonb_build_object('displayTitle',p.display_title) else '{}'::jsonb end as value
  from public.content_pages p where p.published
)
select jsonb_build_object(
  'schemaVersion',s.schema_version,'contentSource',s.content_source,'crawlRunId',s.crawl_run_id,'notice',s.notice,
  'siteSettings',jsonb_build_object('businessName',s.business_name,'language',s.language,'timezone',s.timezone,
    'contact',jsonb_strip_nulls(jsonb_build_object('phone',s.contact_phone,'email',s.contact_email,'address',s.contact_address)),
    'navigation',coalesce((select jsonb_agg(jsonb_build_object('label',n.label,'path',p.path) order by n.position)
      from public.content_navigation n join pages p on p.id=n.page_id where n.location='header'),'[]'::jsonb),
    'footerLinks',coalesce((select jsonb_agg(jsonb_build_object('label',n.label,'path',p.path) order by n.position)
      from public.content_navigation n join pages p on p.id=n.page_id where n.location='footer'),'[]'::jsonb),
    'featuredTourIds',coalesce((select jsonb_agg(f.page_id order by f.position) from public.content_featured f
      join pages p on p.id=f.page_id and p.page_type='tour' where f.collection='tours'),'[]'::jsonb),
    'featuredPostIds',coalesce((select jsonb_agg(f.page_id order by f.position) from public.content_featured f
      join pages p on p.id=f.page_id and p.page_type='article' where f.collection='posts'),'[]'::jsonb)),
  'pages',coalesce((select jsonb_agg(p.value order by p.position) from pages p),'[]'::jsonb),
  'presentation',coalesce((select jsonb_object_agg(c.key,c.value) from public.content_copy c),'{}'::jsonb),
  'redirects',coalesce((select jsonb_agg(jsonb_build_object('fromPath',r.from_path,'fromQuery',r.from_query,'toPath',p.path) order by r.position)
    from public.content_redirects r join pages p on p.id=r.to_page_id),'[]'::jsonb),
  'media',coalesce((select jsonb_agg(m.value order by m.position) from media m where m.kind='site'),'[]'::jsonb),
  'gallery',(select jsonb_build_object('schemaVersion',1,'provider','google-photos','albumUrl',g.album_url,
    'heading',g.heading,'introduction',g.introduction,'sourceLabel',g.source_label,'shuffleLabel',g.shuffle_label,
    'openAlbumLabel',g.open_album_label,'photoAltPrefix',g.photo_alt_prefix,'displayCount',g.display_count,
    'syncedAt',to_char(g.synced_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'albumTitle',g.album_title,
    'photos',coalesce((select jsonb_agg(m.value order by gp.position) from public.content_gallery_photos gp
      join media m on m.id=gp.media_id and m.kind='gallery'),'[]'::jsonb)) from public.content_gallery g where g.id)
) from public.content_site s where s.id;
$$;
revoke all on function public.read_site_content() from public, anon, authenticated, service_role;
grant execute on function public.read_site_content() to service_role;
comment on function public.read_site_content() is 'Server-only public projection, excluding draft pages. Matches PublicSiteContentSchema version 2.';
