-- Verified from the original site's Article/Person schema and public verification meta, 2 November 2026.
-- Keep any author or verification tag already assigned by an editor.
update public.content_pages set author_name='Yaniv Ozana', author_page_id='page-8b5c126b-4175-4479-8bf8-8581747abd8f' where id='page-96557157-6056-4ad0-b9a5-890867a778b1' and author_name is null;
update public.content_pages set author_name='Yaniv Ozana', author_page_id='page-8b5c126b-4175-4479-8bf8-8581747abd8f' where id='page-cb2d6d2e-d1b3-49dd-a9aa-530690824b91' and author_name is null;
update public.content_pages set author_name='Yaniv Ozana', author_page_id='page-8b5c126b-4175-4479-8bf8-8581747abd8f' where id='page-1b9cfdf5-9ee7-4d5f-8fc8-c8bdad1a7c68' and author_name is null;
update public.content_pages set author_name='Roni', author_page_id='page-28aeda68-0dc8-47bd-ae07-87107734b74d' where id='page-a8b24e49-16c5-4b84-a519-0de512ec4252' and author_name is null;
update public.content_pages set author_name='Roni', author_page_id='page-28aeda68-0dc8-47bd-ae07-87107734b74d' where id='page-10d00229-15ad-48b7-9c9d-7bb2bac24a7a' and author_name is null;
update public.content_pages set author_name='Roni', author_page_id='page-28aeda68-0dc8-47bd-ae07-87107734b74d' where id='page-d0f02c63-5adc-429a-9207-067f632a39c3' and author_name is null;
update public.content_pages set author_name='Roni', author_page_id='page-28aeda68-0dc8-47bd-ae07-87107734b74d' where id='page-1dfc1f64-9c6a-4a46-8199-47d84ad3ff19' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-8f0d4e17-ba3f-4ff0-ad60-5097b256cfd7' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-d642ebf1-f724-414e-8d32-a5c213cdd9be' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-56dcafb5-3628-4c18-953c-02b0deb8adc9' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-0ece30a3-48a0-4586-bed3-100457f83c8d' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-7f6996d9-3dde-4d7a-8d00-5309944361a2' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-abef17c9-f313-4611-8203-e47d306b916a' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-f3047d75-2bb0-4e63-8de0-bc4eaf27d68a' and author_name is null;
update public.content_pages set author_name='Oren tal', author_page_id='page-02732de0-5f00-435f-b924-831070d3c2bd' where id='page-32a0beb0-48a4-4812-b05f-9d3dc80d9df4' and author_name is null;
insert into public.content_copy(area,slot,value) select 'seo','googleVerification','HQLi9CUkENhR5okH6YQ43Dp06dCwf6ttMN4W7uNCZgo' where exists(select 1 from public.content_site) on conflict(area,slot) do nothing;
