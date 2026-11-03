import { createHash } from "node:crypto";
import { EmailDeliveryError, type CallbackMailer, type CallbackMessage } from "./callback-email.js";

export class CallbackRateLimit extends Error {}
export class CallbackConflict extends Error {}

// Per-process abuse/retry guards only. No contact details are persisted anywhere.
// Serverless instances do not share this memory; this is not a durable queue.
export class CallbackDelivery {
  private submissions = new Map<string, { fingerprint: string; expires: number; task: Promise<void> }>();
  private limits = new Map<string, { count: number; expires: number }>();
  constructor(private mailer: CallbackMailer, private now = Date.now) {}

  async send(message: CallbackMessage, clientKey: string): Promise<void> {
    const now = this.now(), window = 15 * 60 * 1000;
    for (const [key, value] of this.submissions) if (value.expires <= now) this.submissions.delete(key);
    for (const [key, value] of this.limits) if (value.expires <= now) this.limits.delete(key);
    const fingerprint = createHash("sha256").update(JSON.stringify([
      clientKey, message.name, message.phone, message.country, message.email,
      message.destinationLabel, message.sourcePath,
    ])).digest("hex");
    const existing = this.submissions.get(message.submissionId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new CallbackConflict();
      await existing.task;
      return;
    }
    const limit = this.limits.get(clientKey);
    if ((limit?.count ?? 0) >= 5 || this.submissions.size >= 5000 || (!limit && this.limits.size >= 5000))
      throw new CallbackRateLimit();
    this.limits.set(clientKey, { count: (limit?.count ?? 0) + 1, expires: limit?.expires ?? now + window });
    const task = Promise.resolve().then(() => this.mailer.send(message)).then(() => undefined);
    this.submissions.set(message.submissionId, { fingerprint, expires: now + window, task });
    try {
      await task;
    } catch (error) {
      // A definite failure can be retried manually. An uncertain SMTP outcome
      // stays remembered briefly so a repeat click does not send it again here.
      if (!(error instanceof EmailDeliveryError) || error.code !== "delivery_unknown")
        this.submissions.delete(message.submissionId);
      throw error;
    }
  }
}
