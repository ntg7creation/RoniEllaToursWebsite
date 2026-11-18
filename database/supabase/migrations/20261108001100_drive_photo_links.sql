-- Editors browse a public Drive folder. Store stable file links, never photo bytes.
create table public.site_media_library (
  id boolean primary key default true check(id), folder_url text not null,
  updated_at timestamptz not null default now(),
  check(folder_url ~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+$')
);
insert into public.site_media_library(id,folder_url) values(true,'https://drive.google.com/drive/folders/1TILL118zzozt6e6gTCO8_HA3HjN3wJNE');
alter table public.site_media_library enable row level security;
revoke all on public.site_media_library from public,anon,authenticated,service_role;
create trigger touch_updated_at before update on public.site_media_library for each row execute function public.content_touch_updated_at();
alter table public.content_media add column drive_folder_url text, add column drive_file_id text, add column drive_file_url text,
  add column drive_created_at timestamptz, add column drive_modified_at timestamptz;
alter table public.content_media add constraint content_media_drive_reference check (
  (drive_folder_url is null and drive_file_id is null and drive_file_url is null) or
  (kind='site' and drive_folder_url is not null and drive_folder_url ~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+$' and
    drive_file_id is not null and length(drive_file_id) between 1 and 200 and drive_file_id ~ '^[A-Za-z0-9_-]+$' and
    drive_file_url is not null and drive_file_url='https://drive.google.com/file/d/'||drive_file_id||'/view'));
alter function public.read_site_content() rename to read_site_content_v2;
create function public.read_site_content() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_set(base,'{media}',coalesce((select jsonb_agg(item || case when m.drive_file_id is not null then
    jsonb_build_object('googleDrive',jsonb_build_object('folderUrl',m.drive_folder_url,'fileId',m.drive_file_id,'fileUrl',m.drive_file_url)) else '{}'::jsonb end order by ord)
    from jsonb_array_elements(base->'media') with ordinality a(item,ord) join public.content_media m on m.id=item->>'id'),'[]'::jsonb))
  from public.read_site_content_v2() base
$$;
revoke all on function public.read_site_content() from public,anon,authenticated,service_role;
grant execute on function public.read_site_content() to service_role;
create function public.admin_photo_library() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return jsonb_build_object('folderUrl',(select folder_url from public.site_media_library where id),
    'media',coalesce((select jsonb_agg(jsonb_build_object('id',id,'src',src,'alt',alt) || case when drive_file_id is not null then
      jsonb_build_object('googleDrive',jsonb_build_object('folderUrl',drive_folder_url,'fileId',drive_file_id,'fileUrl',drive_file_url)) else '{}'::jsonb end order by position)
      from public.content_media where kind='site'),'[]'::jsonb));
end $$;
revoke all on function public.admin_photo_library() from public,anon,authenticated,service_role;
grant execute on function public.admin_photo_library() to authenticated;
alter function public.admin_workspace_read(text,text) rename to admin_workspace_read_v2;
revoke all on function public.admin_workspace_read_v2(text,text) from public,anon,authenticated,service_role;
create function public.admin_workspace_read(p_key text default null,p_collection text default 'tour') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; library jsonb;
begin
  result:=public.admin_workspace_read_v2(p_key,p_collection); library:=public.admin_photo_library();
  return result||jsonb_build_object('media',library->'media');
end $$;
revoke all on function public.admin_workspace_read(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_workspace_read(text,text) to authenticated;
create function public.admin_set_drive_folder(p_url text,p_expected text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous text;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if length(p_url)>2000 or p_url !~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+$' then raise exception 'Invalid folder' using errcode='22023'; end if;
  select folder_url into previous from public.site_media_library where id for update;
  if previous is distinct from p_expected then raise exception 'Folder changed' using errcode='40001'; end if;
  update public.site_media_library set folder_url=p_url where id;
  insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value) values(auth.uid(),(select email from auth.users where id=auth.uid()),jsonb_build_object('operation','set_drive_folder'),to_jsonb(previous),to_jsonb(p_url));
  return jsonb_build_object('folderUrl',p_url);
end $$;
revoke all on function public.admin_set_drive_folder(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_set_drive_folder(text,text) to authenticated;
create function public.admin_link_drive_photo(p_photo jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare media_key text; image_width integer; image_height integer; edge integer; folder_url text; file_key text; file_url text; existing jsonb;
begin
  if not public.is_site_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if jsonb_typeof(p_photo) is distinct from 'object' or octet_length(p_photo::text)>12000 then raise exception 'Invalid photo' using errcode='22023'; end if;
  folder_url:=p_photo->>'folderUrl'; file_key:=p_photo->>'fileId'; file_url:='https://drive.google.com/file/d/'||file_key||'/view';
  if coalesce(folder_url,'') !~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+$' or length(folder_url)>2000 or
    coalesce(file_key,'') !~ '^[A-Za-z0-9_-]+$' or length(file_key)>200 or jsonb_typeof(p_photo->'alt') is distinct from 'string' or length(btrim(p_photo->>'alt')) not between 1 and 2000 or
    coalesce(p_photo->>'width','') !~ '^[1-9][0-9]{0,5}$' or coalesce(p_photo->>'height','') !~ '^[1-9][0-9]{0,5}$' then raise exception 'Invalid photo reference' using errcode='22023'; end if;
  if folder_url is distinct from (select l.folder_url from public.site_media_library l where id) then raise exception 'Folder changed' using errcode='40001'; end if;
  image_width:=(p_photo->>'width')::integer; image_height:=(p_photo->>'height')::integer;
  if image_width>100000 or image_height>100000 then raise exception 'Invalid dimensions' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(741943291); media_key:='drive-'||md5(file_key);
  select to_jsonb(m) into existing from public.content_media m where id=media_key;
  insert into public.content_media(id,kind,position,src,width,height,alt,caption,author,source_url,license,license_url,sizes,drive_folder_url,drive_file_id,drive_file_url,drive_created_at,drive_modified_at)
  values(media_key,'site',(select coalesce(max(position),-1)+1 from public.content_media where kind='site'),'/media/'||media_key||'-1600.jpg',image_width,image_height,p_photo->>'alt',p_photo->>'alt',
    'לא צוין בתיקייה',file_url,'לא צוין בתיקייה',file_url,'(max-width: 640px) 100vw, 60vw',folder_url,file_key,file_url,(p_photo->>'addedAt')::timestamptz,(p_photo->>'modifiedAt')::timestamptz)
  on conflict(id) do update set width=excluded.width,height=excluded.height,drive_created_at=excluded.drive_created_at,drive_modified_at=excluded.drive_modified_at;
  delete from public.content_media_variants where media_id=media_key;
  foreach edge in array array[480,1600] loop
    insert into public.content_media_variants(media_id,position,src,width) values(media_key,case edge when 480 then 0 else 1 end,'/media/'||media_key||'-'||edge::text||'.jpg',
      greatest(1,round(image_width*least(1.0,edge::numeric/greatest(image_width,image_height))))::integer);
  end loop;
  if existing is null then insert into public.site_edit_history(actor_id,actor_email,target,previous_value,new_value)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),jsonb_build_object('operation','link_drive_photo','key',media_key),'null',p_photo); end if;
  return jsonb_build_object('id',media_key,'src','/media/'||media_key||'-1600.jpg','alt',(select alt from public.content_media where id=media_key),
    'googleDrive',jsonb_build_object('folderUrl',folder_url,'fileId',file_key,'fileUrl',file_url));
end $$;
revoke all on function public.admin_link_drive_photo(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_link_drive_photo(jsonb) to authenticated;
