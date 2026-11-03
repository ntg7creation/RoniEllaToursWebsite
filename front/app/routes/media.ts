import type { LoaderFunctionArgs } from "react-router";
import { serverConfig, backendHeaders } from "../server/config.server";

// Same-origin streaming route: no API origin or backend file paths in the browser.
export async function loader({ request, params }: LoaderFunctionArgs) {
  const filename = params.filename ?? "";
  if (!/^[a-z0-9][a-z0-9.-]*\.(?:jpg|jpeg|png|webp|avif)$/.test(filename))
    throw new Response("Not found", { status: 404 });
  try {
    const options = {
      headers: backendHeaders(), redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(serverConfig.requestTimeoutMs)]),
    } satisfies RequestInit;
    let upstream = await fetch(`${serverConfig.backendOrigin}/api/v1/media/${filename}`, { ...options, redirect: "manual" });
    // Only follow our exact static-photo path on the configured backend origin.
    // Never forward API/protection credentials to an arbitrary redirect target.
    if (upstream.status === 307 && upstream.headers.get("location") === `/photos/${filename}`) {
      await upstream.body?.cancel();
      upstream = await fetch(`${serverConfig.backendOrigin}/photos/${filename}`, options);
    }
    if (upstream.status === 404) return new Response("Not found", { status: 404 });
    if (!upstream.ok || !/^image\/(?:jpeg|png|webp|avif)(?:;|$)/.test(upstream.headers.get("content-type") ?? ""))
      return new Response("Image unavailable", { status: 503 });
    const headers = new Headers({ "Content-Type": upstream.headers.get("content-type")!, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    if (upstream.headers.has("content-length")) headers.set("Content-Length", upstream.headers.get("content-length")!);
    return new Response(upstream.body, { headers });
  } catch { return new Response("Image unavailable", { status: 503 }); }
}
