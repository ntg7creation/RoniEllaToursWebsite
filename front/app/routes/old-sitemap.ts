import { redirect } from "react-router";
export function loader() {
  return redirect("/sitemap.xml", 301);
}
