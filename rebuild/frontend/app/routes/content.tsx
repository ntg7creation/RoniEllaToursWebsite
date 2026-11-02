import {
  data,
  redirect,
  useLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { absoluteUrl, normalizePath, paths } from "@roniella/shared";
import { archiveRedirectLocation } from "@roniella/shared/archive-urls";
import { requestPublicContent } from "../server/content.server";
import { serverConfig } from "../server/config.server";
import { selectGalleryPhotos } from "../server/gallery.server";
import { Breadcrumbs, SiteLayout } from "../components/layout";
import { ArchivePageContent } from "../components/archive-content";
import { ErrorPage } from "../components/error-page";
import { SiteContentProvider } from "../components/site-content-context";
import {
  displayHeading,
  isEditorialPage,
} from "../components/editorial-config";

export async function loader({ request, url }: LoaderFunctionArgs) {
  const content = await requestPublicContent(request);
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
      noindex: serverConfig.noindex,
      totalGalleryPhotos,
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
    ...(loaded.page.seo.description
      ? [{ name: "description", content: loaded.page.seo.description }]
      : []),
    { tagName: "link", rel: "canonical", href: loaded.canonical },
    {
      name: "robots",
      content: loaded.noindex ? "noindex, nofollow" : "index, follow",
    },
  ];
};
export default function ContentRoute() {
  const { content, page, totalGalleryPhotos } = useLoaderData<typeof loader>();
  const parent =
    page.pageType === "tour"
      ? { title: "הטיולים שלנו", path: paths.tours }
      : page.pageType === "article"
        ? { title: "בלוג", path: paths.blog }
        : undefined;
  return (
    <SiteContentProvider content={content}><SiteLayout
      settings={content.siteSettings}
      notice={content.notice}
      editorial
      presentation={content.presentation}
    >
      {page.path !== "/" && (
        <Breadcrumbs
          title={
            isEditorialPage(page)
              ? `${displayHeading(page)} · אפריל 2027`
              : page.title
          }
          parent={parent}
        />
      )}
      <ArchivePageContent page={page} content={content} totalGalleryPhotos={totalGalleryPhotos} />
    </SiteLayout></SiteContentProvider>
  );
}
export const ErrorBoundary = ErrorPage;
