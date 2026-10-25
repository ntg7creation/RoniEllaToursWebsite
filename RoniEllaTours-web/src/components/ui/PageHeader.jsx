import { useLocale } from "../../i18n/LocaleContext.jsx";
export default function PageHeader({
  eyebrow,
  title,
  description
}) {
  const {
    t
  } = useLocale();
  return <header className="page-header">
      <div className="container narrow">
        {eyebrow ? <p className="eyebrow">{t(eyebrow)}</p> : null}
        <h1>{t(title)}</h1>
        {description ? <p className="page-description">{t(description)}</p> : null}
        
      </div>
    </header>;
}
