import { useLocale } from "../../i18n/LocaleContext.jsx";
import FormNotice from "./FormNotice.jsx";
import { useId, useState } from "react";
import { disabledSubmissionMessage, submitRegistrationForm, validateEmail, validateRequiredFields } from "../../services/forms.js";
const initialState = {
  gender: "",
  firstNameLatin: "",
  lastNameLatin: "",
  idNumber: "",
  phone: "",
  mobile: "",
  email: "",
  passport: "",
  roomType: "",
  foodPreference: "",
  notes: "",
  consent: false
};
const requiredFields = [{
  name: "firstNameLatin",
  label: "שם פרטי בלועזית כפי שמופיע בדרכון"
}, {
  name: "lastNameLatin",
  label: "שם משפחה בלועזית כפי שמופיע בדרכון"
}, {
  name: "mobile",
  label: "טלפון נייד"
}, {
  name: "email",
  label: "דואר אלקטרוני"
}];
export default function RegistrationForm({
  tourTitle
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
      nextErrors.consent = "נדרש אישור קריאת תנאי הטיול לפני המשך";
    }
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) event.currentTarget.elements.namedItem(firstInvalid)?.focus();
    if (Object.keys(nextErrors).length === 0) {
      const result = await submitRegistrationForm({
        ...values,
        tourTitle
      });
      setMessage(result.message || disabledSubmissionMessage);
    } else {
      setMessage("");
    }
  }
  return <form className="form-panel registration-form" onSubmit={handleSubmit} noValidate>
      <FormNotice />
      <p className="form-footnote">{t("שדות חובה מסומנים בכוכבית (*)")}</p>
      <div className="form-grid">
        <label>{t("מין הנוסע")}<select name="gender" aria-invalid={Boolean(errors.gender)} aria-describedby={errors.gender ? formId + '-gender' : undefined} value={values.gender} onChange={updateValue}>
            <option value="">{t("מין הנוסע")}</option>
            <option value="male">{t("זכר")}</option>
            <option value="female">{t("נקבה")}</option>
          </select>
        </label>
        <label>{t("שם פרטי בלועזית כפי שמופיע בדרכון *")}<input name="firstNameLatin" aria-invalid={Boolean(errors.firstNameLatin)} aria-describedby={errors.firstNameLatin ? formId + '-firstNameLatin' : undefined} required dir="ltr" autoComplete="given-name" value={values.firstNameLatin} onChange={updateValue} />
          {errors.firstNameLatin ? <span id={formId + '-firstNameLatin'}>{t(errors.firstNameLatin)}</span> : null}
        </label>
        <label>{t("שם משפחה בלועזית כפי שמופיע בדרכון *")}<input name="lastNameLatin" aria-invalid={Boolean(errors.lastNameLatin)} aria-describedby={errors.lastNameLatin ? formId + '-lastNameLatin' : undefined} required dir="ltr" autoComplete="family-name" value={values.lastNameLatin} onChange={updateValue} />
          {errors.lastNameLatin ? <span id={formId + '-lastNameLatin'}>{t(errors.lastNameLatin)}</span> : null}
        </label>
        <label>{t("מספר תעודת זהות")}<input name="idNumber" aria-invalid={Boolean(errors.idNumber)} aria-describedby={errors.idNumber ? formId + '-idNumber' : undefined} dir="ltr" value={values.idNumber} onChange={updateValue} />
        </label>
        <label>{t("טלפון")}<input name="phone" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? formId + '-phone' : undefined} type="tel" dir="ltr" autoComplete="tel" value={values.phone} onChange={updateValue} inputMode="tel" />
        </label>
        <label>{t("טלפון נייד *")}<input name="mobile" aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? formId + '-mobile' : undefined} required type="tel" dir="ltr" autoComplete="tel" value={values.mobile} onChange={updateValue} inputMode="tel" />
          {errors.mobile ? <span id={formId + '-mobile'}>{t(errors.mobile)}</span> : null}
        </label>
        <label>{t("דואר אלקטרוני *")}<input name="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? formId + '-email' : undefined} required type="email" dir="ltr" autoComplete="email" value={values.email} onChange={updateValue} inputMode="email" />
          {errors.email ? <span id={formId + '-email'}>{t(errors.email)}</span> : null}
        </label>
        <label>{t("מספר דרכון")}<input name="passport" aria-invalid={Boolean(errors.passport)} aria-describedby={errors.passport ? formId + '-passport' : undefined} dir="ltr" value={values.passport} onChange={updateValue} />
        </label>
        <label>{t("סוג חדר")}<select name="roomType" aria-invalid={Boolean(errors.roomType)} aria-describedby={errors.roomType ? formId + '-roomType' : undefined} value={values.roomType} onChange={updateValue}>
            <option value="">{t("סוג חדר")}</option>
            <option value="single">{t("יחיד בחדר")}</option>
            <option value="double">{t("זוג בחדר מיטה זוגית")}</option>
            <option value="twin">{t("חדר זוגי מיטות נפרדות")}</option>
          </select>
        </label>
        <label>{t("העדפות אוכל בטיול")}<select name="foodPreference" aria-invalid={Boolean(errors.foodPreference)} aria-describedby={errors.foodPreference ? formId + '-foodPreference' : undefined} value={values.foodPreference} onChange={updateValue}>
            <option value="">{t("העדפות אוכל בטיול")}</option>
            <option value="meat">{t("בשרי")}</option>
            <option value="vegetarian">{t("צמחוני")}</option>
            <option value="fish">{t("צמחוני אוכל דגים")}</option>
          </select>
        </label>
      </div>
      <label>{t("הערות")}<textarea name="notes" rows="4" value={values.notes} onChange={updateValue} />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" name="consent" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? formId + '-consent' : undefined} required checked={values.consent} onChange={updateValue} />{t("הבנתי שהטופס אינו שולח פרטים ואינו מהווה הרשמה לטיול. *")}</label>
      {errors.consent ? <p role="alert" id={formId + "-consent"} className="form-error">{t(errors.consent)}</p> : null}
      <button className="primary-button" type="submit">{t("בדיקת טופס הרשמה")}</button>
      {message ? <p role="status" className="form-message">{t(message)}</p> : null}
    </form>;
}
