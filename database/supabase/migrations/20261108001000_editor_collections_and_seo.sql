-- Shared destination/article records, structured images, and editorial metadata.
-- All writes retain the Google admin allowlist, optimistic locks and audit log.
alter table public.content_pages
  add column summary text,
  add column destination_dates text not null default '',
  add column seo_keywords jsonb not null default '[]' check (jsonb_typeof(seo_keywords)='array'),
  add column social_title text not null default '',
  add column social_description text not null default '',
  add column seo_noindex boolean not null default false;
alter table public.content_blocks drop constraint content_blocks_block_type_check;
alter table public.content_blocks add constraint content_blocks_block_type_check check (block_type in ('heading','paragraph','list','table','image'));
alter table public.content_blocks add column media_id text references public.content_media(id),
  add column image_alt text, add column image_caption text, add column image_align text;
alter table public.content_blocks add constraint content_blocks_image_check check (
  block_type<>'image' or (media_id is not null and image_alt is not null and length(btrim(image_alt))>0 and image_caption is not null and image_align is not null and image_align in ('left','right','full')));

create function public.content_editor_blocks(p_key text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('type',b.block_type,'anchorIds',b.anchor_ids,'links',b.links) ||
    case b.block_type
      when 'heading' then jsonb_build_object('text',b.text,'level',b.heading_level)
      when 'paragraph' then jsonb_build_object('text',b.text)
      when 'list' then jsonb_build_object('ordered',b.list_ordered,'items',b.list_items)
      when 'table' then jsonb_build_object('caption',b.table_caption,'rows',b.table_rows)
      when 'image' then jsonb_build_object('mediaId',b.media_id,'alt',b.image_alt,'caption',b.image_caption,'align',b.image_align)
    end order by b.position),'[]'::jsonb) from public.content_blocks b where b.page_id=p_key
$$;
revoke all on function public.content_editor_blocks(text) from public,anon,authenticated,service_role;
grant execute on function public.content_editor_blocks(text) to service_role;

-- Preserve the established read model; extend it in the same database snapshot.
alter function public.read_site_content() rename to read_site_content_v1;
create function public.read_site_content() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_set(base,'{pages}',coalesce((select jsonb_agg(
    item || jsonb_build_object('blocks',public.content_editor_blocks(p.id),
      'seo',(item->'seo') || case when p.seo_keywords<>'[]'::jsonb then jsonb_build_object('keywords',p.seo_keywords) else '{}'::jsonb end
        || case when p.social_title<>'' then jsonb_build_object('socialTitle',p.social_title) else '{}'::jsonb end
        || case when p.social_description<>'' then jsonb_build_object('socialDescription',p.social_description) else '{}'::jsonb end
        || case when p.seo_noindex then jsonb_build_object('noindex',true) else '{}'::jsonb end)
    || case when p.summary is not null then jsonb_build_object('summary',p.summary) else '{}'::jsonb end
    || case when p.page_type='destinationArchive' and (p.summary is not null or p.destination_dates<>'') then jsonb_build_object('destinationDetails',jsonb_build_object(
      'summary',coalesce(p.summary,(select value from public.content_copy where key='home.'||case when p.path='/destinations/uzbekistan/' then 'uzbekistan' when p.path='/destinations/china/' then 'china' else '' end||'.body'),''),
      'dates',p.destination_dates)) else '{}'::jsonb end
    || jsonb_build_object('cards',coalesce((select jsonb_agg(card || case when target.summary is not null then jsonb_build_object('summary',target.summary) else '{}'::jsonb end order by ord)
      from jsonb_array_elements(item->'cards') with ordinality c(card,ord)
      join public.content_pages target on target.id=card->>'pageId' and target.published),'[]'::jsonb))
    order by p.position) from jsonb_array_elements(base->'pages') item join public.content_pages p on p.id=item->>'id'),'[]'::jsonb))
  from public.read_site_content_v1() base
$$;
revoke all on function public.read_site_content() from public,anon,authenticated,service_role;
grant execute on function public.read_site_content() to service_role;

