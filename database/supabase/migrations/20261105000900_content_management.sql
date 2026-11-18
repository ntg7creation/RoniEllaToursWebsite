-- Text management and reversible publication. Media and credentials are untouched.
create table public.content_trip_details (
  page_id text primary key references public.content_pages(id) on delete cascade,
  summary text not null default '', dates text not null default '',
  duration text not null default '', price text not null default '',
  guide text not null default '', status text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.content_trip_details enable row level security;
revoke all on public.content_trip_details from public,anon,authenticated,service_role;
grant select on public.content_trip_details to service_role;
create trigger touch_updated_at before update on public.content_trip_details
for each row execute function public.content_touch_updated_at();

-- A monotonic revision is checked by every public content read, including reads
-- served by another serverless instance. TTL alone must not hide saved changes.
create table public.content_revision (id boolean primary key default true check(id), revision bigint not null default 1);
insert into public.content_revision(id) values(true);
alter table public.content_revision enable row level security;
revoke all on public.content_revision from public,anon,authenticated,service_role;
grant select on public.content_revision to service_role;
create function public.bump_content_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin update public.content_revision set revision=revision+1 where id; return null; end;
$$;
revoke all on function public.bump_content_revision() from public,anon,authenticated,service_role;
do $$ declare t text; begin
  foreach t in array array['content_site','content_media','content_media_variants','content_pages','content_blocks',
    'content_page_cards','content_videos','content_navigation','content_featured','content_copy',
    'content_redirects','content_gallery','content_gallery_photos','content_trip_details'] loop
    execute format('create trigger publish_revision after insert or update or delete on public.%I for each statement execute function public.bump_content_revision()',t);
  end loop;
end $$;
create function public.read_site_revision() returns text
language sql stable security invoker set search_path='' as $$ select revision::text from public.content_revision where id $$;
revoke all on function public.read_site_revision() from public,anon,authenticated,service_role;
grant execute on function public.read_site_revision() to service_role;

-- Body and detail edits also invalidate the parent page's optimistic lock.
create function public.touch_content_parent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.content_pages set updated_at=clock_timestamp() where id=coalesce(new.page_id,old.page_id);
  return null;
end $$;
revoke all on function public.touch_content_parent() from public,anon,authenticated,service_role;
create trigger touch_parent after insert or update or delete on public.content_blocks for each row execute function public.touch_content_parent();
create trigger touch_parent after insert or update or delete on public.content_trip_details for each row execute function public.touch_content_parent();

create function public.editor_section_anchor(label text) returns text language sql immutable set search_path='' as $$
  select case label when 'מסלול הטיול' then 'editor-itinerary' when 'תאריכי יציאה ומחירים' then 'editor-prices' when 'תנאים והערות' then 'editor-terms' when 'למה לטייל איתנו' then 'editor-more' end
$$;
revoke all on function public.editor_section_anchor(text) from public,anon,authenticated,service_role;
create function public.preserve_editor_section() returns trigger language plpgsql security definer set search_path='' as $$
declare anchor text:=public.editor_section_anchor(old.text);
begin
  if old.block_type='heading' and anchor is not null and not new.anchor_ids ? anchor and exists(select 1 from public.content_pages where id=new.page_id and page_type='tour') then new.anchor_ids:=new.anchor_ids||jsonb_build_array(anchor); end if;
  return new;
end $$;
revoke all on function public.preserve_editor_section() from public,anon,authenticated,service_role;
create trigger preserve_section before update on public.content_blocks for each row execute function public.preserve_editor_section();

-- Stable section anchors survive edits to the visible Hebrew section headings.
update public.content_blocks b set anchor_ids=anchor_ids || jsonb_build_array(case text
  when 'מסלול הטיול' then 'editor-itinerary' when 'תאריכי יציאה ומחירים' then 'editor-prices'
  when 'תנאים והערות' then 'editor-terms' else 'editor-more' end)
where block_type='heading' and text in ('מסלול הטיול','תאריכי יציאה ומחירים','תנאים והערות','למה לטייל איתנו')
and exists(select 1 from public.content_pages p where p.id=b.page_id and p.page_type='tour');

create table public.site_admin_requests (
  request_id uuid primary key, actor_id uuid not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.site_admin_requests enable row level security;
revoke all on public.site_admin_requests from public,anon,authenticated,service_role;

-- JSON is only a wire format. Both this validator and the application validate
-- the stored block contract, so direct RPC callers cannot publish malformed data.
create function public.validate_editor_blocks(blocks jsonb) returns void
language plpgsql set search_path='' as $$
declare b jsonb; item jsonb; child jsonb; row_value jsonb; cell jsonb; links jsonb; link jsonb; value jsonb;
begin
  if jsonb_typeof(blocks) is distinct from 'array' or jsonb_array_length(blocks) not between 1 and 500 or octet_length(blocks::text)>900000 then
    raise exception 'Invalid body' using errcode='22023'; end if;
  for b in select * from jsonb_array_elements(blocks) loop
    if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b->'anchorIds') is distinct from 'array'
       or jsonb_typeof(b->'links') is distinct from 'array' then raise exception 'Invalid block' using errcode='22023'; end if;
    for value in select * from jsonb_array_elements(b->'anchorIds') loop
      if jsonb_typeof(value)<>'string' or length(value#>>'{}') not between 1 and 200 then raise exception 'Invalid anchor' using errcode='22023'; end if;
    end loop;
    case b->>'type'
      when 'heading' then
        if coalesce(b->>'level','') !~ '^[2-6]$' then raise exception 'Invalid heading' using errcode='22023'; end if;
      when 'paragraph' then null;
      when 'list' then
        if jsonb_typeof(b->'ordered') is distinct from 'boolean' or jsonb_typeof(b->'items') is distinct from 'array' or jsonb_array_length(b->'items')>200 then raise exception 'Invalid list' using errcode='22023'; end if;
        for item in select * from jsonb_array_elements(b->'items') loop
          if jsonb_typeof(item->'text') is distinct from 'string' or jsonb_typeof(item->'links') is distinct from 'array' or jsonb_typeof(item->'children') is distinct from 'array' or item-array['text','links','children']<>'{}'::jsonb then raise exception 'Invalid item' using errcode='22023'; end if;
          for child in select * from jsonb_array_elements(item->'children') loop
            if jsonb_typeof(child->'ordered') is distinct from 'boolean' or jsonb_typeof(child->'items') is distinct from 'array' or child-array['ordered','items']<>'{}'::jsonb then raise exception 'Invalid nested list' using errcode='22023'; end if;
            for value in select * from jsonb_array_elements(child->'items') loop
              if jsonb_typeof(value)<>'string' then raise exception 'Invalid list text' using errcode='22023'; end if;
            end loop;
          end loop;
        end loop;
      when 'table' then
        if jsonb_typeof(b->'caption') not in ('string','null') or not b ? 'caption' or jsonb_typeof(b->'rows') is distinct from 'array' then raise exception 'Invalid table' using errcode='22023'; end if;
        for row_value in select * from jsonb_array_elements(b->'rows') loop
          if jsonb_typeof(row_value)<>'array' then raise exception 'Invalid row' using errcode='22023'; end if;
          for cell in select * from jsonb_array_elements(row_value) loop
            if jsonb_typeof(cell->'text') is distinct from 'string' or jsonb_typeof(cell->'isHeader') is distinct from 'boolean' or jsonb_typeof(cell->'links') is distinct from 'array' or cell-array['text','isHeader','links','rowspan','colspan']<>'{}'::jsonb then raise exception 'Invalid cell' using errcode='22023'; end if;
            foreach links in array array[cell->'rowspan',cell->'colspan'] loop
              if links is null or (links<>'null'::jsonb and (jsonb_typeof(links)<>'number' or (links#>>'{}') !~ '^[1-9][0-9]{0,3}$')) then raise exception 'Invalid span' using errcode='22023'; end if;
            end loop;
          end loop;
        end loop;
      else raise exception 'Unknown block' using errcode='22023';
    end case;
    if b->>'type' in ('heading','paragraph') and (jsonb_typeof(b->'text') is distinct from 'string' or length(btrim(b->>'text'))=0) then raise exception 'Text required' using errcode='22023'; end if;
  end loop;
  for value in select jsonb_path_query(blocks,'strict $.** ? (@.type() == "string")') loop
    if length(value#>>'{}')>20000 then raise exception 'Text too long' using errcode='22023'; end if;
  end loop;
  for links in select jsonb_path_query(blocks,'lax $.**.links') loop
    if jsonb_typeof(links)<>'array' then raise exception 'Invalid links' using errcode='22023'; end if;
    for link in select * from jsonb_array_elements(links) loop
      if link-array['text','href']<>'{}'::jsonb or jsonb_typeof(link->'text') is distinct from 'string' or length(link->>'text')=0 or
        jsonb_typeof(link->'href') is distinct from 'string' or link->>'href' ~ '[[:cntrl:]\\]' or
        not (link->>'href'='/' or link->>'href' ~ '^/[^/]' or link->>'href' ~ '^(https?://|mailto:|tel:)') then
        raise exception 'Invalid link' using errcode='22023'; end if;
    end loop;
  end loop;
end $$;
revoke all on function public.validate_editor_blocks(jsonb) from public,anon,authenticated,service_role;

create function public.admin_manage_read(p_key text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_key is null then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'path',path,'published',published,'revision',updated_at::text) order by position),'[]') into result from public.content_pages where page_type='tour';
  else
    select jsonb_build_object('id',p.id,'title',p.title,'revision',p.updated_at::text,'blocks',coalesce((select jsonb_agg(
      jsonb_build_object('type',b.block_type,'anchorIds',b.anchor_ids || case when p.page_type='tour' and b.block_type='heading' and public.editor_section_anchor(b.text) is not null and not b.anchor_ids ? public.editor_section_anchor(b.text) then jsonb_build_array(public.editor_section_anchor(b.text)) else '[]'::jsonb end,'links',b.links) || case b.block_type
        when 'heading' then jsonb_build_object('text',b.text,'level',b.heading_level)
        when 'paragraph' then jsonb_build_object('text',b.text)
        when 'list' then jsonb_build_object('ordered',b.list_ordered,'items',b.list_items)
        when 'table' then jsonb_build_object('caption',b.table_caption,'rows',b.table_rows) end order by b.position)
      from public.content_blocks b where b.page_id=p.id),'[]')) into result from public.content_pages p where p.id=p_key;
    if result is null then raise exception 'Page missing' using errcode='P0002'; end if;
  end if;
  return result;
end $$;
revoke all on function public.admin_manage_read(text) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_read(text) to authenticated;

create function public.admin_manage_content(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.content_pages; b jsonb; n integer:=0; id_value text; path_value text; result jsonb;
  details jsonb; request_key uuid; prior public.site_admin_requests; operation text:=command->>'operation'; email_value text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if octet_length(command::text)>1000000 then raise exception 'Request too large' using errcode='22023'; end if;
  select email into email_value from auth.users where id=auth.uid();
  -- Serializes structural mutations and prevents slug/position allocation races.
  perform pg_advisory_xact_lock(741943291);
  if operation='create_trip' then
    request_key:=(command->>'requestId')::uuid; details:=command->'trip';
    select * into prior from public.site_admin_requests where request_id=request_key;
    if found then
      if prior.actor_id<>auth.uid() or prior.payload<>command then raise exception 'Request already used' using errcode='40001'; end if;
      return prior.result;
    end if;
    if jsonb_typeof(details) is distinct from 'object' or coalesce(details->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(details->>'slug')>100 then raise exception 'Invalid address' using errcode='22023'; end if;
    foreach id_value in array array['title','summary','overview','dates','duration','price','guide','status'] loop
      if jsonb_typeof(details->id_value) is distinct from 'string' or length(details->>id_value)>(case when id_value='overview' then 20000 else 2000 end) then raise exception 'Invalid trip text' using errcode='22023'; end if;
    end loop;
    if length(btrim(details->>'title')) not between 1 and 300 or length(btrim(details->>'summary'))=0 or length(btrim(details->>'overview'))=0 then raise exception 'Trip text required' using errcode='22023'; end if;
    id_value:='tour-'||replace(request_key::text,'-',''); path_value:='/tours/'||(details->>'slug')||'/';
    if exists(select 1 from public.content_pages where path=path_value) or exists(select 1 from public.content_redirects where from_path=path_value) then raise exception 'Address already used' using errcode='23505'; end if;
    insert into public.content_pages(id,path,page_type,title,position,published) values(id_value,path_value,'tour',btrim(details->>'title'),(select coalesce(max(position),-1)+1 from public.content_pages),false);
    insert into public.content_trip_details(page_id,summary,dates,duration,price,guide,status)
      values(id_value,details->>'summary',details->>'dates',details->>'duration',details->>'price',details->>'guide',details->>'status');
    insert into public.content_featured(collection,position,page_id) values('tours',(select coalesce(max(position),-1)+1 from public.content_featured where collection='tours'),id_value);
    insert into public.content_blocks(page_id,position,block_type,text,heading_level,anchor_ids) values
      (id_value,0,'paragraph',details->>'overview',null,'[]'),
      (id_value,1,'heading','מסלול הטיול',2,'["editor-itinerary"]'),
      (id_value,2,'heading','תאריכי יציאה ומחירים',2,'["editor-prices"]'),
      (id_value,3,'heading','תנאים והערות',2,'["editor-terms"]');
    result:=jsonb_build_object('id',id_value,'path',path_value,'published',false);
    insert into public.site_admin_requests values(request_key,auth.uid(),command,result,now());
    insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),email_value,jsonb_build_object('operation',operation,'key',id_value),'null',details);
    return result;
  end if;
  select * into p from public.content_pages where id=command->>'key' for update;
  if not found then raise exception 'Page missing' using errcode='P0002'; end if;
  if p.updated_at is distinct from (command->>'expectedRevision')::timestamptz then raise exception 'Page changed' using errcode='40001'; end if;
  if operation='publish_trip' then
    if p.page_type<>'tour' or jsonb_typeof(command->'published') is distinct from 'boolean' then raise exception 'Invalid trip' using errcode='22023'; end if;
    if (command->>'published')::boolean and not exists(select 1 from public.content_blocks where page_id=p.id and block_type='paragraph') then raise exception 'Trip body required' using errcode='22023'; end if;
    update public.content_pages set published=(command->>'published')::boolean where id=p.id;
    insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),email_value,jsonb_build_object('operation',operation,'key',p.id),to_jsonb(p.published),command->'published');
  elsif operation='save_body' then
    perform public.validate_editor_blocks(command->'blocks');
    details:=public.admin_manage_read(p.id)->'blocks';
    delete from public.content_blocks where page_id=p.id;
    for b in select * from jsonb_array_elements(command->'blocks') loop
      insert into public.content_blocks(page_id,position,block_type,text,heading_level,anchor_ids,links,list_ordered,list_items,table_caption,table_rows)
      values(p.id,n,b->>'type',b->>'text',(b->>'level')::smallint,b->'anchorIds',b->'links',(b->>'ordered')::boolean,b->'items',b->>'caption',b->'rows'); n:=n+1;
    end loop;
    update public.content_pages set modification_date=to_char(current_date,'YYYY-MM-DD') where id=p.id;
    insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),email_value,jsonb_build_object('operation',operation,'key',p.id),details,command->'blocks');
  else raise exception 'Unknown operation' using errcode='22023'; end if;
  return jsonb_build_object('id',p.id,'path',p.path);
