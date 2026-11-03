import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, type EntryContext } from "react-router";
import { applyResponseHeaders } from "./server/config.server";

// Shared document renderer for build-time generation and runtime regeneration.
export const streamTimeout = 5000;
export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
): Promise<Response> | Response {
  applyResponseHeaders(headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  if (request.method === "HEAD") return new Response(null, { status, headers });
  return new Promise((resolve, reject) => {
    // Complete the loader-data stream too: hydration needs the framework's serialized data.
    const timeout = setTimeout(() => abort(), streamTimeout + 1000);
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={context} url={request.url} />,
      {
        onAllReady() {
          const body = new PassThrough();
          body.once("close", () => clearTimeout(timeout));
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              status,
              headers,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          clearTimeout(timeout);
          reject(error);
        },
        onError() {
          status = 500;
          console.error("Page rendering failed");
        },
      },
    );
  });
}
export function handleDataRequest(response: Response): Response {
  applyResponseHeaders(response.headers);
  return response;
}
