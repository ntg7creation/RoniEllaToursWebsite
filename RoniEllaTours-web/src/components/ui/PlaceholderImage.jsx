import { useLocale } from "../../i18n/LocaleContext.jsx";
export default function PlaceholderImage({
  src,
  alt
}) {
  const {
    t
  } = useLocale();
  return <figure className="placeholder-image">
      <img src={src} alt={t(alt)} />
    </figure>;
}
