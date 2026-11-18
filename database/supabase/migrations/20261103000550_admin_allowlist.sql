-- Manual membership can be configured before the admin application is deployed.
-- No browser or public backend role can read or grant membership.
create table public.site_admins (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from public, anon, authenticated, service_role;

comment on table public.site_admins is 'Manual Google-account allowlist. Insert normalized email in Supabase SQL Editor; set active=false to revoke access.';
