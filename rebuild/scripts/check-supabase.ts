import { readBackendConfig } from "../backend/src/config.js";
import { SupabaseContentRepository } from "../backend/src/supabase-repository.js";
const config=readBackendConfig();
if(config.provider!=="supabase") throw Error("Set CONTENT_PROVIDER=supabase for this read-only connectivity check");
try {
  const content=await new SupabaseContentRepository({...config,cacheMs:0}).getPublicContent();
  console.log(`PASS: hosted/local Supabase read, schema validation and registered backend image files (${content.pages.length} published pages, ${content.gallery?.photos.length ?? 0} gallery photos). No database writes performed.`);
} catch {
  console.error("Supabase check failed. Verify URL/server key, both migrations, initial content import and corresponding backend media files. No secret values are logged.");
  process.exitCode=1;
}
