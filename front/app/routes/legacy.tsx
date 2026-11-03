import { redirect, type LoaderFunctionArgs } from "react-router";
import { scaffoldRedirects, normalizePath } from "@roniella/shared/urls";
export function loader({ url }: LoaderFunctionArgs) {
  const destination = scaffoldRedirects[normalizePath(url.pathname)];
  if (!destination) throw new Response("Not found", { status: 404 });
  // Browsers retain the incoming fragment when Location supplies no new fragment.
  return redirect(`${destination}${url.search}`, 301);
}
export default function LegacyRedirect() {
  return null;
}
