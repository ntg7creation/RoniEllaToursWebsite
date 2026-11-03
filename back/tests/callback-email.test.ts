import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { GmailCallbackEmail, EmailDeliveryError, callbackEmail, readEmailConfig, type CallbackMessage } from "../src/callback-email.js";
import { CallbackDelivery, CallbackRateLimit } from "../src/callback-delivery.js";

const config = { user: "roniellatours@gmail.com", appPassword: "abcdefghijklmnop", to: "roniellatours@gmail.com" };
const message: CallbackMessage = {
  submissionId: randomUUID(), name: "<script>unsafe()</script>", phone: "+972505202480",
  country: "IL", email: "visitor@example.com", destinationLabel: "סין & תרבות",
  sourcePath: "/contact/", createdAt: "2026-11-03T00:00:00.000Z",
};

test("Gmail messages use the business recipient, escaped content, optional Reply-To and no storage claims", () => {
  const payload = callbackEmail(message, config);
  assert.deepEqual(payload.from, { name: "RoniElla Tours", address: config.user });
  assert.equal(payload.to, config.to); assert.equal(payload.replyTo, message.email);
  assert.ok(String(payload.html).includes('dir="rtl"') && !String(payload.html).includes("<script>"));
  assert.ok(String(payload.text).includes(message.phone) && String(payload.html).includes("סין &amp; תרבות"));
  assert.ok(!String(payload.html).includes("שמורים") && !String(payload.html).includes("Supabase"));
  assert.equal(callbackEmail({ ...message, email: null }, config).replyTo, undefined);
  assert.equal(readEmailConfig({}), undefined);
  assert.equal(readEmailConfig({ GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" })!.to, config.to);
  assert.throws(() => readEmailConfig({ GMAIL_APP_PASSWORD: "normal-password" }), /App Password/);
});

test("Gmail SMTP acceptance is awaited and credentials/provider diagnostics never enter error responses", async () => {
  let sent: unknown;
  const mailer = new GmailCallbackEmail(config, async payload => { sent = payload; return { messageId: "smtp-accepted" }; });
  assert.equal(await mailer.send(message), "smtp-accepted");
  assert.equal((sent as { messageId: string }).messageId, "<callback-" + message.submissionId + "@gmail.com>");
  for (const [failure, expected] of [
    [{ code: "EAUTH", message: config.appPassword }, "provider_configuration"],
    [{ code: "ETIMEDOUT", command: "DATA" }, "delivery_unknown"],
    [{ code: "ECONNECTION", command: "CONN" }, "network"],
    [{ responseCode: 550 }, "provider_error"],
  ] as const) {
    const failed = new GmailCallbackEmail(config, async () => { throw failure; });
    await assert.rejects(failed.send(message), error =>
      error instanceof EmailDeliveryError && error.code === expected && !error.message.includes(config.appPassword));
  }
  const rejected = new GmailCallbackEmail(config, async () => ({ messageId: "rejected", rejected: [config.to] }));
  await assert.rejects(rejected.send(message), error => error instanceof EmailDeliveryError && error.code === "provider_error");
});

test("in-memory request limits expire without a database or local files", async () => {
  let now = 0, sent = 0;
  const delivery = new CallbackDelivery({ send: async () => { sent++; return "mock"; } }, () => now);
  for (let i = 0; i < 5; i++) await delivery.send({ ...message, submissionId: randomUUID() }, "client");
  await assert.rejects(delivery.send({ ...message, submissionId: randomUUID() }, "client"), CallbackRateLimit);
  now += 15 * 60 * 1000;
  await delivery.send({ ...message, submissionId: randomUUID() }, "client");
  assert.equal(sent, 6);
});
