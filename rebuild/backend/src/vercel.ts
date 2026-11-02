import type { RequestListener } from "node:http";
import { createApp } from "./app.js";
import { readBackendConfig } from "./config.js";
import { SupabaseContentRepository } from "./supabase-repository.js";

// The build injects filenames only. Photos are static assets outside the function.
declare const __RONIELLA_STATIC_MEDIA__: string[];
let app: ReturnType<typeof createApp> | undefined;
const handler: RequestListener = (req, res) => {
  try {
    if (!app) {
      const config = readBackendConfig();
      if (config.provider !== "supabase" || !config.apiToken)
        throw Error("Vercel requires Supabase and an API token");
      app = createApp(new SupabaseContentRepository({ ...config,
        staticMediaFiles: new Set(__RONIELLA_STATIC_MEDIA__),
      }), { apiToken: config.apiToken });
    }
    app(req, res);
  } catch {
    console.error("Backend deployment configuration is unavailable");
    res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
    res.end(JSON.stringify({ error: { code: "unavailable" } }));
  }
};
export default handler;
