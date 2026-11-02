import { writeFile } from "node:fs/promises";
import { LocalContentRepository } from "../backend/src/content-repository.js";
import { createGalleryUpdate } from "./content-seed.js";
const content=await(await LocalContentRepository.load()).getPublicContent();
await writeFile(new URL("../deploy/gallery-update.sql",import.meta.url),createGalleryUpdate(content),"utf8");
console.log("Prepared deploy/gallery-update.sql for review. Deploy new backend photo files first, then apply this transaction manually. Database prose and existing alt descriptions are preserved. No database was contacted.");
