import { createContext, useContext, type ReactNode } from "react";
import type { PublicSiteContent } from "@roniella/shared/site-content";

const SiteContentContext = createContext<PublicSiteContent | null>(null);
export function SiteContentProvider({ content, children }: { content: PublicSiteContent; children: ReactNode }) {
  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>;
}
export function useSiteContent() {
  const content = useContext(SiteContentContext);
  if (!content) throw Error("Site content provider is missing");
  return content;
}
export function copy(content: PublicSiteContent, key: string) {
  const value = content.presentation[key];
  if (value === undefined) throw Error(`Missing site copy: ${key}`);
  return value;
}
