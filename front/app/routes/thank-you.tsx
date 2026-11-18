import { Link, type LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { serverConfig } from "../server/config.server";

export function loader({ url }: LoaderFunctionArgs) {
  if (url.pathname !== "/thank-you/") throw redirect("/thank-you/" + url.search, 301);
  return { canonical: serverConfig.siteOrigin + "/thank-you/" };
}
export const headers = () => ({ "X-Robots-Tag": "noindex, follow" });
export const meta = ({ loaderData }: { loaderData?: { canonical: string } }) => [
  { title: "תודה על פנייתכם | טיולי העולם העתיק" },
  { name: "description", content: "תודה על פנייתכם לצוות טיולי העולם העתיק." },
  { name: "robots", content: "noindex, follow" },
  ...(loaderData ? [{ tagName: "link", rel: "canonical", href: loaderData.canonical }] : []),
];
export default function ThankYou() {
  return <main id="main-content" className="container"><h1>תודה על פנייתכם</h1>
    <p><Link to="/tours/">הטיולים שלנו</Link> · <Link to="/">לדף הבית</Link></p></main>;
}
