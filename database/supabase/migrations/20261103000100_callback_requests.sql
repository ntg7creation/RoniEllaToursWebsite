-- Private callback inbox. Never part of read_site_content(), SSG, or browser APIs.
create table public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  full_name text not null check(length(full_name) between 2 and 100),
  phone_e164 text not null check(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_country text not null check(phone_country ~ '^[A-Z]{2}$'),
  email text check(length(email)<=254),
  destination_page_id text references public.content_pages(id) on delete set null,
  destination_label text not null,
  source_path text not null,
  privacy_version text not null,
  privacy_accepted_at timestamptz not null default now(),
  phone_check text not null default 'numbering-plan' check(phone_check='numbering-plan'),
  created_at timestamptz not null default now(),
  status text not null default 'new' check(status in ('new','contacted','closed'))
);
create index callback_requests_created_idx on public.callback_requests(created_at desc);
create table public.callback_rate_limits (
  client_key text primary key check(client_key ~ '^[a-f0-9]{64}$'),
  count integer not null check(count>0),
  expires_at timestamptz not null
);
alter table public.callback_requests enable row level security;
alter table public.callback_rate_limits enable row level security;
revoke all on public.callback_requests,public.callback_rate_limits from public,anon,authenticated,service_role;
grant select,insert on public.callback_requests to service_role;
grant select,insert,update,delete on public.callback_rate_limits to service_role;

create function public.create_callback_request(payload jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  -- Hold a transaction lock so retries of one request cannot consume multiple slots.
  perform pg_advisory_xact_lock(hashtextextended(payload->>'submissionId',0));
  if exists(select 1 from public.callback_requests where submission_id=(payload->>'submissionId')::uuid) then return; end if;
  if payload->'privacyAccepted' is distinct from 'true'::jsonb or payload->>'privacyVersion'<>'2026-11-03-callback-v1' or payload->>'clientKey' !~ '^[a-f0-9]{64}$' then
    raise exception 'callback_invalid';
  end if;
  delete from public.callback_rate_limits where expires_at<now()-interval '1 day';
  insert into public.callback_rate_limits(client_key,count,expires_at)
  values(payload->>'clientKey',1,now()+interval '15 minutes')
  on conflict(client_key) do update set
    count=case when callback_rate_limits.expires_at<=now() then 1 else callback_rate_limits.count+1 end,
    expires_at=case when callback_rate_limits.expires_at<=now() then now()+interval '15 minutes' else callback_rate_limits.expires_at end
  where callback_rate_limits.expires_at<=now() or callback_rate_limits.count<5;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'callback_rate_limited'; end if;
  if payload->>'destination'<>'undecided' and not exists(select 1 from public.content_pages
    where id=payload->>'destination' and published and page_type='destinationArchive') then raise exception 'callback_invalid'; end if;
  insert into public.callback_requests(submission_id,full_name,phone_e164,phone_country,email,destination_page_id,destination_label,source_path,privacy_version)
  values((payload->>'submissionId')::uuid,payload->>'name',payload->>'phone',payload->>'country',nullif(payload->>'email',''),
    nullif(payload->>'destination','undecided'),payload->>'destinationLabel',payload->>'sourcePath',payload->>'privacyVersion');
end;
$$;
revoke all on function public.create_callback_request(jsonb) from public,anon,authenticated;
grant execute on function public.create_callback_request(jsonb) to service_role;
comment on table public.callback_requests is 'Private callback requests. Staff review in Supabase Table Editor. No automatic email/SMS dispatch. numbering-plan does not mean SMS verification.';
