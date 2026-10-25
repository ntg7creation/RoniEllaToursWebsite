import { useLocale } from "../../i18n/LocaleContext.jsx";
import FormNotice from "./FormNotice.jsx";
import { useId, useState } from "react";
import { disabledSubmissionMessage, submitInterestForm, validateEmail, validateRequiredFields } from "../../services/forms.js";
const initialState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  destination: "",
  consent: false
};
const requiredFields = [{
  name: "firstName",
  label: "שם פרטי"
}, {
  name: "phone",
  label: "טלפון"
}, {
  name: "email",
  label: "אימייל"
}, {
  name: "destination",
  label: "יעד"
}];
export default function InterestForm({
  compact = false
}) {
  const {
    t
  } = useLocale();
  const formId = useId();
  const [values, setValues] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  function updateValue(event) {
    const {
      name,
      value,
      type,
      checked
    } = event.target;
    setMessage("");
    setErrors(current => ({
      ...current,
      [name]: undefined
    }));
    setValues(current => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRequiredFields(values, requiredFields);
    if (!validateEmail(values.email)) {
      nextErrors.email = "נא להזין כתובת אימייל תקינה";
    }
    if (!values.consent) {
      nextErrors.consent = "יש לאשר את מדיניות הפרטיות לפני המשך";
    }
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) event.currentTarget.elements.namedItem(firstInvalid)?.focus();
    if (Object.keys(nextErrors).length === 0) {
      const result = await submitInterestForm(values);
      setMessage(result.message || disabledSubmissionMessage);
    } else {
      setMessage("");
    }
  }
  return <form className={`form-panel ${compact ? "compact" : ""}`} onSubmit={handleSubmit} noValidate>
      <FormNotice />
      <p className="form-footnote">{t("שדות חובה מסומנים בכוכבית (*)")}</p>
      <div className="form-grid">
        <label>{t("שם פרטי *")}<input name="firstName" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? formId + '-firstName' : undefined} required autoComplete="given-name" value={values.firstName} onChange={updateValue} />
          {errors.firstName ? <span id={formId + '-firstName'}>{t(errors.firstName)}</span> : null}
        </label>
        <label>{t("שם משפחה")}<input name="lastName" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? formId + '-lastName' : undefined} autoComplete="family-name" value={values.lastName} onChange={updateValue} />
        </label>
        <label>{t("טלפון *")}<input name="phone" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? formId + '-phone' : undefined} required type="tel" dir="ltr" autoComplete="tel" value={values.phone} onChange={updateValue} inputMode="tel" />
          {errors.phone ? <span id={formId + '-phone'}>{t(errors.phone)}</span> : null}
        </label>
        <label>{t("אימייל *")}<input name="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? formId + '-email' : undefined} required type="email" dir="ltr" autoComplete="email" value={values.email} onChange={updateValue} inputMode="email" />
          {errors.email ? <span id={formId + '-email'}>{t(errors.email)}</span> : null}
        </label>
        <label>{t("יעד *")}<select name="destination" aria-invalid={Boolean(errors.destination)} aria-describedby={errors.destination ? formId + '-destination' : undefined} required value={values.destination} onChange={updateValue}>
            <option value="">{t("בחירת יעד")}</option>
            <option value="uzbekistan">{t("אוזבקיסטן")}</option>
            <option value="china">{t("סין")}</option>
            <option value="greece">{t("יוון")}</option>
          </select>
          {errors.destination ? <span id={formId + '-destination'}>{t(errors.destination)}</span> : null}
        </label>
      </div>
      <label className="checkbox-field">
        <input type="checkbox" name="consent" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? formId + '-consent' : undefined} required checked={values.consent} onChange={updateValue} />{t("קראתי את מדיניות הפרטיות *")}</label>
      {errors.consent ? <p role="alert" id={formId + "-consent"} className="form-error">{t(errors.consent)}</p> : null}
      <button className="primary-button" type="submit">{t("בדיקת הטופס")}</button>
      {message ? <p role="status" className="form-message">{t(message)}</p> : null}
    </form>;
}
