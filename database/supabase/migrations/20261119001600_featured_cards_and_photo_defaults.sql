-- A tour may have dates and prices without being featured on the homepage.
create or replace function public.read_site_content_v1() returns jsonb
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
      'seo',jsonb_build_object('title',coalesce(nullif(btrim(p.seo_title),''),p.title || ' | ' || (select business_name from public.content_site where id)),'description',p.seo_description,'canonicalPath',p.path),
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
        from (
          select c.target_page_id,c.summary,c.position from public.content_page_cards c
          join public.content_pages target on target.id=c.target_page_id and target.published where c.page_id=p.id
          union all
          select target.id,coalesce((select left(b.text,220) from public.content_blocks b
            where b.page_id=target.id and b.block_type='paragraph' order by b.position limit 1),''),
            100000+target.position
          from public.content_pages target
          where target.published and ((p.page_type='blog' and target.page_type='article') or ((p.page_type='tours' or (p.path='/' and exists(select 1 from public.content_featured f where f.collection='tours' and f.page_id=target.id))) and target.page_type='tour'))
            and not exists(select 1 from public.content_page_cards existing where existing.page_id=p.id and existing.target_page_id=target.id)
        ) c),'[]'::jsonb),
      'videos',coalesce((select jsonb_agg(jsonb_build_object('title',v.title,'description',v.description,'externalUrl',v.external_url) order by v.position)
        from public.content_videos v where v.page_id=p.id),'[]'::jsonb))
    || case when p.author_name is not null then jsonb_build_object('author',
      jsonb_build_object('name',p.author_name) || case when exists(select 1 from public.content_pages author where author.id=p.author_page_id and author.published)
        then jsonb_build_object('pageId',p.author_page_id) else '{}'::jsonb end) else '{}'::jsonb end
    || case when exists(select 1 from public.content_trip_details td where td.page_id=p.id) then jsonb_build_object('tourDetails',(select to_jsonb(td)-'page_id'-'updated_at' from public.content_trip_details td where td.page_id=p.id)) else '{}'::jsonb end
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

-- Show the editor the same default cover the public section uses.
create or replace function public.admin_read_photo_slot(p_slot text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.site_photo_slots; default_id text; title_value text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  case p_slot
    when 'home.hero' then default_id:=coalesce((select hero_media_id from public.content_pages where path='/'),'samarkand');title_value:='תמונת פתיח דף הבית';
    when 'home.approach' then default_id:=coalesce((select hero_media_id from public.content_pages where path='/about/'),'samarkand');title_value:='תמונת הגישה שלנו';
    when 'tour.april.interlude' then default_id:=coalesce((select hero_media_id from public.content_pages where id='page-1259e55f-578c-4db2-90b6-274d43d51283'),'bukhara');title_value:='תמונת מעבר בעמוד המסע';
    else raise exception 'Unknown photo slot' using errcode='22023';
  end case;
  select * into item from public.site_photo_slots where slot=p_slot;
  return jsonb_build_object('slot',p_slot,'title',title_value,'mediaId',case when found then item.media_id else default_id end,
    'revision',coalesce(item.updated_at::text,'0'),'media',public.admin_photo_library()->'media');
end $$;
