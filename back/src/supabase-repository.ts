import { parseSiteContent, type PublicSiteContent } from "@roniella/shared/site-content";
import type { ContentRepository, MediaFile } from "./content-repository.js";
import { registeredMedia, validateRuntimeContent } from "./runtime-content.js";

export interface SupabaseOptions {
  origin: string; secretKey: string; mediaDirectory: URL;
  timeoutMs: number; cacheMs: number;
  staticMediaFiles?: ReadonlySet<string>;
}
type Snapshot = { content: PublicSiteContent; files: Map<string, MediaFile>; expires: number };
export class SupabaseContentRepository implements ContentRepository {
  private cached?: Snapshot;
  private pending?: Promise<Snapshot>;
  constructor(private readonly options: SupabaseOptions, private readonly request: typeof fetch = fetch) {}

  private async refresh(): Promise<Snapshot> {
    const headers: Record<string,string> = { apikey: this.options.secretKey, Accept: "application/json", "Content-Type": "application/json" };
    // New sb_secret keys are API keys, not JWTs. Legacy local-stack service JWTs need Bearer too.
    if (this.options.secretKey.startsWith("eyJ")) headers.Authorization = `Bearer ${this.options.secretKey}`;
    const response = await this.request(`${this.options.origin}/rest/v1/rpc/read_site_content`, {
      method: "POST", headers, body: "{}", redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (!response.ok) { await response.body?.cancel(); throw Error(`Content database read failed (${response.status})`); }
    const content = parseSiteContent(await response.json());
    validateRuntimeContent(content);
    const files = await registeredMedia(content, this.options.mediaDirectory, this.options.staticMediaFiles);
    return { content, files, expires: Date.now() + this.options.cacheMs };
  }
  private async snapshot(): Promise<Snapshot> {
    if (this.cached && Date.now() < this.cached.expires) return this.cached;
    if (!this.pending) {
      this.pending = this.refresh().then(snapshot => { this.cached = snapshot; return snapshot; })
        .finally(() => { this.pending = undefined; });
    }
    return this.pending;
  }
  async getPublicContent() { return (await this.snapshot()).content; }
  async getMedia(filename: string) { return (await this.snapshot()).files.get(filename); }
}
