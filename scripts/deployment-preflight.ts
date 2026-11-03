import { readBackendConfig } from "../back/src/config.js";
import { serverConfig } from "../front/app/server/config.server.js";
const config=readBackendConfig();
for(const key of ["SUPABASE_URL","SUPABASE_SECRET_KEY","BACKEND_API_TOKEN","SITE_ORIGIN","SITE_HOST","TLS_EMAIL"]) {
  if (/REPLACE|YOUR_|example\.com/i.test(process.env[key] ?? "")) throw Error(`Replace the example value for ${key}`);
}
if(config.deployment!=="local" && config.provider!=="supabase") throw Error("The online deployment plan expects CONTENT_PROVIDER=supabase");
if(process.env.SITE_HOST && new URL(serverConfig.siteOrigin).hostname!==process.env.SITE_HOST) throw Error("SITE_HOST and SITE_ORIGIN must name the same hostname");
if(serverConfig.requestTimeoutMs<=config.timeoutMs) throw Error("CONTENT_TIMEOUT_MS must exceed SUPABASE_TIMEOUT_MS");
console.log(`PASS: offline deployment configuration (${config.provider}; ${config.deployment}; indexing ${serverConfig.noindex ? "disabled" : "enabled"}). No secrets printed, network requests made, or services deployed.`);
