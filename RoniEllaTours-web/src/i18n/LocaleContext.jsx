import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authoredLanguage, dictionary, makeTranslator, namespaces } from './catalog.js';
import { languages, pageNamespaces } from './languages.js';

const LocaleContext = createContext(null);
const translatedPages = new Map();
const storageKey = 'roniella-language';
function initialLanguage() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (languages.some(item => item.code === saved)) return saved;
  } catch { /* Private browsing can disable storage. */ }
  return 'he';
}

export function LocaleProvider({ children }) {
  const { pathname } = useLocation();
  const [language, setLanguage] = useState(initialLanguage);
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState(null);
  const pages = useMemo(() => pageNamespaces(pathname.replace(/\/$/, '') || '/', namespaces), [pathname]);
  const authored = authoredLanguage(language);
  const requestKey = `${language}:${pages.join(',')}`;
  const cached = translatedPages.get(requestKey);
  const current = cached || (remote?.key === requestKey ? remote : null);
  const status = authored ? 'authored' : current?.status || 'loading';
  const contentLanguage = authored || status === 'ready' ? language : 'en';
  const direction = languages.find(item => item.code === contentLanguage)?.direction || 'ltr';
  const copy = useMemo(() => status === 'ready' ? current.copy : dictionary(contentLanguage, pages), [status, current, contentLanguage, pages]);
  const t = useMemo(() => makeTranslator(copy), [copy]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, language); } catch { /* Selection still works without storage. */ }
  }, [language]);

  useLayoutEffect(() => {
    document.documentElement.lang = status === 'ready' ? `${contentLanguage}-x-mtfrom-en` : contentLanguage;
    document.documentElement.dir = direction;
  }, [contentLanguage, direction, status]);

  useEffect(() => {
    if (authored || translatedPages.has(requestKey)) return;
    const controller = new AbortController();
    let disposed = false;
    setRemote({ key: requestKey, status: 'loading' });
    const timeout = setTimeout(() => controller.abort(), 30000);
    (async () => {
      try {
        const response = await fetch('/api/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language, namespaces: pages }), signal: controller.signal,
        });
        if (!response.ok) throw new Error('Translation unavailable');
        const data = await response.json();
        const english = dictionary('en', pages);
        if (!data.copy || Object.keys(english).some(key => typeof data.copy[key] !== 'string' || !data.copy[key].trim())) throw new Error('Incomplete translation');
        if (disposed) return;
        const result = { key: requestKey, status: 'ready', copy: data.copy };
        translatedPages.set(requestKey, result);
        setRemote(result);
      } catch {
        if (!disposed) setRemote({ key: requestKey, status: 'unavailable' });
      } finally { clearTimeout(timeout); }
    })();
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); };
  }, [authored, language, pages, requestKey, attempt]);

  const value = { language, setLanguage, contentLanguage, direction, status, t, retry: () => setAttempt(value => value + 1) };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider');
  return context;
}
