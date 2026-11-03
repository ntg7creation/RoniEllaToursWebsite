import {appendFile,mkdir} from "node:fs/promises";
import type {CallbackRecord} from "@roniella/shared/callback";
export interface CallbackStore {save(record:CallbackRecord):Promise<void>}
export class CallbackRateLimit extends Error {}
export class SupabaseCallbackStore implements CallbackStore {
  constructor(private options:{origin:string;secretKey:string;timeoutMs:number},private request:typeof fetch=fetch){}
  async save(record:CallbackRecord) {
    const headers:Record<string,string>={apikey:this.options.secretKey,"Content-Type":"application/json"};
    if(this.options.secretKey.startsWith("eyJ"))headers.Authorization=`Bearer ${this.options.secretKey}`;
    const response=await this.request(this.options.origin+"/rest/v1/rpc/create_callback_request",{method:"POST",headers,
      body:JSON.stringify({payload:record}),redirect:"error",signal:AbortSignal.timeout(this.options.timeoutMs)});
    if(!response.ok){
      const failure=await response.json().catch(()=>({}));
      if(failure.message==="callback_rate_limited")throw new CallbackRateLimit();
      throw Error("Callback storage unavailable");
    }
    await response.body?.cancel();
  }
}
// Local development only. This directory is excluded from Git and static assets.
export class FileCallbackStore implements CallbackStore {
  private seen=new Set<string>();
  private limits=new Map<string,{count:number;until:number}>();
  constructor(private directory=new URL("../private-data/",import.meta.url)){}
  async save(record:CallbackRecord){
    if(this.seen.has(record.submissionId))return;
    const key=record.clientKey,now=Date.now(),limit=this.limits.get(key);
    if(limit&&limit.until>now&&limit.count>=5)throw new CallbackRateLimit();
    this.limits.set(key,{count:limit&&limit.until>now?limit.count+1:1,until:limit&&limit.until>now?limit.until:now+900000});
    for(const [key,value] of this.limits)if(value.until<now)this.limits.delete(key);
    await mkdir(this.directory,{recursive:true});
    await appendFile(new URL("callbacks.jsonl",this.directory),JSON.stringify({...record,createdAt:new Date().toISOString()})+"\n",{mode:0o600});
    this.seen.add(record.submissionId);
    if(this.seen.size>1000)this.seen.delete(this.seen.values().next().value!);
  }
}
