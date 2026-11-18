import assert from "node:assert/strict";
import { test } from "node:test";
import { SupabaseContentRepository } from "../src/supabase-repository.js";
import { LocalContentRepository, defaultContentDirectory } from "../src/content-repository.js";
import { readBackendConfig, safeConfigurationError } from "../src/config.js";
import { createApp } from "../src/app.js";

test("Supabase adapter uses server API-key headers, coalesces reads, validates data and never exposes upstream errors", async () => {
  const source = await (await LocalContentRepository.load()).getPublicContent();
  let requests = 0, revision = '1';
  const secretKey = "sb_secret_local_test_value_only_12345";
  const request = (async (url: string, init: RequestInit) => {
    assert.ok(['read_site_content', 'read_site_revision'].some(name => url === `https://example.supabase.co/rest/v1/rpc/${name}`));
    assert.equal(new Headers(init.headers).get("apikey"),secretKey);
    assert.equal(new Headers(init.headers).get("authorization"),null);
    assert.equal(init.redirect,"error");
    if (url.endsWith('read_site_revision')) return Response.json(revision);
    requests++;
    return Response.json(source);
  }) as typeof fetch;
  const repository = new SupabaseContentRepository({origin:"https://example.supabase.co",secretKey,mediaDirectory:new URL("media/",defaultContentDirectory),timeoutMs:1000,cacheMs:30000},request);
  const [one,two] = await Promise.all([repository.getPublicContent(),repository.getPublicContent()]);
  assert.deepEqual(one,source); assert.deepEqual(two,source); assert.equal(requests,1);
  assert.ok(await repository.getMedia(source.media[0]!.src.split("/").at(-1)!)); assert.equal(requests,1);
  assert.equal(await repository.getMedia("index.json"),undefined);
  await repository.getPublicContent(); assert.equal(requests, 1, 'Same revision reuses validated snapshot');
  const other = new SupabaseContentRepository({origin:'https://example.supabase.co',secretKey,mediaDirectory:new URL('media/',defaultContentDirectory),timeoutMs:1000,cacheMs:30000},request);
  await other.getPublicContent(); assert.equal(requests, 2);
  source.pages[0]!.title = 'Saved on another instance'; revision = '2';
  assert.equal((await repository.getPublicContent()).pages[0]!.title, source.pages[0]!.title);
  assert.equal((await other.getPublicContent()).pages[0]!.title, source.pages[0]!.title);
  assert.equal(requests, 4, 'Both warm serverless instances refresh immediately');
  const invalid = new SupabaseContentRepository({origin:"https://example.supabase.co",secretKey,mediaDirectory:defaultContentDirectory,timeoutMs:1000,cacheMs:0},(async(url)=>Response.json(String(url).endsWith('read_site_revision') ? '1' : {schemaVersion:999})) as typeof fetch);
  await assert.rejects(invalid.getPublicContent(), /validation failed/);
});
test("deployment config rejects missing or browser credentials and unsafe hosted database origins", () => {
  assert.equal(safeConfigurationError(new Error("Invalid API_PORT")), "Invalid API_PORT");
  assert.equal(safeConfigurationError(new Error("SUPABASE_SECRET_KEY must be a server secret key, never a publishable/anon key")), "SUPABASE_SECRET_KEY must be a server secret key, never a publishable/anon key");
  assert.equal(safeConfigurationError(new Error("Invalid key: sb_secret_private_value")), "Unexpected startup error");
  assert.equal(safeConfigurationError({message:"secret"}), "Unexpected startup error");
  assert.equal(readBackendConfig({}).provider,"files");
  assert.throws(()=>readBackendConfig({CONTENT_PROVIDER:"unknown"}));
  assert.throws(()=>readBackendConfig({DEPLOYMENT_ENV:"production"}), /BACKEND_API_TOKEN/);
  assert.throws(()=>readBackendConfig({CONTENT_PROVIDER:"supabase",SUPABASE_URL:"https://example.supabase.co",SUPABASE_SECRET_KEY:"sb_publishable_wrong"}), /server secret/);
  assert.throws(()=>readBackendConfig({CONTENT_PROVIDER:"supabase",SUPABASE_URL:"http://example.com"}), /HTTPS/);
  const config=readBackendConfig({CONTENT_PROVIDER:"supabase",SUPABASE_URL:"https://example.supabase.co",SUPABASE_SECRET_KEY:"sb_secret_local_test_value_only_12345",API_HOST:"0.0.0.0",PORT:"4321"});
  assert.equal(config.port,4321); assert.equal(config.origin,"https://example.supabase.co");
});
test("backend API token protects content and photos while liveness/readiness remain probeable", async () => {
  const repository = await LocalContentRepository.load(), token = "local-backend-token-for-tests-only-123456";
  const server = createApp(repository,{apiToken:token}).listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const address=server.address(); assert.ok(address && typeof address!=="string");
  const origin=`http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(origin+"/health")).status,200);
    assert.equal((await fetch(origin+"/ready")).status,200);
    for(const path of ["/api/v1/content","/api/v1/media/china-960.jpg"]){
      assert.equal((await fetch(origin+path)).status,401);
      assert.equal((await fetch(origin+path,{headers:{Authorization:"Bearer wrong"}})).status,401);
      assert.equal((await fetch(origin+path,{headers:{Authorization:`Bearer ${token}`}})).status,200);
    }
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
