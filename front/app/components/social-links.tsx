import {socialLinks} from "@roniella/shared/callback";
export function WhatsAppIcon(){return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.7A8.5 8.5 0 1 1 20.5 11.5Z" stroke="currentColor" strokeWidth="1.6"/><path d="m8.6 7.4 1.2 2-1 1.1c.8 1.6 2 2.8 3.8 3.6l1.1-1.1 2.1 1.1c-.3 2.7-2.5 2.3-4.5 1.3-2.7-1.4-5.4-4.5-4.3-6.9.3-.7 1-.9 1.6-1.1Z" fill="currentColor"/></svg>}
export function SocialLinks({presentation={}}:{presentation?:Record<string,string>}){
  const links=socialLinks(presentation);
  return <nav className="social-links" aria-label="עקבו אחרינו ברשתות החברתיות">
    <a href={links.facebook} target="_blank" rel="noopener noreferrer" aria-label="פייסבוק של טיולי העולם העתיק — נפתח בחלון חדש"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M14 22v-8h3l.5-4H14V7.5c0-1.2.4-2 2.1-2H18V2.1A23 23 0 0 0 15.2 2C12.4 2 10 3.8 10 7.2V10H7v4h3v8Z"/></svg><span>פייסבוק</span></a>
    <a href={links.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube של טיולי העולם העתיק — נפתח בחלון חדש"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="m10 9 6 3-6 3Z" className="youtube-play"/></svg><span lang="en" dir="ltr">YouTube</span></a>
  </nav>;
}
