export const disabledSubmissionMessage =
  "הפרטים נבדקו, אך לא נשלחו ולא נשמרו. להמשך הפנייה או ההרשמה, צרו איתנו קשר בטלפון או במייל.";

export function validateRequiredFields(values, requiredFields) {
  return requiredFields.reduce((errors, field) => {
    const value = values[field.name];
    if (!value || value.toString().trim() === "") {
      errors[field.name] = { message: '{field} הוא שדה חובה', params: { field: field.label } };
    }
    return errors;
  }, {});
}

export function validateEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitInterestForm() {
  return { ok: false, disabled: true, message: disabledSubmissionMessage };
}

export async function submitContactForm() {
  return { ok: false, disabled: true, message: disabledSubmissionMessage };
}

export async function submitRegistrationForm() {
  return { ok: false, disabled: true, message: disabledSubmissionMessage };
}
