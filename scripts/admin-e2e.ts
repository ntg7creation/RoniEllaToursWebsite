import assert from "node:assert/strict";
import { editorLabel } from './editor-label.js';
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { adminTestServices } from "./admin-test-support.js";
import { exerciseContentManagement } from './content-management-e2e.js';
import { exerciseEditorCollections } from './editor-collections-e2e.js';
import { exerciseDrivePhotoPicker } from './drive-photo-picker-e2e.js';
import { exercisePhotoControls } from './photo-controls-e2e.js';
import { exerciseMarketing } from './marketing-e2e.js';

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../front/package.json", import.meta.url));
const serve = resolve(dirname(require.resolve("@react-router/serve/package.json")), "dist/cli.js");
const services = await adminTestServices(4902), origin = "http://127.0.0.1:4900";
const children: (ChildProcess & { output: string })[] = [];
function start(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, { cwd: resolve(root, cwd), windowsHide: true, env: { ...process.env, NODE_ENV: "production", DEPLOYMENT_ENV: "local", ...env }, stdio: ["ignore", "pipe", "pipe"] }) as ChildProcess & { output: string };
  child.output = "";
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { child.output = (child.output + chunk).slice(-10000); });
  children.push(child); return child;
}
async function ready(url: string, child: typeof children[number]) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw Error(child.output);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(child.output);
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
context.setDefaultTimeout(30000);
const page = await context.newPage(), errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
async function login(p: Page, user = "editor") {
  await p.goto(origin + "/admin/login");
  await p.getByRole("button", { name: "כניסה באמצעות Google" }).click();
  await p.getByRole("button", { name: "Continue as " + user }).click();
  await p.waitForURL(url => url.origin === origin && !url.pathname.includes("callback"));
}
async function editor(p: Page) {
  await p.getByRole('button', { name: editorLabel('עריכת פתיח דף הבית') }).click();
  await p.locator("#admin-field-0").waitFor();
  return p.getByRole("dialog");
}
try {
  await mkdir(resolve(root, ".qa/admin"), { recursive: true });
  const driveItems = Array.from({ length: 75 }, (_, index) => { const row = Array(11).fill(null); row[0] = `test-photo-${index + 1}`; row[1] = ['1TILL118zzozt6e6gTCO8_HA3HjN3wJNE']; row[2] = `Photo ${String(index + 1).padStart(2, '0')}.jpg`; row[3] = 'image/jpeg'; row[9] = Date.UTC(2026, 0, index + 1); row[10] = Date.UTC(2026, 0, 75 - index); return row; });
  await writeFile(resolve(root, '.qa/admin/drive-fixture.html'), `<title>Test shared folder – Google Drive</title><script>window['_DRIVE_ivd'] = '${JSON.stringify([driveItems, null]).replaceAll('"', '\\x22')}';</script>`);
  const thumbnail = await import('node:fs/promises').then(fs => fs.readFile(resolve(root, 'back/content/media/bukhara-480.jpg')));
  await context.route('https://lh3.googleusercontent.com/**', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: thumbnail }));
  await context.route('https://drive.google.com/thumbnail**', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: thumbnail }));
  await context.route('**/media/drive-*.jpg', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: thumbnail }));
  const api = start(["dist/server.js"], "back", { API_HOST: "127.0.0.1", API_PORT: "4901", CONTENT_PROVIDER: "supabase", SUPABASE_URL: services.origin, SUPABASE_SECRET_KEY: services.secretKey, BACKEND_API_TOKEN: "admin-local-integration-token-123456789", CONTENT_CACHE_MS: "30000" });
  await ready("http://127.0.0.1:4901/ready", api);
  const web = start([serve, "./build/server/index.js"], "front", { HOST: "127.0.0.1", PORT: "4900", BACKEND_ORIGIN: "http://127.0.0.1:4901", BACKEND_API_TOKEN: "admin-local-integration-token-123456789", SITE_ORIGIN: origin, SUPABASE_URL: services.origin, SUPABASE_PUBLISHABLE_KEY: services.publicKey, RONIELLA_TEST_DRIVE_HTML: resolve(root, '.qa/admin/drive-fixture.html') });
  await ready(origin + "/health", web);
  const loginResponse = await page.goto(origin + "/admin/login");
  assert.match(loginResponse!.headers()["cache-control"]!, /private.*no-store/);
  assert.match(loginResponse!.headers()["x-robots-tag"]!, /noindex/);
  await page.screenshot({ path: resolve(root, ".qa/admin/login.png") });
  assert.deepEqual((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations, []);
  services.setGoogleEnabled(false);
  await page.getByRole("button", { name: "כניסה באמצעות Google" }).click();
  await page.getByRole("alert").waitFor(); assert.match(await page.getByRole("alert").innerText(), /עדיין אינה זמינה/);
  services.setGoogleEnabled(true);
  await page.goto(origin);
  assert.equal(await page.locator(".admin-edit-button,.admin-logout").count(), 0);
  assert.equal(await page.locator('a[href*="/admin/"]').count(), 0);
  assert.equal((await context.request.get(origin + "/admin/editor?scope=copy&key=home.hero")).status(), 401);
  assert.equal((await context.request.post(origin + "/admin/editor", { headers: { Origin: "https://evil.invalid" }, data: [] })).status(), 403);
  await login(page, "visitor");
  await page.getByRole("alert").waitFor(); assert.match(await page.getByRole("alert").innerText(), /אינו מורשה/);
  assert.ok(!(await context.cookies(origin)).some(cookie => /admin(?:\.|$)/.test(cookie.name)));
  await login(page);
  await page.locator(".admin-logout").waitFor();
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(services.counters.exchanges, 2);
  if (process.argv.includes('--marketing-only')) {
    await exerciseMarketing(page,context,origin); assert.deepEqual(errors,[]);
  } else if (process.argv.includes('--photos-only')) {
    await exerciseDrivePhotoPicker(page, context, origin); await exercisePhotoControls(page, context, origin); assert.deepEqual(errors, []);
  } else if (process.argv.includes('--photo-controls-only')) {
    await exercisePhotoControls(page, context, origin); assert.deepEqual(errors, []);
  } else if (process.argv.includes('--collections-only')) {
    const createdResponse = await context.request.post(origin + '/admin/manage', { headers: { Origin: origin }, data: {
      operation: 'create_trip', requestId: crypto.randomUUID(), trip: { title: 'טיול חדש במבחן הדפדפן', slug: 'browser-new-trip', summary: 'תקציר טיול', overview: 'פתיח הטיול', dates: '', duration: '', price: '', guide: '', status: '' },
    } });
    assert.equal(createdResponse.status(), 200); const created = await createdResponse.json();
    const draft = await (await context.request.get(origin + '/admin/manage?key=' + created.id)).json();
    assert.equal((await context.request.post(origin + '/admin/manage', { headers: { Origin: origin }, data: {
      operation: 'publish_trip', key: created.id, expectedRevision: draft.revision, published: true,
    } })).status(), 200);
    await exerciseEditorCollections(page, context, origin);
    assert.deepEqual(errors, []);
  } else {
  const cookies = (await context.cookies(origin)).filter(cookie => /admin(?:\.|$)/.test(cookie.name));
  assert.ok(cookies.length > 0 && cookies.every(cookie => cookie.httpOnly && cookie.sameSite === "Lax" && cookie.expires > Date.now() / 1000 + 86400));
  assert.ok(!(await page.evaluate(() => document.cookie)).includes("roniella-admin"));
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  const publicHtml = await (await context.request.get(origin)).text();
  assert.ok(!publicHtml.includes(services.users.admin.email) && !publicHtml.includes("access_token"));
  await page.reload(); await page.locator(".admin-logout").waitFor();
  await page.evaluate(() => window.scrollTo(0, 1000));
  assert.ok(Math.abs((await page.locator(".site-header").boundingBox())!.y) < 1);
  const logoutBox = (await page.locator(".admin-logout").boundingBox())!, brandBox = (await page.locator(".brand").boundingBox())!;
  assert.ok(logoutBox.x < brandBox.x);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(root, ".qa/admin/home-desktop.png") });
  const dialog = await editor(page);
  assert.deepEqual((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations, []);
  await page.screenshot({ path: resolve(root, ".qa/admin/editor-desktop.png") });
  const field = page.locator("#admin-field-0"), original = await field.inputValue(), edited = original + " — בדיקת עריכה";
  await field.fill(edited);
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "המשך עריכה" }).click();
  await dialog.getByRole("button", { name: "שמירת שינויים" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText(edited, { exact: true }).waitFor();
  assert.equal(services.counters.writes, 1);
  const tab = await context.newPage(); await tab.goto(origin); await tab.locator(".admin-logout").waitFor();
  await editor(page); await editor(tab);
  await tab.locator("#admin-field-0").fill(original + " — שמירה מקבילה");
  await tab.getByRole("button", { name: "שמירת שינויים" }).click(); await tab.getByRole("dialog").waitFor({ state: "hidden" });
  await field.fill(original + " — טיוטה שלי");
  const conflict = page.waitForResponse(response => response.url().endsWith("/admin/editor") && response.request().method() === "POST");
  await page.getByRole("button", { name: "שמירת שינויים" }).click(); assert.equal((await conflict).status(), 409);
  assert.equal(await field.inputValue(), original + " — טיוטה שלי");
  await page.getByRole("button", { name: "טעינת הגרסה העדכנית" }).click();
  await page.getByRole("button", { name: "ביטול השינויים וטעינה מחדש" }).click();
  await page.waitForFunction(() => (document.querySelector("#admin-field-0") as HTMLTextAreaElement)?.value.endsWith("שמירה מקבילה"));
  await page.getByRole("button", { name: "סגירה ×" }).click();
  assert.ok(await page.getByRole('button', { name: editorLabel('עריכת פתיח דף הבית') }).evaluate(element => element === document.activeElement));
  const invalid = await context.request.post(origin + "/admin/editor", { headers: { Origin: origin }, data: [{ scope: "page", key: "home", field: "title", expected: "", value: "x", unexpected: true }] });
  assert.equal(invalid.status(), 422);
  // Expired access metadata triggers the real SDK's refresh-token rotation.
  const current = (await context.cookies(origin)).filter(cookie => /admin(?:\.|$)/.test(cookie.name)).sort((a,b) => a.name.localeCompare(b.name));
  const encoded = current.map(cookie => cookie.value).join("");
  assert.ok(encoded.startsWith("base64-"));
  const session = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString()); session.expires_at = Math.floor(Date.now() / 1000) - 5;
  for (const cookie of current) await context.addCookies([{ ...cookie, expires: 1 }]);
  await context.addCookies([{ ...current[0]!, name: "roniella-admin", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url") }]);
  await page.reload(); await page.locator(".admin-logout").waitFor(); assert.ok(services.counters.refreshes >= 1);
  const stored = await context.storageState(); const restored = await browser.newContext({ storageState: stored });
  const restoredPage = await restored.newPage(); await restoredPage.goto(origin); await restoredPage.locator(".admin-logout").waitFor(); await restored.close();
  services.setAuthAvailable(false);
  assert.equal((await context.request.get(origin + "/admin/session")).status(), 503);
  assert.ok((await context.cookies(origin)).some(cookie => /admin(?:\.|$)/.test(cookie.name)));
  services.setAuthAvailable(true);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const log = (await page.locator(".admin-logout").boundingBox())!, brand = (await page.locator(".brand").boundingBox())!;
    assert.ok(log.x < brand.x, "Logout is at the left on mobile");
    await editor(page); assert.ok(await page.evaluate(() => { const d = document.querySelector("dialog")!; return d.scrollWidth <= d.clientWidth + 1; }));
    await page.screenshot({ path: resolve(root, `.qa/admin/editor-${width}.png`) });
    await page.getByRole("button", { name: "סגירה ×" }).click();
  }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 ? [] :
    Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (rect.x < -1 || rect.right > innerWidth + 1);
    }).map(el => `${el.tagName}.${el.className} (${Math.round(el.getBoundingClientRect().width)}px)`).slice(0,20));
  assert.deepEqual(overflow, [], '320px viewport with enlarged text');
  await page.screenshot({ path: resolve(root, ".qa/admin/mobile-large-text.png") });
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await exerciseContentManagement(page, context, origin);
  await exerciseEditorCollections(page, context, origin);
  await services.db.exec("update public.site_admins set active=false");
  assert.equal((await context.request.get(origin + "/admin/editor?scope=copy&key=home.hero")).status(), 401);
  await page.reload(); assert.equal(await page.locator(".admin-logout").count(), 0);
  await services.db.exec("update public.site_admins set active=true");
  await login(page); await page.locator(".admin-logout").waitFor();
  await tab.reload(); await tab.locator(".admin-logout").waitFor();
  await page.locator(".admin-logout").click();
  await page.waitForLoadState("networkidle");
  await tab.locator(".admin-logout").waitFor({ state: "hidden" });
  assert.ok(!(await context.cookies(origin)).some(cookie => /admin(?:\.|$)/.test(cookie.name)));
  assert.equal((await context.request.get(origin + "/admin/session")).status(), 200);
  assert.deepEqual(errors, []);
  console.log("PASS: simulated Google consent with real PKCE; private persistent HttpOnly sessions and refresh; denied accounts/CSRF/revocation; inline saves, conflicts, reload; sticky responsive navbar; dialog accessibility; logout across tabs. No hosted changes.");
  }
} catch (error) {
  await page.screenshot({ path: resolve(root, ".qa/admin/failure.png") }).catch(() => {});
  await writeFile(resolve(root, ".qa/admin/servers.log"), children.map(child => child.output).join("\n"));
  throw error;
} finally {
  await browser.close();
  for (const child of children.reverse()) if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  await services.close();
}
