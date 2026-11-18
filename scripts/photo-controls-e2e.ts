import assert from 'node:assert/strict';
import { editorLabel } from './editor-label.js';
import type { BrowserContext, Locator, Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

export async function exercisePhotoControls(page:Page,context:BrowserContext,origin:string){
  const noSourceLinks=async()=>assert.equal(await page.locator('a[href*="drive.google.com"],a[href*="creativecommons.org"],.photo-credit').count(),0);
  const choose=async(container:Locator,label:string,file:string)=>{
    await container.getByLabel(editorLabel(label)).click();
    const picker=container.getByRole('region',{ name: editorLabel('בחירת ' + label) });
    await picker.getByText(editorLabel('Test shared folder · 75 תמונות')).waitFor();
    await picker.getByRole('button',{name:file,exact:true}).click();
    await picker.getByLabel(/Image alt text/).fill('תיאור התמונה לבדיקה');
    await picker.getByRole('button',{name:/Use photo with this description/}).click();
    await picker.waitFor({state:'hidden'});
  };
  await page.goto(origin);await page.locator('.admin-logout').waitFor();await noSourceLinks();
  const heroButton=page.getByRole('button', { name: editorLabel('עריכת תמונת הרקע') });
  for(const width of [1440,768,320]){
    await page.setViewportSize({width,height:1000});await heroButton.scrollIntoViewIfNeeded();await heroButton.click({trial:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`.qa/admin/hero-photo-control-${width}.png`});
  }
  await heroButton.click();
  const heroEditor=page.locator('dialog.admin-section-photo-editor');
  await heroEditor.getByRole('heading',{name:'תמונת פתיח דף הבית',exact:true}).waitFor();
  await choose(heroEditor,'תמונת האזור','Photo 72.jpg');
  await heroEditor.getByRole('button', { name: editorLabel('שמירת התמונה') }).click();await heroEditor.waitFor({state:'hidden'});
  await page.locator('.editorial-hero-photo>img[src*="drive-"]').waitFor();
  await page.reload();await heroButton.waitFor();await page.locator('.editorial-hero-photo>img[src*="drive-"]').waitFor();
  const heroDocument=await (await context.request.get(origin+'/admin/manage?photoSlot=home.hero')).json();
  assert.equal(heroDocument.media.find((item:{id:string})=>item.id===heroDocument.mediaId).googleDrive.fileId,'test-photo-72');
  await page.setViewportSize({width:1440,height:1000});
  const hero=await page.locator('.editorial-hero-photo>img').getAttribute('src');
  await page.locator('.editorial-approach').getByRole('button', { name: editorLabel('עריכת תמונה') }).click();
  const photoEditor=page.locator('dialog.admin-section-photo-editor');
  await photoEditor.getByLabel(editorLabel('תמונת האזור')).waitFor();
  await choose(photoEditor,'תמונת האזור','Photo 74.jpg');
  await page.keyboard.press('Escape');await photoEditor.getByRole('button', { name: editorLabel('המשך עריכה') }).click();
  await page.setViewportSize({width:320,height:844});assert.ok(await photoEditor.evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations,[]);
  await page.screenshot({path:'.qa/admin/section-photo-mobile.png'});
  await photoEditor.getByRole('button', { name: editorLabel('שמירת התמונה') }).click();await photoEditor.waitFor({state:'hidden'});
  await page.locator('.editorial-approach>figure>img[src*="drive-"]').waitFor();
  const approach=(await (await context.request.get(origin+'/admin/manage?photoSlot=home.approach')).json());
  assert.match(approach.mediaId,/^drive-[a-f0-9]{32}$/);assert.equal(await page.locator('.editorial-hero-photo>img').getAttribute('src'),hero);
  await page.reload();await page.locator('.admin-logout').waitFor();await page.locator('.editorial-approach>figure>img[src*="drive-"]').waitFor();await noSourceLinks();
  // Optimistic revision protects one editor from silently replacing another editor's selection.
  const save=()=>context.request.post(origin+'/admin/manage',{headers:{Origin:origin},data:{operation:'save_photo',slot:'home.approach',mediaId:approach.mediaId,expectedRevision:approach.revision}});
  assert.equal((await save()).status(),200);assert.equal((await save()).status(),409);
  assert.equal((await context.request.get(origin+'/admin/manage?photoSlot=unknown')).status(),400);
  assert.equal((await context.request.post(origin+'/admin/manage',{headers:{Origin:'https://evil.invalid'},data:{operation:'save_photo',slot:'home.approach',mediaId:null,expectedRevision:'0'}})).status(),403);

  await page.setViewportSize({width:1440,height:1000});
  const homeGuide=page.locator('.editorial-person').nth(1),name=await homeGuide.locator('h3').innerText();
  await homeGuide.getByRole('button', { name: editorLabel('עריכת איש הצוות והתמונה') }).click();
  const workspace=page.locator('dialog.admin-workspace');
  const profile=workspace.locator('section.admin-block-editor').filter({has:page.getByRole('textbox',{name:editorLabel('שם המדריך או המדריכה')})}).nth(1);
  await profile.getByLabel(editorLabel('שם המדריך או המדריכה')).waitFor();assert.equal(await profile.getByLabel(editorLabel('שם המדריך או המדריכה')).inputValue(),name);
  const slotBefore=(await (await context.request.get(origin+'/admin/manage?photoSlot=home.approach')).json()).mediaId;
  await choose(profile,'תמונת איש הצוות','Photo 73.jpg');
  await page.setViewportSize({width:320,height:844});assert.ok(await workspace.evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  await page.screenshot({path:'.qa/admin/guide-photo-mobile.png'});
  await workspace.getByRole('button', { name: editorLabel('שמירת תוכן העמוד') }).click();await workspace.getByText(editorLabel('השינויים נשמרו.')).waitFor();
  await workspace.getByRole('button', { name: editorLabel('סגירה ×') }).click();
  const portrait=homeGuide.locator('.guide-portrait>img');await portrait.waitFor();
  const src=await portrait.getAttribute('src');assert.match(src!,/\/media\/drive-/);
  assert.equal((await (await context.request.get(origin+'/admin/manage?photoSlot=home.approach')).json()).mediaId,slotBefore);
  await portrait.scrollIntoViewIfNeeded();assert.ok(await portrait.evaluate(img=>img.clientWidth>0&&img.clientHeight===img.clientWidth));
  await page.setViewportSize({width:1440,height:1000});await homeGuide.screenshot({path:'.qa/admin/guide-photo-home.png'});
  await page.goto(origin+'/guides/');await page.locator('.admin-logout').waitFor();
  const guide=page.locator('.guide-card').filter({has:page.getByRole('heading',{name,exact:true})});
  await guide.locator('.guide-portrait>img').waitFor();assert.equal(await guide.locator('.guide-portrait>img').getAttribute('src'),src);
  assert.equal(await guide.locator('.guide-portrait').count(),1);await noSourceLinks();
  await guide.scrollIntoViewIfNeeded();await guide.screenshot({path:'.qa/admin/guide-photo-profile.png'});
  await guide.getByRole('button', { name: editorLabel('עריכת איש הצוות והתמונה') }).click();
  const second=workspace.locator('section.admin-block-editor').filter({has:page.getByRole('textbox',{name:editorLabel('שם המדריך או המדריכה')})}).nth(1);
  await second.getByRole('button', { name: editorLabel('הסרת התמונה') }).click();
  await workspace.getByRole('button', { name: editorLabel('שמירת תוכן העמוד') }).click();await workspace.getByText(editorLabel('השינויים נשמרו.')).waitFor();
  await workspace.getByRole('button', { name: editorLabel('סגירה ×') }).click();await guide.locator('.guide-monogram').waitFor();
  await page.goto(origin);await page.locator('.editorial-person').nth(1).locator('.person-initials').waitFor();
  console.log('PASS: reachable desktop/tablet/mobile hero photo control and Drive save/reload; contextual section-photo save/reload, independent photo assignments, conflict and CSRF rejection; Drive guide portrait shared by home and guides; portrait removal; public source links absent; mobile dialog accessibility. No hosted edits.');
}
