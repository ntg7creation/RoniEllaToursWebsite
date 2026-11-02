import { index, route, type RouteConfig } from "@react-router/dev/routes";

// Public page paths and legacy redirects resolve through the content API at runtime.
// A database content edit or newly published page never needs a frontend rebuild.
export default [
  route("health", "routes/health.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("media/:filename", "routes/media.ts"),
  index("routes/content.tsx", { id: "home" }),
  route("*", "routes/content.tsx", { id: "content" }),
] satisfies RouteConfig;
