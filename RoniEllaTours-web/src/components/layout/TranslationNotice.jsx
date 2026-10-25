import { useLocale } from '../../i18n/LocaleContext.jsx';
import { translationMessages, providerNotice } from '../../i18n/translationMessages.js';

export default function TranslationNotice() {
  const { status, retry, language } = useLocale();
  if (status === 'authored') return null;
  const messageLanguage = translationMessages[language] ? language : 'en';
  const copy = translationMessages[messageLanguage];
  return <aside className="translation-notice" lang={messageLanguage} dir="ltr">
    <p role="status">{copy[status]}</p>
    {status === 'unavailable' && <button type="button" className="text-link" onClick={retry}>{copy.retry}</button>}
    {status === 'ready' && <>
      <a href="https://translate.google.com" target="_blank" rel="noopener noreferrer" lang="en"><img src="/translation/png/color-regular.png" alt="Powered by Google Translate" width="159" height="16" /></a>
      <details><summary>{copy.details}</summary><p lang="en">{providerNotice}</p></details>
    </>}
  </aside>;
}
