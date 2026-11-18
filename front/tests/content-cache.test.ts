import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LocalContentRepository } from '../../back/src/content-repository.js';
import { requestPublicContent } from '../app/server/content.server.js';

test('warm frontend reuses only backend-validated content and editors bypass conditional reads',async()=>{
 const original=globalThis.fetch,content=await (await LocalContentRepository.load()).getPublicContent();
 const etag='"'+'a'.repeat(64)+'"',calls:Headers[]=[];let mode:'initial'|'unchanged'|'updated'|'failed'='initial';
 globalThis.fetch=async(_input,init)=>{const headers=new Headers(init?.headers);calls.push(headers);if(mode==='failed')return new Response(null,{status:503});if(mode==='unchanged')return new Response(null,{status:304});return Response.json(content,{headers:{ETag:etag}});};
 try{
  const request=()=>requestPublicContent(new Request('http://localhost/tours/'));
  const initial=await request();assert.equal(calls.at(-1)!.get('If-None-Match'),null);
  mode='unchanged';assert.equal(await request(),initial);assert.equal(calls.at(-1)!.get('If-None-Match'),etag);
  mode='updated';content.notice='Updated published snapshot';const updated=await request();assert.equal(updated.notice,content.notice);assert.notEqual(updated,initial);
  await requestPublicContent(new Request('http://localhost/tours/',{headers:{Cookie:'roniella-admin=local-test'}}));assert.equal(calls.at(-1)!.get('If-None-Match'),null);assert.equal(calls.at(-1)!.get('x-roniella-fresh-content'),'1');
  mode='failed';await assert.rejects(request(),error=>error instanceof Response&&error.status===503);
 }finally{globalThis.fetch=original;}
});
