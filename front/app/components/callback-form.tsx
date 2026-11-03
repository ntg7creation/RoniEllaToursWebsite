import {useId,useRef,useState,useEffect} from "react";
import {Link,useFetcher,useActionData,useLocation,useLoaderData} from "react-router";
import {callbackCountries,callbackDestinations,validateCallback,type CallbackField,type CallbackResult} from "@roniella/shared/callback";
import type {PublicSiteContent} from "@roniella/shared/site-content";
export function CallbackForm({content}:{content:PublicSiteContent}){
  const id=useId(),fetcher=useFetcher<CallbackResult>(),action=useActionData<CallbackResult>(),location=useLocation();
  const destinations=callbackDestinations(content),submission=useRef<string>(undefined);
  const reply=fetcher.data??action,busy=fetcher.state!=="idle";
  const {callbackCountries:countries}=useLoaderData<{callbackCountries:ReturnType<typeof callbackCountries>}>();
  const [country,setCountry]=useState(reply?.values?.country??"IL");
  const [errors,setErrors]=useState<Partial<Record<CallbackField,string>>>(reply?.errors??{});
  useEffect(()=>{if(reply?.errors){setErrors(reply.errors);focusError(reply.errors);}},[reply]);
  const focusError=(errors:Partial<Record<CallbackField,string>>)=>requestAnimationFrame(()=>document.getElementById(`${id}-${Object.keys(errors)[0]==="privacy"?"privacyAccepted":Object.keys(errors)[0]}`)?.focus());
  const inputClass=(field:CallbackField)=>errors[field]?"has-error":undefined;
  const error=(field:CallbackField)=>errors[field]?<p className="callback-field-error" id={`${id}-${field}-error`}>{errors[field]}</p>:null;
  if(reply?.ok)return <section className="callback-card callback-success" role="status" tabIndex={-1}><span aria-hidden="true">✓</span><h3>תודה, קיבלנו את הפרטים!</h3><p>נחזור אליכם לשיחה על המסע הבא שלכם.</p></section>;
  return <section className="callback-card" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>השאירו פרטים ונחזור אליכם</h3><p className="callback-intro">נשמח להכיר, לענות על שאלות ולעזור לבחור את המסע המתאים.</p>
    <fetcher.Form method="post" action={location.pathname==="/"?"/?index":location.pathname} noValidate className="callback-form" onSubmit={event=>{
      const form=new FormData(event.currentTarget);
      const checked=validateCallback({name:String(form.get("name")??""),phone:String(form.get("phone")??""),country:String(form.get("country")??""),email:String(form.get("email")??""),destination:String(form.get("destination")??""),privacyAccepted:form.get("privacyAccepted")==="on"},destinations);
      setErrors(checked.errors);
      if(Object.keys(checked.errors).length){event.preventDefault();focusError(checked.errors);return;}
      submission.current??=crypto.randomUUID();
      (event.currentTarget.elements.namedItem("submissionId") as HTMLInputElement).value=submission.current;
    }}>
      <input type="hidden" name="submissionId" defaultValue=""/>
      <div className="callback-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
      <div className="callback-fields">
        <div><label htmlFor={`${id}-name`}>שם מלא <span aria-hidden="true">*</span></label><input id={`${id}-name`} name="name" autoComplete="name" defaultValue={reply?.values?.name} maxLength={100} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name?`${id}-name-error`:undefined} className={inputClass("name")}/>{error("name")}</div>
        <div><label htmlFor={`${id}-phone`}>מספר טלפון לחזרה <span aria-hidden="true">*</span></label><div className="callback-phone-row"><div><label className="callback-country-label" htmlFor={`${id}-country`}>מדינה</label><select id={`${id}-country`} name="country" defaultValue={country} onChange={event=>setCountry(event.target.value)} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country?`${id}-country-error`:undefined}>{countries.map(item=><option value={item.code} key={item.code}>{`${item.label} \u2066(+${item.callingCode})\u2069`}</option>)}</select></div><input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={reply?.values?.phone} dir="ltr" maxLength={32} required placeholder={country==="IL"?"050-5202480":""} aria-invalid={Boolean(errors.phone)} aria-describedby={`${id}-phone-help${errors.phone?` ${id}-phone-error`:""}`} className={inputClass("phone")}/></div><p className="callback-help" id={`${id}-phone-help`}>נא לבדוק את המספר ואת המדינה — למספר הזה נחזור אליכם.</p>{error("country")}{error("phone")}</div>
        <div><label htmlFor={`${id}-email`}>כתובת דוא״ל <span className="callback-optional">(לא חובה)</span></label><input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" defaultValue={reply?.values?.email} dir="ltr" maxLength={254} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email?`${id}-email-error`:undefined} className={inputClass("email")}/>{error("email")}</div>
        <div><label htmlFor={`${id}-destination`}>איזה יעד מעניין אתכם? <span aria-hidden="true">*</span></label><select id={`${id}-destination`} name="destination" required defaultValue={reply?.values?.destination??""} aria-invalid={Boolean(errors.destination)} aria-describedby={errors.destination?`${id}-destination-error`:undefined} className={inputClass("destination")}><option value="" disabled>בחרו יעד</option>{destinations.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>{error("destination")}</div>
      </div>
      <div className="callback-consent"><input id={`${id}-privacyAccepted`} name="privacyAccepted" type="checkbox" required defaultChecked={reply?.values?.privacyAccepted??false} aria-invalid={Boolean(errors.privacy)} aria-describedby={errors.privacy?`${id}-privacy-error`:undefined}/><label htmlFor={`${id}-privacyAccepted`}>קראתי את <Link to="/privacy/" target="_blank" rel="noopener">מדיניות הפרטיות</Link> ואני מסכים/ה לשימוש בפרטים כדי שתחזרו אליי בנוגע לפנייה.</label></div>{error("privacy")}
      {Object.keys(errors).length>0&&<p role="alert" className="callback-field-error">יש לבדוק את השדות המסומנים לפני השליחה.</p>}
      {reply?.message&&<p role="alert" className="callback-field-error">{reply.message}</p>}
      <button type="submit" className="editorial-button" disabled={busy}>{busy?"שולחים את הפרטים…":"שליחת הפרטים לשיחה חוזרת"}<span aria-hidden="true">←</span></button>
      <p className="callback-help">הפרטים ישמשו למענה לפנייה בלבד. שדות המסומנים ב־* הם חובה.</p>
    </fetcher.Form>
  </section>;
}
