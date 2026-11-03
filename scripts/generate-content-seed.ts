import { writeFile } from "node:fs/promises";
import { LocalContentRepository } from "../back/src/content-repository.js";
import { createContentSeed } from "./content-seed.js";
const content = await (await LocalContentRepository.load()).getPublicContent();
await writeFile(new URL("../database/supabase/seed.sql", import.meta.url), createContentSeed(content), "utf8");
console.log(`Prepared offline seed: ${content.pages.length} pages, ${content.pages.reduce((n,p)=>n+p.blocks.length,0)} ordered blocks, ${Object.keys(content.presentation).length} copy slots, ${content.gallery?.photos.length ?? 0} gallery photos. No database connection was made.`);
