import {createHmac,randomUUID} from "node:crypto";
import {data,type ActionFunctionArgs} from "react-router";
import {callbackDestinations,validateCallback,type CallbackResult} from "@roniella/shared/callback";
import {backendHeaders,serverConfig} from "./config.server";
import {requestPublicContent} from "./content.server";
export async function callbackAction({request,url}:ActionFunctionArgs){
  const origin=request.headers.get("origin");
  const result=(value:CallbackResult,status=200)=>data(value,{status,headers:{"Cache-Control":"no-store"}});
  if(origin!==url.origin&&origin!==serverConfig.siteOrigin)return result({ok:false,message:"לא ניתן לשלוח את הבקשה ממקור זה. נא לפתוח את האתר ולנסות שוב."},403);
  const length=Number(request.headers.get("content-length")??0);
  if(length>8192)return result({ok:false,message:"הבקשה גדולה מדי."},413);
  const form=await request.formData();
  const field=(name:string)=>String(form.get(name)??"").slice(0,500);
  if(field("website"))return result({ok:true});
  const values={name:field("name"),phone:field("phone"),country:field("country"),email:field("email"),destination:field("destination"),privacyAccepted:form.get("privacyAccepted")==="on"};
  const content=await requestPublicContent(request);
  const destinations=callbackDestinations(content);
  const {errors}=validateCallback(values,destinations);
  if(Object.keys(errors).length)return result({ok:false,errors,values},422);
  const id=field("submissionId")||randomUUID();
  if(!/^[a-f0-9-]{36}$/i.test(id))return result({ok:false,message:"נא לרענן את העמוד ולנסות שוב."},400);
  const ip=request.headers.get("x-vercel-forwarded-for")??request.headers.get("x-forwarded-for")??"local";
  const clientKey=createHmac("sha256",serverConfig.apiToken||"local-development-only").update(ip.split(",")[0]!.trim()).digest("hex");
  try{
    const response=await fetch(serverConfig.backendOrigin+"/api/v1/callbacks",{method:"POST",headers:{...backendHeaders(),"Content-Type":"application/json"},
      body:JSON.stringify({...values,destinationLabel:destinations.find(item=>item.value===values.destination)!.label,sourcePath:url.pathname,submissionId:id,clientKey}),redirect:"error",signal:AbortSignal.timeout(25000)});
    const reply=await response.json() as CallbackResult;
    if(response.ok&&reply.ok)return result({ok:true});
    return result({ok:false,errors:reply.errors,values,message:reply.message??"הפנייה לא נשלחה. אפשר לנסות שוב או לפנות אלינו בוואטסאפ."},[400,409,422,429,503].includes(response.status)?response.status:503);
  }catch{return result({ok:false,values,message:"לא ניתן לאשר אם ההודעה נשלחה. נא לפנות אלינו בוואטסאפ לפני שליחה נוספת."},503);}
}
