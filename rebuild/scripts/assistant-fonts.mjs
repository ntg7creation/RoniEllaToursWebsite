// Optional acquisition of the Hebrew/Latin Assistant variable faces; no runtime network calls.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = new URL('../frontend/public/assets/fonts/',import.meta.url);
await mkdir(directory,{recursive:true});
const source='https://fonts.googleapis.com/css2?family=Assistant:wght@400..700&display=swap';
const get=async url=>{
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Font acquisition HTTP ${response.status}`);
  return response;
};
let css=await(await get(source)).text();
const records=[];
for(const match of [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)]){
  const filename=`assistant-${records.length+1}.woff2`;
  const bytes=Buffer.from(await(await get(match[1])).arrayBuffer());
  await writeFile(new URL(filename,directory),bytes);
  records.push({file:filename,source:match[1],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  css=css.replaceAll(match[1],`/assets/fonts/${filename}`);
}
await writeFile(new URL('assistant.css',directory),css);
const license='https://raw.githubusercontent.com/google/fonts/main/ofl/assistant/OFL.txt';
await writeFile(new URL('assistant-OFL.txt',directory),await(await get(license)).text());
await writeFile(new URL('assistant-provenance.json',directory),JSON.stringify({source,license,assets:records},null,2)+'\n');
console.log(`Saved ${records.length} local Assistant font subsets and OFL license.`);
