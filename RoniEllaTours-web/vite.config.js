import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createGoogleReviewsHandler } from "./api/google-reviews.js";
import { createTranslationHandler } from './api/translate.js';

export default defineConfig(({ mode }) => {
  const handler = createGoogleReviewsHandler({ env: { ...process.env, ...loadEnv(mode, process.cwd(), 'GOOGLE_') } });
  const translate = createTranslationHandler({ env: { ...process.env, ...loadEnv(mode, process.cwd(), 'GOOGLE_') } });
  const install = (server) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === '/api/google-reviews') return handler(req, res);
      if (req.url?.split('?')[0] === '/api/translate') return translate(req, res);
      next();
    });
  };
  return { plugins: [react(), { name: 'google-reviews-api', configureServer: install, configurePreviewServer: install }] };
});
