import { Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import ToursPage from "./pages/ToursPage.jsx";
import TourDetailPage from "./pages/TourDetailPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import GuidesPage from "./pages/GuidesPage.jsx";
import BlogPage from "./pages/BlogPage.jsx";
import ArticlePage from "./pages/ArticlePage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LegalPage from "./pages/LegalPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import GalleryPage from "./pages/GalleryPage.jsx";
import ReviewsPage from "./pages/ReviewsPage.jsx";
import { legalPages } from "./content/pages.js";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/tours" element={<ToursPage />} />
        <Route path="/tours/:slug" element={<TourDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<ArticlePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route
          path="/privacy-policy"
          element={<LegalPage page={legalPages.privacy} />}
        />
        <Route
          path="/accessibility"
          element={<LegalPage page={legalPages.accessibility} />}
        />
        <Route path="/terms" element={<LegalPage page={legalPages.terms} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
