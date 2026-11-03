import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {launchProduction} from "./processes.mjs";
const servers=launchProduction({webPort:4400,apiPort:4401});
const output=new URL("../.qa/callback-review/",import.meta.url);
await mkdir(output,{recursive:true});
let browser;
const measurements=[];
try{
  await servers.ready();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [390,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(servers.origin,{waitUntil:'networkidle'});
    const contact=page.locator('.editorial-contact');
    assert.equal(await contact.getByRole('link',{name:/לשיחה בוואטסאפ/}).getAttribute('href'),'https://wa.me/972505202480');
    assert.equal(await contact.locator('a[href="tel:0733744686"]').count(),1);
    assert.equal(await contact.locator('a[href="https://www.facebook.com/ronitoursancientworld/"]').count(),1);
    assert.equal(await contact.locator('a[href="https://www.youtube.com/@roniellatours1400"]').count(),1);
    assert.equal(await page.getByLabel('מדינה',{exact:true}).inputValue(),'IL');
    assert.equal(await page.locator('[name="privacyAccepted"]').isChecked(),false);
    await contact.screenshot({path:fileURLToPath(new URL(`contact-${width}.png`,output))});
    await page.getByLabel(/שם מלא/).fill('בדיקת טופס מקומית');
    await page.getByLabel(/מספר טלפון לחזרה/).fill('123');
    await page.getByLabel(/איזה יעד/).selectOption('undecided');
    await page.getByRole('button',{name:/שליחת הפרטים/}).click();
    await page.getByText('נא להזין מספר טלפון תקין',{exact:false}).waitFor();
    assert.ok(await page.getByText('כדי שנוכל לחזור אליכם',{exact:false}).isVisible());
    await page.getByLabel('מדינה',{exact:true}).selectOption('US');
    await page.getByLabel(/מספר טלפון לחזרה/).fill('202555012');
    await page.locator('[name="privacyAccepted"]').check();
    await page.getByRole('button',{name:/שליחת הפרטים/}).click();
    await page.getByText('נא לבדוק את אורך המספר',{exact:false}).waitFor();
    await page.getByLabel('מדינה',{exact:true}).selectOption('IL');
    await page.getByLabel(/מספר טלפון לחזרה/).fill('0505202480');
    await page.getByLabel(/כתובת דוא/).fill('person@gmial.com');
    await page.getByRole('button',{name:/שליחת הפרטים/}).click();
    await page.getByText('האם התכוונתם',{exact:false}).waitFor();
    await page.getByLabel(/כתובת דוא/).fill('');
    await page.getByRole('button',{name:/שליחת הפרטים/}).click();
    try{await page.getByRole('heading',{name:'תודה, קיבלנו את הפרטים!'}).waitFor({timeout:10000});}
    catch(error){console.log('Form diagnostic:',(await page.locator('.callback-card').textContent({timeout:1000})).slice(-800));console.log('Server diagnostic:',servers.logs());await page.screenshot({path:fileURLToPath(new URL('failure.png',output)),fullPage:true});throw error;}
    const sizes=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(sizes.width<=sizes.viewport+2);
    assert.deepEqual(errors,[]);measurements.push({width,javaScript:true,errors,...sizes});
    await context.close();
  }
  const context=await browser.newContext({javaScriptEnabled:false}),page=await context.newPage();
  await page.goto(servers.origin+'/contact/');
  await page.getByLabel(/שם מלא/).fill('בדיקה ללא סקריפטים');
  await page.getByLabel(/מספר טלפון לחזרה/).fill('123');
  await page.getByLabel(/איזה יעד/).selectOption('undecided');
  await page.getByRole('button',{name:/שליחת הפרטים/}).click();
  assert.ok(await page.getByText('נא להזין מספר טלפון תקין',{exact:false}).isVisible());
  assert.equal(await page.getByLabel(/שם מלא/).inputValue(),'בדיקה ללא סקריפטים');
  await page.getByLabel(/מספר טלפון לחזרה/).fill('0505202480');
  await page.locator('[name="privacyAccepted"]').check();
  await page.getByRole('button',{name:/שליחת הפרטים/}).click();
  await page.getByRole('heading',{name:'תודה, קיבלנו את הפרטים!'}).waitFor();
  const privacy=await page.goto(servers.origin+'/privacy/');assert.equal(privacy.status(),200);
  assert.ok(await page.getByRole('heading',{name:'בקשות לשיחה חוזרת באתר'}).isVisible());
  measurements.push({javaScript:false,serverValidation:true,valuesPreserved:true,success:true,privacy:true});
  await context.close();
  await writeFile(new URL('report.json',output),JSON.stringify(measurements,null,2)+'\n');
  console.log('PASS: desktop/mobile WhatsApp, phone and social links; default Israel/changeable country; invalid number length, email typo and missing consent blocked; saved callbacks with and without JS; accessible privacy page; no overflow/page errors. Local test requests only.');
}finally{if(browser)await browser.close();await servers.stop();}
