import { createServerClient, parseCookieHeader, serializeCookieHeader, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { safeAdminReturn, type AdminIdentity } from "@roniella/shared/admin";
import { serverConfig } from "./config.server";

const lifetime = 60 * 60 * 24 * 30;
export function adminConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  const url = new URL(env.SUPABASE_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && (env.DEPLOYMENT_ENV ?? "local") === "local";
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw Error("Invalid admin Supabase URL");
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  let anon = false;
  try { anon = key.startsWith("eyJ") && JSON.parse(Buffer.from(key.split(".")[1]!, "base64url").toString()).role === "anon"; } catch { /* Reject malformed legacy keys. */ }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key) && !anon) throw Error("Admin auth requires a publishable or anon key");
  return { origin: url.origin, key };
}
export function adminOrigin(request: Request) {
  return (process.env.DEPLOYMENT_ENV ?? "local") === "local" ? new URL(request.url).origin : serverConfig.siteOrigin;
}
export function adminHeaders() {
  return new Headers({
    "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "Expires": "0",
    "Vary": "Cookie", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
}
export function sameOriginAdminPost(request: Request) {
  return request.method === "POST" && request.headers.get("origin") === adminOrigin(request) &&
    new URL(request.url).origin === adminOrigin(request) && request.headers.get("sec-fetch-site") !== "cross-site";
}
export function verifiedGoogleEmail(user: User | null): string | null {
  if (!user?.email || !user.email_confirmed_at || user.is_anonymous) return null;
  const email = user.email.toLowerCase();
  return user.identities?.some(identity => identity.provider === "google" &&
    identity.identity_data?.email_verified === true &&
    typeof identity.identity_data.email === "string" && identity.identity_data.email.toLowerCase() === email) ? email : null;
}
export class AdminUnavailable extends Error {}

export function clearAdminCookies(request: Request, headers = adminHeaders()) {
  for (const cookie of parseCookieHeader(request.headers.get("cookie") ?? "")) {
    if (/^(?:__Host-)?roniella-admin(?:[.-]|$)/.test(cookie.name)) {
      headers.append("Set-Cookie", serializeCookieHeader(cookie.name, "", {
        path: "/", httpOnly: true, secure: cookie.name.startsWith("__Host-"), sameSite: "lax", maxAge: 0,
      }));
    }
  }
  return headers;
}

export function createAdminAuth(request: Request, transport: typeof fetch = fetch) {
  const config = adminConfig();
  if (!config) return null;
  const secure = new URL(adminOrigin(request)).protocol === "https:";
  const name = secure ? "__Host-roniella-admin" : "roniella-admin";
  const options: CookieOptions = { path: "/", httpOnly: true, secure, sameSite: "lax", maxAge: lifetime };
  const cookies = new Map(parseCookieHeader(request.headers.get("cookie") ?? "").map(cookie => [cookie.name, cookie.value]));
  const pending = new Map<string, { value: string; options: CookieOptions }>();
  const setCookie = (cookieName: string, value: string, extra: CookieOptions = {}) => {
    cookies.set(cookieName, value);
    // Deletion must retain maxAge=0. The secure, host-only HttpOnly settings
    // apply to session chunks and PKCE verifier cookies alike.
    pending.set(cookieName, { value, options: { ...options, ...extra, path: "/", httpOnly: true, secure, sameSite: "lax", domain: undefined } });
  };
  const client = createServerClient(config.origin, config.key, {
    cookieOptions: { ...options, name },
    global: { fetch: (input, init) => transport(input, { ...init, redirect: "error", cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000), ...(init?.signal ? [init.signal] : [])]) }) },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: values => { for (const cookie of values) setCookie(cookie.name, cookie.value, cookie.options); },
    },
  });
  const clear = () => {
    for (const cookieName of cookies.keys())
      if (cookieName === name || cookieName.startsWith(name + ".") || cookieName.startsWith(name + "-")) setCookie(cookieName, "", { maxAge: 0 });
  };
  const headers = () => {
    const result = adminHeaders();
    for (const [cookieName, cookie] of pending) result.append("Set-Cookie", serializeCookieHeader(cookieName, cookie.value, cookie.options));
    return result;
  };
  async function identity(): Promise<AdminIdentity | null> {
    if (![...cookies.keys()].some(cookieName => cookieName === name || cookieName.startsWith(name + "."))) return null;
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (!error.status || error.status >= 500) throw new AdminUnavailable();
      clear(); return null;
    }
    const email = verifiedGoogleEmail(data.user);
    if (!email) { clear(); return null; }
    const allowed = await client.rpc("is_site_admin");
    if (allowed.error) throw new AdminUnavailable();
    if (allowed.data !== true) { clear(); return null; }
    return { email };
  }
  return {
    client, headers, clear, identity,
    setReturnPath: (value: unknown) => setCookie(name + "-return", safeAdminReturn(value), { maxAge: 600 }),
    returnPath: () => safeAdminReturn(cookies.get(name + "-return")),
    clearReturnPath: () => setCookie(name + "-return", "", { maxAge: 0 }),
    async googleEnabled() {
      const response = await transport(config.origin + "/auth/v1/settings", {
        headers: { apikey: config.key }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new AdminUnavailable();
      const settings = await response.json() as { external?: { google?: boolean } };
      return settings.external?.google === true;
    },
  };
}
export type AdminAuth = NonNullable<ReturnType<typeof createAdminAuth>>;
