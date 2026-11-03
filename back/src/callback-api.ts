import { Router } from "express";
import { Resolver } from "node:dns/promises";
import { validateCallback } from "@roniella/shared/callback";
import { CallbackConflict, CallbackDelivery, CallbackRateLimit } from "./callback-delivery.js";
import { EmailDeliveryError, type CallbackMailer } from "./callback-email.js";

export async function emailDomainExists(email: string) {
  const domain = email.split("@").at(-1)!;
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  try {
    const records = await resolver.resolveMx(domain);
    return records.some(record => record.exchange && record.exchange !== ".");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOTFOUND") return false;
    if ((error as NodeJS.ErrnoException).code !== "ENODATA") return null;
    const addresses = await Promise.allSettled([resolver.resolve4(domain), resolver.resolve6(domain)]);
    return addresses.some(result => result.status === "fulfilled" && result.value.length > 0);
  }
}

export function callbackRouter(mailer?: CallbackMailer, checkEmail = emailDomainExists) {
  const router = Router(), delivery = mailer ? new CallbackDelivery(mailer) : undefined;
  router.post("/", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ ok: false, message: "הבקשה אינה תקינה." }); return;
    }
    const strings = ["name", "phone", "country", "email", "destination", "destinationLabel", "sourcePath", "submissionId", "clientKey"];
    if (strings.some(key => typeof body[key] !== "string" || body[key].length > 500) ||
        typeof body.privacyAccepted !== "boolean" || !/^[a-f0-9-]{36}$/i.test(body.submissionId) ||
        !/^[a-f0-9]{64}$/.test(body.clientKey) || !/^\/(?:[a-z0-9-]+\/)*$/.test(body.sourcePath) ||
        !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(body.destination) ||
        body.destinationLabel.trim().length < 1 || body.destinationLabel.length > 160 ||
        /[\u0000-\u001f<>]/.test(body.destinationLabel)) {
      res.status(400).json({ ok: false, message: "הבקשה אינה תקינה." }); return;
    }
    // The authenticated frontend validates the published CMS selection and sends
    // its bounded display label. Sending email never reads or writes the CMS.
    const { value, errors } = validateCallback(body, [{ value: body.destination, label: body.destinationLabel }]);
    if (Object.keys(errors).length) { res.status(422).json({ ok: false, errors }); return; }
    if (value.email) {
      const exists = await checkEmail(value.email);
      if (exists === false) {
        res.status(422).json({ ok: false, errors: { email: "לא מצאנו כתובת דוא״ל עם שם המתחם הזה. נא לבדוק את האיות, או להשאיר את השדה ריק." } }); return;
      }
      if (exists === null) {
        res.status(503).json({ ok: false, message: "לא הצלחנו לבדוק כרגע את כתובת הדוא״ל. אפשר לנסות שוב או להשאיר אותה ריקה." }); return;
      }
    }
    if (!delivery) {
      console.error("Callback email is not configured");
      res.status(503).json({ ok: false, message: "לא ניתן לשלוח את הפנייה כרגע. אפשר לפנות אלינו בוואטסאפ." }); return;
    }
    try {
      await delivery.send({
        submissionId: body.submissionId, ...value, destinationLabel: body.destinationLabel.trim(),
        sourcePath: body.sourcePath, createdAt: new Date().toISOString(),
      }, body.clientKey);
      res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof CallbackRateLimit) {
        res.status(429).json({ ok: false, message: "נשלחו כמה בקשות בזמן קצר. אפשר לנסות שוב מאוחר יותר או לפנות אלינו בוואטסאפ." }); return;
      }
      if (error instanceof CallbackConflict) {
        res.status(409).json({ ok: false, message: "פרטי הפנייה השתנו. נא לרענן את העמוד לפני שליחה נוספת." }); return;
      }
      const code = error instanceof EmailDeliveryError ? error.code : "provider_error";
      console.error("Callback email failed; reason:", code);
      res.status(503).json({ ok: false, message: code === "delivery_unknown"
        ? "לא ניתן לאשר אם ההודעה נשלחה. נא לפנות אלינו בוואטסאפ לפני שליחה נוספת."
        : "הפנייה לא נשלחה כרגע. נא לנסות שוב או לפנות אלינו בוואטסאפ." });
    }
  });
  return router;
}
