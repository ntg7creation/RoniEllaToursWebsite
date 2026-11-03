-- Text-first content store. Public HTTP reads go through the backend, never directly from the browser.
create table public.content_site (
  id boolean primary key default true check (id),
  schema_version integer not null default 2 check (schema_version = 2),
  content_source text not null default 'liveArchive' check (content_source = 'liveArchive'),
  crawl_run_id text not null,
  notice text not null,
  business_name text not null,
  language text not null default 'he' check (language = 'he'),
  timezone text not null default 'Asia/Jerusalem' check (timezone = 'Asia/Jerusalem'),
  contact_phone text not null,
  contact_email text not null,
  contact_address text,
  updated_at timestamptz not null default now()
);

create table public.content_media (
  id text primary key,
  kind text not null check (kind in ('site', 'gallery')),
  position integer not null check (position >= 0),
  src text not null check (src ~ '^/media/[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png|webp|avif)$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt text not null check (length(alt) > 0),
  caption text,
  author text,
  source_url text,
  license text,
  license_url text,
  sizes text,
  updated_at timestamptz not null default now(),
  check (kind <> 'site' or (caption is not null and author is not null and source_url is not null and license is not null and license_url is not null and sizes is not null))
);
create table public.content_media_variants (
  media_id text not null references public.content_media(id) on delete cascade,
  position integer not null check (position >= 0),
  src text not null check (src ~ '^/media/[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png|webp|avif)$'),
  width integer not null check (width > 0),
  updated_at timestamptz not null default now(),
  primary key (media_id, position)
);

create table public.content_pages (
  id text primary key,
  path text not null unique check (path = '/' or path ~ '^/[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*/$'),
  page_type text not null,
  title text not null check (length(title) > 0),
  display_title text,
  hero_media_id text references public.content_media(id),
  seo_title text not null check (length(seo_title) > 0),
  seo_description text,
  publication_date text,
  modification_date text,
  source_retrieved_at timestamptz not null,
  position integer not null unique check (position >= 0),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.content_pages is 'One row per public page/tour/article. Stable path is also its canonical path. New pages start as drafts.';
comment on column public.content_pages.published is 'Only published pages and their related links enter the public SSR response.';

create table public.content_blocks (
  page_id text not null references public.content_pages(id) on delete cascade,
  position integer not null check (position >= 0),
  block_type text not null check (block_type in ('heading','paragraph','list','table')),
  text text,
  heading_level smallint check (heading_level between 2 and 6),
  anchor_ids jsonb not null default '[]' check (jsonb_typeof(anchor_ids) = 'array'),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array'),
  list_ordered boolean,
  list_items jsonb check (jsonb_typeof(list_items) = 'array'),
  table_caption text,
  table_rows jsonb check (jsonb_typeof(table_rows) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (page_id, position),
  check (block_type not in ('heading','paragraph') or (text is not null and length(text) > 0)),
  check (block_type <> 'heading' or heading_level is not null),
  check (block_type <> 'list' or (list_ordered is not null and list_items is not null)),
  check (block_type <> 'table' or table_rows is not null)
);
comment on table public.content_blocks is 'Edit ordinary paragraphs/headings in text. position orders the page. Only nested lists, table cells and inline links use JSON; no executable HTML.';

create table public.content_page_cards (
  page_id text not null references public.content_pages(id) on delete cascade,
  position integer not null check (position >= 0),
  target_page_id text not null references public.content_pages(id),
  summary text not null default '',
  updated_at timestamptz not null default now(),
  primary key (page_id, position)
);
create index content_page_cards_target_idx on public.content_page_cards(target_page_id);
create table public.content_videos (
  page_id text not null references public.content_pages(id) on delete cascade,
  position integer not null check (position >= 0),
  title text,
  description text,
  external_url text not null check (external_url ~ '^https?://'),
  updated_at timestamptz not null default now(),
  primary key (page_id, position)
);
create table public.content_navigation (
  location text not null check (location in ('header','footer')),
  position integer not null check (position >= 0),
  label text not null check (length(label) > 0),
  page_id text not null references public.content_pages(id),
  updated_at timestamptz not null default now(),
  primary key (location, position)
);
create index content_navigation_page_idx on public.content_navigation(page_id);
create table public.content_featured (
  collection text not null check (collection in ('tours','posts')),
  position integer not null check (position >= 0),
  page_id text not null references public.content_pages(id),
  updated_at timestamptz not null default now(),
  primary key (collection, position),
  unique (collection, page_id)
);
create index content_featured_page_idx on public.content_featured(page_id);
create table public.content_copy (
  area text not null check (length(area) > 0),
  slot text not null check (length(slot) > 0 and position('.' in slot) = 0),
  key text generated always as (area || '.' || slot) stored unique,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (area, slot)
);
comment on table public.content_copy is 'Placement-based display copy: area home.hero + slot heading fills the hero heading. Edit value; keep area/slot stable.';
create table public.content_redirects (
  position integer primary key check (position >= 0),
  from_path text not null check (left(from_path,1) = '/'),
  from_query jsonb not null default '{}' check (jsonb_typeof(from_query) = 'object'),
  to_page_id text not null references public.content_pages(id),
  updated_at timestamptz not null default now(),
  unique (from_path, from_query)
);
create index content_redirects_target_idx on public.content_redirects(to_page_id);
create table public.content_gallery (
  id boolean primary key default true check (id),
  album_url text not null check (album_url ~ '^https://photos\.(app\.goo\.gl|google\.com)/'),
  heading text not null,
  introduction text not null,
  source_label text not null,
  shuffle_label text not null,
  open_album_label text not null,
  photo_alt_prefix text not null,
  display_count integer not null default 24 check (display_count between 1 and 200),
  synced_at timestamptz,
  album_title text,
  updated_at timestamptz not null default now()
);
create table public.content_gallery_photos (
  position integer primary key check (position >= 0),
  media_id text not null unique references public.content_media(id),
  updated_at timestamptz not null default now()
);
create index content_pages_hero_idx on public.content_pages(hero_media_id);

create function public.content_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.content_touch_updated_at() from public, anon, authenticated;

-- No anonymous or authenticated table access. The server key's role can only read these tables.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'content_site','content_media','content_media_variants','content_pages','content_blocks',
    'content_page_cards','content_videos','content_navigation','content_featured','content_copy',
    'content_redirects','content_gallery','content_gallery_photos'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
    execute format('grant select on table public.%I to service_role', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.content_touch_updated_at()', table_name);
  end loop;
end;
$$;
grant usage on schema public to service_role;
