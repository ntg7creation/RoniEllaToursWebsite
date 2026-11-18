-- Membership is created separately by 20261103000550_admin_allowlist.sql so
-- the owner can authorize accounts before deploying the admin application.

create table public.site_edit_history (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  actor_email text not null,
  target jsonb not null,
  previous_value jsonb not null,
  new_value jsonb not null,
  edited_at timestamptz not null default now()
);
alter table public.site_edit_history enable row level security;
revoke all on public.site_edit_history from public, anon, authenticated, service_role;
revoke all on sequence public.site_edit_history_id_seq from public, anon, authenticated, service_role;

-- Check current account, Google identity, session and membership in the database,
-- rather than trusting editable user_metadata or a role cached in a browser.
create function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join public.site_admins a on a.email = lower(u.email) and a.active
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
      and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
        and lower(i.identity_data->>'email') = lower(u.email)
        and i.identity_data->>'email_verified' = 'true')
      and exists (select 1 from auth.sessions s where s.user_id = u.id
        and s.id::text = (select auth.jwt()->>'session_id'))
  );
$$;
revoke all on function public.is_site_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_site_admin() to authenticated;
grant usage on schema public to authenticated;

-- These rows are returned only to an authorized admin; content table grants stay
-- read-only for the existing public backend and closed to ordinary Auth users.
create function public.admin_read_editor(p_scope text, p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  case p_scope
    when 'page' then
      select jsonb_build_object('page',to_jsonb(p),'blocks',coalesce((select jsonb_agg(to_jsonb(b) order by b.position)
        from public.content_blocks b where b.page_id=p.id),'[]'::jsonb)) into result
        from public.content_pages p where p.id=p_key and p.published;
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

create function public.admin_save_content(p_changes jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  change jsonb; scope text; target_key text; field_name text; field_path text[];
  current_row jsonb; previous_value jsonb; next_value jsonb; column_value jsonb;
  table_name text; predicate text; target_position integer; required_value boolean;
  written integer := 0; actor_email text; parsed_text text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
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
    target_position:=null; current_row:=null; field_path:=null; required_value:=true;
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
        select to_jsonb(p) into current_row from public.content_pages p where p.id=target_key and p.published for update;
      when 'block' then
        if field_name not in ('text','table_caption','list_items','table_rows') then raise exception 'Field not editable' using errcode='22023'; end if;
        if coalesce(change->>'position','') !~ '^[0-9]{1,5}$' then raise exception 'Invalid block' using errcode='22023'; end if;
        target_position:=(change->>'position')::integer; table_name:='content_blocks'; predicate:='page_id=$2 and position=$3';
        select to_jsonb(b) into current_row from public.content_blocks b where b.page_id=target_key and b.position=target_position
          and exists(select 1 from public.content_pages p where p.id=b.page_id and p.published) for update;
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
        if field_name not in ('business_name','contact_phone','contact_email','contact_address') then raise exception 'Field not editable' using errcode='22023'; end if;
        table_name:='content_site'; predicate:='id'; required_value:=field_name<>'contact_address';
        select to_jsonb(s) into current_row from public.content_site s where s.id for update;
        if field_name='contact_email' and coalesce(next_value#>>'{}','') !~ '^(?:[A-Za-z0-9_''+\-]+\.)*[A-Za-z0-9_''+\-]*[A-Za-z0-9_+\-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$' then
          raise exception 'Invalid email' using errcode='22023';
        end if;
        if field_name='contact_phone' and coalesce(next_value#>>'{}','') !~ '^\+?[0-9 -]+$' then
          raise exception 'Invalid phone' using errcode='22023';
        end if;
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

comment on table public.site_admins is 'Manual Google-account allowlist. Insert normalized email in Supabase SQL Editor; set active=false to revoke access immediately.';
comment on function public.admin_save_content(jsonb) is 'Allowlisted Google users only. Atomic text edits with expected-value conflict checks and private edit history. No schema, URLs, publication or membership changes.';
