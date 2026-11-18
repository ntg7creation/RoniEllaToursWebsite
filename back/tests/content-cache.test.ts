import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { LocalContentRepository } from '../src/content-repository.js';

test('conditional public content reads still check publication, authentication and backend failures',async()=>{
 let content=await (await LocalContentRepository.load()).getPublicContent(),reads=0,available=true;
 const token='test-conditional-content-token';
 const server=createApp({async getPublicContent(){reads++;if(!available)throw Error('private diagnostic');return content;}},{apiToken:token}).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const url=`http://127.0.0.1:${address.port}/api/v1/content`,headers={Authorization:'Bearer '+token};
 try{
  const initial=await fetch(url,{headers});assert.equal(initial.status,200);const etag=initial.headers.get('etag')!;assert.match(etag,/^"[a-f0-9]{64}"$/);await initial.body?.cancel();
  const unchanged=await fetch(url,{headers:{...headers,'If-None-Match':etag}});assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert.equal(reads,2,'An ETag never bypasses the current publication read');
  assert.equal((await fetch(url,{headers:{'If-None-Match':etag}})).status,401);assert.equal(reads,2);
  const fresh=await fetch(url,{headers:{...headers,'If-None-Match':etag,'x-roniella-fresh-content':'1'}});assert.equal(fresh.status,200);await fresh.body?.cancel();
  content=structuredClone(content);content.pages=content.pages.slice(1);
  const changed=await fetch(url,{headers:{...headers,'If-None-Match':etag}});assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),etag);assert.equal((await changed.json()).pages.length,content.pages.length);
  available=false;const failed=await fetch(url,{headers:{...headers,'If-None-Match':changed.headers.get('etag')!}});assert.equal(failed.status,500);assert.ok(!(await failed.text()).includes('private diagnostic'));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
