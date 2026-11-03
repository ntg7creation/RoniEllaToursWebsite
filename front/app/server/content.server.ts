import {
  parseSiteContent,
  type PublicSiteContent,
} from "@roniella/shared/site-content";
import { serverConfig, backendHeaders } from "./config.server";
import { readFile } from "node:fs/promises";

export async function requestPublicContent(
  request: Request,
): Promise<PublicSiteContent> {
  if (process.env.RONIELLA_BUILD_CONTENT)
    return parseSiteContent(JSON.parse(await readFile(process.env.RONIELLA_BUILD_CONTENT,"utf8")));
  try {
    const response = await fetch(
      `${serverConfig.backendOrigin}/api/v1/content`,
      {
        headers: backendHeaders(),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(serverConfig.requestTimeoutMs),
        ]),
      },
    );
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return parseSiteContent(await response.json());
  } catch {
    // Do not expose upstream URLs, configuration, or validation diagnostics to visitors.
    console.error("Public content request failed or timed out");
    throw new Response("התוכן אינו זמין כרגע. נסו שוב בעוד כמה רגעים.", {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }
}
