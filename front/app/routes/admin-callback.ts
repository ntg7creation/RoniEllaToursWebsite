import type { LoaderFunctionArgs } from "react-router";
import { adminHeaders, adminOrigin, createAdminAuth } from "../server/admin-auth.server";
export async function loader({ request }: LoaderFunctionArgs) {
  let auth: ReturnType<typeof createAdminAuth> = null;
  let failure = "signin";
  try {
    const url = new URL(request.url);
    auth = createAdminAuth(request);
    const code = url.searchParams.get("code"), flowId = url.searchParams.get("sb_flow_id");
    if (auth && url.origin === adminOrigin(request) && code && code.length < 2048 && !url.searchParams.has("error")) {
      const exchanged = await auth.client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!exchanged.error) {
        const target = auth.returnPath();
        auth.clearReturnPath();
        if (await auth.identity()) {
          const headers = auth.headers(); headers.set("Location", target);
          return new Response(null, { status: 303, headers });
        }
        failure = "denied";
        await auth.client.auth.signOut({ scope: "local" });
      }
    }
  } catch { failure = "unavailable"; }
  auth?.clear();
  const headers = auth?.headers() ?? adminHeaders();
  headers.set("Location", "/admin/login?error=" + failure);
  return new Response(null, { status: 303, headers });
}
