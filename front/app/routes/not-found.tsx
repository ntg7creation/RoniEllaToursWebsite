import { ErrorPage } from "../components/error-page";
export function loader() {
  throw new Response("Not found", { status: 404 });
}
export function meta() {
  return [
    { title: "העמוד לא נמצא | Roniella Tours" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
export default function NotFound() {
  return null;
}
export const ErrorBoundary = ErrorPage;
