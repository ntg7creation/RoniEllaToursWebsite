import express, { type ErrorRequestHandler } from "express";
import type { ContentRepository } from "./content-repository.js";
import { dirname } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import {callbackRouter,emailDomainExists} from "./callback-api.js";
import type {CallbackMailer} from "./callback-email.js";
import { driveThumbnailUrl } from '@roniella/shared/google-drive';
import type { PublicSiteContent } from '@roniella/shared/site-content';
export function createApp(repository: ContentRepository, options: { apiToken?: string;checkEmail?:typeof emailDomainExists;callbackMailer?:CallbackMailer } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/ready", async (_req, res) => {
    try { await repository.getPublicContent(); res.json({ status: "ready" }); }
    catch { res.status(503).json({ status: "unavailable" }); }
  });
  if (options.apiToken) {
    const expected = createHash("sha256").update(`Bearer ${options.apiToken}`).digest();
    app.use("/api", (req, res, next) => {
      const actual = createHash("sha256").update(req.get("authorization") ?? "").digest();
      if (!timingSafeEqual(actual, expected)) { res.status(401).json({ error: { code: "unauthorized" } }); return; }
      next();
    });
  }
  let encoded: { content: PublicSiteContent; body: string; etag: string } | undefined;
  app.get("/api/v1/content", async (req, res) => {
    const fresh = req.get("x-roniella-fresh-content") === "1";
    // Check the database revision first, including for conditional reads. Never
    // return an unchanged response solely because this instance has a snapshot.
    const content = await repository.getPublicContent(fresh);
    if (encoded?.content !== content) {
      const body = JSON.stringify(content);
      encoded = { content, body, etag: '"' + createHash('sha256').update(body).digest('hex') + '"' };
    }
    res.set('ETag', encoded.etag);
    if (!fresh && req.get('if-none-match') === encoded.etag) { res.status(304).end(); return; }
    res.type('json').end(encoded.body);
  });
  app.use("/api/v1/callbacks",express.json({limit:"8kb"}),callbackRouter(options.callbackMailer,options.checkEmail));
  app.get("/api/v1/media/:filename", async (req, res, next) => {
    if (!/^[a-z0-9][a-z0-9.-]*\.(?:jpg|jpeg|png|webp|avif)$/.test(req.params.filename)) {
      res.status(404).end(); return;
    }
    const file = await repository.getMedia?.(req.params.filename);
    if (!file) { res.status(404).end(); return; }
    if ('googleDrive' in file && file.googleDrive) {
      res.redirect(307, driveThumbnailUrl(file.googleDrive.fileId, file.edge));
      return;
    }
    if (file.staticPath) { res.redirect(307, file.staticPath); return; }
    res.set("X-Content-Type-Options", "nosniff");
    res.sendFile(file.filename, { root: dirname(file.path!), dotfiles: "deny" }, error => {
      if (error && "code" in error && ["ECONNABORTED", "ECONNRESET"].includes(String(error.code))) return;
      if (error && !req.destroyed && !res.destroyed) next(error);
    });
  });
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "notFound", message: "Public endpoint not found" },
    });
  });
  const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    if (res.headersSent) { _next(_error); return; }
    res.status(500).json({
      error: {
        code: "internalError",
        message: "Public content is temporarily unavailable",
      },
    });
  };
  app.use(errorHandler);
  return app;
}
