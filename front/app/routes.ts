import { index, route, type RouteConfig } from "@react-router/dev/routes";

// SSG discovers current published paths at build time. Runtime resolution keeps
// database edits, new publications and removals working without another build.
export default [
  route("health", "routes/health.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("media/:filename", "routes/media.ts"),
  index("routes/content.tsx", { id: "home" }),
  route("*", "routes/content.tsx", { id: "content" }),
] satisfies RouteConfig;
