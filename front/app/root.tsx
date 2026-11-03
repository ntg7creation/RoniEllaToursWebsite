import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { ErrorPage } from "./components/error-page";
import type { MiddlewareFunction } from "react-router";
import { applyResponseHeaders } from "./server/config.server";
import "./styles.css";
import "./editorial.css";
import "./design.css";
import "./gallery.css";
import "./callback.css";
export const middleware: MiddlewareFunction<Response>[] = [
  async (_args, next) => {
    const response = await next();
    applyResponseHeaders(response.headers);
    return response;
  },
];
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/compass.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/editorial/fonts.css" />
        <link rel="stylesheet" href="/assets/fonts/assistant.css" />
        <link rel="preload" href="/assets/editorial/font-01.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/assets/fonts/assistant-1.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <Meta />
        <Links />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          דילוג לתוכן הראשי
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function App() {
  return <Outlet />;
}
export const ErrorBoundary = ErrorPage;
