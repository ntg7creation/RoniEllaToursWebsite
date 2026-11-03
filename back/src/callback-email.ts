import nodemailer,{type SendMailOptions} from "nodemailer";
import {z} from "zod";

export type EmailConfig={user:string;appPassword:string;to:string};
export function readEmailConfig(env:NodeJS.ProcessEnv=process.env):EmailConfig|undefined {
  if(!env.GMAIL_APP_PASSWORD)return undefined;
  const user=env.GMAIL_USER??"roniellatours@gmail.com",to=env.CALLBACK_EMAIL_TO??"roniellatours@gmail.com";
  const appPassword=env.GMAIL_APP_PASSWORD.replace(/\s/g,"");
  if(!/^[a-zA-Z0-9]{16}$/.test(appPassword)||!z.email().safeParse(user).success||!user.toLowerCase().endsWith("@gmail.com")||!z.email().safeParse(to).success)
    throw Error("Callback email requires a Gmail address and 16-character Google App Password");
  return {user,appPassword,to};
}
export type EmailJob={submissionId:string;leaseToken:string;name:string;phone:string;country:string;email:string|null;destinationLabel:string;sourcePath:string;createdAt:string};
export interface EmailQueue {claim(submissionId?:string):Promise<EmailJob|null>;finish(job:EmailJob,outcome:{providerId:string}|{errorCode:string}):Promise<void>}
export class EmailDeliveryError extends Error {constructor(readonly code:string){super("Callback email delivery unavailable");}}
const escape=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
export function callbackEmail(job:EmailJob,config:EmailConfig):SendMailOptions{
  const rows=[['שם',job.name],['טלפון לחזרה',job.phone],['מדינה',job.country],['דוא״ל',job.email??'לא נמסר'],['יעד',job.destinationLabel],['עמוד מקור',job.sourcePath],['מועד הפנייה',job.createdAt],['מזהה פנייה',job.submissionId]];
  return {from:{name:"RoniElla Tours",address:config.user},to:config.to,subject:`פנייה חדשה מהאתר — שיחה חוזרת #${job.submissionId.slice(0,8)}`,
    ...(job.email?{replyTo:job.email}:{}),messageId:`<callback-${job.submissionId}@gmail.com>`,date:new Date(job.createdAt),
    text:"בקשה חדשה לשיחה חוזרת — טיולי העולם העתיק\n\n"+rows.map(([label,value])=>`${label}: ${value}`).join("\n"),
    html:`<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,sans-serif;line-height:1.7;background:#f6f2e7;color:#173f34;padding:24px"><h1 style="font-size:24px">בקשה חדשה לשיחה חוזרת</h1><p>התקבלה פנייה מהאתר של טיולי העולם העתיק.</p><table style="border-collapse:collapse;width:100%;max-width:650px">${rows.map(([label,value])=>`<tr><th style="text-align:right;padding:10px;border-bottom:1px solid #c4cdc1">${escape(label!)}</th><td style="padding:10px;border-bottom:1px solid #c4cdc1"><bdi>${escape(value!)}</bdi></td></tr>`).join("")}</table><p>פרטי הפנייה שמורים גם במערכת הפניות של העסק.</p></body></html>`};
}
type SendMail=(message:SendMailOptions)=>Promise<{messageId:string;rejected?:unknown[]}>;
export class GmailCallbackEmail {
  private sendMail:SendMail;
  constructor(private config:EmailConfig,sendMail?:SendMail){
    const transport=sendMail?undefined:nodemailer.createTransport({host:"smtp.gmail.com",port:465,secure:true,
      auth:{user:config.user,pass:config.appPassword},pool:false,connectionTimeout:5000,greetingTimeout:5000,socketTimeout:8000,
      logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
    this.sendMail=sendMail??(message=>transport!.sendMail(message));
  }
  async send(job:EmailJob):Promise<string>{
    try{
      const result=await this.sendMail(callbackEmail(job,this.config));
      if(result.rejected?.length)throw new EmailDeliveryError("provider_error");
      if(!result.messageId||result.messageId.length>256)throw new EmailDeliveryError("delivery_unknown");
      return result.messageId;
    }catch(error){
      if(error instanceof EmailDeliveryError)throw error;
      const failure=error as {code?:string;command?:string;responseCode?:number};
      if(failure.code==="EAUTH")throw new EmailDeliveryError("provider_configuration");
      if(failure.responseCode&&failure.responseCode>=400)throw new EmailDeliveryError("provider_error");
      if(failure.code==="EDNS"||failure.code==="ECONNECTION"||failure.command==="CONN")throw new EmailDeliveryError("network");
      throw new EmailDeliveryError("delivery_unknown");
    }
  }
}
export class CallbackNotifier {
  constructor(private queue:EmailQueue,private mailer:GmailCallbackEmail){}
  async deliver(submissionId?:string){
    const job=await this.queue.claim(submissionId);
    if(!job)return {processed:false,sent:false};
    let sent=false;
    try{
      const providerId=await this.mailer.send(job);sent=true;
      await this.queue.finish(job,{providerId});
      return {processed:true,sent:true};
    }catch(error){
      const errorCode=sent?"delivery_unknown":error instanceof EmailDeliveryError?error.code:"notification_state";
      await this.queue.finish(job,{errorCode}).catch(()=>{});
      console.error("Callback email pending or needs review; reason:",errorCode);
      return {processed:true,sent:false};
    }
  }
}
export class SupabaseEmailQueue implements EmailQueue {
  constructor(private options:{origin:string;secretKey:string;timeoutMs:number},private request:typeof fetch=fetch){}
  private async rpc(name:string,body:unknown){
    const headers:Record<string,string>={apikey:this.options.secretKey,"Content-Type":"application/json"};
    if(this.options.secretKey.startsWith("eyJ"))headers.Authorization=`Bearer ${this.options.secretKey}`;
    const response=await this.request(`${this.options.origin}/rest/v1/rpc/${name}`,{method:"POST",headers,body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(Math.min(this.options.timeoutMs,3000))});
    if(!response.ok){await response.body?.cancel();throw Error("Callback email queue unavailable");}
    return response.json();
  }
  async claim(submissionId?:string):Promise<EmailJob|null>{return this.rpc("claim_callback_email",{requested_submission:submissionId??null});}
  async finish(job:EmailJob,outcome:{providerId:string}|{errorCode:string}){await this.rpc("finish_callback_email",{requested_submission:job.submissionId,lease:job.leaseToken,provider_id:"providerId" in outcome?outcome.providerId:null,error_code:"errorCode" in outcome?outcome.errorCode:null});}
}
export function configuredCallbackNotifier(options:{origin:string;secretKey:string;timeoutMs:number},env:NodeJS.ProcessEnv=process.env){
  try{const config=readEmailConfig(env);return config?new CallbackNotifier(new SupabaseEmailQueue(options),new GmailCallbackEmail(config)):undefined;}
  catch{console.error("Callback email configuration is incomplete; requests remain in the private inbox");return undefined;}
}
