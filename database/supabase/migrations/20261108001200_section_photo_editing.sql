-- Contextual photo controls for the fixed presentation sections.
create table public.site_photo_slots (
  slot text primary key check(slot in ('home.hero','home.approach','tour.april.interlude')),
  media_id text references public.content_media(id), updated_at timestamptz not null default now()
);
alter table public.site_photo_slots enable row level security;
revoke all on public.site_photo_slots from public,anon,authenticated,service_role;
grant select on public.site_photo_slots to service_role;
create trigger touch_updated_at before update on public.site_photo_slots for each row execute function public.content_touch_updated_at();
create trigger publish_revision after insert or update or delete on public.site_photo_slots for each statement execute function public.bump_content_revision();
alter function public.read_site_content() rename to read_site_content_v3;
create function public.read_site_content() returns jsonb
language sql stable security invoker set search_path='' as $$
  select base || case when exists(select 1 from public.site_photo_slots) then
    jsonb_build_object('photoSlots',(select jsonb_object_agg(slot,media_id) from public.site_photo_slots)) else '{}'::jsonb end
  from public.read_site_content_v3() base
$$;
revoke all on function public.read_site_content() from public,anon,authenticated,service_role;
grant execute on function public.read_site_content() to service_role;
create function public.admin_read_photo_slot(p_slot text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.site_photo_slots; default_id text; title_value text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  case p_slot
    when 'home.hero' then default_id:='samarkand';title_value:='תמונת פתיח דף הבית';
    when 'home.approach' then default_id:='samarkand';title_value:='תמונת הגישה שלנו';
    when 'tour.april.interlude' then default_id:='bukhara';title_value:='תמונת מעבר בעמוד המסע';
    else raise exception 'Unknown photo slot' using errcode='22023';
  end case;
  select * into item from public.site_photo_slots where slot=p_slot;
  return jsonb_build_object('slot',p_slot,'title',title_value,'mediaId',case when found then item.media_id else default_id end,
    'revision',coalesce(item.updated_at::text,'0'),'media',public.admin_photo_library()->'media');
end $$;
revoke all on function public.admin_read_photo_slot(text) from public,anon,authenticated,service_role;
grant execute on function public.admin_read_photo_slot(text) to authenticated;
create function public.admin_save_photo_slot(p_slot text,p_media_id text,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare document jsonb; previous text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(741943291);
  document:=public.admin_read_photo_slot(p_slot);
  if document->>'revision' is distinct from p_revision then raise exception 'Photo changed' using errcode='40001'; end if;
  if p_media_id is not null and not exists(select 1 from public.content_media where id=p_media_id and kind='site') then raise exception 'Invalid photo' using errcode='22023'; end if;
  previous:=document->>'mediaId';
  insert into public.site_photo_slots(slot,media_id) values(p_slot,p_media_id) on conflict(slot) do update set media_id=excluded.media_id;
  insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),(select email from auth.users where id=auth.uid()),jsonb_build_object('operation','save_photo','slot',p_slot),coalesce(to_jsonb(previous),'null'),coalesce(to_jsonb(p_media_id),'null'));
  return public.admin_read_photo_slot(p_slot);
end $$;
revoke all on function public.admin_save_photo_slot(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_photo_slot(text,text,text) to authenticated;
