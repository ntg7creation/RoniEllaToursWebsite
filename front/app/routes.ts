import { index, route, type RouteConfig } from "@react-router/dev/routes";

// SSG discovers current published paths at build time. Runtime resolution keeps
// database edits, new publications and removals working without another build.
export default [
  route("admin/login", "routes/admin-login.tsx"),
  route("admin/callback", "routes/admin-callback.ts"),
  route("admin/logout", "routes/admin-logout.ts"),
  route("admin/session", "routes/admin-session.ts"),
  route("admin/editor", "routes/admin-editor.ts"),
  route("admin/manage", "routes/admin-manage.ts"),
  route('admin/photos', 'routes/admin-photos.ts'),
  route("health", "routes/health.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("llms.txt", "routes/llms.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  ...["sitemap_index.xml", "wp-sitemap.xml", "post-sitemap.xml", "page-sitemap.xml", "trips-sitemap.xml",
    "category-sitemap.xml", "trips_cats-sitemap.xml", "lead_status-sitemap.xml", "author-sitemap.xml"].map(path =>
    route(path, "routes/old-sitemap.ts", { id: path })),
  route("thank-you", "routes/thank-you.tsx"),
  route("media/:filename", "routes/media.ts"),
  index("routes/content.tsx", { id: "home" }),
  route("*", "routes/content.tsx", { id: "content" }),
] satisfies RouteConfig;
