import nodemailer, { type SendMailOptions } from "nodemailer";
import { z } from "zod";

export type EmailConfig = { user: string; appPassword: string; to: string };
export type CallbackMessage = {
  submissionId: string;
  name: string;
  phone: string;
  country: string;
  email: string | null;
  destinationLabel: string;
  sourcePath: string;
  createdAt: string;
};
export interface CallbackMailer { send(message: CallbackMessage): Promise<string> }

export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | undefined {
  if (!env.GMAIL_APP_PASSWORD) return undefined;
  const user = env.GMAIL_USER ?? "roniellatours@gmail.com";
  const to = env.CALLBACK_EMAIL_TO ?? "roniellatours@gmail.com";
  const appPassword = env.GMAIL_APP_PASSWORD.replace(/\s/g, "");
  if (!/^[a-zA-Z0-9]{16}$/.test(appPassword) || !z.email().safeParse(user).success ||
      !user.toLowerCase().endsWith("@gmail.com") || !z.email().safeParse(to).success)
    throw Error("Callback email requires a Gmail address and 16-character Google App Password");
  return { user, appPassword, to };
}

export class EmailDeliveryError extends Error {
  constructor(readonly code: "provider_configuration" | "provider_error" | "network" | "delivery_unknown") {
    super("Callback email delivery unavailable");
  }
}
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function callbackEmail(message: CallbackMessage, config: EmailConfig): SendMailOptions {
  const rows = [
    ["שם", message.name], ["טלפון לחזרה", message.phone], ["מדינה", message.country],
    ["דוא״ל", message.email ?? "לא נמסר"], ["יעד", message.destinationLabel],
    ["עמוד מקור", message.sourcePath], ["מועד הפנייה", message.createdAt],
    ["אישור שימוש בפרטים לצורך חזרה לפונה", "ניתן בטופס"], ["מזהה פנייה", message.submissionId],
  ];
  return {
    from: { name: "RoniElla Tours", address: config.user }, to: config.to,
    subject: "פנייה חדשה מהאתר — שיחה חוזרת #" + message.submissionId.slice(0, 8),
    ...(message.email ? { replyTo: message.email } : {}),
    messageId: "<callback-" + message.submissionId + "@gmail.com>", date: new Date(message.createdAt),
    text: "בקשה חדשה לשיחה חוזרת — טיולי העולם העתיק\n\n" +
      rows.map(([label, value]) => label + ": " + value).join("\n"),
    html: '<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,sans-serif;line-height:1.7;background:#f6f2e7;color:#173f34;padding:24px"><h1 style="font-size:24px">בקשה חדשה לשיחה חוזרת</h1><p>התקבלה פנייה מטופס יצירת הקשר באתר של טיולי העולם העתיק.</p><table style="border-collapse:collapse;width:100%;max-width:650px">' +
      rows.map(([label, value]) => '<tr><th style="text-align:right;padding:10px;border-bottom:1px solid #c4cdc1">' +
        escape(label!) + '</th><td style="padding:10px;border-bottom:1px solid #c4cdc1"><bdi>' +
        escape(value!) + '</bdi></td></tr>').join("") +
      '</table><p>אפשר לחזור לפונה במספר הטלפון המצורף.</p></body></html>',
  };
}

type SendMail = (message: SendMailOptions) => Promise<{ messageId: string; rejected?: unknown[] }>;
export class GmailCallbackEmail implements CallbackMailer {
  private sendMail: SendMail;
  constructor(private config: EmailConfig, sendMail?: SendMail) {
    const transport = sendMail ? undefined : nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: config.user, pass: config.appPassword }, pool: false,
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    });
    this.sendMail = sendMail ?? (message => transport!.sendMail(message));
  }
  async send(message: CallbackMessage): Promise<string> {
    try {
      const result = await this.sendMail(callbackEmail(message, this.config));
      if (result.rejected?.length) throw new EmailDeliveryError("provider_error");
      if (!result.messageId || result.messageId.length > 256) throw new EmailDeliveryError("delivery_unknown");
      return result.messageId;
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      const failure = error as { code?: string; command?: string; responseCode?: number };
      if (failure.code === "EAUTH") throw new EmailDeliveryError("provider_configuration");
      if (failure.responseCode && failure.responseCode >= 400) throw new EmailDeliveryError("provider_error");
      if (failure.code === "EDNS" || failure.code === "ECONNECTION" || failure.command === "CONN")
        throw new EmailDeliveryError("network");
      throw new EmailDeliveryError("delivery_unknown");
    }
  }
}

export function configuredCallbackMailer(env: NodeJS.ProcessEnv = process.env): CallbackMailer | undefined {
  try {
    const config = readEmailConfig(env);
    return config ? new GmailCallbackEmail(config) : undefined;
  } catch {
    console.error("Callback email configuration is incomplete");
    return undefined;
  }
}
