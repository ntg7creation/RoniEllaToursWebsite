import type { LoaderFunctionArgs } from "react-router";
import { adminHeaders, createAdminAuth } from "../server/admin-auth.server";
export async function loader({ request }: LoaderFunctionArgs) {
  let auth: ReturnType<typeof createAdminAuth> = null;
  try {
    auth = createAdminAuth(request);
    return Response.json({ admin: auth ? await auth.identity() : null }, { headers: auth?.headers() ?? adminHeaders() });
  } catch {
    return Response.json({ admin: null, message: "לא ניתן לבדוק את החיבור כרגע." }, { status: 503, headers: auth?.headers() ?? adminHeaders() });
  }
}
