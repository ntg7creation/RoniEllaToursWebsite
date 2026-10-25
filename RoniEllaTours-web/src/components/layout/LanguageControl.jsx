import { Languages } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { languages } from '../../i18n/languages.js';

export default function LanguageControl() {
  const { language, setLanguage, t } = useLocale();
  return <label className="language-control">
    <Languages size={19} aria-hidden="true" />
    <span className="sr-only">{t('שפת האתר')}</span>
    <select value={language} onChange={event => setLanguage(event.target.value)} aria-label={t('שפת האתר')} dir="ltr">
      {languages.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.label}</option>)}
    </select>
  </label>;
}
