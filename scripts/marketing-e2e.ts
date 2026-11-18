import assert from 'node:assert/strict';
import type { Page, BrowserContext } from 'playwright';

export async function exerciseMarketing(page:Page, context:BrowserContext, origin:string) {
  await page.goto(origin+'/tours/uzbekistan-march-2027/');
  const dialog=page.locator('dialog.admin-workspace');
  const schedule=()=>page.getByRole('button',{name:/^עריכת פרטי הטיול \/ Edit tour details/}).click();
  const save=async()=>{
    await dialog.getByRole('button',{name:/Save changes/}).click();
    await dialog.getByText(/השינויים נשמרו\./).waitFor();
  };
  const close=()=>dialog.getByRole('button',{name:/Close$/}).click();
  const days=page.locator('#journy .day-card');
  assert.equal(await days.count(),9);
  const original=await days.nth(8).locator('p').allTextContents();
  await schedule(); assert.ok(await dialog.getByLabel(/Match itinerary days/).isChecked());
  await dialog.getByLabel(/End date/).fill('2027-03-21'); await save(); await close();
  await page.reload(); assert.equal(await days.count(),7);
  await schedule(); await dialog.getByLabel(/End date/).fill('2027-03-25'); await save(); await close();
  await page.reload(); assert.equal(await days.count(),11);
  assert.deepEqual(await days.nth(8).locator('p').allTextContents(),original);
  assert.match(await days.nth(10).innerText(),/יום 11/);
  await page.getByRole('button',{name:/^עריכת ימי המסלול/}).click();
  await dialog.getByLabel(/Day heading/).nth(10).fill('Restored itinerary test day');
  await save(); await close();
  await schedule(); await dialog.getByLabel(/End date/).fill('2027-03-21'); await save(); await close();
  const html=await (await context.request.get(page.url())).text();
  assert.ok(!html.includes('Restored itinerary test day'));
  await schedule(); await dialog.getByLabel(/Match itinerary days/).uncheck(); await save(); await close();
  await page.reload(); assert.equal(await days.count(),11);
  await page.getByRole('heading',{name:'Restored itinerary test day'}).waitFor();
  await page.getByRole('button',{name:/Edit SEO and topics/}).click();
  const table=dialog.locator('.admin-seo-table'); await table.waitFor();
  assert.equal(await table.locator('thead th').count(),3);
  await table.getByLabel(/Search description/).fill('A journey along the Silk Road.');
  await table.getByLabel(/Topics, separated by commas/).fill('Samarkand, Silk Road');
  await page.setViewportSize({width:320,height:840});
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await save(); await close();
  const output=await (await context.request.get(page.url())).text();
  assert.match(output,/name="description" content="A journey along the Silk Road\."/);
  assert.match(output,/property="og:description" content="A journey along the Silk Road\."/);
  assert.match(output,/"keywords":\["Samarkand","Silk Road"\]/);
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS: tour dates, saved hidden days, blank templates, manual override and bilingual SEO table through the browser and PostgreSQL.');
}
