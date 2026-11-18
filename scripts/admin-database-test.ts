import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { migratedTestDatabase } from "./database-test-support.js";
import { parseSiteContent } from "../shared/src/site-content.js";
const db = await migratedTestDatabase();
const admin = "11111111-1111-4111-8111-111111111111", outsider = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333", otherSession = "44444444-4444-4444-8444-444444444444";
const claims = (id: string, sid: string) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, session_id: sid })]);
const allowed = async () => (await db.query<{ allowed: boolean }>("select public.is_site_admin() as allowed")).rows[0]!.allowed;
const save = (changes: unknown[]) => db.query("select public.admin_save_content($1::jsonb)", [JSON.stringify(changes)]);
const readCopy = async () => (await db.query<{ data: { copy: { value: string }[] } }>("select public.admin_read_editor('copy','home.hero') as data")).rows[0]!.data;
try {
  await db.exec(await readFile(new URL("../database/supabase/seed.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1,'editor@example.com',now()),($2,'visitor@example.com',now())", [admin, outsider]);
  await db.query("insert into auth.identities values($1,$1,'google',$3::jsonb),($2,$2,'google',$4::jsonb)", [admin, outsider, JSON.stringify({ email: "editor@example.com", email_verified: true }), JSON.stringify({ email: "visitor@example.com", email_verified: true })]);
  await db.query("insert into auth.sessions values($1,$2),($3,$4)", [session, admin, otherSession, outsider]);
  await db.exec("insert into public.site_admins(email) values('editor@example.com')");
  await db.exec("set role anon");
  await assert.rejects(readCopy(), /permission denied/);
  await db.exec("reset role; set role authenticated");
  await claims(outsider, otherSession); assert.equal(await allowed(), false);
  await assert.rejects(readCopy(), /Admin access required/);
  await assert.rejects(save([{ scope: "copy", key: "home.hero.heading", field: "value", expected: "x", value: "y" }]), /Admin access required/);
  await claims(admin, session); assert.equal(await allowed(), true);
  for (const sql of ["select * from public.site_admins", "insert into public.site_admins(email) values('visitor@example.com')", "update public.content_copy set value='bypass'", "select * from public.site_edit_history"])
    await assert.rejects(db.exec(sql), /permission denied/);
  const original = (await readCopy()).copy;
  const loaded = (await db.query<{ data: { copy: { key: string; value: string }[] } }>("select public.admin_read_editor('copy','home.hero') as data")).rows[0]!.data;
  const heading = loaded.copy.find(row => row.key === "home.hero.heading")!;
  const change = { scope: "copy", key: heading.key, field: "value", expected: heading.value, value: "כותרת שנערכה במבחן" };
  await save([change]); assert.ok((await readCopy()).copy.some(row => row.value === change.value));
  await assert.rejects(save([{ ...change, value: "stale overwrite" }]), /changed since/);
  await assert.rejects(save([{ ...change, expected: change.value, value: "must roll back" }, { scope: "copy", key: "home.hero.kicker", field: "value", expected: "wrong previous value", value: "second" }]), /changed since/);
  assert.ok((await readCopy()).copy.some(row => row.value === change.value), "A failed batch must roll back earlier edits");
  for (const invalid of [
    { ...change, scope: "site_admins", expected: change.value },
    { ...change, field: "area", expected: change.value },
    { ...change, field: "value; drop table public.site_admins", expected: change.value },
    { ...change, path: ["href"], expected: change.value },
    { ...change, expected: change.value, value: "" },
    { ...change, expected: change.value, value: "x".repeat(20001) },
  ]) await assert.rejects(save([invalid]));
  await db.exec("reset role");
  const page = (await db.query<{ id: string; title: string }>("select id,title from public.content_pages where path='/about/'")).rows[0]!;
  await db.query("insert into public.content_blocks(page_id,position,block_type,table_rows) values($1,9999,'table',$2::jsonb)",
    [page.id, JSON.stringify([[{ text: "Original cell", isHeader: true, rowspan: null, colspan: null, links: [] }]])]);
  const list = (await db.query<{ page_id: string; position: number; text: string }>("select page_id,position,list_items#>>'{0,text}' as text from public.content_blocks where block_type='list' and jsonb_array_length(list_items)>0 limit 1")).rows[0]!;
  const table = (await db.query<{ page_id: string; position: number; text: string }>("select page_id,position,table_rows#>>'{0,0,text}' as text from public.content_blocks where block_type='table' and jsonb_array_length(table_rows)>0 limit 1")).rows[0]!;
  await db.exec("set role authenticated");
  await save([
    { scope: "page", key: page.id, field: "title", expected: page.title, value: "אודות העסק — מבחן" },
    { scope: "block", key: list.page_id, position: list.position, field: "list_items", path: ["0", "text"], expected: list.text, value: "פריט מעודכן" },
    { scope: "block", key: table.page_id, position: table.position, field: "table_rows", path: ["0", "0", "text"], expected: table.text, value: "תא מעודכן" },
  ]);
  await assert.rejects(save([{ scope: "page", key: page.id, field: "published", expected: true, value: false }]));
  await assert.rejects(save([{ scope: "block", key: list.page_id, position: list.position, field: "list_items", path: ["0", "links", "0", "href"], expected: "x", value: "javascript:alert(1)" }]));
  const site = (await db.query<{ data: { site: { contact_email: string; contact_phone: string } } }>("select public.admin_read_editor('site','site') as data")).rows[0]!.data.site;
  for (const value of ["double..dot@example.com", "bad@example.c", "not an email", "a@invalid_domain.com"])
    await assert.rejects(save([{ scope: "site", key: "site", field: "contact_email", expected: site.contact_email, value }]), /Invalid email/);
  await assert.rejects(save([{ scope: "site", key: "site", field: "contact_phone", expected: site.contact_phone, value: "javascript:alert(1)" }]), /Invalid phone/);
  await db.exec("begin");
  await save([{ scope: "site", key: "site", field: "contact_email", expected: site.contact_email, value: "editor+site@example.com" }]);
  await db.exec("reset role");
  parseSiteContent((await db.query<{ content: unknown }>("select public.read_site_content() as content")).rows[0]!.content);
  await db.exec("rollback");
  await db.exec("reset role");
  const seo = (await db.query<{ seo_title: string | null }>("select seo_title from public.content_pages where id=$1", [page.id])).rows[0]!.seo_title;
  await db.exec("begin; set local role authenticated");
  await save([{ scope: "page", key: page.id, field: "seo_title", expected: seo, value: null }]);
  await db.exec("reset role");
  const automatic = parseSiteContent((await db.query<{ content: unknown }>("select public.read_site_content() as content")).rows[0]!.content);
  assert.ok(automatic.pages.find(item => item.id === page.id)!.seo.title.startsWith("אודות העסק — מבחן"));
  await db.exec("rollback");
  await db.exec("reset role");
  const history = await db.query<{ actor_id: string; actor_email: string }>("select actor_id,actor_email from public.site_edit_history");
  assert.equal(history.rows.length, 4); assert.ok(history.rows.every(row => row.actor_id === admin && row.actor_email === "editor@example.com"));
  parseSiteContent((await db.query<{ content: unknown }>("select public.read_site_content() as content")).rows[0]!.content);
  // Trip lifecycle and structural edits use real database functions and roles.
  type ManagedBody = { id: string; title: string; revision: string; blocks: import('../shared/src/site-content.js').SiteBlock[] };
  const manage = async (command: unknown) => (await db.query<{ result: { id: string; path: string } }>('select public.admin_manage_content($1::jsonb) as result', [JSON.stringify(command)])).rows[0]!.result;
  const body = async (id: string) => (await db.query<{ result: ManagedBody }>('select public.admin_manage_read($1) as result', [id])).rows[0]!.result;
  const readPublic = async () => { await db.exec('reset role'); const content = parseSiteContent((await db.query<{ content: unknown }>('select public.read_site_content() as content')).rows[0]!.content); await db.exec('set role authenticated'); return content; };
  const create = { operation: 'create_trip', requestId: '55555555-5555-4555-8555-555555555555', trip: { title: 'טיול חדש לבדיקה', slug: 'integration-trip', summary: 'תקציר חדש', overview: 'פתיח לטיול החדש', dates: 'מאי 2028', duration: '10 ימים', price: '2500 USD', guide: 'צוות ההדרכה', status: 'הרשמה פתוחה' } };
  await db.exec('set role anon'); await assert.rejects(manage(create), /permission denied/); await assert.rejects(body(page.id), /permission denied/);
  await db.exec('reset role; set role authenticated'); await claims(outsider, otherSession); await assert.rejects(manage(create), /Admin access required/);
  await claims(admin, session);
  const linkPhoto = async (photo: unknown) => (await db.query<{ result: { id: string; src: string; alt: string } }>('select public.admin_link_drive_photo($1::jsonb) as result', [JSON.stringify(photo)])).rows[0]!.result;
  const photoReference = { folderUrl: 'https://drive.google.com/drive/folders/1TILL118zzozt6e6gTCO8_HA3HjN3wJNE', fileId: 'public-photo-one', width: 2400, height: 3200, alt: 'תצלום מתוך תיקייה משותפת', addedAt: '2026-11-02T16:07:18Z' };
  await claims(outsider, otherSession); await assert.rejects(linkPhoto(photoReference), /Admin access required/); await claims(admin, session);
  const linkedPhoto = await linkPhoto(photoReference); assert.deepEqual(await linkPhoto(photoReference), linkedPhoto, 'A repeated selection reuses the reference');
  const linkedMedia = (await readPublic()).media.find(asset => asset.id === linkedPhoto.id)!;
  assert.deepEqual(linkedMedia.googleDrive, { folderUrl: photoReference.folderUrl, fileId: photoReference.fileId, fileUrl: 'https://drive.google.com/file/d/' + photoReference.fileId + '/view' });
  assert.equal(linkedMedia.variants.length, 2); assert.equal(linkedMedia.variants[1]!.width, 1200);
  for (const patch of [{ folderUrl: 'http://localhost/private' }, { fileId: '../private' }, { width: -1 }]) await assert.rejects(linkPhoto({ ...photoReference, ...patch }));
  await db.query('select public.admin_set_drive_folder($1,$2)', [photoReference.folderUrl,photoReference.folderUrl]);
  await assert.rejects(db.query('select public.admin_set_drive_folder($1,$2)', [photoReference.folderUrl,'https://drive.google.com/drive/folders/staleFolder']),/Folder changed/);
  const photoSlot = async (slot = 'home.approach') => (await db.query<{ result: { mediaId: string | null; revision: string } }>('select public.admin_read_photo_slot($1) as result', [slot])).rows[0]!.result;
  const savePhoto = async (media: string | null, revision: string) => db.query('select public.admin_save_photo_slot($1,$2,$3)', ['home.approach',media,revision]);
  assert.equal((await readPublic()).photoSlots, undefined, 'Default presentation is unchanged before any selection');
  assert.deepEqual({ mediaId: (await photoSlot()).mediaId, revision: (await photoSlot()).revision }, { mediaId: 'samarkand', revision: '0' });
  await db.exec('reset role; set role anon'); await assert.rejects(photoSlot(), /permission denied/); await assert.rejects(savePhoto(null,'0'), /permission denied/);
  await db.exec('reset role; set role authenticated'); await claims(outsider, otherSession); await assert.rejects(photoSlot(), /Admin access required/); await assert.rejects(savePhoto(null,'0'), /Admin access required/); await claims(admin,session);
  await assert.rejects(photoSlot('unknown'), /Unknown photo slot/);
  await assert.rejects(savePhoto('missing-media','0'), /Invalid photo/);
  await savePhoto(linkedPhoto.id,'0');
  assert.equal((await photoSlot()).mediaId, linkedPhoto.id);
  assert.equal((await readPublic()).photoSlots!['home.approach'],linkedPhoto.id);
  assert.equal((await photoSlot('home.hero')).mediaId,'samarkand','The hero is independent of the approach photo');
  await assert.rejects(savePhoto('samarkand','0'), /Photo changed/);
  await savePhoto(null,(await photoSlot()).revision);
  assert.equal((await readPublic()).photoSlots!['home.approach'],null,'Explicit removal survives serialization');
  await savePhoto('samarkand',(await photoSlot()).revision);
  await db.exec('reset role; set role service_role');
  assert.equal(parseSiteContent((await db.query<{content:unknown}>('select public.read_site_content() as content')).rows[0]!.content).photoSlots!['home.approach'],'samarkand');
  await db.exec('reset role; set role authenticated'); await claims(admin,session);
  const created = await manage(create);
  assert.deepEqual(await manage(create), created, 'Retrying the same creation request is idempotent');
  await assert.rejects(manage({ ...create, requestId: '66666666-6666-4666-8666-666666666666' }), /Address already used/);
  assert.ok(!(await readPublic()).pages.some(p => p.id === created.id), 'Draft stays private');
  const draft = await body(created.id);
  assert.equal(draft.blocks[0]!.type, 'paragraph');
  const updatedBlocks = [...draft.blocks]; updatedBlocks.splice(2, 0, { type: 'heading', level: 3, text: 'יום 1 — הגעה', anchorIds: ['editor-day-integration'], links: [] }, { type: 'paragraph', text: 'נפגשים ומתחילים את הטיול.', anchorIds: [], links: [] });
  await manage({ operation: 'save_body', key: created.id, expectedRevision: draft.revision, blocks: updatedBlocks });
  await assert.rejects(manage({ operation: 'save_body', key: created.id, expectedRevision: draft.revision, blocks: draft.blocks }), /Page changed/);
  const editedBody = await body(created.id);
  await assert.rejects(manage({ operation: 'save_body', key: created.id, expectedRevision: editedBody.revision, blocks: [{ type: 'paragraph', text: 'bad link', anchorIds: [], links: [{ text: 'bad', href: 'javascript:alert(1)' }] }] }), /Invalid link/);
  assert.deepEqual((await body(created.id)).blocks, updatedBlocks, 'Rejected body is atomic');
  await manage({ operation: 'publish_trip', key: created.id, expectedRevision: editedBody.revision, published: true });
  let publicView = await readPublic();
  assert.equal(publicView.pages.find(p => p.id === created.id)!.tourDetails!.price, '2500 USD');
  assert.ok(publicView.pages.find(p => p.path === '/')!.cards.some(c => c.pageId === created.id));
  assert.ok(publicView.pages.find(p => p.pageType === 'tours')!.cards.some(c => c.pageId === created.id));
  assert.ok(publicView.siteSettings.featuredTourIds.includes(created.id));
  const beforeInline = await body(created.id);
  await save([{ scope: 'block', key: created.id, position: 0, field: 'text', expected: 'פתיח לטיול החדש', value: 'פתיח מעודכן' }]);
  await assert.rejects(manage({ operation: 'save_body', key: created.id, expectedRevision: beforeInline.revision, blocks: beforeInline.blocks }), /Page changed/);
  await manage({ operation: 'publish_trip', key: created.id, expectedRevision: (await body(created.id)).revision, published: false });
  publicView = await readPublic(); assert.ok(!publicView.pages.some(p => p.id === created.id)); assert.ok(publicView.pages.every(p => p.cards.every(c => c.pageId !== created.id)));
  await manage({ operation: 'publish_trip', key: created.id, expectedRevision: (await body(created.id)).revision, published: true });
  assert.equal((await readPublic()).pages.find(p => p.id === created.id)!.blocks[0]!.type, 'paragraph');
  // Every existing body must survive the richer editor, including nested lists and tables.
  for (const existing of (await readPublic()).pages) {
    const doc = await body(existing.id); if (!doc.blocks.length) continue;
    await manage({ operation: 'save_body', key: existing.id, expectedRevision: doc.revision, blocks: doc.blocks });
    assert.deepEqual((await body(existing.id)).blocks, doc.blocks);
  }
  // Destination and blog lifecycle, media, labels and metadata share the public projection.
  type Workspace = ManagedBody & { settings: import('../shared/src/admin.js').PageSettings };
  const workspace = async (id: string) => (await db.query<{ result: Workspace }>('select public.admin_workspace_read($1) as result', [id])).rows[0]!.result;
  const originalArticle = (await readPublic()).pages.find(p => p.pageType === 'article' && p.publicationDate?.includes('T'))!;
  const originalSettings = await workspace(originalArticle.id);
  assert.equal(originalSettings.settings.publicationDate, originalArticle.publicationDate!.slice(0, 10));
  await manage({ operation: 'save_settings', key: originalArticle.id, expectedRevision: originalSettings.revision, settings: { ...originalSettings.settings, socialTitle: 'כותרת שיתוף לבדיקה' } });
  assert.equal((await readPublic()).pages.find(p => p.id === originalArticle.id)!.publicationDate, originalArticle.publicationDate, 'Unrelated metadata edits preserve an imported publication timestamp');
  const linkedSettings = await workspace(originalArticle.id);
  await manage({ operation: 'save_settings', key: originalArticle.id, expectedRevision: linkedSettings.revision, settings: { ...linkedSettings.settings, heroMediaId: linkedPhoto.id } });
  assert.equal((await readPublic()).pages.find(p => p.id === originalArticle.id)!.heroMediaId, linkedPhoto.id);
  await db.exec('reset role; set role anon'); await assert.rejects(workspace(originalArticle.id), /permission denied/);
  await db.exec('reset role; set role authenticated'); await claims(outsider, otherSession); await assert.rejects(workspace(originalArticle.id), /Admin access required/);
  await claims(admin, session);
  for (const [collection, requestId, slug] of [
    ['article', '77777777-7777-4777-8777-777777777777', 'new-story'],
    ['destinationArchive', '88888888-8888-4888-8888-888888888888', 'new-destination'],
  ] as const) {
    const command = { operation: 'create_entry', collection, requestId, entry: { title: 'תוכן חדש', slug, summary: 'תקציר משותף', overview: 'הסיפור החדש מתחיל כאן', dates: '' } };
    const entry = await manage(command); assert.deepEqual(await manage(command), entry);
    assert.ok(!(await readPublic()).pages.some(p => p.id === entry.id));
    const initial = await workspace(entry.id), asset = (await readPublic()).media[0]!;
    const settings = { ...initial.settings, title: 'כותרת מעודכנת', dates: 'סתיו 2028 — טרם נקבע', heroMediaId: asset.id,
      seoTitle: 'כותרת חיפוש', seoDescription: 'תיאור חיפוש', keywords: ['היסטוריה', 'תרבות'], socialTitle: 'כותרת שיתוף', socialDescription: 'תיאור שיתוף', authorName: 'כותבת חדשה', publicationDate: '2026-11-08', noindex: true };
    await manage({ operation: 'save_settings', key: entry.id, expectedRevision: initial.revision, settings });
    await assert.rejects(manage({ operation: 'save_settings', key: entry.id, expectedRevision: initial.revision, settings }), /Page changed/);
    const changed = await workspace(entry.id);
    for (const patch of [{ heroMediaId: 'missing' }, { publicationDate: '2026-02-31' }, { keywords: [false] }, { noindex: 'true' }])
      await assert.rejects(manage({ operation: 'save_settings', key: entry.id, expectedRevision: changed.revision, settings: { ...settings, ...patch } }));
    const image = { type: 'image', mediaId: asset.id, alt: 'תיאור נגיש', caption: 'צילום מתוך המאמר', align: 'left', anchorIds: [], links: [] };
    const withImage = [image, ...changed.blocks];
    await manage({ operation: 'save_body', key: entry.id, expectedRevision: changed.revision, blocks: withImage });
    const imageBody = await body(entry.id); assert.deepEqual(imageBody.blocks, withImage);
    await assert.rejects(manage({ operation: 'save_body', key: entry.id, expectedRevision: imageBody.revision, blocks: [{ ...image, mediaId: 'unknown' }] }), /Invalid image/);
    await manage({ operation: 'publish_entry', key: entry.id, expectedRevision: imageBody.revision, published: true });
    let view = await readPublic(), published = view.pages.find(p => p.id === entry.id)!;
    assert.equal(published.heroMediaId, asset.id); assert.deepEqual(published.seo.keywords, settings.keywords);
    assert.equal(published.seo.socialTitle, settings.socialTitle); assert.equal(published.seo.noindex, true);
    assert.equal(published.author!.name, settings.authorName); assert.equal(published.blocks[0]!.type, 'image');
    if (collection === 'article') {
      assert.ok(view.pages.find(p => p.pageType === 'blog')!.cards.some(c => c.pageId === entry.id && c.summary === settings.summary));
      assert.ok(view.siteSettings.featuredPostIds.includes(entry.id));
    } else assert.equal(published.destinationDetails!.dates, settings.dates);
    const next = await workspace(entry.id);
    await manage({ operation: 'save_settings', key: entry.id, expectedRevision: next.revision, settings: { ...next.settings, dates: '', heroMediaId: null } });
    await manage({ operation: 'publish_entry', key: entry.id, expectedRevision: (await body(entry.id)).revision, published: false });
    view = await readPublic(); assert.ok(!view.pages.some(p => p.id === entry.id));
    assert.ok(view.pages.every(p => p.cards.every(c => c.pageId !== entry.id)));
    await manage({ operation: 'publish_entry', key: entry.id, expectedRevision: (await body(entry.id)).revision, published: true });
    published = (await readPublic()).pages.find(p => p.id === entry.id)!;
    assert.equal(published.heroMediaId, null); if (collection === 'destinationArchive') assert.equal(published.destinationDetails!.dates, '');
  }
  await db.exec('reset role');
  for (const invalidation of [
    "update public.site_admins set active=false",
    "update auth.identities set identity_data=jsonb_set(identity_data,'{email_verified}','false')",
    "update auth.identities set identity_data=jsonb_set(identity_data,'{email}','\"different@example.com\"')",
    "delete from auth.sessions",
  ]) {
    await db.exec("begin"); await db.exec(invalidation); await db.exec("set local role authenticated");
    assert.equal(await allowed(), false); await assert.rejects(readCopy(), /Admin access required/);
    await db.exec("rollback");
  }
  assert.equal(original.length, 3);
  console.log("PASS: real PostgreSQL admin allowlist, Google identity and session checks; private tables; atomic text edits, conflict rollback, schema preservation, audit history and immediate revocation. No hosted changes.");
} finally { await db.close(); }
