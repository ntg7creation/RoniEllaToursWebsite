import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {validateCallback,callbackDestinations,privacyVersion,type CallbackRecord} from "@roniella/shared/callback";
import {LocalContentRepository} from "../src/content-repository.js";
import {createApp} from "../src/app.js";
import {migratedTestDatabase} from "../../scripts/database-test-support.js";
const input={name:"רוני אלה",phone:"050-5202480",country:"IL",email:"",destination:"undecided",privacyAccepted:true};
test("callback validation accepts local/international phone numbers and rejects malformed input, email typos and missing consent",async()=>{
  const content=await(await LocalContentRepository.load()).getPublicContent(),destinations=callbackDestinations(content);
  assert.equal(destinations.length,4);
  for(const phone of ["050-5202480","+972505202480","0733744686"]){
    const result=validateCallback({...input,phone},destinations);assert.deepEqual(result.errors,{});assert.ok(result.value.phone.startsWith("+"));
  }
  assert.deepEqual(validateCallback({...input,country:"US",phone:"2025550123"},destinations).errors,{});
  assert.ok(validateCallback({...input,country:"US",phone:"202555012"},destinations).errors.phone);
  assert.ok(validateCallback({...input,country:"IL",phone:"+12025550123"},destinations).errors.phone);
  for(const phone of ["123","050520248","+972111111111","call 0505202480","0505202480 ext 3"])assert.ok(validateCallback({...input,phone},destinations).errors.phone,phone);
  assert.ok(validateCallback({...input,name:"1"},destinations).errors.name);
  assert.ok(validateCallback({...input,email:"roni@gmial.com"},destinations).errors.email);
  assert.ok(validateCallback({...input,email:"missing@"},destinations).errors.email);
  assert.ok(validateCallback({...input,destination:"not-published"},destinations).errors.destination);
  assert.ok(validateCallback({...input,privacyAccepted:false},destinations).errors.privacy);
});
test("callback endpoint validates on the server, protects storage with the API token, and never returns private inbox data",async()=>{
  const records:CallbackRecord[]=[],repository=await LocalContentRepository.load();
  const server=createApp(repository,{apiToken:"callback-test-token-12345678901234567890",callbackStore:{save:async row=>{records.push(row);}},checkEmail:async email=>!email.endsWith("@no-such-domain.test")}).listen(0,"127.0.0.1");
  await new Promise<void>(done=>server.once("listening",done));const address=server.address();assert.ok(address&&typeof address!=="string");
  const origin=`http://127.0.0.1:${address.port}`,headers={"Content-Type":"application/json",Authorization:"Bearer callback-test-token-12345678901234567890"};
  const body={...input,submissionId:randomUUID(),sourcePath:"/contact/",clientKey:"a".repeat(64)};
  const post=(value:unknown,auth=true)=>fetch(origin+"/api/v1/callbacks",{method:"POST",headers:auth?headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
  try{
    assert.equal((await post(body,false)).status,401);
    assert.equal((await post({...body,phone:"123"})).status,422);
    assert.equal((await post({...body,privacyAccepted:false})).status,422);
    assert.equal((await post({...body,email:"name@no-such-domain.test"})).status,422);
    assert.equal(records.length,0);
    assert.equal((await post(body)).status,201);assert.equal(records[0]!.phone,"+972505202480");assert.equal(records[0]!.privacyVersion,privacyVersion);
    assert.equal((await fetch(origin+"/api/v1/callbacks",{headers})).status,404);
    const content=await(await fetch(origin+"/api/v1/content",{headers})).text();assert.ok(!content.includes('submissionId')&&!content.includes('phone_e164'));
  }finally{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
});
test("callback database stores consent privately, deduplicates retries, limits requests and excludes the inbox from content",async()=>{
  const db=await migratedTestDatabase();
  try{
    await db.exec(await readFile(new URL("../../database/supabase/seed.sql",import.meta.url),"utf8"));
    const base={...input,phone:"+972505202480",email:null,destinationLabel:"עדיין לא החלטתי",sourcePath:"/contact/",privacyVersion,clientKey:"c".repeat(64)};
    const row={...base,submissionId:randomUUID()};
    for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);await assert.rejects(db.exec("select * from public.callback_requests"),/permission denied/);await assert.rejects(db.query("select public.create_callback_request($1::jsonb)",[JSON.stringify(row)]),/permission denied/);await db.exec("reset role");}
    await db.exec("set role service_role");
    const submit=(payload:unknown)=>db.query("select public.create_callback_request($1::jsonb)",[JSON.stringify(payload)]);
    await submit(row);await submit(row);
    assert.equal((await db.query("select * from public.callback_requests")).rows.length,1);
    await assert.rejects(submit({...row,submissionId:randomUUID(),privacyAccepted:false}),/callback_invalid/);
    for(let i=0;i<4;i++)await submit({...base,submissionId:randomUUID()});
    await assert.rejects(submit({...base,submissionId:randomUUID()}),/callback_rate_limited/);
    const saved=(await db.query("select * from public.callback_requests limit 1")).rows[0]!;
    assert.equal(saved.phone_e164,"+972505202480");assert.ok(saved.privacy_accepted_at);assert.equal(saved.phone_check,"numbering-plan");
    const publicContent=JSON.stringify((await db.query("select public.read_site_content() as content")).rows[0]);
    assert.ok(!publicContent.includes(row.submissionId)&&!publicContent.includes("phone_e164"));
  }finally{await db.close();}
});
