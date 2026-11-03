import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../front/.vercel/output/functions/server.func/ssg/manifest.json',import.meta.url),'utf8'));
const token='local-browser-ssg-test-token-1234567890';
const children=[];
const start=(cwd,env)=>{
  const child=spawn(process.execPath,[root+(cwd==='back'?'back/dist/server.js':'scripts/serve-vercel-output.mjs')],{cwd:root+cwd,windowsHide:true,env:{...process.env,NODE_ENV:'production',DEPLOYMENT_ENV:'local',...env},stdio:['ignore','pipe','pipe']});
  child.output=''; for(const stream of [child.stdout,child.stderr])stream.on('data',value=>child.output=(child.output+value).slice(-5000));
  children.push(child);return child;
};
const ready=async(url,child)=>{for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(child.output);try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Not ready '+child.output)};
let browser;
try{
  const api=start('back',{API_PORT:'4301',CONTENT_PROVIDER:'files',BACKEND_API_TOKEN:token});
  await ready('http://127.0.0.1:4301/ready',api);
  const web=start('front',{PORT:'4300',BACKEND_ORIGIN:'http://127.0.0.1:4301',BACKEND_API_TOKEN:token,SITE_ORIGIN:manifest.origin,ALLOW_INDEXING:manifest.noindex?'false':'true'});
  await ready('http://127.0.0.1:4300/health',web);
  assert.equal((await fetch('http://127.0.0.1:4300/')).headers.get('x-roniella-render'),'static');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const directory=new URL('../.qa/ssg-review/',import.meta.url);await mkdir(directory,{recursive:true});
  const rows=[];
  for(const javaScriptEnabled of [false,true]){
    for(const width of [390,1440]){
      const context=await browser.newContext({javaScriptEnabled,viewport:{width,height:1000}});
      const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
      for(const path of ['/','/blog/','/tours/','/blog/uzbekistan-silk-road/','/gallery/']){
        const response=await page.goto('http://127.0.0.1:4300'+path,{waitUntil:'networkidle'});
        assert.equal(response.status(),200);assert.equal(await page.locator('h1').count(),1);
        assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
        const sizes=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
        assert.ok(sizes.body<=sizes.viewport+2,'Horizontal overflow '+path);
        rows.push({path,width,javaScriptEnabled,render:response.headers()['x-roniella-render']??'dynamic',errors:[...errors]});
        if(path==='/'&&javaScriptEnabled){
          await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,70));}scrollTo(0,0)});
          await page.waitForTimeout(300);
          assert.equal(await page.locator('img').evaluateAll(images=>images.filter(image=>!image.complete||!image.naturalWidth).length),0,'Homepage photos load after scrolling');
          await page.screenshot({path:fileURLToPath(new URL('home-'+width+'.png',directory)),fullPage:true});
        }
      }
      assert.deepEqual(errors,[]);await context.close();
    }
  }
  await writeFile(new URL('report.json',directory),JSON.stringify(rows,null,2));
  console.log('PASS: static HTML path; 20 Chrome page/viewport/script-mode checks; real Hebrew content without JavaScript; one H1; RTL; no overflow or captured browser errors. Screenshots: .qa/ssg-review/.');
}finally{
  if(browser)await browser.close();
  await Promise.all(children.map(async child=>{if(child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}}));
}
