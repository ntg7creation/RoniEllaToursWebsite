alter table public.content_pages add column sync_itinerary boolean not null default true;

alter function public.read_site_content() rename to read_site_content_before_schedule;
create function public.read_site_content() returns jsonb
language sql stable security invoker set search_path='' as $$
  select case when exists(select 1 from public.content_pages where published and not sync_itinerary)
    then jsonb_set(base, '{pages}', (select jsonb_agg(
      case when p.sync_itinerary then item else item || '{"syncItinerary":false}'::jsonb end order by ord)
      from jsonb_array_elements(base->'pages') with ordinality a(item,ord)
      join public.content_pages p on p.id=item->>'id'))
    else base end from public.read_site_content_before_schedule() base
$$;
revoke all on function public.read_site_content() from public,anon,authenticated,service_role;
grant execute on function public.read_site_content() to service_role;

alter function public.admin_workspace_read(text,text) rename to admin_workspace_before_schedule;
revoke all on function public.admin_workspace_before_schedule(text,text) from public,anon,authenticated,service_role;
create function public.admin_workspace_read(p_key text default null,p_collection text default 'tour') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; trip jsonb;
begin
  result := public.admin_workspace_before_schedule(p_key,p_collection);
  if result->>'pageType'='tour' then
    select coalesce((select to_jsonb(t)-'page_id'-'updated_at' from public.content_trip_details t where t.page_id=p.id),
      public.admin_trip_defaults(p.id)) || jsonb_build_object('syncItinerary',p.sync_itinerary)
      into trip from public.content_pages p where p.id=p_key;
    result := result || jsonb_build_object('trip',trip);
  end if;
  return result;
end $$;
revoke all on function public.admin_workspace_read(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_workspace_read(text,text) to authenticated;

alter function public.admin_manage_content(jsonb) rename to admin_manage_before_schedule;
revoke all on function public.admin_manage_before_schedule(jsonb) from public,anon,authenticated,service_role;
create function public.admin_manage_content(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb := command->'trip'; result jsonb; old_trip jsonb; p public.content_pages;
  field text; replay boolean;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if command->>'operation' not in ('create_trip','save_trip_details') then
    return public.admin_manage_before_schedule(command);
  end if;
  perform pg_advisory_xact_lock(741943291);
  if item ? 'syncItinerary' and jsonb_typeof(item->'syncItinerary') is distinct from 'boolean' then
    raise exception 'Invalid itinerary setting' using errcode='22023';
  end if;
  if command->>'operation'='create_trip' then
    select exists(select 1 from public.site_admin_requests where request_id=(command->>'requestId')::uuid) into replay;
    result := public.admin_manage_before_schedule(command);
    if not replay and item->'syncItinerary'='false'::jsonb then
      update public.content_pages set sync_itinerary=false where id=result->>'id';
    end if;
    return result;
  end if;
  if jsonb_typeof(item->'syncItinerary') is distinct from 'boolean' then raise exception 'Missing setting' using errcode='22023'; end if;
  foreach field in array array['dates','duration','summary','guide','price','status'] loop
    if jsonb_typeof(item->field) is distinct from 'string' or length(item->>field)>2000 then
      raise exception 'Invalid trip details' using errcode='22023';
    end if;
  end loop;
  select * into p from public.content_pages where id=command->>'key' and page_type='tour' for update;
  if not found then raise exception 'Tour missing' using errcode='P0002'; end if;
  if p.updated_at is distinct from (command->>'expectedRevision')::timestamptz then raise exception 'Tour changed' using errcode='40001'; end if;
  old_trip := public.admin_workspace_read(p.id)->'trip';
  insert into public.content_trip_details(page_id,summary,dates,duration,price,guide,status)
    values(p.id,item->>'summary',item->>'dates',item->>'duration',item->>'price',item->>'guide',item->>'status')
    on conflict(page_id) do update set summary=excluded.summary,dates=excluded.dates,duration=excluded.duration,
      price=excluded.price,guide=excluded.guide,status=excluded.status;
  update public.content_pages set sync_itinerary=(item->>'syncItinerary')::boolean where id=p.id;
  insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),jsonb_build_object('operation','save_trip_details','key',p.id),old_trip,item);
  return jsonb_build_object('id',p.id,'path',p.path);
end $$;
revoke all on function public.admin_manage_content(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_content(jsonb) to authenticated;
