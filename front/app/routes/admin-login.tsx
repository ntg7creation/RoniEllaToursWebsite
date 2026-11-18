import { data, Form, Link, useActionData, useLoaderData, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs, type HeadersFunction } from "react-router";
import { safeAdminReturn } from "@roniella/shared/admin";
import { adminHeaders, adminOrigin, createAdminAuth, sameOriginAdminPost } from "../server/admin-auth.server";

const messages: Record<string, string> = {
  denied: "חשבון Google הזה אינו מורשה לעריכת האתר. יש לפנות לבעל האתר כדי לקבל גישה.",
  signin: "הכניסה לא הושלמה או שפג תוקף הקישור. אפשר לנסות שוב.",
  unavailable: "שירות הכניסה אינו זמין כרגע. נסו שוב בעוד כמה רגעים.",
  setup: "הכניסה למנהלים עדיין אינה זמינה. יש לפנות לבעל האתר.",
};
export const headers: HeadersFunction = ({ loaderHeaders, actionHeaders }) => {
  const result = adminHeaders();
  for (const source of [loaderHeaders, actionHeaders]) for (const cookie of source.getSetCookie()) result.append("Set-Cookie", cookie);
  return result;
};
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url), origin = adminOrigin(request);
  if (url.origin !== origin) return new Response(null, { status: 302, headers: { ...Object.fromEntries(adminHeaders()), Location: origin + "/admin/login" } });
  let auth: ReturnType<typeof createAdminAuth> = null;
  const returnTo = safeAdminReturn(url.searchParams.get("returnTo"));
  try {
    auth = createAdminAuth(request);
    if (auth && await auth.identity()) {
      const headers = auth.headers(); headers.set("Location", returnTo);
      return new Response(null, { status: 302, headers });
    }
  } catch { /* Keep the login page usable if a previous session cannot be checked. */ }
  return data({ configured: Boolean(auth), returnTo, message: messages[url.searchParams.get("error") ?? ""] ?? null }, { headers: auth?.headers() ?? adminHeaders() });
}
export async function action({ request }: ActionFunctionArgs) {
  if (!sameOriginAdminPost(request)) return data({ message: "לא ניתן להתחבר ממקור זה." }, { status: 403, headers: adminHeaders() });
  let auth: ReturnType<typeof createAdminAuth> = null;
  try {
    auth = createAdminAuth(request);
    if (!auth || !await auth.googleEnabled()) return data({ message: messages.setup }, { status: 503, headers: auth?.headers() ?? adminHeaders() });
    const url = new URL(request.url);
    auth.setReturnPath(url.searchParams.get("returnTo"));
    const result = await auth.client.auth.signInWithOAuth({ provider: "google", options: {
      redirectTo: adminOrigin(request) + "/admin/callback", skipBrowserRedirect: true, queryParams: { prompt: "select_account" },
    } });
    if (result.error || !result.data.url) throw Error("Sign-in unavailable");
    const headers = auth.headers(); headers.set("Location", result.data.url);
    return new Response(null, { status: 303, headers });
  } catch { return data({ message: messages.unavailable }, { status: 503, headers: auth?.headers() ?? adminHeaders() }); }
}
export const meta = () => [{ title: "כניסת מנהלים | טיולי העולם העתיק" }, { name: "robots", content: "noindex, nofollow" }];
export default function AdminLogin() {
  const loaded = useLoaderData<typeof loader>(), reply = useActionData<typeof action>(), navigation = useNavigation();
  const message = reply?.message ?? loaded.message;
  return <main id="main-content" className="admin-login" tabIndex={-1}>
    <Link to="/" className="admin-back-link">חזרה לאתר ← / Back to site</Link>
    <section className="admin-login-card" aria-labelledby="admin-login-title">
      <p className="eyebrow">טיולי העולם העתיק</p>
      <h1 id="admin-login-title">כניסת מנהלים / Admin sign-in</h1>
      <p>התחברו באמצעות חשבון Google שהורשה לעריכת האתר. / Sign in with an authorized Google account.</p>
      {message && <p role="alert" className="admin-message">{message}</p>}
      {loaded.configured ? <Form method="post" action={"/admin/login?returnTo=" + encodeURIComponent(loaded.returnTo)}>
        <button className="admin-google-button" type="submit" disabled={navigation.state !== "idle"}>
          {navigation.state === "idle" ? "כניסה באמצעות Google / Sign in with Google" : "מעבירים אתכם ל־Google… / Opening Google…"}
        </button>
      </Form> : <p className="admin-message">{messages.setup}</p>}
      <p className="admin-login-note">לאחר הכניסה תוכלו לערוך את התוכן ישירות באתר. / After signing in, edit content directly on each page.</p>
    </section>
  </main>;
}
