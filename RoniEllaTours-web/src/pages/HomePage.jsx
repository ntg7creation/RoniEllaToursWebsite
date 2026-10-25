import { useLocale } from "../i18n/LocaleContext.jsx";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import ArticleCard from "../components/blog/ArticleCard.jsx";
import InterestForm from "../components/forms/InterestForm.jsx";
import Section from "../components/ui/Section.jsx";
import TourCard from "../components/tours/TourCard.jsx";
import { articles } from "../content/articles.js";
import { guides } from "../content/guides.js";
import { homepageContent, whyTravelWithUs } from "../content/site.js";
import { tours } from "../content/tours.js";
import { companyVideo } from "../content/videos.js";
import VideoCard from "../components/ui/VideoCard.jsx";
import '../styles/gallery.css';
import '../styles/home.css';
export default function HomePage() {
  const {
    t, direction
  } = useLocale();
  const featuredTours = tours.filter(tour => tour.featured);
  const featuredArticles = articles.slice(0, 3);
  const featuredDestinations = ["china-zhong-guo", "uzbekistan"].map(slug => tours.find(tour => tour.slug === slug)).filter(Boolean);
  return <div className="home-page">
      <section className="hero">
        <img src="/placeholders/hero-culture.svg" alt={t("איור להמחשה: טיולי העולם העתיק")} />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="container hero-content">
          <p className="eyebrow">{t(homepageContent.heroEyebrow)}</p>
          <h1>{t(homepageContent.heroTitle)}</h1>
          <p>{t(homepageContent.heroText)}</p>
          <div className="button-row">
            <Link className="primary-button" to="/tours">{t("צפייה בטיולים")}<ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <Link className="secondary-button" to="/contact">{t("שיחה עם הצוות")}</Link>
          </div>
        </div>
      </section>

      <Section eyebrow={t("לאן נוסעים?")} title={t("מסעות שנבנים סביב ידע, קצב וסיפור")} description={t("מסין ועד אוזבקיסטן — להכיר מקרוב תרבויות, נופים והיסטוריה.")}>
        <div className="destination-grid">
          {featuredDestinations.map(tour => <article className="destination-card" key={tour.slug}>
              <img src={tour.image} alt={t("איור להמחשה: {0}", {
            "0": tour.title
          })} />
              <div className="destination-card-content">
                <h3>{t(tour.country)}</h3>
                <Link className="destination-link" to={`/tours/${tour.slug}`}>{t("לפרטי הטיול")}<ArrowLeft size={20} aria-hidden="true" />
                </Link>
              </div>
            </article>)}
        </div>
      </Section>

      <Section className="soft-band home-story">
        <div className="home-story-layout">
          <div className="home-story-video" dir={direction}>
            <div className="home-story-heading">
              <p className="eyebrow">{t("נעים להכיר")}</p>
              <h2>{t("הסיפור שלנו, מקרוב")}</h2>
            </div>
            <VideoCard video={companyVideo} />
            <Link className="text-link section-link" to="/gallery">{t("לגלריה ולסרטונים שלנו")}<ArrowLeft size={18} aria-hidden="true" /></Link>
          </div>
          <div className="home-story-copy text-stack" dir={direction}>
            <div className="home-story-heading">
              <p className="eyebrow">{t("הדרך שלנו")}</p>
              <h2>{t(whyTravelWithUs.title)}</h2>
            </div>
            {whyTravelWithUs.intro.map(paragraph => <p key={paragraph}>{t(paragraph)}</p>)}
          </div>
        </div>
        <ul className="home-story-benefits">
          {whyTravelWithUs.points.map(point => <li key={point}><CheckCircle2 size={24} aria-hidden="true" /><span>{t(point)}</span></li>)}
        </ul>
      </Section>

      <Section eyebrow={t("הטיולים שלנו")} title={t("לכל מסע סיפור משלו")}>
        <div className="card-grid">
          {featuredTours.map(tour => <TourCard key={tour.slug} tour={tour} />)}
        </div>
      </Section>

      <Section className="soft-band" eyebrow={t("המדריכים שלנו")} title={t("נעים להכיר")}>
        <div className="guide-preview-grid">
          {guides.slice(0, 2).map(guide => <article className="guide-preview" key={guide.id}>
              <img src={guide.image} alt={t("איור להמחשה: {0}", {
            "0": guide.name
          })} />
              <div>
                <h3>{t(guide.name)}</h3>
                <p>{t(guide.title)}</p>
                <p>{t(guide.preview || guide.bio)}</p>
              </div>
            </article>)}
        </div>
        <Link className="text-link section-link" to="/guides">{t("לכל המדריכים")}<ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </Section>

      <Section eyebrow={t("מאמרים אחרונים מהבלוג")} title={t("סיפורים לדרך")}>
        <div className="card-grid">
          {featuredArticles.map(article => <ArticleCard key={article.slug} article={article} />)}
        </div>
      </Section>

      <Section eyebrow={t("רוצים להצטרף לטיול?")} title={t("בואו נדבר על המסע הבא")}>
        <InterestForm />
      </Section>
    </div>;
}
