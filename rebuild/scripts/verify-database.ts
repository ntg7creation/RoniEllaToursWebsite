import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LocalContentRepository } from "../backend/src/content-repository.js";
import { parseSiteContent } from "../shared/src/site-content.js";
import { createContentSeed, createGalleryUpdate } from "./content-seed.js";
import { migratedTestDatabase } from "./database-test-support.js";

const source = await (await LocalContentRepository.load()).getPublicContent();
const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
assert.equal(seed, createContentSeed(source), "Seed is stale. Run npm run db:seed and review it.");
const db = await migratedTestDatabase();
try {
  await db.exec(seed);
  const read = async () => parseSiteContent((await db.query<{content:unknown}>("select public.read_site_content() as content")).rows[0]!.content);
  assert.deepEqual(await read(), source, "Database round-trip must preserve every text block, ordering, link, media record and SEO field");
  await db.exec("set role service_role");
  assert.deepEqual(await read(), source);
  await assert.rejects(db.exec("update public.content_copy set value='not allowed'"), /permission denied/);
  await db.exec("reset role");
  for (const role of ["anon","authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.exec("select * from public.content_pages"), /permission denied/);
    await assert.rejects(db.exec("select public.read_site_content()"), /permission denied/);
    await assert.rejects(db.exec("update public.content_site set notice='not allowed'"), /permission denied/);
    await db.exec("reset role");
  }
  const policies = await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'content_%'");
  assert.equal(policies.rows.length, 13); assert.ok(policies.rows.every(row => row.relrowsecurity));
  const tour = source.pages.find(page => page.pageType === "tour")!;
  await db.query("update public.content_pages set published=false where id=$1",[tour.id]);
  const draftView = await read();
  assert.ok(!draftView.pages.some(page => page.id === tour.id));
  assert.ok(draftView.pages.every(page => page.cards.every(card => card.pageId !== tour.id)));
  assert.ok(draftView.redirects.every(redirect => redirect.toPath !== tour.path));
  assert.ok(draftView.siteSettings.navigation.every(link => link.path !== tour.path));
  assert.ok(!draftView.siteSettings.featuredTourIds.includes(tour.id));
  await db.query("update public.content_pages set published=true where id=$1",[tour.id]);
  await db.exec("update public.content_copy set value='Edited directly in database' where area='home.hero' and slot='heading'");
  assert.equal((await read()).presentation["home.hero.heading"],"Edited directly in database");
  assert.throws(()=>createGalleryUpdate({...source,gallery:{...source.gallery!,photos:[{...source.gallery!.photos[0]!,id:source.media[0]!.id}]}}),/overlap/);
  await assert.rejects(db.exec(seed), /Content already exists/);
  await db.exec("rollback");
  assert.equal((await read()).presentation["home.hero.heading"],"Edited directly in database", "Repeated bootstrap must not overwrite editorial changes");
  await db.exec("update public.content_gallery set heading='Database gallery heading'");
  await db.query("update public.content_media set alt='Database-edited description' where id=$1",[source.gallery!.photos[0]!.id]);
  await db.exec(createGalleryUpdate(source));
  assert.equal((await read()).gallery!.heading,"Database gallery heading");
  assert.equal((await read()).gallery!.photos[0]!.alt,"Database-edited description");
  assert.equal((await read()).presentation["home.hero.heading"],"Edited directly in database");
  const page = source.pages[0]!;
  await assert.rejects(db.query("insert into public.content_page_cards(page_id,position,target_page_id) values($1,9999,'missing-page')",[page.id]), /foreign key/);
  await assert.rejects(db.exec("insert into public.content_media(id,kind,position,src,width,height,alt) values('bad','gallery',999,'/media/../../private.json',1,1,'bad')"), /check constraint/);
  console.log(`PASS: actual PostgreSQL migrations and seed; exact round-trip of ${source.pages.length} pages and ${source.gallery?.photos.length} gallery photos; all 13 tables protected; anonymous/authenticated access denied; server read-only grants; drafts excluded; editorial edits and safe bootstrap refusal; foreign-key/path checks.`);
} finally { await db.close(); }
