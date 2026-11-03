import {Router} from "express";
import {Resolver} from "node:dns/promises";
import {callbackDestinations,privacyVersion,validateCallback} from "@roniella/shared/callback";
import {CallbackRateLimit,type CallbackStore} from "./callback-store.js";
import type {ContentRepository} from "./content-repository.js";
import type {CallbackNotifier} from "./callback-email.js";
export async function emailDomainExists(email:string) {
  const domain=email.split("@").at(-1)!;
  const resolver=new Resolver({timeout:2000,tries:1});
  try {
    const records=await resolver.resolveMx(domain);
    return records.some(record=>record.exchange&&record.exchange!==".");
  }catch(error){
    if((error as NodeJS.ErrnoException).code==="ENOTFOUND")return false;
    if((error as NodeJS.ErrnoException).code!=="ENODATA")return null;
    const addresses=await Promise.allSettled([resolver.resolve4(domain),resolver.resolve6(domain)]);
    return addresses.some(result=>result.status==="fulfilled"&&result.value.length>0);
  }
}
export function callbackRouter(repository:ContentRepository,store:CallbackStore,checkEmail= emailDomainExists,notifier?:CallbackNotifier){
  const router=Router();
  router.post("/",async(req,res)=>{
    const body=req.body;
    if(!body||typeof body!=="object"||Array.isArray(body)){res.status(400).json({ok:false,message:"הבקשה אינה תקינה."});return;}
    const strings=["name","phone","country","email","destination","sourcePath","submissionId","clientKey"];
    if(strings.some(key=>typeof body[key]!=="string"||body[key].length>500)||typeof body.privacyAccepted!=="boolean"||
      !/^[a-f0-9-]{36}$/i.test(body.submissionId)||!/^[a-f0-9]{64}$/.test(body.clientKey)||!/^\/(?:[a-z0-9-]+\/)*$/.test(body.sourcePath)){
      res.status(400).json({ok:false,message:"הבקשה אינה תקינה."});return;
    }
    const content=await repository.getPublicContent(),destinations=callbackDestinations(content);
    const {value,errors}=validateCallback(body,destinations);
    if(Object.keys(errors).length){res.status(422).json({ok:false,errors});return;}
    if(value.email){
      const exists=await checkEmail(value.email);
      if(exists===false){res.status(422).json({ok:false,errors:{email:"לא מצאנו כתובת דוא״ל עם שם המתחם הזה. נא לבדוק את האיות, או להשאיר את השדה ריק."}});return;}
      if(exists===null){res.status(503).json({ok:false,message:"לא הצלחנו לבדוק כרגע את כתובת הדוא״ל. אפשר לנסות שוב או להשאיר אותה ריקה."});return;}
    }
    try{
      await store.save({...value,submissionId:body.submissionId,destinationLabel:destinations.find(item=>item.value===value.destination)!.label,
        sourcePath:body.sourcePath,privacyVersion,privacyAccepted:true,clientKey:body.clientKey});
      if(notifier)await notifier.deliver(body.submissionId).catch(()=>console.error("Callback email queue unavailable; request saved in private inbox"));
      res.status(201).json({ok:true});
    }catch(error){
      res.status(error instanceof CallbackRateLimit?429:503).json({ok:false,message:error instanceof CallbackRateLimit?"נשלחו כמה בקשות בזמן קצר. אפשר לנסות שוב מאוחר יותר או לפנות אלינו בוואטסאפ.":"הבקשה לא נשמרה כרגע. נא לנסות שוב או לפנות אלינו בוואטסאפ."});
    }
  });
  router.post("/retry-notifications",async(_req,res)=>{
    if(!notifier){res.status(503).json({ok:false,message:"Email notifications are not configured"});return;}
    const result=await notifier.deliver();res.json({ok:true,...result});
  });
  return router;
}
