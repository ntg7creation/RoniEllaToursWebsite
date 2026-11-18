import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export async function migratedTestDatabase() {
  const db = new PGlite();
  // Hosted Supabase supplies these roles. Reproduce their privilege boundaries locally.
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  // Minimal Supabase Auth fixtures for authorization tests. Production Supabase
  // owns this schema; the application migration never creates Auth objects.
  await db.exec(`create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.identities(id uuid primary key,user_id uuid references auth.users(id),provider text,identity_data jsonb);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create function auth.jwt() returns jsonb language sql stable as
      $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as
      $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.jwt(),auth.uid() to anon,authenticated,service_role;`);
  const directory = new URL("../database/supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  return db;
}
