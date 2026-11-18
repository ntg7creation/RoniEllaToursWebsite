import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {launchProduction} from './processes.mjs';
const servers=launchProduction({webPort:4800,apiPort:4801});
// axe cannot evaluate the layered hero background. Hide text without changing
// layout, then conservatively measure every background pixel in each text box.
// This checks the current photograph, font and CSS at the tested viewports.
const output=new URL('../.qa/accessibility-audit/',import.meta.url),results=[];
let browser;
try {
  await mkdir(output,{recursive:true});await servers.ready();
  browser=await chromium.launch({channel:'chrome',headless:true});
  const decoder=await browser.newPage();
  for(const width of [1440,390,320]){
    const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
    await page.goto(servers.origin,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const selectors=['.editorial-hero-copy > .editorial-kicker','.editorial-hero-copy h1','.editorial-hero-copy .editorial-hero-description'];
    const elements=await page.evaluate(selectors=>selectors.map(selector=>{
      const el=document.querySelector(selector),rect=el.getBoundingClientRect(),style=getComputedStyle(el);
      return{selector,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,color:style.color,requiredRatio:el.tagName==='H1'?3:4.5};
    }),selectors);
    await page.evaluate(selectors=>selectors.forEach(selector=>document.querySelector(selector).style.visibility='hidden'),selectors);
    const png=await page.screenshot({fullPage:true});
    const samples=await decoder.evaluate(async({source,elements})=>{
      const image=new Image();image.src=source;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,image.width,image.height).data;
      const luminance=rgb=>rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
      return elements.map(element=>{
        const foreground=luminance(element.color.match(/[\d.]+/g).slice(0,3).map(Number));let minimum=Infinity;
        for(let y=Math.max(0,Math.ceil(element.top));y<Math.min(image.height,element.bottom);y++)for(let x=Math.max(0,Math.ceil(element.left));x<Math.min(image.width,element.right);x++){
          const index=(y*image.width+x)*4,background=luminance([...pixels.slice(index,index+3)]);
          minimum=Math.min(minimum,(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05));
        }
        return{...element,minimumContrastAcrossFullRectangle:minimum};
      });
    },{source:'data:image/png;base64,'+png.toString('base64'),elements});
    results.push({width,samples});await page.close();
  }
  await writeFile(new URL('image-background-contrast.json',output),JSON.stringify({note:'Conservative sample: every pixel in the text bounding rectangle after hiding text, preserving the actual image/gradient. Local Chrome only.',results},null,2)+'\n');
  console.log(JSON.stringify(results.map(({width,samples})=>({width,samples:samples.map(({selector,minimumContrastAcrossFullRectangle})=>({selector,ratio:minimumContrastAcrossFullRectangle.toFixed(2)}))})),null,2));
  for(const {width,samples} of results)for(const sample of samples){
    assert.ok(Number.isFinite(sample.minimumContrastAcrossFullRectangle));
    assert.ok(sample.minimumContrastAcrossFullRectangle>=sample.requiredRatio,`${sample.selector} at ${width}px: ${sample.minimumContrastAcrossFullRectangle.toFixed(2)} < ${sample.requiredRatio}`);
  }
  console.log('PASS: hero text contrast across the actual image/gradient at 1440/390/320px. This is targeted evidence, not a complete visual or conformance evaluation.');
}finally{await browser?.close();await servers.stop();}
