// Test-only local API: real validation/SMTP adapter with an in-memory mail transport.
// No Gmail credentials, network email or inquiry persistence.
import { createApp } from "../back/dist/app.js";
import { LocalContentRepository } from "../back/dist/content-repository.js";
import { GmailCallbackEmail } from "../back/dist/callback-email.js";
import { createServer } from "node:http";
const repository = await LocalContentRepository.load();
let delivered = 0;
const mailer = new GmailCallbackEmail({
  user: "roniellatours@gmail.com", appPassword: "abcdefghijklmnop", to: "roniellatours@gmail.com",
}, async () => ({ messageId: "local-test-" + ++delivered }));
const app = createApp(repository, { callbackMailer: mailer });
createServer((req, res) => {
  if (req.url === "/test/email-count") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ delivered }));
    return;
  }
  app(req, res);
}).listen(Number(process.env.API_PORT), "127.0.0.1");
