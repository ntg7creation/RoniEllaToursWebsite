import { useLocale } from "../../i18n/LocaleContext.jsx";
import FormNotice from "./FormNotice.jsx";
import { useId, useState } from "react";
import { disabledSubmissionMessage, submitContactForm, validateEmail, validateRequiredFields } from "../../services/forms.js";
const initialState = {
  fullName: "",
  phone: "",
  email: "",
  message: "",
  consent: false
};
const requiredFields = [{
  name: "fullName",
  label: "שם מלא"
}, {
  name: "phone",
  label: "טלפון"
}, {
  name: "email",
  label: "כתובת מייל"
}];
export default function ContactForm() {
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
      const result = await submitContactForm(values);
      setMessage(result.message || disabledSubmissionMessage);
    } else {
      setMessage("");
    }
  }
  return <form className="form-panel" onSubmit={handleSubmit} noValidate>
      <FormNotice />
      <p className="form-footnote">{t("שדות חובה מסומנים בכוכבית (*)")}</p>
      <div className="form-grid">
        <label>{t("שם מלא *")}<input name="fullName" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? formId + '-fullName' : undefined} required autoComplete="name" value={values.fullName} onChange={updateValue} />
          {errors.fullName ? <span id={formId + '-fullName'}>{t(errors.fullName)}</span> : null}
        </label>
        <label>{t("טלפון *")}<input name="phone" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? formId + '-phone' : undefined} required type="tel" dir="ltr" autoComplete="tel" value={values.phone} onChange={updateValue} inputMode="tel" />
          {errors.phone ? <span id={formId + '-phone'}>{t(errors.phone)}</span> : null}
        </label>
        <label>{t("כתובת מייל *")}<input name="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? formId + '-email' : undefined} required type="email" dir="ltr" autoComplete="email" value={values.email} onChange={updateValue} inputMode="email" />
          {errors.email ? <span id={formId + '-email'}>{t(errors.email)}</span> : null}
        </label>
      </div>
      <label>{t("הודעה")}<textarea name="message" rows="5" value={values.message} onChange={updateValue} />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" name="consent" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? formId + '-consent' : undefined} required checked={values.consent} onChange={updateValue} />{t("קראתי את מדיניות הפרטיות *")}</label>
      {errors.consent ? <p role="alert" id={formId + "-consent"} className="form-error">{t(errors.consent)}</p> : null}
      <button className="primary-button" type="submit">{t("בדיקת הטופס")}</button>
      {message ? <p role="status" className="form-message">{t(message)}</p> : null}
    </form>;
}
