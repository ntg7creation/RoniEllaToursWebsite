import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DriveFolderUrlSchema, PublicDriveFolderReader, parsePublicDriveFolder, orderDrivePhotos, fetchDriveImage } from '../src/google-drive.js';
const folderUrl='https://drive.google.com/drive/folders/publicFolder';
function fixture() {
 const row=Array(11).fill(null); row[0]='photo-one'; row[1]=['publicFolder']; row[2]='A photo.jpg'; row[3]='image/jpeg'; row[9]=Date.UTC(2026,10,8); row[10]=Date.UTC(2026,10,7);
 return `<title>Public folder – Google Drive</title><script>window['_DRIVE_ivd'] = '${JSON.stringify([[row],null]).replaceAll('"','\\x22')}';</script><script>throw new Error('never execute')</script>`;
}
test('public folder reads retain stable file IDs, names and upload dates without evaluating scripts',()=>{
 const folder=parsePublicDriveFolder(fixture(),folderUrl); assert.equal(folder.title,'Public folder'); assert.equal(folder.photos[0]!.sourceId,'photo-one'); assert.equal(folder.photos[0]!.addedAt,'2026-11-08T00:00:00.000Z');
 assert.throws(()=>parsePublicDriveFolder('<html>Sign in</html>',folderUrl),/unavailable/);
 assert.throws(()=>parsePublicDriveFolder(fixture(),folderUrl.replace('publicFolder','differentFolder')),/Unrecognized/);
 for(const url of ['http://drive.google.com/drive/folders/a','https://evil.test/drive/folders/a','https://drive.google.com@localhost/drive/folders/a',folderUrl+'\n']) assert.equal(DriveFolderUrlSchema.safeParse(url).success,false);
 assert.equal(DriveFolderUrlSchema.parse(folderUrl+'?usp=sharing'),folderUrl);
});
test('folder refresh coalesces reads, expires briefly and rejects oversized or redirected pages',async()=>{
 let calls=0,now=0; const reader=new PublicDriveFolderReader(async()=>{calls++;return new Response(fixture(),{headers:{'Content-Type':'text/html'}});},()=>now);
 await Promise.all([reader.read(folderUrl),reader.read(folderUrl)]); assert.equal(calls,1); await reader.read(folderUrl);assert.equal(calls,1);
 now=60001;await reader.read(folderUrl);assert.equal(calls,2);await reader.read(folderUrl,true);assert.equal(calls,3);
 await assert.rejects(new PublicDriveFolderReader(async()=>new Response('x'.repeat(8000001),{headers:{'Content-Type':'text/html'}})).read(folderUrl),/too large/);
});
test('Drive sorting is stable, places missing dates last and never fabricates photo dates',()=>{
 const photos=[{position:0,name:'B',addedAt:'2026-01-01'},{position:1,name:'C'},{position:2,name:'A',addedAt:'2026-02-01'}];
 assert.deepEqual(orderDrivePhotos(photos,'added-newest').map(p=>p.position),[2,0,1]);assert.deepEqual(orderDrivePhotos(photos,'name').map(p=>p.position),[2,0,1]);assert.deepEqual(orderDrivePhotos(photos,'album').map(p=>p.position),[0,1,2]);
});
test('image delivery accepts only Drive/Google image hosts and carries no credentials across redirects',async()=>{
 let calls=0;const image=await fetchDriveImage('https://drive.google.com/thumbnail?id=photo-one&sz=w1600',undefined,async(_input,init)=>{
  assert.equal(new Headers(init?.headers).has('authorization'),false);assert.equal(new Headers(init?.headers).has('cookie'),false);
  return ++calls===1?new Response(null,{status:302,headers:{Location:'https://lh3.googleusercontent.com/drive-storage/image=s1600'}}):new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}});
 });assert.equal(image.bytes.length,3);assert.equal(calls,2);
 await assert.rejects(fetchDriveImage('http://localhost/private'));
 await assert.rejects(fetchDriveImage('https://drive.google.com/thumbnail?id=photo&sz=w1600',undefined,async()=>new Response(null,{status:302,headers:{Location:'https://evil.test/image'}})),/host/);
});
