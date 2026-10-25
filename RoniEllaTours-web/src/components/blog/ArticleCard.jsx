import { useLocale } from "../../i18n/LocaleContext.jsx";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
export default function ArticleCard({
  article
}) {
  const {
    t
  } = useLocale();
  return <article className="article-card">
      <img src={article.image} alt={t("איור להמחשה: {0}", {
      "0": article.title
    })} />
      <div className="card-content">
        <h3>{t(article.title)}</h3>
        <p>{t(article.excerpt)}</p>
        <Link className="text-link" to={`/blog/${article.slug}`}>{t("לקריאת המאמר")}<ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>;
}
