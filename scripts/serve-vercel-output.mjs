// Local test harness for the actual generated bundles, not a Vercel emulator.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";

const output = resolve(".vercel/output");
const assets = resolve(output, "static");
const { default: handler } = await import(pathToFileURL(resolve(output, "functions/server.func/index.mjs")));
const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (process.env.TEST_BACKEND_PROTECTION && /^\/(api|photos)\//.test(pathname) &&
      req.headers["x-vercel-protection-bypass"] !== process.env.TEST_BACKEND_PROTECTION) {
      res.writeHead(403).end(); return;
    }
    const file = resolve(assets, `.${pathname}`), rel = relative(assets, file);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) { res.writeHead(404).end(); return; }
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) {
      res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Content-Length": info.size });
      if (req.method === "HEAD") res.end(); else createReadStream(file).pipe(res);
      return;
    }
    handler(req, res);
  } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
});
server.listen(Number(process.env.PORT), "127.0.0.1");
