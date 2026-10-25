import { useLocale } from "../i18n/LocaleContext.jsx";
import { useParams } from "react-router-dom";
import PlaceholderImage from "../components/ui/PlaceholderImage.jsx";
import Section from "../components/ui/Section.jsx";
import { getArticleBySlug } from "../content/articles.js";
import NotFoundPage from "./NotFoundPage.jsx";
export default function ArticlePage() {
  const {
    t
  } = useLocale();
  const {
    slug
  } = useParams();
  const article = getArticleBySlug(slug);
  if (!article) {
    return <NotFoundPage />;
  }
  return <>
      <section className="article-hero">
        <div className="container article-hero-grid">
          <div>
            <p className="eyebrow">{t("בלוג")}</p>
            <h1>{t(article.title)}</h1>
            <p>{t(article.excerpt)}</p>
          </div>
          <PlaceholderImage src={article.image} alt={t("איור להמחשה: {0}", {
          "0": article.title
        })} label={t("תמונה זמנית למאמר")} />
        </div>
      </section>
      <Section>
        <article className="rich-content article-body">
          {article.body.length > 0 ? article.body.map(block => block.type === "heading" ? <h2 key={block.text}>{t(block.text)}</h2> : <p key={block.text}>{t(block.text)}</p>) : <div className="placeholder-panel">
              <p>{t("המאמר המלא אינו זמין כרגע. מוזמנים לקרוא מאמרים נוספים בבלוג.")}</p>
            </div>}
        </article>
      </Section>
    </>;
}
