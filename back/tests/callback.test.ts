import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { validateCallback, callbackDestinations } from "@roniella/shared/callback";
import { LocalContentRepository } from "../src/content-repository.js";
import { createApp } from "../src/app.js";
import { EmailDeliveryError, type CallbackMessage } from "../src/callback-email.js";

const token = "callback-test-token-12345678901234567890";
const input = { name: "בדיקת טופס", phone: "0505202480", country: "IL", email: "", destination: "undecided", privacyAccepted: true };
const requestBody = () => ({ ...input, submissionId: randomUUID(), sourcePath: "/contact/", destinationLabel: "עדיין לא החלטתי", clientKey: "a".repeat(64) });

async function startApi(options: Parameters<typeof createApp>[1] = {}) {
  let contentReads = 0;
  const repository = { getPublicContent: async () => { contentReads++; throw Error("CMS unavailable"); } };
  const server = createApp(repository, { apiToken: token, checkEmail: async () => true, ...options }).listen(0, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = "http://127.0.0.1:" + address.port;
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };
  return {
    post: (body: unknown, auth = true) => fetch(origin + "/api/v1/callbacks", {
      method: "POST", headers: auth ? headers : { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
    retiredRetry: () => fetch(origin + "/api/v1/callbacks/retry-notifications", { method: "POST", headers }),
    contentReads: () => contentReads,
    close: async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); },
  };
}

test("callback validation accepts international/local phone numbers and rejects invalid fields and missing consent", async () => {
  const content = await (await LocalContentRepository.load()).getPublicContent(), destinations = callbackDestinations(content);
  assert.equal(destinations.length, 4);
  const privacy = JSON.stringify(content.pages.find(page => page.path === "/privacy/"));
  assert.ok(privacy.includes("הטופס אינו יוצר רשומת פנייה במסד הנתונים"));
  assert.ok(!privacy.includes("????"));
  for (const phone of ["050-5202480", "+972505202480", "0733744686"]) {
    const result = validateCallback({ ...input, phone }, destinations);
    assert.deepEqual(result.errors, {}); assert.ok(result.value.phone.startsWith("+"));
  }
  assert.deepEqual(validateCallback({ ...input, country: "US", phone: "2025550123" }, destinations).errors, {});
  assert.ok(validateCallback({ ...input, country: "US", phone: "202555012" }, destinations).errors.phone);
  assert.ok(validateCallback({ ...input, country: "IL", phone: "+12025550123" }, destinations).errors.phone);
  for (const phone of ["123", "050520248", "+972111111111", "call 0505202480", "0505202480 ext 3"])
    assert.ok(validateCallback({ ...input, phone }, destinations).errors.phone, phone);
  assert.ok(validateCallback({ ...input, name: "1" }, destinations).errors.name);
  assert.ok(validateCallback({ ...input, email: "roni@gmial.com" }, destinations).errors.email);
  assert.ok(validateCallback({ ...input, email: "missing@" }, destinations).errors.email);
  assert.ok(validateCallback({ ...input, destination: "not-published" }, destinations).errors.destination);
  assert.ok(validateCallback({ ...input, privacyAccepted: false }, destinations).errors.privacy);
});

test("email API validates and authenticates, waits for sending, deduplicates repeat clicks and works with the CMS offline", async () => {
  const sent: CallbackMessage[] = [];
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  const started = new Promise<void>(done => { entered = done; });
  const api = await startApi({ callbackMailer: { send: async message => {
    sent.push(message); entered(); await gate; return "mock-smtp-accepted";
  } } });
  const body = requestBody();
  try {
    assert.equal((await api.post(body, false)).status, 401);
    assert.equal((await api.post({ ...body, phone: "123" })).status, 422);
    assert.equal((await api.post({ ...body, privacyAccepted: false })).status, 422);
    assert.equal((await api.post({ ...body, destinationLabel: "<script>" })).status, 400);
    assert.equal(sent.length, 0);
    let complete = false;
    const first = api.post(body).then(response => { complete = true; return response; });
    await started;
    assert.equal(complete, false, "HTTP success must wait for SMTP acceptance");
    const repeated = api.post(body);
    release();
    const responses = await Promise.all([first, repeated]);
    for (const response of responses) { assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true }); }
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.phone, "+972505202480");
    assert.equal(sent[0]!.sourcePath, "/contact/");
    assert.equal("privacyVersion" in sent[0]!, false);
    assert.equal(api.contentReads(), 0, "Sending mail must not read or write the CMS");
    assert.equal((await api.post({ ...body, name: "Changed Person" })).status, 409);
    assert.equal((await api.retiredRetry()).status, 404);
  } finally { release(); await api.close(); }
});

test("missing Gmail configuration and invalid email domains fail without reporting successful delivery", async () => {
  const missing = await startApi();
  try {
    const response = await missing.post(requestBody());
    assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
    assert.equal(missing.contentReads(), 0);
  } finally { await missing.close(); }
  let sent = 0;
  const api = await startApi({
    callbackMailer: { send: async () => { sent++; return "mock"; } },
    checkEmail: async email => email.endsWith("@missing.test") ? false : null,
  });
  try {
    assert.equal((await api.post({ ...requestBody(), email: "visitor@missing.test" })).status, 422);
    assert.equal((await api.post({ ...requestBody(), email: "visitor@example.com" })).status, 503);
    assert.equal(sent, 0); assert.equal(api.contentReads(), 0);
  } finally { await api.close(); }
});

test("SMTP failure is visible; an uncertain send is not repeated automatically", async () => {
  for (const code of ["provider_configuration", "delivery_unknown"] as const) {
    let attempts = 0;
    const api = await startApi({ callbackMailer: { send: async () => {
      attempts++; throw new EmailDeliveryError(code);
    } } });
    const body = requestBody();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await api.post(body); assert.equal(response.status, 503);
        const reply = await response.json(); assert.equal(reply.ok, false);
        assert.ok(!JSON.stringify(reply).includes(code));
      }
      assert.equal(attempts, code === "delivery_unknown" ? 1 : 2);
      assert.equal(api.contentReads(), 0);
    } finally { await api.close(); }
  }
});

test("the email API limits repeated new submissions without using persistent storage", async () => {
  let sent = 0;
  const api = await startApi({ callbackMailer: { send: async () => { sent++; return "mock"; } } });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await api.post(requestBody())).status, 200);
    assert.equal((await api.post(requestBody())).status, 429);
    assert.equal(sent, 5); assert.equal(api.contentReads(), 0);
  } finally { await api.close(); }
});
