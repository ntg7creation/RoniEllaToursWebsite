import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export async function migratedTestDatabase() {
  const db = new PGlite();
  // Hosted Supabase supplies these roles. Reproduce their privilege boundaries locally.
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  return db;
}