end $$;
revoke all on function public.admin_manage_content(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_content(jsonb) to authenticated;




create or replace function public.read_site_content() returns jsonb
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
          where target.published and ((p.page_type='blog' and target.page_type='article') or ((p.page_type='tours' or (p.path='/' and exists(select 1 from public.content_trip_details td where td.page_id=target.id))) and target.page_type='tour'))
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
revoke all on function public.read_site_content() from public, anon, authenticated, service_role;
grant execute on function public.read_site_content() to service_role;
comment on function public.read_site_content() is 'Server-only public projection, excluding draft pages. Matches PublicSiteContentSchema version 2.';

create function public.admin_trip_defaults(p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t text; title_value text; dates_value text; duration_value text; status_value text;
begin
 select p.title,coalesce((select c.summary from public.content_page_cards c join public.content_pages listing on listing.id=c.page_id where c.target_page_id=p.id order by (listing.page_type='tours') desc,c.position limit 1),'') into title_value,t from public.content_pages p where p.id=p_key;
 if starts_with(t,title_value) then t:=btrim(substr(t,length(title_value)+1)); end if;
 dates_value:=substring(t from '[0-9]{2}/[0-9]{2}/[0-9]{4}\s*[-–]\s*[0-9]{2}/[0-9]{2}/[0-9]{4}');
 duration_value:=substring(t from '[0-9]+\s+ימים');
 status_value:=substring(t from 'סטטוס הטיול:\s*(.+?)(?:\s+לפרטים|$)');
 t:=replace(replace(t,coalesce(dates_value,'!impossible!'),''),coalesce(duration_value,'!impossible!'),'');
 t:=regexp_replace(regexp_replace(t,'סטטוס הטיול:.*$',''),'(להמשך קריאה\s*»?|לפרטים)\s*$','');
 return jsonb_build_object('summary',btrim(t),'dates',coalesce(dates_value,''),'duration',coalesce(duration_value,''),'status',coalesce(status_value,''),'price','','guide','');
end $$;
revoke all on function public.admin_trip_defaults(text) from public,anon,authenticated,service_role;

create or replace function public.admin_read_editor(p_scope text, p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  case p_scope
    when 'page' then
      select jsonb_build_object('page',to_jsonb(p),'blocks',coalesce((select jsonb_agg(to_jsonb(b) order by b.position)
        from public.content_blocks b where b.page_id=p.id),'[]'::jsonb)) into result
        from public.content_pages p where p.id=p_key;
    when 'block' then
      select jsonb_build_object('page',to_jsonb(p),'blocks',jsonb_build_array(to_jsonb(b))) into result
      from public.content_pages p cross join lateral(select * from public.content_blocks where page_id=p.id order by position limit 1 offset (substring(p_key from '[0-9]+$'))::integer) b
      where p.id=regexp_replace(p_key,'\.[0-9]+$','');
    when 'trip' then
      select jsonb_build_object('page',to_jsonb(p),'trip',coalesce((select to_jsonb(t) from public.content_trip_details t where t.page_id=p.id),public.admin_trip_defaults(p.id))) into result from public.content_pages p where p.id=p_key and p.page_type='tour';
    when 'cards' then
      select jsonb_build_object('cards',coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('title',p.title,'page_type',p.page_type,'editor_summary',case when p.page_type='tour' then coalesce((select t.summary from public.content_trip_details t where t.page_id=p.id),public.admin_trip_defaults(p.id)->>'summary') else c.summary end) order by c.position),'[]')) into result from public.content_page_cards c join public.content_pages p on p.id=c.target_page_id where c.page_id=p_key;
    when 'videos' then
      select jsonb_build_object('videos',coalesce(jsonb_agg(to_jsonb(v) order by v.position),'[]')) into result from public.content_videos v where v.page_id=p_key;
    when 'navigation' then
      select jsonb_build_object('navigation',coalesce(jsonb_agg(to_jsonb(n) order by location,position),'[]')) into result from public.content_navigation n;
    when 'copy_all' then
      select jsonb_build_object('copy',coalesce(jsonb_agg(to_jsonb(c) order by area,slot),'[]')) into result from public.content_copy c where c.area not in ('seo','social') and c.slot !~ 'Url$';
    when 'copy' then
      select jsonb_build_object('copy',jsonb_agg(to_jsonb(c) order by c.slot)) into result
        from public.content_copy c where c.area=p_key and c.area not in ('seo','social') and c.slot !~ 'Url$';
    when 'site' then select jsonb_build_object('site',to_jsonb(s)) into result from public.content_site s where s.id;
    when 'gallery' then select jsonb_build_object('gallery',to_jsonb(g)) into result from public.content_gallery g where g.id;
    when 'media' then select jsonb_build_object('media',to_jsonb(m)) into result from public.content_media m where m.id=p_key;
    else raise exception 'Unknown editor' using errcode='22023';
  end case;
  if result is null or result = '{"copy":null}'::jsonb then raise exception 'Content not found' using errcode='P0002'; end if;
  return result;
end;
$$;
revoke all on function public.admin_read_editor(text,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_read_editor(text,text) to authenticated;


create or replace function public.admin_save_content(p_changes jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  change jsonb; scope text; target_key text; field_name text; field_path text[];
  current_row jsonb; previous_value jsonb; next_value jsonb; column_value jsonb;
  table_name text; predicate text; target_position integer; required_value boolean;
  written integer := 0; actor_email text; parsed_text text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(741943291);
  if jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'Invalid changes' using errcode='22023'; end if;
  if jsonb_array_length(p_changes) not between 1 and 100 or octet_length(p_changes::text)>1048576 then
    raise exception 'Too many changes' using errcode='22023';
  end if;
  select u.email into actor_email from auth.users u where u.id=auth.uid();
  -- Stable lock ordering reduces deadlocks between editors of the same records.
  for change in select value from jsonb_array_elements(p_changes)
    order by value->>'scope',value->>'key',value->>'position',value->>'field',value->>'path'
  loop
    scope:=change->>'scope'; target_key:=change->>'key'; field_name:=change->>'field';
    target_position:=case when coalesce(change->>'position','') ~ '^[0-9]{1,5}$' then (change->>'position')::integer else null end; current_row:=null; field_path:=null; required_value:=true;
    next_value:=change->'value';
    if not (change ? 'expected' and change ? 'value') or
       jsonb_typeof(next_value) not in ('string','null') or
       jsonb_typeof(change->'expected') not in ('string','null') or
       length(coalesce(next_value#>>'{}',''))>20000 then
      raise exception 'Invalid text change' using errcode='22023';
    end if;
    if change ? 'path' then
      if jsonb_typeof(change->'path') is distinct from 'array' or jsonb_array_length(change->'path')>8 then
        raise exception 'Invalid text path' using errcode='22023';
      end if;
      select array_agg(value order by ordinality) into field_path from jsonb_array_elements_text(change->'path') with ordinality;
    end if;
    case scope
      when 'page' then
        if field_name not in ('title','display_title','seo_title','seo_description') then raise exception 'Field not editable' using errcode='22023'; end if;
        required_value:=field_name='title'; table_name:='content_pages'; predicate:='id=$2';
        select to_jsonb(p) into current_row from public.content_pages p where p.id=target_key for update;
      when 'block' then
        if field_name not in ('text','table_caption','list_items','table_rows') then raise exception 'Field not editable' using errcode='22023'; end if;
        if coalesce(change->>'position','') !~ '^[0-9]{1,5}$' then raise exception 'Invalid block' using errcode='22023'; end if;
        target_position:=(change->>'position')::integer; table_name:='content_blocks'; predicate:='page_id=$2 and position=$3';
        select to_jsonb(b) into current_row from public.content_blocks b where b.page_id=target_key and b.position=target_position
          and exists(select 1 from public.content_pages p where p.id=b.page_id) for update;
        if (field_name='text' and current_row->>'block_type' not in ('paragraph','heading')) or
           (field_name='table_caption' and current_row->>'block_type'<>'table') then raise exception 'Field not editable' using errcode='22023'; end if;
        required_value:=field_name='text';
        if field_name='list_items' and (field_path is null or array_to_string(field_path,',') !~ '^([0-9]+,text|[0-9]+,children,[0-9]+,items,[0-9]+)$') then
          raise exception 'Invalid list text path' using errcode='22023';
        elsif field_name='table_rows' and (field_path is null or array_to_string(field_path,',') !~ '^[0-9]+,[0-9]+,text$') then
          raise exception 'Invalid table text path' using errcode='22023';
        end if;
      when 'copy' then
        if field_name<>'value' then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_copy'; predicate:='key=$2';
        select to_jsonb(c) into current_row from public.content_copy c where c.key=target_key
          and c.area not in ('seo','social') and c.slot !~ 'Url$' for update;
      when 'site' then
        if field_name not in ('business_name','contact_phone','contact_email','contact_address','notice') then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_site'; predicate:='id'; required_value:=field_name<>'contact_address';
        select to_jsonb(s) into current_row from public.content_site s where s.id for update;
        if field_name='contact_email' and coalesce(next_value#>>'{}','') !~ '^(?:[A-Za-z0-9_''+\-]+\.)*[A-Za-z0-9_''+\-]*[A-Za-z0-9_+\-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$' then
          raise exception 'Invalid email' using errcode='22023';
        end if;
        if field_name='contact_phone' and coalesce(next_value#>>'{}','') !~ '^\+?[0-9 -]+$' then
          raise exception 'Invalid phone' using errcode='22023';
        end if;
      when 'trip' then
        if field_name not in ('summary','dates','duration','price','guide','status') then raise exception 'Field not editable' using errcode='22023'; end if;
        perform 1 from public.content_pages where id=target_key and page_type='tour' for update;
        if not found then raise exception 'Trip missing' using errcode='P0002'; end if;
        if not exists(select 1 from public.content_trip_details where page_id=target_key) then
          column_value:=public.admin_trip_defaults(target_key);
          insert into public.content_trip_details(page_id,summary,dates,duration,price,guide,status) values(target_key,column_value->>'summary',column_value->>'dates',column_value->>'duration',column_value->>'price',column_value->>'guide',column_value->>'status');
        end if;
        table_name:='content_trip_details'; predicate:='page_id=$2'; required_value:=false;
        if next_value='null'::jsonb then next_value:='""'::jsonb; end if;
        select to_jsonb(t) into current_row from public.content_trip_details t where page_id=target_key for update;
      when 'card' then
        if field_name<>'summary' then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_page_cards'; predicate:='page_id=$2 and position=$3'; required_value:=false;
        if next_value='null'::jsonb then next_value:='""'::jsonb; end if;
        select to_jsonb(c) into current_row from public.content_page_cards c where page_id=target_key and position=target_position for update;
      when 'video' then
        if field_name not in ('title','description') then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_videos'; predicate:='page_id=$2 and position=$3'; required_value:=false;
        select to_jsonb(v) into current_row from public.content_videos v where page_id=target_key and position=target_position for update;
      when 'navigation' then
        if field_name<>'label' then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_navigation'; predicate:='location=$2 and position=$3';
        select to_jsonb(n) into current_row from public.content_navigation n where location=target_key and position=target_position for update;
      when 'gallery' then
        if field_name not in ('heading','introduction','source_label','shuffle_label','open_album_label') then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_gallery'; predicate:='id';
        select to_jsonb(g) into current_row from public.content_gallery g where g.id for update;
      when 'media' then
        if field_name<>'alt' then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_media'; predicate:='id=$2';
        select to_jsonb(m) into current_row from public.content_media m where m.id=target_key for update;
      else raise exception 'Unknown edit target' using errcode='22023';
    end case;
    if current_row is null then raise exception 'Content not found' using errcode='P0002'; end if;
    if field_name not in ('list_items','table_rows') and field_path is not null then raise exception 'Unexpected text path' using errcode='22023'; end if;
    previous_value:=case when field_path is null then current_row->field_name else (current_row->field_name)#>field_path end;
    if previous_value is null or (field_path is not null and jsonb_typeof(previous_value)<>'string') then
      raise exception 'Text field not found' using errcode='22023';
    end if;
    if previous_value is distinct from change->'expected' then raise exception 'Content changed since it was opened' using errcode='40001'; end if;
    if (scope='page' and field_name in ('display_title','seo_title')) or (scope='site' and field_name='contact_address') then
      if length(btrim(coalesce(next_value#>>'{}','')))=0 then next_value:='null'::jsonb; end if;
    end if;
    if required_value and (next_value='null'::jsonb or length(btrim(next_value#>>'{}'))=0) then
      raise exception 'Text is required' using errcode='22023';
    end if;
    if field_path is not null and next_value='null'::jsonb then raise exception 'Text must be a string' using errcode='22023'; end if;
    if previous_value=next_value then continue; end if;
    if field_path is null then
      parsed_text:=next_value#>>'{}';
      execute format('update public.%I set %I=$1 where %s',table_name,field_name,predicate) using parsed_text,target_key,target_position;
    else
      column_value:=jsonb_set(current_row->field_name,field_path,next_value,false);
      execute format('update public.%I set %I=$1 where %s',table_name,field_name,predicate) using column_value,target_key,target_position;
    end if;
    insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value)
      values(auth.uid(),actor_email,change-'value'-'expected',previous_value,next_value);
    written:=written+1;
  end loop;
  return written;
end;
$$;
revoke all on function public.admin_save_content(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_content(jsonb) to authenticated;


-- Existing presentation copy becomes ordinary editable text. Fresh databases receive it from seed.
insert into public.content_copy(area,slot,value)
select v.area,v.slot,v.value from (values
('text.editorial','text1','המועדים המוצגים הם מהאתר הקיים וטעונים אישור. מחיר וזמינות עדכניים מבררים בשיחה.'),
('text.editorial','text2','לקריאת הסיפור המלא'),
('text.editorial','text3','תרבות · היסטוריה · מקומות'),
('text.editorial','text4','מה דורש אישור במידע הקיים?'),
('text.editorial','text5','לא נקבע כאן איזה נוסח נכון. לפני הזמנה יש לקבל מהחברה פרטים מאושרים ואחידים.'),
('text.editorial','text6','התוכנית עודכנה מהאתר הקיים. מועדים, מחירים ושיבוץ ההדרכה דורשים אימות לפני הזמנה.'),
('text.editorial','text7','מפגש עם הלב של דרך המשי'),
('text.editorial','text8','עוד על היעד ועל המסע'),
('text.editorial','text9','קו מחבר בין תרבויות'),
('text.editorial','text10','סדר הערים לפי התוכנית שבאתר המקור. פרטי המסלול טעונים אישור.'),
('text.editorial','text11','המסע, יום אחר יום'),
('text.editorial','text12','התוכנית שלהלן נשמרה מהאתר הקיים. מספר הימים והנוסח הסופי ייקבעו לאחר אישור המידע.'),
('text.editorial','text13','הפרטים שעושים את הדרך'),
('text.editorial','text14','לפי רשימות המקור, לעיון בלבד עד אישור. שמות המלונות ופרטי הטיסות אינם מאושרים כאן.'),
('text.editorial','text15','מה כלול בנוסח הקיים'),
('text.editorial','text16','מה לא כלול בנוסח הקיים'),
('text.editorial','text17','מידע נוסף ותנאים בנוסח המקור מופיעים בהמשך.'),
('text.editorial','text18','מחיר, מועדים ותנאים'),
('text.editorial','text19','המחיר, התאריכים והצוות למועד הזה עדיין דורשים אישור. בשיחה אפשר לברר את הפרטים העדכניים.'),
('text.editorial','text20','תאריכי יציאה ומחירים — הנוסח הקיים'),
('text.editorial','text21','הטקסט הבא נשמר כמקור לעיון, וכולל מידע סותר שטרם אושר.'),
('text.editorial','text22','קוראים לפני שמחליטים'),
('text.editorial','text23','תנאים והערות'),
('text.editorial','text24','נוסח המקור, לעיון. תנאים מאושרים יש לקבל מהחברה לפני הזמנה.'),
('text.editorial','text25','לפני שיוצאים לדרך'),
('text.editorial','text26','איך מבררים את התאריכים ואת שיבוץ המדריכים?'),
('text.editorial','text27','איפה אפשר לקרוא את המסלול המלא?'),
('text.editorial','text28','על הדרך שלנו — מידע נוסף מהאתר הקיים'),
('text.pages','text1','לקריאת ההמלצה המלאה'),
('text.pages','text2','בואו נדבר על המסע הבא'),
('text.pages','text3','לבירור מועדים, מחירים ופרטי הטיול העדכניים.'),
('text.pages','text4','המסעות שלנו · תרבות והיסטוריה'),
('text.pages','text5','המסע במבט אחד'),
('text.pages','text6','המידע מהאתר הקיים. יש לאמת זמינות, מחיר ותנאים לפני הזמנה.'),
('text.pages','text7','לפני שיוצאים'),
('text.pages','text8','עוד על היעד ועל המסע'),
('text.pages','text9','צעד אחר צעד'),
('text.pages','text10','מסלול הטיול'),
('text.pages','text11','פתחו כל יום כדי לקרוא את התוכנית המלאה.'),
('text.pages','text12','לקראת היציאה'),
('text.pages','text13','תאריכי יציאה ומחירים'),
('text.pages','text14','כל הפרטים, במקום אחד'),
('text.pages','text15','תנאים והערות'),
('text.pages','text16','תשלום, ביטול, מה כלול ועוד — לפי הנוסח באתר הקיים.'),
('text.pages','text17','למה לטייל איתנו'),
('text.pages','text18','תמונות מהטיול'),
('text.pages','text19','תמונות מהטיול יתווספו בהמשך.'),
('text.pages','text20','על צוות המדריכים ועל הדרך שלנו'),
('text.pages','text21','נוסח מהאתר הקיים — טעון בדיקה ואישור לפני פרסום.')
) as v(area,slot,value) where exists(select 1 from public.content_site) on conflict(area,slot) do nothing;
