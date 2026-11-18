import { test } from "node:test";
import assert from "node:assert/strict";
import { adminConfig, createAdminAuth, sameOriginAdminPost, verifiedGoogleEmail } from "../app/server/admin-auth.server.js";
import { safeAdminReturn, EditChangesSchema } from "../../shared/src/admin.js";
import { editorDocument } from "../app/server/admin-editor.server.js";
import type { User } from "@supabase/supabase-js";

test("admin return paths reject external, encoded and privileged destinations", () => {
  for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/admin/logout", "/ad%6din/login", "/foo\nbar", "/a/../../admin/login"])
    assert.equal(safeAdminReturn(value), "/");
  assert.equal(safeAdminReturn("/tours/china-may-2027/#contact"), "/tours/china-may-2027/#contact");
});
test("admin config accepts public keys and rejects a service key or insecure hosted origin", () => {
  assert.equal(adminConfig({}), null);
  assert.ok(adminConfig({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnop" }));
  assert.throws(() => adminConfig({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_secret_abcdefghijklmnop" }));
  assert.throws(() => adminConfig({ DEPLOYMENT_ENV: "production", SUPABASE_URL: "http://127.0.0.1", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnop" }));
});
test("Google admin identity requires a matching verified Google email", () => {
  const user: User = { id: "user-id", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-11-03", email: "Editor@Example.com", email_confirmed_at: "2026-11-03", identities: [{ id: "identity-id", user_id: "user-id", identity_id: "identity-id", provider: "google", identity_data: { email: "editor@example.com", email_verified: true } }] };
  assert.equal(verifiedGoogleEmail(user), "editor@example.com");
  assert.equal(verifiedGoogleEmail({ ...user, identities: [{ ...user.identities![0]!, provider: "email" }] }), null);
  assert.equal(verifiedGoogleEmail({ ...user, identities: [{ ...user.identities![0]!, identity_data: { email: "other@example.com", email_verified: true } }] }), null);
  assert.equal(verifiedGoogleEmail({ ...user, email_confirmed_at: undefined }), null);
  assert.equal(verifiedGoogleEmail({ ...user, user_metadata: { admin: true }, identities: [] }), null);
});
test("admin mutations reject absent or cross-site Origin", () => {
  const url = "http://localhost:3000/admin/editor";
  assert.equal(sameOriginAdminPost(new Request(url, { method: "POST" })), false);
  assert.equal(sameOriginAdminPost(new Request(url, { method: "POST", headers: { Origin: "https://evil.test" } })), false);
  assert.equal(sameOriginAdminPost(new Request(url, { method: "POST", headers: { Origin: "http://localhost:3000" } })), true);
});
test("editor exposes labeled text fields and validates bounded patches", () => {
  const doc = editorDocument({ scope: "copy", key: "home.hero" }, { copy: [{ key: "home.hero.heading", slot: "heading", value: "Hello" }] });
  assert.equal(doc.fields[0]!.label, "כותרת ראשית / Main heading");
  assert.equal(doc.fields[0]!.target.key, "home.hero.heading");
  assert.equal(EditChangesSchema.safeParse([{ ...doc.fields[0]!.target, expected: "Hello", value: "Updated" }]).success, true);
  assert.equal(EditChangesSchema.safeParse([{ ...doc.fields[0]!.target, expected: "Hello", value: "x".repeat(20001) }]).success, false);
  assert.equal(EditChangesSchema.safeParse([{ ...doc.fields[0]!.target, expected: "Hello", value: "Updated", admin: true }]).success, false);
});
test("Google OAuth uses PKCE and host-only persistent HttpOnly cookies on HTTPS", async () => {
  const before = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_abcdefghijklmnop";
  try {
    const auth = createAdminAuth(new Request("https://site.example/admin/login"), async () => { throw Error("Unexpected external request"); })!;
    const result = await auth.client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://site.example/admin/callback", skipBrowserRedirect: true } });
    assert.equal(result.error, null);
    const url = new URL(result.data.url!);
    assert.equal(url.searchParams.get("provider"), "google");
    assert.equal(url.searchParams.get("code_challenge_method")?.toLowerCase(), "s256");
    const cookies = auth.headers().getSetCookie(); assert.ok(cookies.length);
    assert.ok(cookies.every(cookie => cookie.startsWith("__Host-roniella-admin") && cookie.includes("HttpOnly") && cookie.includes("Secure") && cookie.includes("SameSite=Lax") && !cookie.includes("Domain=")));
    assert.match(auth.headers().get("cache-control")!, /private.*no-store/);
    auth.clear(); assert.ok(auth.headers().getSetCookie().every(cookie => cookie.includes("Max-Age=0")));
  } finally {
    if (before.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = before.url;
    if (before.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = before.key;
  }
});