create function public.admin_workspace_read(p_key text default null,p_collection text default 'tour') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; p public.content_pages; assets jsonb;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'src',src,'alt',alt) order by position),'[]') into assets from public.content_media where kind='site';
  if p_key is null then
    if p_collection not in ('tour','article','destinationArchive') then raise exception 'Invalid collection' using errcode='22023'; end if;
    select jsonb_build_object('entries',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'path',path,'published',published,'revision',updated_at::text) order by position),'[]'),'media',assets)
      into result from public.content_pages where page_type=p_collection;
  else
    select * into p from public.content_pages where id=p_key;
    if not found then raise exception 'Page missing' using errcode='P0002'; end if;
    result:=jsonb_build_object('id',p.id,'title',p.title,'pageType',p.page_type,'path',p.path,'revision',p.updated_at::text,
      'blocks',(select coalesce(jsonb_agg(value || case when p.page_type='tour' and value->>'type'='heading' then
        jsonb_build_object('anchorIds',value->'anchorIds' || case
          when public.editor_section_anchor(value->>'text') is not null and not (value->'anchorIds') ? public.editor_section_anchor(value->>'text') then jsonb_build_array(public.editor_section_anchor(value->>'text'))
          when value->>'text' ~ '^(היום|יום|ימים)\s' and not exists(select 1 from jsonb_array_elements_text(value->'anchorIds') a where a like 'editor-day-%') then jsonb_build_array('editor-day-'||ord::text)
          else '[]'::jsonb end) else '{}'::jsonb end order by ord),'[]') from jsonb_array_elements(public.content_editor_blocks(p.id)) with ordinality b(value,ord)),
      'media',assets,'settings',jsonb_build_object(
        'title',p.title,'displayTitle',coalesce(p.display_title,''),
        'summary',coalesce(p.summary,(select value from public.content_copy where key='home.'||case when p.path='/destinations/uzbekistan/' then 'uzbekistan' when p.path='/destinations/china/' then 'china' else '' end||'.body'),
          (select c.summary from public.content_page_cards c where c.target_page_id=p.id order by c.position limit 1),''),
        'dates',p.destination_dates,'heroMediaId',p.hero_media_id,'seoTitle',coalesce(p.seo_title,''),'seoDescription',coalesce(p.seo_description,''),
        'keywords',p.seo_keywords,'socialTitle',p.social_title,'socialDescription',p.social_description,'noindex',p.seo_noindex,
        'authorName',coalesce(p.author_name,''),'publicationDate',left(coalesce(p.publication_date,''),10)));
  end if;
  return result;
