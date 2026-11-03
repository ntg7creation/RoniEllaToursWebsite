import type { Config } from "@react-router/dev/config";
import { readFile } from "node:fs/promises";
export default {
  ssr: true,
  async prerender() {
    if (!process.env.RONIELLA_BUILD_CONTENT) return [];
    const content = JSON.parse(await readFile(process.env.RONIELLA_BUILD_CONTENT,"utf8"));
    return content.pages.filter((page:{pageType:string})=>page.pageType !== "gallery").map((page:{path:string})=>page.path);
  },
} satisfies Config;
