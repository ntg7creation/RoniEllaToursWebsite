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
import { selectGalleryPhotos } from "../server/gallery.server";
import { buildPageSeo } from "../server/seo.server";
import { Breadcrumbs, SiteLayout } from "../components/layout";
import { ArchivePageContent } from "../components/archive-content";
import { ErrorPage } from "../components/error-page";
import { SiteContentProvider } from "../components/site-content-context";
import { generatedPageMiddleware, publicContentContext } from "../server/generated-pages.server";
import {callbackCountries} from "@roniella/shared/callback";

export const middleware = [generatedPageMiddleware];
export {callbackAction as action} from "../server/callback.server";

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const content = structuredClone(context.get(publicContentContext));
  const location = archiveRedirectLocation(url, content.redirects);
  if (location) throw redirect(location, 301);
  if (["p", "page_id", "post_type"].some((key) => url.searchParams.has(key)))
    throw new Response("Not found", { status: 404 });
  const page = content.pages.find(
    (page) => page.path === normalizePath(url.pathname),
  );
  if (!page) throw new Response("Not found", { status: 404 });
  if (url.pathname !== page.path)
    throw redirect(`${page.path}${url.search}`, 301);
  const totalGalleryPhotos = content.gallery?.photos.length ?? 0;
  if (content.gallery) content.gallery = {
    ...content.gallery,
    photos: page.pageType === "gallery"
      ? selectGalleryPhotos(content.gallery.photos, content.gallery.displayCount)
      : [],
  };
  return data(
    {
      content,
      page,
      canonical: absoluteUrl(page.seo.canonicalPath, serverConfig.siteOrigin),
      seo: buildPageSeo(page, content, serverConfig.siteOrigin),
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
    { title: loaded.page.seo.title },
    { name: "description", content: loaded.seo.description },
    { tagName: "link", rel: "canonical", href: loaded.canonical },
    {
      name: "robots",
      content: loaded.noindex ? "noindex, nofollow" : "index, follow",
    },
    { property: "og:type", content: loaded.page.pageType === "article" ? "article" : "website" },
    { property: "og:title", content: loaded.page.seo.title },
    { property: "og:description", content: loaded.seo.description },
    { property: "og:url", content: loaded.canonical },
    { property: "og:site_name", content: loaded.content.siteSettings.businessName },
    { property: "og:locale", content: "he_IL" },
    ...(loaded.content.presentation["seo.googleVerification"] ? [{name:"google-site-verification",content:loaded.content.presentation["seo.googleVerification"]}] : []),
    ...(loaded.page.author ? [{name:"author",content:loaded.page.author.name}] : []),
    ...(loaded.seo.articleDates?.published ? [{property:"article:published_time",content:loaded.seo.articleDates.published}] : []),
    ...(loaded.seo.articleDates?.modified ? [{property:"article:modified_time",content:loaded.seo.articleDates.modified}] : []),
    { name: "twitter:card", content: loaded.seo.image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: loaded.page.seo.title },
    { name: "twitter:description", content: loaded.seo.description },
    ...(loaded.seo.image ? [
      { property: "og:image", content: loaded.seo.image.url },
      { property: "og:image:alt", content: loaded.seo.image.alt },
      { property: "og:image:width", content: String(loaded.seo.image.width) },
      { property: "og:image:height", content: String(loaded.seo.image.height) },
      ...(/\.jpe?g$/i.test(new URL(loaded.seo.image.url).pathname) ? [{property:"og:image:type",content:"image/jpeg"}] : []),
      { name: "twitter:image", content: loaded.seo.image.url },
      { name: "twitter:image:alt", content: loaded.seo.image.alt },
    ] : []),
    { "script:ld+json": loaded.seo.structuredData },
  ];
};
export default function ContentRoute() {
  const { content, page, totalGalleryPhotos, seo } = useLoaderData<typeof loader>();
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
      <ArchivePageContent page={page} content={content} totalGalleryPhotos={totalGalleryPhotos} />
    </SiteLayout></SiteContentProvider>
  );
}
export const ErrorBoundary = ErrorPage;
