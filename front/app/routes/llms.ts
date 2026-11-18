import type { LoaderFunctionArgs } from 'react-router';
import { serverConfig } from '../server/config.server';
import { requestPublicContent } from '../server/content.server';
export async function loader({request}:LoaderFunctionArgs) {
  if (serverConfig.noindex) return new Response('Not found',{status:404});
  const content = await requestPublicContent(request);
  const pages = content.pages.filter(page=>!page.seo.noindex);
  const lines = ['# '+content.siteSettings.businessName,'','Hebrew-language guided cultural tours and travel articles.',''];
  const clean = (value:string)=>value.replace(/[\[\]\\\r\n]/g,' ').trim();
  for (const [title, group] of [
    ['Tours',pages.filter(p=>p.pageType==='tour')],
    ['Articles',pages.filter(p=>p.pageType==='article')],
    ['Site pages',pages.filter(p=>p.pageType!=='article' && p.pageType!=='tour')],
  ] as const) {
    if (!group.length) continue;
    lines.push('## '+title,'',...group.map(p=>'- ['+clean(p.displayTitle ?? p.title)+']('+serverConfig.siteOrigin+p.path+')'),'');
  }
  return new Response(lines.join('\n'),{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
