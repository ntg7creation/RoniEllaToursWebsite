import { createServer } from "node:http";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { migratedTestDatabase } from "./database-test-support.js";

// Local GoTrue/PostgREST protocol double. Google consent is simulated; actual
// application SDKs, PKCE verification, cookies and PostgreSQL RPCs are exercised.
export async function adminTestServices(port: number) {
  const db = await migratedTestDatabase();
  await db.exec(await readFile(new URL("../database/supabase/seed.sql", import.meta.url), "utf8"));
  const origin = `http://127.0.0.1:${port}`;
  const publicKey = "sb_publishable_admin_test_not_a_real_key", secretKey = "sb_secret_admin_test_not_a_real_key";
  const users = {
    admin: { id: "11111111-1111-4111-8111-111111111111", email: "editor@example.com" },
    outsider: { id: "22222222-2222-4222-8222-222222222222", email: "visitor@example.com" },
  };
  for (const user of Object.values(users)) {
    await db.query("insert into auth.users values($1,$2,now())", [user.id, user.email]);
    await db.query("insert into auth.identities values($1,$1,'google',$2::jsonb)", [user.id, JSON.stringify({ email: user.email, email_verified: true })]);
  }
  await db.query("insert into public.site_admins(email) values($1)", [users.admin.email]);
  const flows = new Map<string, { redirect: string; challenge: string }>();
  const codes = new Map<string, { user: keyof typeof users; challenge: string }>();
  const access = new Map<string, { sub: string; session_id: string; exp: number }>();
  const refresh = new Map<string, { user: keyof typeof users; sid: string }>();
  const counters = { refreshes: 0, exchanges: 0, writes: 0 };
  let authAvailable = true, googleEnabled = true;
  const userData = (key: keyof typeof users) => ({ ...users[key], aud: "authenticated", role: "authenticated", created_at: "2026-11-03T00:00:00Z", email_confirmed_at: "2026-11-03T00:00:00Z", is_anonymous: false,
    app_metadata: { provider: "google", providers: ["google"] }, user_metadata: {},
    identities: [{ id: users[key].id, identity_id: users[key].id, user_id: users[key].id, provider: "google", identity_data: { email: users[key].email, email_verified: true } }],
  });
  async function issue(key: keyof typeof users, existing?: string) {
    const sid = existing ?? randomUUID();
    if (!existing) await db.query("insert into auth.sessions values($1,$2)", [sid, users[key].id]);
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const claims = { sub: users[key].id, session_id: sid, exp, role: "authenticated", aud: "authenticated", email: users[key].email, iat: exp - 3600, jti: randomUUID() };
    const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const jwt = head + "." + body + "." + createHmac("sha256", "local-test-signing-key").update(head + "." + body).digest("base64url");
    access.set(jwt, claims);
    const token = randomUUID(); refresh.set(token, { user: key, sid });
    return { access_token: jwt, refresh_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, user: userData(key) };
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, origin);
    const json = (status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(value)); };
    try {
      if (url.pathname === "/auth/v1/authorize") {
        const id = randomUUID(); flows.set(id, { redirect: url.searchParams.get("redirect_to")!, challenge: url.searchParams.get("code_challenge")! });
        res.writeHead(200, { "Content-Type": "text/html" }).end(`<html lang="en"><title>Local simulated Google consent</title><h1>Local Google test</h1><form action="/test/consent"><input type="hidden" name="flow" value="${id}"><button name="user" value="admin">Continue as editor</button><button name="user" value="outsider">Continue as visitor</button></form></html>`); return;
      }
      if (url.pathname === "/test/consent") {
        const flow = flows.get(url.searchParams.get("flow") ?? "");
        if (!flow) { json(400, { error: "Missing test flow" }); return; }
        const key = url.searchParams.get("user") === "admin" ? "admin" : "outsider", code = randomUUID();
        codes.set(code, { user: key, challenge: flow.challenge });
        const callback = new URL(flow.redirect); callback.searchParams.set("code", code);
        res.writeHead(302, { Location: callback.href }).end(); return;
      }
      if (url.pathname.startsWith("/auth/") && !authAvailable) { json(503, { code: "unexpected_failure", message: "Test auth unavailable" }); return; }
      if (url.pathname === "/auth/v1/settings") { json(200, { external: { google: googleEnabled } }); return; }
      const jwt = req.headers.authorization?.replace(/^Bearer /, "") ?? "", claims = access.get(jwt);
      let body = ""; for await (const chunk of req) body += chunk;
      const args = body ? JSON.parse(body) : {};
      if (url.pathname === "/auth/v1/token") {
        if (req.headers.apikey !== publicKey) { json(401, { message: "Invalid test API key" }); return; }
        if (url.searchParams.get("grant_type") === "pkce") {
          const code = codes.get(args.auth_code); codes.delete(args.auth_code);
          if (!code || createHash("sha256").update(args.code_verifier ?? "").digest("base64url") !== code.challenge) { json(400, { error_code: "bad_code_verifier", msg: "Invalid PKCE verifier" }); return; }
          counters.exchanges++; json(200, await issue(code.user)); return;
        }
        const previous = refresh.get(args.refresh_token);
        if (!previous || !(await db.query("select 1 from auth.sessions where id=$1", [previous.sid])).rows.length) { json(400, { error_code: "refresh_token_not_found", msg: "Invalid refresh token" }); return; }
        refresh.delete(args.refresh_token); counters.refreshes++; json(200, await issue(previous.user, previous.sid)); return;
      }
      if (url.pathname === "/auth/v1/user") {
        if (!claims || !(await db.query("select 1 from auth.sessions where id=$1", [claims.session_id])).rows.length) { json(401, { error_code: "bad_jwt", msg: "Invalid access token" }); return; }
        json(200, userData(claims.sub === users.admin.id ? "admin" : "outsider")); return;
      }
      if (url.pathname === "/auth/v1/logout") {
        if (claims) await db.query("delete from auth.sessions where id=$1", [claims.session_id]);
        res.writeHead(204).end(); return;
      }
      if (["/rest/v1/rpc/read_site_content", "/rest/v1/rpc/read_site_revision"].includes(url.pathname) && req.headers.apikey === secretKey) {
        const result = await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query<{ result: unknown }>(url.pathname.endsWith('read_site_revision') ? 'select public.read_site_revision() as result' : "select public.read_site_content() as result"); });
        json(200, result.rows[0]!.result); return;
      }
      if (!claims || req.headers.apikey !== publicKey) { json(401, { code: "PGRST301", message: "Unauthenticated" }); return; }
      const result = await db.transaction(async tx => {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]);
        switch (url.pathname) {
          case "/rest/v1/rpc/is_site_admin": return tx.query<{ result: unknown }>("select public.is_site_admin() as result");
          case "/rest/v1/rpc/admin_read_editor": return tx.query<{ result: unknown }>("select public.admin_read_editor($1,$2) as result", [args.p_scope, args.p_key]);
          case "/rest/v1/rpc/admin_save_content": counters.writes++; return tx.query<{ result: unknown }>("select public.admin_save_content($1::jsonb) as result", [JSON.stringify(args.p_changes)]);
          case "/rest/v1/rpc/admin_manage_read": return tx.query<{ result: unknown }>("select public.admin_manage_read($1) as result", [args.p_key]);
          case "/rest/v1/rpc/admin_workspace_read": return tx.query<{ result: unknown }>("select public.admin_workspace_read($1,$2) as result", [args.p_key, args.p_collection]);
          case '/rest/v1/rpc/admin_photo_library': return tx.query<{ result: unknown }>('select public.admin_photo_library() as result');
          case '/rest/v1/rpc/admin_read_photo_slot': return tx.query<{ result: unknown }>('select public.admin_read_photo_slot($1) as result', [args.p_slot]);
          case '/rest/v1/rpc/admin_save_photo_slot': counters.writes++; return tx.query<{ result: unknown }>('select public.admin_save_photo_slot($1,$2,$3) as result', [args.p_slot,args.p_media_id,args.p_revision]);
          case '/rest/v1/rpc/admin_link_drive_photo': counters.writes++; return tx.query<{ result: unknown }>('select public.admin_link_drive_photo($1::jsonb) as result', [JSON.stringify(args.p_photo)]);
          case '/rest/v1/rpc/admin_set_drive_folder': return tx.query<{ result: unknown }>('select public.admin_set_drive_folder($1,$2) as result', [args.p_url, args.p_expected]);
          case "/rest/v1/rpc/admin_manage_content": counters.writes++; return tx.query<{ result: unknown }>("select public.admin_manage_content($1::jsonb) as result", [JSON.stringify(args.command)]);
          default: throw Object.assign(Error("Unknown RPC"), { code: "P0002" });
        }
      });
      json(200, result.rows[0]!.result);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "XX000";
      json(code === "42501" ? 403 : code === "40001" ? 409 : 400, { code, message: "Local test RPC rejected the request" });
    }
  });
  server.listen(port, "127.0.0.1"); await once(server, "listening");
  return { db, origin, publicKey, secretKey, users, counters,
    setAuthAvailable: (value: boolean) => { authAvailable = value; }, setGoogleEnabled: (value: boolean) => { googleEnabled = value; },
    async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); },
  };
}
