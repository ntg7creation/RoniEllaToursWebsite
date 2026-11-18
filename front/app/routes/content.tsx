import {
  data,
  redirect,
  useLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { absoluteUrl, normalizePath } from "@roniella/shared";
import { archiveRedirectLocation } from "@roniella/shared/archive-urls";
import { serverConfig } from "../server/config.server";
import { pageView } from "../server/page-view.server";
import { buildPageSeo } from "../server/seo.server";
import { Breadcrumbs, SiteLayout } from "../components/layout";
import { ArchivePageContent } from "../components/archive-content";
import { ErrorPage } from "../components/error-page";
import { SiteContentProvider } from "../components/site-content-context";
import { generatedPageMiddleware, publicContentContext } from "../server/generated-pages.server";
import {callbackCountries} from "@roniella/shared/callback";
import { AdminEditButton, AdminManageButton, EditingPageProvider, BlockPositions } from "../components/admin-context";

export const middleware = [generatedPageMiddleware];
export {callbackAction as action} from "../server/callback.server";

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const snapshot = context.get(publicContentContext);
  const location = archiveRedirectLocation(url, snapshot.redirects);
  if (location) throw redirect(location, 301);
  if (["p", "page_id", "post_type", "cat"].some((key) => url.searchParams.has(key)))
    throw new Response("Not found", { status: 404 });
  const original = snapshot.pages.find(
    (page) => page.path === normalizePath(url.pathname),
  );
  if (!original) throw new Response("Not found", { status: 404 });
  if (url.pathname !== original.path) throw redirect(original.path + url.search, 301);
  const { page, content, positions } = pageView(snapshot, original);
  const totalGalleryPhotos = snapshot.gallery?.photos.length ?? 0;
  return data(
    {
      content,
      page,
      positions,
      canonical: absoluteUrl(page.seo.canonicalPath, serverConfig.siteOrigin),
      seo: buildPageSeo(page, content, serverConfig.siteOrigin, serverConfig.noindex),
      noindex: serverConfig.noindex,
      totalGalleryPhotos,
      callbackCountries:callbackCountries(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export const meta: MetaFunction<typeof loader> = ({
  loaderData: loaded,
  error,
}) => {
  if (!loaded)
    return [
      {
        title:
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 404
            ? "העמוד לא נמצא | Roniella Tours"
            : "התוכן אינו זמין כרגע | Roniella Tours",
      },
      { name: "robots", content: "noindex, nofollow" },
    ];
  return [
    ...loaded.seo.tags.filter(row => row.value).map(row => {
      if (row.element === 'title') return { title: row.value };
      if (row.element === 'link') return { tagName: 'link' as const, rel: row.key, href: row.value };
      return row.attribute === 'name' ? { name: row.key, content: row.value } : { property: row.key, content: row.value };
    }),
    { "script:ld+json": loaded.seo.structuredData },
  ];
};
export default function ContentRoute() {
  const { content, page, positions, totalGalleryPhotos, seo } = useLoaderData<typeof loader>();
  const parent = seo.breadcrumbs.length > 2 ? seo.breadcrumbs[1] : undefined;
  const terms = content.pages.find(p => p.pageType === "terms");
  return (
    <SiteContentProvider content={content}><SiteLayout
      settings={content.siteSettings}
      notice={content.notice}
      editorial
      presentation={content.presentation}
      additionalFooterLinks={terms ? [{path:terms.path,label:terms.title}] : []}
    >
      {page.path !== "/" && (
        <Breadcrumbs
          title={seo.breadcrumbs.at(-1)!.title}
          parent={parent}
        />
      )}
      <div className="admin-page-tools">
        <AdminEditButton scope="page" contentKey={page.id}>עריכת העמוד / Edit page text</AdminEditButton>
        <AdminManageButton pageId={page.id} />
        <AdminManageButton pageId={page.id} mode="settings">עריכת פרטים ותמונה / Edit page details and image</AdminManageButton>
        <AdminManageButton pageId={page.id} mode="seo">עריכת SEO ותוויות / Edit SEO and topics</AdminManageButton>
        {page.pageType === 'tour' && <AdminEditButton scope="trip" contentKey={page.id}>עריכת פרטי הטיול / Edit tour details and dates</AdminEditButton>}
        {page.pageType === 'tour' && <AdminManageButton pageId={page.id} mode="itinerary">עריכת ימי המסלול / Edit itinerary days</AdminManageButton>}
        <AdminManageButton />
        <AdminManageButton collection="destinationArchive">ניהול יעדים / Manage destinations</AdminManageButton>
        <AdminManageButton collection="article">ניהול מאמרים / Manage articles</AdminManageButton>
        {page.cards.length > 0 && <AdminManageButton collection={page.pageType === 'blog' || ['categoryArchive', 'authorArchive'].includes(page.pageType) ? 'article' : 'tour'}>עריכת פרטי הכרטיסים / Edit listing cards</AdminManageButton>}
        {page.videos.length > 0 && <AdminEditButton scope="videos" contentKey={page.id}>עריכת טקסטי הסרטונים / Edit video descriptions</AdminEditButton>}
        <AdminEditButton scope="copy_all" contentKey="all">טקסטים נוספים באתר / Edit site-wide copy</AdminEditButton>
        <AdminEditButton scope="navigation" contentKey="all">עריכת התפריטים / Edit navigation labels</AdminEditButton>
      </div>
      <EditingPageProvider value={page}><BlockPositions.Provider value={positions}><ArchivePageContent page={page} content={content} totalGalleryPhotos={totalGalleryPhotos} /></BlockPositions.Provider></EditingPageProvider>
    </SiteLayout></SiteContentProvider>
  );
}
export const ErrorBoundary = ErrorPage;
