import type { LoaderFunctionArgs } from "react-router";
import { requestPublicContent } from "../server/content.server";
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requestPublicContent(request);
    return Response.json({ status: "ready" }, { headers: { "X-Robots-Tag": "noindex, nofollow" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }
}
