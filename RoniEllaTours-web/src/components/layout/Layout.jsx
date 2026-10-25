import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import TranslationNotice from './TranslationNotice.jsx';
export default function Layout() {
  const {
    t
  } = useLocale();
  const location = useLocation();
  const previousLocation = useRef(location.key);
  useLayoutEffect(() => {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({
      behavior: 'instant'
    });else window.scrollTo({
      top: 0,
      behavior: 'instant'
    });
    if (previousLocation.current !== location.key) (target || document.getElementById('main-content'))?.focus({
      preventScroll: true
    });
    previousLocation.current = location.key;
  }, [location.key, location.hash]);
  useLayoutEffect(() => {
    const title = document.querySelector('h1')?.textContent;
    document.title = `${title || t('טיולי העולם העתיק')} | RoniElla Tours`;
  }, [location.key, t]);
  return <div className="site-shell">
      <Header />
      <main id="main-content" tabIndex={-1}>
        <TranslationNotice />
        <Outlet />
      </main>
      <Footer />
    </div>;
}
