import {parsePhoneNumberFromString,getCountries,getCountryCallingCode,type CountryCode} from "libphonenumber-js/max";
import {z} from "zod";
import type {PublicSiteContent} from "./site-content.js";

export const callbackMessages={
  name:"נא להזין שם באורך 2 תווים לפחות.",phone:"נא להזין מספר טלפון תקין, כולל קידומת. לדוגמה: 050-5202480.",
  email:"נא לבדוק את כתובת הדוא״ל, או להשאיר את השדה ריק.",destination:"נא לבחור יעד מהרשימה.",
  privacy:"כדי שנוכל לחזור אליכם, יש לאשר את מדיניות הפרטיות.",
  country:"נא לבחור מדינה למספר הטלפון.",
};
export type CallbackField=keyof typeof callbackMessages;
export type CallbackInput={name:string;phone:string;country:string;email:string;destination:string;privacyAccepted:boolean};
export type CallbackResult={ok:boolean;errors?:Partial<Record<CallbackField,string>>;message?:string;values?:CallbackInput};
export function callbackCountries(){
  const names=new Intl.DisplayNames(["he"],{type:"region"});
  return getCountries().map(code=>({code,label:names.of(code)??code,callingCode:getCountryCallingCode(code)})).sort((a,b)=>a.code==="IL"?-1:b.code==="IL"?1:a.label.localeCompare(b.label,"he"));
}
export function callbackDestinations(content:PublicSiteContent) {
  const labels:Record<string,string>={china:"סין",uzbekistan:"אוזבקיסטן",greece:"יוון"};
  return [...content.pages.filter(page=>page.pageType==="destinationArchive").map(page=>({value:page.id,
    label:labels[page.slug??""]??page.displayTitle??page.title})),{value:"undecided",label:"עדיין לא החלטתי / יעד אחר"}];
}
export function validateCallback(input:CallbackInput, destinations:{value:string;label:string}[]) {
  const errors:Partial<Record<CallbackField,string>>={};
  const name=input.name.replace(/\s+/g," ").trim();
  if(name.length<2||name.length>100||(name.match(/\p{L}/gu)?.length??0)<2||/[\u0000-\u001f<>]/.test(name))errors.name=callbackMessages.name;
  const raw=input.phone.trim();
  const country=getCountries().includes(input.country as CountryCode)?input.country as CountryCode:undefined;
  if(!country)errors.country=callbackMessages.country;
  const phone=country&&/^[+\d\s().-]{5,32}$/.test(raw)?parsePhoneNumberFromString(raw,{defaultCountry:country,extract:false}):undefined;
  if(!phone?.isValid()||phone.ext||phone.country!==country)errors.phone=country==="IL"?callbackMessages.phone:"נא לבדוק את אורך המספר והקידומת לפי המדינה שנבחרה.";
  const email=input.email.trim();
  const typo:Record<string,string>={"gmial.com":"gmail.com","gmal.com":"gmail.com","gmail.con":"gmail.com","gmaill.com":"gmail.com","gnail.com":"gmail.com","hotmial.com":"hotmail.com","outlook.con":"outlook.com"};
  const domain=email.split("@").at(-1)?.toLowerCase()??"";
  if(email&&(!z.email().safeParse(email).success||email.length>254))errors.email=callbackMessages.email;
  else if(email&&typo[domain])errors.email=`האם התכוונתם ל־${typo[domain]}? נא לתקן את כתובת הדוא״ל.`;
  if(!destinations.some(item=>item.value===input.destination))errors.destination=callbackMessages.destination;
  if(!input.privacyAccepted)errors.privacy=callbackMessages.privacy;
  return {errors,value:{name,phone:phone?.number??"",country:country??"",email:email?email.slice(0,email.lastIndexOf("@")+1)+domain:null,destination:input.destination}};
}
export function socialLinks(presentation:Record<string,string>) {
  const safe=(key:string,fallback:string,hosts:string[])=>{
    try{const url=new URL(presentation[key]??fallback);if(url.protocol==="https:"&&hosts.includes(url.hostname)&&!url.username&&!url.password)return url.href;}catch{}
    return fallback;
  };
  return {whatsapp:safe("contact.whatsappUrl","https://wa.me/972505202480",["wa.me"]),
    facebook:safe("social.facebookUrl","https://www.facebook.com/ronitoursancientworld/",["www.facebook.com"]),
    youtube:safe("social.youtubeUrl","https://www.youtube.com/@roniellatours1400",["www.youtube.com"])};
}
