import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {CallbackNotifier,GmailCallbackEmail,callbackEmail,readEmailConfig,type EmailJob} from "../src/callback-email.js";
import {migratedTestDatabase} from "../../scripts/database-test-support.js";
import {privacyVersion} from "@roniella/shared/callback";
const config={user:"roniellatours@gmail.com",appPassword:"abcdefghijklmnop",to:"roniellatours@gmail.com"};
const job:EmailJob={submissionId:randomUUID(),leaseToken:randomUUID(),name:'<script>unsafe()</script>',phone:'+972505202480',country:'IL',email:'visitor@example.com',destinationLabel:'סין & תרבות',sourcePath:'/contact/',createdAt:'2026-11-03T00:00:00.000Z'};
test("callback email uses the configured business inbox, escaped Hebrew content and optional visitor reply-to",()=>{
  const payload=callbackEmail(job,config);
  assert.equal(payload.to,'roniellatours@gmail.com');assert.equal(payload.replyTo,'visitor@example.com');
  assert.ok(String(payload.html).includes('dir="rtl"')&&!String(payload.html).includes('<script>'));
  assert.ok(String(payload.text).includes(job.phone)&&String(payload.html).includes('סין &amp; תרבות'));
  assert.equal(callbackEmail({...job,email:null},config).replyTo,undefined);
  assert.equal(readEmailConfig({}),undefined);
  assert.equal(readEmailConfig({GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop'})!.to,config.to);
  assert.throws(()=>readEmailConfig({GMAIL_APP_PASSWORD:'normal-password'}),/App Password/);
});
test("Gmail notifications use stable message IDs and retain queue work on authentication failure",async()=>{
  const requests:unknown[]=[];
  const mailer=new GmailCallbackEmail(config,async message=>{requests.push(message);return {messageId:'mail-id-123'};});
  const outcomes:unknown[]=[];
  const queue={claim:async()=>job,finish:async(_job:EmailJob,outcome:unknown)=>{outcomes.push(outcome);}};
  assert.deepEqual(await new CallbackNotifier(queue,mailer).deliver(job.submissionId),{processed:true,sent:true});
  assert.equal((requests[0] as {messageId:string}).messageId,`<callback-${job.submissionId}@gmail.com>`);
  assert.deepEqual(outcomes[0],{providerId:'mail-id-123'});
  const failed=new GmailCallbackEmail(config,async()=>{throw {code:'EAUTH',message:'Private diagnostic'};});
  assert.deepEqual(await new CallbackNotifier(queue,failed).deliver(),{processed:true,sent:false});
  assert.deepEqual(outcomes[1],{errorCode:'provider_configuration'});
  const uncertain=new GmailCallbackEmail(config,async()=>{throw {code:'ETIMEDOUT',command:'DATA'};});
  assert.deepEqual(await new CallbackNotifier(queue,uncertain).deliver(),{processed:true,sent:false});
  assert.deepEqual(outcomes[2],{errorCode:'delivery_unknown'});
});
test("private email jobs are leased, retried without duplicates, marked sent and absent from public content",async()=>{
  const db=await migratedTestDatabase();
  try{
    await db.exec(await readFile(new URL('../../database/supabase/seed.sql',import.meta.url),'utf8'));
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);await assert.rejects(db.exec('select * from public.callback_email_jobs'),/permission denied/);
      await assert.rejects(db.exec('select public.claim_callback_email(null)'),/permission denied/);await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const record={submissionId:job.submissionId,name:'Local email test',phone:job.phone,country:job.country,email:job.email,destination:'undecided',destinationLabel:'Other',sourcePath:'/',privacyVersion,privacyAccepted:true,clientKey:'e'.repeat(64)};
    await db.query('select public.create_callback_request($1::jsonb)',[JSON.stringify(record)]);
    const claim=async()=>((await db.query<{job:EmailJob|null}>('select public.claim_callback_email($1) as job',[record.submissionId])).rows[0]!.job);
    const claimed=await claim();assert.ok(claimed);assert.equal(claimed.email,job.email);
    assert.equal(await claim(),null,'A leased request cannot be claimed twice');
    await db.query('select public.finish_callback_email($1,$2,null,$3)',[record.submissionId,claimed.leaseToken,'network']);
    assert.equal(await claim(),null,'Retry waits for its backoff');
    await db.exec('reset role');await db.query("update public.callback_email_jobs set available_at=now()-interval '1 minute' where submission_id=$1",[record.submissionId]);await db.exec('set role service_role');
    const retry=await claim();assert.ok(retry);assert.notEqual(retry.leaseToken,claimed.leaseToken);assert.equal(retry.createdAt,claimed.createdAt);
    await db.query('select public.finish_callback_email($1,$2,$3,null)',[record.submissionId,retry.leaseToken,'resend-fixture-id']);
    assert.equal(await claim(),null);
    assert.equal((await db.query('select state from public.callback_email_jobs')).rows[0]!.state,'sent');
    assert.ok(!JSON.stringify((await db.query('select public.read_site_content() as content')).rows).includes(record.submissionId));
    const uncertainId=randomUUID();
    await db.query('select public.create_callback_request($1::jsonb)',[JSON.stringify({...record,submissionId:uncertainId})]);
    assert.ok((await db.query('select public.claim_callback_email($1) as job',[uncertainId])).rows[0]!.job);
    await db.exec('reset role');
    await db.query("update public.callback_email_jobs set lease_until=now()-interval '1 minute' where submission_id=$1",[uncertainId]);
    await db.exec('set role service_role');
    assert.equal((await db.query('select public.claim_callback_email($1) as job',[uncertainId])).rows[0]!.job,null);
    assert.equal((await db.query('select error_code from public.callback_email_jobs where submission_id=$1',[uncertainId])).rows[0]!.error_code,'delivery_unknown');
  }finally{await db.close();}
});