end $$;
revoke all on function public.admin_workspace_read(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_workspace_read(text,text) to authenticated;

alter function public.validate_editor_blocks(jsonb) rename to validate_editor_blocks_v1;
create function public.validate_editor_blocks(blocks jsonb) returns void
language plpgsql set search_path='' as $$
declare b jsonb; ordinary jsonb;
begin
  if jsonb_typeof(blocks) is distinct from 'array' or jsonb_array_length(blocks) not between 1 and 500 or octet_length(blocks::text)>900000 then raise exception 'Invalid body' using errcode='22023'; end if;
  select coalesce(jsonb_agg(value),'[]') into ordinary from jsonb_array_elements(blocks) where value->>'type' is distinct from 'image';
  if jsonb_array_length(ordinary)>0 then perform public.validate_editor_blocks_v1(ordinary); end if;
  for b in select * from jsonb_array_elements(blocks) where value->>'type'='image' loop
    if b-array['type','anchorIds','links','mediaId','alt','caption','align']<>'{}'::jsonb or
      jsonb_typeof(b->'anchorIds') is distinct from 'array' or b->'links' is distinct from '[]'::jsonb or
      jsonb_typeof(b->'alt') is distinct from 'string' or length(btrim(b->>'alt')) not between 1 and 2000 or
      jsonb_typeof(b->'caption') is distinct from 'string' or length(b->>'caption')>2000 or
      coalesce(b->>'align','') not in ('left','right','full') or not exists(select 1 from public.content_media where id=b->>'mediaId' and kind='site') or
      exists(select 1 from jsonb_array_elements(b->'anchorIds') a where jsonb_typeof(a)<>'string' or length(a#>>'{}') not between 1 and 200) then
      raise exception 'Invalid image' using errcode='22023'; end if;
  end loop;
end $$;
revoke all on function public.validate_editor_blocks(jsonb) from public,anon,authenticated,service_role;

alter function public.admin_manage_content(jsonb) rename to admin_manage_content_v1;
revoke all on function public.admin_manage_content_v1(jsonb) from public,anon,authenticated,service_role;
create function public.admin_manage_content(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.content_pages; data jsonb; b jsonb; old_value jsonb; result jsonb; actor_email text;
  operation text:=command->>'operation'; request_key uuid; prior public.site_admin_requests;
  id_value text; path_value text; entry_kind text; n integer:=0; field_name text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if octet_length(command::text)>1000000 then raise exception 'Request too large' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(741943291);
  select email into actor_email from auth.users where id=auth.uid();
  if operation in ('create_trip','publish_trip') then return public.admin_manage_content_v1(command); end if;
  if operation='create_entry' then
    request_key:=(command->>'requestId')::uuid; data:=command->'entry'; entry_kind:=command->>'collection';
    select * into prior from public.site_admin_requests where request_id=request_key;
    if found then
      if prior.actor_id<>auth.uid() or prior.payload<>command then raise exception 'Request already used' using errcode='40001'; end if;
      return prior.result;
    end if;
    if entry_kind not in ('article','destinationArchive') or entry_kind is null or jsonb_typeof(data) is distinct from 'object' or coalesce(data->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(data->>'slug')>100 then raise exception 'Invalid entry' using errcode='22023'; end if;
    foreach field_name in array array['title','summary','overview','dates'] loop
      if jsonb_typeof(data->field_name) is distinct from 'string' or length(data->>field_name)>(case when field_name='overview' then 20000 else 2000 end) then raise exception 'Invalid text' using errcode='22023'; end if;
    end loop;
    if length(btrim(data->>'title')) not between 1 and 300 or length(btrim(data->>'overview'))=0 then raise exception 'Text required' using errcode='22023'; end if;
    id_value:=case entry_kind when 'article' then 'article-' else 'destination-' end||replace(request_key::text,'-','');
    path_value:=case entry_kind when 'article' then '/blog/' else '/destinations/' end||(data->>'slug')||'/';
    if exists(select 1 from public.content_pages where path=path_value) or exists(select 1 from public.content_redirects where from_path=path_value) then raise exception 'Address already used' using errcode='23505'; end if;
    insert into public.content_pages(id,path,page_type,title,summary,destination_dates,position,published,publication_date)
      values(id_value,path_value,entry_kind,btrim(data->>'title'),data->>'summary',data->>'dates',(select coalesce(max(position),-1)+1 from public.content_pages),false,case when entry_kind='article' then to_char(current_timestamp at time zone 'Asia/Jerusalem','YYYY-MM-DD') end);
    insert into public.content_blocks(page_id,position,block_type,text) values(id_value,0,'paragraph',data->>'overview');
    if entry_kind='article' then insert into public.content_featured(collection,position,page_id) values('posts',(select coalesce(max(position),-1)+1 from public.content_featured where collection='posts'),id_value); end if;
    result:=jsonb_build_object('id',id_value,'path',path_value,'published',false);
    insert into public.site_admin_requests values(request_key,auth.uid(),command,result,now());
    insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),actor_email,jsonb_build_object('operation',operation,'key',id_value),'null',data);
    return result;
  end if;
  select * into p from public.content_pages where id=command->>'key' for update;
  if not found then raise exception 'Page missing' using errcode='P0002'; end if;
  if p.updated_at is distinct from (command->>'expectedRevision')::timestamptz then raise exception 'Page changed' using errcode='40001'; end if;
  if operation='publish_entry' then
    if p.page_type not in ('article','destinationArchive') or jsonb_typeof(command->'published') is distinct from 'boolean' then raise exception 'Invalid entry' using errcode='22023'; end if;
    if (command->>'published')::boolean and not exists(select 1 from public.content_blocks where page_id=p.id and block_type='paragraph') then raise exception 'Body required' using errcode='22023'; end if;
    old_value:=to_jsonb(p.published); data:=command->'published';
    update public.content_pages set published=(command->>'published')::boolean where id=p.id;
  elsif operation='save_settings' then
    data:=command->'settings';
    if jsonb_typeof(data) is distinct from 'object' then raise exception 'Invalid settings' using errcode='22023'; end if;
    foreach field_name in array array['title','displayTitle','summary','dates','seoTitle','seoDescription','socialTitle','socialDescription','authorName','publicationDate'] loop
      if jsonb_typeof(data->field_name) is distinct from 'string' or length(data->>field_name)>2000 then raise exception 'Invalid settings text' using errcode='22023'; end if;
    end loop;
    if length(btrim(data->>'title')) not between 1 and 300 or length(data->>'seoTitle')>300 or length(data->>'socialTitle')>300 or
      jsonb_typeof(data->'noindex') is distinct from 'boolean' or jsonb_typeof(data->'keywords') is distinct from 'array' or jsonb_array_length(data->'keywords')>50 or
      not data ? 'heroMediaId' or jsonb_typeof(data->'heroMediaId') not in ('string','null') or
      (data->>'heroMediaId' is not null and not exists(select 1 from public.content_media where id=data->>'heroMediaId' and kind='site')) then raise exception 'Invalid settings' using errcode='22023'; end if;
    for b in select * from jsonb_array_elements(data->'keywords') loop
      if jsonb_typeof(b)<>'string' or length(btrim(b#>>'{}')) not between 1 and 100 then raise exception 'Invalid label' using errcode='22023'; end if;
    end loop;
    if data->>'publicationDate'<>'' and (data->>'publicationDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((data->>'publicationDate')::date,'YYYY-MM-DD')<>data->>'publicationDate') then raise exception 'Invalid date' using errcode='22023'; end if;
    old_value:=public.admin_workspace_read(p.id)->'settings';
    update public.content_pages set title=btrim(data->>'title'),display_title=nullif(btrim(data->>'displayTitle'),''),summary=data->>'summary',destination_dates=data->>'dates',
      hero_media_id=data->>'heroMediaId',seo_title=nullif(btrim(data->>'seoTitle'),''),seo_description=nullif(btrim(data->>'seoDescription'),''),
      seo_keywords=data->'keywords',social_title=data->>'socialTitle',social_description=data->>'socialDescription',seo_noindex=(data->>'noindex')::boolean,
      author_name=nullif(btrim(data->>'authorName'),''),author_page_id=case when coalesce(p.author_name,'')=btrim(data->>'authorName') then p.author_page_id else null end,
      publication_date=case when left(coalesce(p.publication_date,''),10)=data->>'publicationDate' then p.publication_date else nullif(data->>'publicationDate','') end,
      modification_date=to_char(current_timestamp at time zone 'Asia/Jerusalem','YYYY-MM-DD') where id=p.id;
  elsif operation='save_body' then
    data:=command->'blocks'; perform public.validate_editor_blocks(data); old_value:=public.content_editor_blocks(p.id);
    delete from public.content_blocks where page_id=p.id;
    for b in select * from jsonb_array_elements(data) loop
      insert into public.content_blocks(page_id,position,block_type,text,heading_level,anchor_ids,links,list_ordered,list_items,table_caption,table_rows,media_id,image_alt,image_caption,image_align)
        values(p.id,n,b->>'type',b->>'text',(b->>'level')::smallint,b->'anchorIds',b->'links',(b->>'ordered')::boolean,b->'items',b->>'caption',b->'rows',b->>'mediaId',b->>'alt',b->>'caption',b->>'align'); n:=n+1;
    end loop;
    update public.content_pages set modification_date=to_char(current_timestamp at time zone 'Asia/Jerusalem','YYYY-MM-DD') where id=p.id;
  else raise exception 'Unknown operation' using errcode='22023'; end if;
  insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),actor_email,jsonb_build_object('operation',operation,'key',p.id),old_value,data);
  return jsonb_build_object('id',p.id,'path',p.path);
end $$;
revoke all on function public.admin_manage_content(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_content(jsonb) to authenticated;

-- Keep the existing management API compatible, including structural image blocks.
create or replace function public.admin_manage_read(p_key text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.admin_workspace_read(p_key,'tour');
  return case when p_key is null then result->'entries' else result end;
end $$;
revoke all on function public.admin_manage_read(text) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_read(text) to authenticated;

create function public.preserve_editor_day() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.block_type='heading' and old.text ~ '^(היום|יום|ימים)\s' and not exists(select 1 from jsonb_array_elements_text(new.anchor_ids) a where a like 'editor-day-%')
    and exists(select 1 from public.content_pages where id=new.page_id and page_type='tour') then
    new.anchor_ids:=new.anchor_ids||jsonb_build_array('editor-day-'||old.position::text);
  end if;
  return new;
end $$;
revoke all on function public.preserve_editor_day() from public,anon,authenticated,service_role;
create trigger preserve_day before update on public.content_blocks for each row execute function public.preserve_editor_day();
