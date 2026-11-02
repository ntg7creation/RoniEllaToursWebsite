import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { defaultContentDirectory } from "./content-repository.js";

export function readBackendConfig(env: NodeJS.ProcessEnv = process.env) {
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw Error(`Invalid ${name}`);
    return value;
  };
  const deployment = env.DEPLOYMENT_ENV ?? "local";
  if (!["local","preview","production"].includes(deployment)) throw Error("Invalid DEPLOYMENT_ENV");
  const provider = env.CONTENT_PROVIDER ?? "files";
  if (!["files","supabase"].includes(provider)) throw Error("CONTENT_PROVIDER must be files or supabase");
  const apiToken = env.BACKEND_API_TOKEN ?? "";
  if ((apiToken && !/^[A-Za-z0-9_-]{32,256}$/.test(apiToken)) || (deployment !== "local" && !apiToken)) throw Error("Set BACKEND_API_TOKEN to a random 32–256 character alphanumeric/URL-safe value");
  const contentDirectory = env.CONTENT_DIRECTORY ? pathToFileURL(resolve(env.CONTENT_DIRECTORY) + sep) : defaultContentDirectory;
  const mediaDirectory = env.MEDIA_DIRECTORY ? pathToFileURL(resolve(env.MEDIA_DIRECTORY) + sep) : new URL("media/", contentDirectory);
  const host = env.API_HOST ?? "127.0.0.1";
  if (!["127.0.0.1","0.0.0.0","::"].includes(host)) throw Error("Invalid API_HOST");
  let origin = "", secretKey = "";
  if (provider === "supabase") {
    if (!env.SUPABASE_URL) throw Error("SUPABASE_URL is required");
    const url = new URL(env.SUPABASE_URL);
    const local = ["localhost","127.0.0.1","[::1]","host.docker.internal"].includes(url.hostname);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(deployment === "local" && local && url.protocol === "http:"))) throw Error("SUPABASE_URL must be an HTTPS origin (HTTP is allowed only for a local stack)");
    origin = url.origin;
    secretKey = env.SUPABASE_SECRET_KEY ?? "";
    let legacyServiceKey = false;
    if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secretKey)) {
      try { legacyServiceKey = JSON.parse(Buffer.from(secretKey.split(".")[1]!, "base64url").toString()).role === "service_role"; } catch { /* Invalid key is rejected below. */ }
    }
    if (!(/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey) && secretKey.length >= 25 && secretKey.length <= 512) && !legacyServiceKey)
      throw Error("SUPABASE_SECRET_KEY must be a server secret key, never a publishable/anon key");
  }
  return { provider, deployment, apiToken, contentDirectory, mediaDirectory, host,
    port: integer("API_PORT", Number(env.PORT ?? 3001), 1, 65535), origin, secretKey,
    timeoutMs: integer("SUPABASE_TIMEOUT_MS", 8000, 1, 30000), cacheMs: integer("CONTENT_CACHE_MS", 30000, 0, 300000) };
}
