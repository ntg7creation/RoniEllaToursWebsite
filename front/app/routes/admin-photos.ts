import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { DriveFolderUrlSchema, DriveFileIdSchema } from '@roniella/shared/google-drive';
import { adminHeaders, createAdminAuth, sameOriginAdminPost, type AdminAuth } from '../server/admin-auth.server';
import { drivePhotoChoice, readEditorFolder, editorImageDimensions } from '../server/google-drive.server';
const reply = (auth: AdminAuth | null, message: string, status: number) => Response.json({ message }, { status, headers: auth?.headers() ?? adminHeaders() });
const altText = z.string().trim().min(1).max(2000);
const selection = z.strictObject({ folderUrl: DriveFolderUrlSchema, fileId: DriveFileIdSchema, alt: altText });
const altChange = z.strictObject({ operation:z.literal('save_alt'), id:z.string().regex(/^[a-zA-Z0-9_.-]{1,200}$/), expected:altText, alt:altText });
const folderChange = z.strictObject({ operation: z.literal('set_folder'), folderUrl: DriveFolderUrlSchema, expectedFolderUrl: DriveFolderUrlSchema });
export async function loader({ request }: LoaderFunctionArgs) {
  let auth: AdminAuth | null = null;
  try {
    auth = createAdminAuth(request); if (!auth || !await auth.identity()) return reply(auth, 'נדרשת כניסת מנהל.', 401);
    const result = await auth.client.rpc('admin_photo_library');
    if (result.error) return reply(auth, 'לא ניתן לטעון את ספריית התמונות.', 503);
    const folderUrl = DriveFolderUrlSchema.parse(result.data.folderUrl);
    const folder = await readEditorFolder(folderUrl, new URL(request.url).searchParams.get('refresh') === '1');
    return Response.json({ folderUrl, title: folder.title, photos: folder.photos.map(drivePhotoChoice) }, { headers: auth.headers() });
  } catch { return reply(auth, 'לא ניתן לטעון את התיקייה. בדקו שקישור Google Drive משותף לצפייה ורעננו.', 503); }
}
export async function action({ request }: ActionFunctionArgs) {
  if (!sameOriginAdminPost(request)) return reply(null, 'בקשה ממקור לא מורשה.', 403);
  let auth: AdminAuth | null = null;
  try {
    auth = createAdminAuth(request); if (!auth || !await auth.identity()) return reply(auth, 'נדרשת כניסת מנהל.', 401);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(auth, 'נדרש תוכן תקין.', 415);
    const reader = request.body?.getReader(); if (!reader) return reply(auth, 'בקשה ריקה.', 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 8000) { await reader.cancel(); return reply(auth, 'בקשה ארוכה מדי.', 413); } chunks.push(value); }
    let body: unknown; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(auth, 'בקשה לא תקינה.', 400); }
    const alt = altChange.safeParse(body);
    if (alt.success) {
      const { id, expected, alt: value } = alt.data;
      const result = await auth.client.rpc('admin_save_content', {p_changes:[{scope:'media',key:id,field:'alt',expected,value}]});
      return result.error ? reply(auth,'התיאור השתנה או לא נשמר. טענו מחדש. / Reload the photo and retry.',result.error.code === '40001' ? 409 : 422) : Response.json({alt:value},{headers:auth.headers()});
    }
    const changing = folderChange.safeParse(body);
    if (changing.success) {
      await readEditorFolder(changing.data.folderUrl, true);
      const result = await auth.client.rpc('admin_set_drive_folder', { p_url: changing.data.folderUrl, p_expected: changing.data.expectedFolderUrl });
      return result.error ? reply(auth, result.error.code === '40001' ? 'קישור התיקייה השתנה. רעננו לפני שמירה.' : 'לא ניתן לשמור את קישור התיקייה.', result.error.code === '40001' ? 409 : 503) : Response.json(result.data, { headers: auth.headers() });
    }
    const parsed = selection.safeParse(body); if (!parsed.success) return reply(auth, 'בחרו תמונה מתוך התיקייה המשותפת.', 422);
    const library = await auth.client.rpc('admin_photo_library'); if (library.error) return reply(auth, 'לא ניתן לטעון את ספריית התמונות.', 503);
    if (library.data.folderUrl !== parsed.data.folderUrl) return reply(auth, 'קישור התיקייה השתנה. רעננו את הרשימה.', 409);
    const folder = await readEditorFolder(parsed.data.folderUrl, true);
    const photo = folder.photos.find(item => item.sourceId === parsed.data.fileId);
    if (!photo) return reply(auth, 'התמונה כבר אינה נמצאת בתיקייה. רעננו את הרשימה.', 404);
    const dimensions = await editorImageDimensions(photo.sourceId, request.signal);
    const result = await auth.client.rpc('admin_link_drive_photo', { p_photo: { ...parsed.data, ...dimensions,
      ...(photo.addedAt ? { addedAt: photo.addedAt } : {}), ...(photo.modifiedAt ? { modifiedAt: photo.modifiedAt } : {}) } });
    return result.error ? reply(auth, 'לא ניתן לשמור את הבחירה. נסו שוב.', 503) : Response.json(result.data, { headers: auth.headers() });
  } catch { return reply(auth, 'לא ניתן לבחור את התמונה כרגע. ודאו שהתיקייה והתמונה משותפות לצפייה ורעננו.', 503); }
}
