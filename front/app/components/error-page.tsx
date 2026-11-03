import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { paths } from "@roniella/shared";
import { SiteLayout, PageHeading } from "./layout";
export function ErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const title =
    status === 404
      ? "העמוד לא נמצא"
      : status === 503
        ? "התוכן אינו זמין כרגע"
        : "אירעה תקלה בטעינת העמוד";
  return (
    <SiteLayout>
      <PageHeading title={title} />
      <p>
        {status === 404
          ? "הכתובת אינה קיימת באתר ההדגמה. אפשר לחזור לראשי ולבחור עמוד מהתפריט."
          : "נסו לרענן את העמוד בעוד כמה רגעים. אפשר גם ליצור איתנו קשר."}
      </p>
      <p>
        <Link to={paths.home}>לעמוד הראשי</Link> ·{" "}
        <Link to={paths.contact}>יצירת קשר</Link>
      </p>
      {status === 503 && (
        <p>
          <a href="tel:0733744686">073-3744686</a> ·{" "}
          <a href="mailto:roniellatours@gmail.com">roniellatours@gmail.com</a>
        </p>
      )}
    </SiteLayout>
  );
}
