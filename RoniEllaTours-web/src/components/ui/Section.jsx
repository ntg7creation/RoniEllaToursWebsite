import { useLocale } from "../../i18n/LocaleContext.jsx";
export default function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = ""
}) {
  const {
    t
  } = useLocale();
  return <section id={id} tabIndex={id ? -1 : undefined} className={`section ${className}`}>
      <div className="container">
        {(eyebrow || title || description) && <div className="section-heading">
            {eyebrow ? <p className="eyebrow">{t(eyebrow)}</p> : null}
            {title ? <h2>{t(title)}</h2> : null}
            {description ? <p>{t(description)}</p> : null}
          </div>}
        {children}
      </div>
    </section>;
}
