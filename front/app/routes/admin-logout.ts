import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { safeAdminReturn } from "@roniella/shared/admin";
import { adminHeaders, clearAdminCookies, createAdminAuth, sameOriginAdminPost } from "../server/admin-auth.server";
export function loader(_args: LoaderFunctionArgs) { return new Response(null, { status: 405, headers: { ...Object.fromEntries(adminHeaders()), Allow: "POST" } }); }
export async function action({ request }: ActionFunctionArgs) {
  if (!sameOriginAdminPost(request)) return new Response("Forbidden", { status: 403, headers: adminHeaders() });
  let auth: ReturnType<typeof createAdminAuth> = null;
  try {
    auth = createAdminAuth(request);
    await auth?.client.auth.signOut({ scope: "local" });
  } catch { /* Always remove this browser's cookies, even during an Auth outage. */ }
  auth?.clear();
  const headers = auth?.headers() ?? clearAdminCookies(request);
  headers.set("Location", safeAdminReturn(new URL(request.url).searchParams.get("returnTo")));
  return new Response(null, { status: 303, headers });
}
