function origin(name: string, fallback: string): string {
  const url = new URL(process.env[name] ?? fallback);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      `${name} must be an HTTP(S) origin without credentials or a path`,
    );
  return url.origin;
}
export const serverConfig = {
  backendOrigin: origin("BACKEND_ORIGIN", "http://127.0.0.1:3001"),
  siteOrigin: origin("SITE_ORIGIN", "http://localhost:3000"),
  requestTimeoutMs: Number(process.env.CONTENT_TIMEOUT_MS ?? 12000),
  noindex: process.env.ALLOW_INDEXING !== "true",
  apiToken: process.env.BACKEND_API_TOKEN ?? "",
};
const deployment = process.env.DEPLOYMENT_ENV ?? "local";
if (!["local", "preview", "production"].includes(deployment)) throw Error("Invalid DEPLOYMENT_ENV");
if (deployment !== "local" && (!process.env.SITE_ORIGIN || !process.env.BACKEND_ORIGIN || serverConfig.apiToken.length < 32))
  throw Error("Hosted SSR requires SITE_ORIGIN, BACKEND_ORIGIN and BACKEND_API_TOKEN (32+ characters)");
if (serverConfig.apiToken && !/^[A-Za-z0-9_-]{32,256}$/.test(serverConfig.apiToken)) throw Error("Invalid BACKEND_API_TOKEN format");
if (process.env.ALLOW_INDEXING && !["true", "false"].includes(process.env.ALLOW_INDEXING)) throw Error("ALLOW_INDEXING must be true or false");
if (!serverConfig.noindex && (deployment !== "production" || !serverConfig.siteOrigin.startsWith("https://")))
  throw Error("Indexing requires DEPLOYMENT_ENV=production and an explicit HTTPS SITE_ORIGIN");
export function backendHeaders(): HeadersInit {
  return { Accept: "application/json", ...(serverConfig.apiToken ? { Authorization: `Bearer ${serverConfig.apiToken}` } : {}) };
}
if (
  !Number.isInteger(serverConfig.requestTimeoutMs) ||
  serverConfig.requestTimeoutMs < 1 ||
  serverConfig.requestTimeoutMs > 30000
)
  throw new Error("CONTENT_TIMEOUT_MS must be an integer from 1 to 30000");
export function applyResponseHeaders(headers: Headers): void {
  headers.set("Cache-Control", "no-store");
  if (serverConfig.noindex) headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("X-Content-Type-Options", "nosniff");
}
