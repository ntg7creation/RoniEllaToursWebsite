import {
  parseSiteContent,
  type PublicSiteContent,
} from "@roniella/shared/site-content";
import { serverConfig, backendHeaders } from "./config.server";
import { readFile } from "node:fs/promises";
let snapshot: { content: PublicSiteContent; etag: string } | undefined;

export async function requestPublicContent(
  request: Request,
): Promise<PublicSiteContent> {
  if (process.env.RONIELLA_BUILD_CONTENT)
    return parseSiteContent(JSON.parse(await readFile(process.env.RONIELLA_BUILD_CONTENT,"utf8")));
  try {
    const fresh = /(?:^|;\s*)(?:__Host-)?roniella-admin(?:\.[0-9]+)?=/.test(request.headers.get('cookie') ?? '');
    const previous = fresh ? undefined : snapshot;
    const response = await fetch(
      `${serverConfig.backendOrigin}/api/v1/content`,
      {
        // Admin browsers need a fresh public snapshot after saving. This flag
        // conveys no authority and never returns private content. The API still
        // requires the frontend's server token; authorization is separate.
        headers: { ...backendHeaders(), ...(fresh ? { 'x-roniella-fresh-content': '1' } : {}), ...(previous ? { 'If-None-Match': previous.etag } : {}) },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(serverConfig.requestTimeoutMs),
        ]),
      },
    );
    if (response.status === 304 && previous) return previous.content;
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const content = parseSiteContent(await response.json());
    const etag = response.headers.get('etag');
    if (etag && /^"[a-f0-9]{64}"$/.test(etag)) snapshot = { content, etag };
    return content;
  } catch {
    // Do not expose upstream URLs, configuration, or validation diagnostics to visitors.
    console.error("Public content request failed or timed out");
    throw new Response("התוכן אינו זמין כרגע. נסו שוב בעוד כמה רגעים.", {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }
}
