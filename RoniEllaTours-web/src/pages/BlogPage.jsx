import { useLocale } from "../i18n/LocaleContext.jsx";
import ArticleCard from "../components/blog/ArticleCard.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { articles, blogListingSource } from "../content/articles.js";
export default function BlogPage() {
  const {
    t
  } = useLocale();
  return <>
      <PageHeader eyebrow={t("בלוג")} title={t("מאמרים")} description={t("להכיר את המקומות, התרבויות והסיפורים שמאחורי המסע.")} source={blogListingSource} />
      <section className="section">
        <div className="container">
          <div className="card-grid">
            {articles.map(article => <ArticleCard key={article.slug} article={article} />)}
          </div>
        </div>
      </section>
    </>;
}
