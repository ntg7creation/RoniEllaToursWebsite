-- Verified against the original WordPress site. Preserve existing redirect positions.
insert into public.content_redirects(position, from_path, from_query, to_page_id)
select coalesce((select max(position) from public.content_redirects), -1) + row_number() over (order by m.query::text),
       '/', m.query, p.id
from (values ('{"p":"6"}'::jsonb, '/'), ('{"p":"9"}', '/blog/'),
             ('{"post_type":"trips"}', '/tours/'), ('{"post_type":"post"}', '/blog/'),
             ('{"post_type":"page"}', '/'), ('{"cat":"1"}', '/category/general/')) as m(query, path)
join public.content_pages p on p.path = m.path
on conflict (from_path, from_query) do nothing;
