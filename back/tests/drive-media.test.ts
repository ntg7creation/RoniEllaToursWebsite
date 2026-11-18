import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { LocalContentRepository } from '../src/content-repository.js';
import { registeredMedia } from '../src/runtime-content.js';
import { createApp } from '../src/app.js';
test('Drive references register and redirect without a local photo file or folder scan', async()=>{
 const content=structuredClone(await(await LocalContentRepository.load()).getPublicContent());
 const id='drive-'+'a'.repeat(32),src=`/media/${id}-1600.jpg`;
 const googleDrive={folderUrl:'https://drive.google.com/drive/folders/publicFolder',fileId:'publicPhoto',fileUrl:'https://drive.google.com/file/d/publicPhoto/view'};
 content.media.push({...content.media[0]!,id,src,googleDrive,variants:[{src,width:1200}]});
 const files=await registeredMedia(content,new URL('../content/media/',import.meta.url));
 assert.deepEqual(files.get(`${id}-1600.jpg`)?.googleDrive,googleDrive);
 const app=createApp({getPublicContent:async()=>content,getMedia:async filename=>files.get(filename)}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try { const address=server.address() as {port:number};const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/media/${id}-1600.jpg`,{redirect:'manual'});assert.equal(response.status,307);assert.equal(response.headers.get('location'),'https://drive.google.com/thumbnail?id=publicPhoto&sz=w1600'); }
 finally { server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
