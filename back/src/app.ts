import express, { type ErrorRequestHandler } from "express";
import type { ContentRepository } from "./content-repository.js";
import { dirname } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import {callbackRouter,emailDomainExists} from "./callback-api.js";
import type {CallbackMailer} from "./callback-email.js";
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
  app.get("/api/v1/content", async (_req, res) => {
    res.json(await repository.getPublicContent());
  });
  app.use("/api/v1/callbacks",express.json({limit:"8kb"}),callbackRouter(options.callbackMailer,options.checkEmail));
  app.get("/api/v1/media/:filename", async (req, res, next) => {
    if (!/^[a-z0-9][a-z0-9.-]*\.(?:jpg|jpeg|png|webp|avif)$/.test(req.params.filename)) {
      res.status(404).end(); return;
    }
    const file = await repository.getMedia?.(req.params.filename);
    if (!file) { res.status(404).end(); return; }
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
