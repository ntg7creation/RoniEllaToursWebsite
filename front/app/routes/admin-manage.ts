import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { ContentCollectionSchema, ContentCommandSchema, PhotoSlotSchema } from "@roniella/shared/admin";
import { adminHeaders, createAdminAuth, sameOriginAdminPost, type AdminAuth } from "../server/admin-auth.server";
import { requestPublicContent } from '../server/content.server';
import { adminSeoPreview } from '../server/admin-seo.server';
const reply=(auth:AdminAuth|null,message:string,status:number)=>Response.json({message},{status,headers:auth?.headers()??adminHeaders()});
function failure(auth:AdminAuth,code?:string) {
  if(code==='42501') return reply(auth,'אין הרשאה לעריכת האתר.',403);
  if(code==='40001') return reply(auth,'העמוד השתנה מאז פתיחת העורך. הטיוטה נשמרת כאן; טענו מחדש לפני ניסיון נוסף.',409);
  if(code==='23505') return reply(auth,'כתובת העמוד כבר נמצאת בשימוש. בחרו כתובת אחרת.',409);
  if(code==='P0002') return reply(auth,'העמוד לא נמצא.',404);
  if(['22023','23514','22P02','22007'].includes(code??'')) return reply(auth,'בדקו את השדות. השינויים לא נשמרו.',422);
  return reply(auth,'לא ניתן לאשר שהפעולה הושלמה. בדקו את הרשימה או טענו מחדש לפני ניסיון נוסף.',503);
}
export async function loader({request}:LoaderFunctionArgs) {
  let auth:AdminAuth|null=null;
  try {
    auth=createAdminAuth(request); if(!auth||!await auth.identity())return reply(auth,'נדרשת כניסת מנהל.',401);
    const photoSlot=new URL(request.url).searchParams.get('photoSlot');
    if(photoSlot!==null){
      const slot=PhotoSlotSchema.safeParse(photoSlot);if(!slot.success)return reply(auth,'בקשת תמונה לא תקינה.',400);
      const result=await auth.client.rpc('admin_read_photo_slot',{p_slot:slot.data});
      return result.error?failure(auth,result.error.code):Response.json(result.data,{headers:auth.headers()});
    }
    const key=new URL(request.url).searchParams.get('key');
    if(key&&!/^[a-zA-Z0-9_.-]{1,200}$/.test(key))return reply(auth,'בקשה לא תקינה.',400);
    const collection=ContentCollectionSchema.safeParse(new URL(request.url).searchParams.get('collection') ?? 'tour');
    if(!collection.success)return reply(auth,'בקשה לא תקינה.',400);
    const result=await auth.client.rpc('admin_workspace_read',{p_key:key,p_collection:collection.data});
    if (!result.error && key && new URL(request.url).searchParams.get('mode') === 'seo') {
      const preview = adminSeoPreview(result.data, await requestPublicContent(request));
      return Response.json({...result.data,preview},{headers:auth.headers()});
    }
    return result.error?failure(auth,result.error.code):Response.json(result.data,{headers:auth.headers()});
  } catch {return reply(auth,'לא ניתן לטעון את התוכן כרגע.',503);}
}
export async function action({request}:ActionFunctionArgs) {
  if(!sameOriginAdminPost(request))return reply(null,'בקשה ממקור לא מורשה.',403);
  let auth:AdminAuth|null=null;
  try {
    auth=createAdminAuth(request); if(!auth||!await auth.identity())return reply(auth,'נדרשת כניסת מנהל.',401);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(auth,'נדרש תוכן תקין.',415);
    const reader=request.body?.getReader(); if(!reader)return reply(auth,'בקשה ריקה.',400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();return reply(auth,'התוכן ארוך מדי לשמירה אחת.',413);}chunks.push(value);}
    let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(auth,'בקשה לא תקינה.',400);}
    const command=ContentCommandSchema.safeParse(body);if(!command.success)return reply(auth,'בדקו את שדות החובה, הקישורים, התמונה ואת כתובת העמוד (אותיות באנגלית, מספרים ומקפים).',422);
    const result=command.data.operation==='save_photo'
      ?await auth.client.rpc('admin_save_photo_slot',{p_slot:command.data.slot,p_media_id:command.data.mediaId,p_revision:command.data.expectedRevision})
      :await auth.client.rpc('admin_manage_content',{command:command.data});
    return result.error?failure(auth,result.error.code):Response.json(result.data,{headers:auth.headers()});
  } catch{return reply(auth,'לא ניתן לאשר שהשמירה הושלמה. בדקו את התוכן לפני ניסיון נוסף.',503);}
}
