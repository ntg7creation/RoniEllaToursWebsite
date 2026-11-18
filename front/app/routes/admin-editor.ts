import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { EditChangesSchema, EditorRequestSchema } from "@roniella/shared/admin";
import { SiteSettingsSchema } from "@roniella/shared";
import { adminHeaders, createAdminAuth, sameOriginAdminPost, type AdminAuth } from "../server/admin-auth.server";
import { editorDocument } from "../server/admin-editor.server";

const reply = (auth: AdminAuth | null, message: string, status: number) => Response.json({ message }, { status, headers: auth?.headers() ?? adminHeaders() });
function databaseError(auth: AdminAuth, code?: string) {
  if (code === "42501") return reply(auth, "אין הרשאה לעריכת האתר. יש להתחבר באמצעות חשבון מורשה.", 403);
  if (code === "40001") return reply(auth, "התוכן השתנה מאז שפתחתם את העורך. השינויים שלכם לא נדרסו. טענו את הגרסה העדכנית ובדקו אותה לפני שמירה נוספת.", 409);
  if (code === "P0002") return reply(auth, "התוכן הזה אינו זמין לעריכה.", 404);
  if (["22023", "23514", "22P02"].includes(code ?? "")) return reply(auth, "יש לבדוק את הטקסט שהוזן. השינויים לא נשמרו.", 422);
  return reply(auth, "לא ניתן לשמור או לטעון את התוכן כרגע. נסו שוב.", 503);
}
export async function loader({ request }: LoaderFunctionArgs) {
  let auth: AdminAuth | null = null;
  try {
    auth = createAdminAuth(request);
    if (!auth || !await auth.identity()) return reply(auth, "נדרשת כניסה באמצעות חשבון מורשה.", 401);
    const query = new URL(request.url).searchParams;
    const parsed = EditorRequestSchema.safeParse({ scope: query.get("scope"), key: query.get("key") });
    if (!parsed.success) return reply(auth, "בקשת עריכה לא תקינה.", 400);
    const result = await auth.client.rpc("admin_read_editor", { p_scope: parsed.data.scope, p_key: parsed.data.key });
    if (result.error) return databaseError(auth, result.error.code);
    return Response.json(editorDocument(parsed.data, result.data), { headers: auth.headers() });
  } catch { return reply(auth, "לא ניתן לטעון את העורך כרגע. נסו שוב.", 503); }
}
export async function action({ request }: ActionFunctionArgs) {
  if (!sameOriginAdminPost(request)) return reply(null, "בקשה ממקור לא מורשה.", 403);
  let auth: AdminAuth | null = null;
  try {
    auth = createAdminAuth(request);
    if (!auth || !await auth.identity()) return reply(auth, "נדרשת כניסה באמצעות חשבון מורשה.", 401);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(auth, "נדרש תוכן תקין.", 415);
    // Read with a hard bound, including chunked requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply(auth, "בקשת עריכה ריקה.", 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 262144) { await reader.cancel(); return reply(auth, "יש לשמור פחות שינויים בכל פעם.", 413); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reply(auth, "בקשת עריכה לא תקינה.", 400); }
    const parsed = EditChangesSchema.safeParse(body);
    if (!parsed.success) return reply(auth, "יש לבדוק את הטקסט שהוזן (עד 100 שדות בכל שמירה).", 422);
    for (const change of parsed.data) if (change.scope === "site") {
      const schema = change.field === "contact_email" ? SiteSettingsSchema.shape.contact.shape.email
        : change.field === "contact_phone" ? SiteSettingsSchema.shape.contact.shape.phone : null;
      if (schema && !schema.safeParse(change.value).success) return reply(auth, "מספר הטלפון או כתובת הדוא״ל אינם תקינים.", 422);
    }
    const result = await auth.client.rpc("admin_save_content", { p_changes: parsed.data });
    if (result.error) return databaseError(auth, result.error.code);
    return Response.json({ saved: result.data }, { headers: auth.headers() });
  } catch { return reply(auth, "לא ניתן לאשר שהשמירה הושלמה. טענו את הגרסה העדכנית לפני ניסיון נוסף.", 503); }
}
