import assert from 'node:assert/strict';
import {test} from 'node:test';
import { LocalContentRepository } from '../../back/src/content-repository.js';
import { archiveRedirectLocation } from '@roniella/shared/archive-urls';
import { itineraryDayCount } from '@roniella/shared/tour-schedule';
import { editableSections, scheduledBlocks } from '../app/components/editor-sections.js';
import { pageView } from '../app/server/page-view.server.js';
import { buildPageSeo } from '../app/server/seo.server.js';

test('tour cards, itineraries and prices use the reviewed departures while the Google gallery stays independent', async () => {
  const site = await (await LocalContentRepository.load()).getPublicContent();
  const tours = site.pages.filter(page => page.pageType === 'tour');
  assert.equal(tours.length, 6);
  for (const tour of tours) {
    const details = tour.tourDetails!;
    const days = editableSections(pageView(site, tour).page.blocks, 'itinerary');
    assert.equal(days.length, itineraryDayCount(details.dates, details.duration));
    if (tour.path.includes('china-')) assert.equal(days.at(-1)!.end - days.at(-1)!.start, 1);
  }
  const april = tours.find(page => page.path.includes('april'))!;
  assert.equal(april.tourDetails!.dates, '05/04/2027 - 13/04/2027');
  assert.ok(april.blocks.some(block => 'text' in block && block.text.includes('05/04/2027 – 13/04/2027')));
  assert.equal(site.siteSettings.featuredTourIds.length, 3);
  assert.equal(site.pages.find(p => p.path === '/testimonials/')!.blocks.filter(b => b.type === 'image').length, 3);
  assert.equal(tours.find(p => p.path.includes('greece'))!.tourDetails!.dates, '');
  assert.equal(site.gallery!.photos.length, 123);
});

test('verified WordPress query forms reach the final English URL in one redirect',async()=>{
  const site = await (await LocalContentRepository.load()).getPublicContent();
  const go = (path:string)=>archiveRedirectLocation(new URL(path,'https://roniellatours.com'),site.redirects);
  for (const [path,expected] of Object.entries({
    '/?page_id=48&utm_source=partner':'/contact/?utm_source=partner',
    '/index.php?p=6032&post_type=trips&utm_campaign=tours':'/tours/china-may-2027/?utm_campaign=tours',
    '/?p=6':'/', '/?page_id=9':'/blog/', '/?post_type=trips':'/tours/', '/?page_id=3167':'/thank-you/',
  })) assert.equal(go(path),expected);
  assert.equal(go('/?p=999999&post_type=trips'),null);
  assert.equal(go('/?p=9&page_id=48'),null);
});

test('inclusive date ranges, legacy RTL dates and tentative durations',()=>{
  for (const [dates,duration,expected] of [
    ['2028-02-28 - 2028-03-01','',3],['01/04/2028 – 01/04/2028','7',1],
    ['23/03/2027 - 15/03/2027','1',9], ['','7 ימים',7],['TBC','7 days',7],
    ['25/10/2027 - 17/10/2025','9 ימים',9], ['2027-02-30 - 2027-03-03','',null],
  ] as const) assert.equal(itineraryDayCount(dates,duration),expected);
});

test('shortening hides authored days from visitors and schema, extending restores them before blank templates',async()=>{
  const site = await (await LocalContentRepository.load()).getPublicContent();
  const tour = site.pages.find(p=>p.path==='/tours/uzbekistan-march-2027/')!;
  const original = structuredClone(tour.blocks);
  const count = (blocks: typeof original)=>editableSections(blocks,'itinerary').length;
  const custom = {...tour,tourDetails:{dates:'2027-03-15 - 2027-03-21',duration:'',summary:'',price:'',guide:'',status:''}};
  const {page,content,positions} = pageView(site,custom);
  assert.equal(count(page.blocks),7);
  assert.equal(count(scheduledBlocks(tour.blocks,7,true)),9);
  assert.deepEqual(positions?.map(i=>tour.blocks[i]),page.blocks);
  const extended = scheduledBlocks(tour.blocks,11);
  assert.equal(count(extended),11);
  assert.deepEqual(extended.filter(b=>original.some(o=>JSON.stringify(o)===JSON.stringify(b))),original);
  const last = editableSections(extended,'itinerary').at(-1)!;
  assert.equal(last.heading.text,'יום 11'); assert.equal(last.end-last.start,1);
  assert.equal(count(pageView(site,{...custom,syncItinerary:false}).page.blocks),9);
  assert.deepEqual(tour.blocks,original);
  const graph = buildPageSeo(page,content,'https://roniellatours.com').structuredData['@graph'];
  const trip = graph.find(n=>n['@type']==='TouristTrip')!;
  assert.equal((trip.itinerary as {numberOfItems:number}).numberOfItems,7);
});
