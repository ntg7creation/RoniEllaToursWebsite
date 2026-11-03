import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../front/package.json", import.meta.url),
);
const serveCli = resolve(
  dirname(require.resolve("@react-router/serve/package.json")),
  "dist/cli.js",
);
export const archiveManifest = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../docs/live-site-content/staging/2026-11-02-live-refresh/manifest.txt", import.meta.url),
    "utf8",
  ),
);
export const sourceRecords = await Promise.all(
  archiveManifest.pages
    .filter((p) => p.httpStatus === 200 && p.publicPath)
    .map(async (p) =>
      JSON.parse(
        await (
          await import("node:fs/promises")
        ).readFile(
          new URL(`../docs/live-site-content/${p.file}`, import.meta.url),
          "utf8",
        ),
      ),
    ),
);
const presentation = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../back/content/presentation.json", import.meta.url), "utf8"));
export function expectedHeading(page) {
  return page.path === "/" ? presentation["home.hero.heading"] : page.displayTitle ?? page.title;
}
export function launchProduction({ webPort = 3400, apiPort = 3401, contentDirectory, backendEntry = "dist/server.js" } = {}) {
  const origin = `http://127.0.0.1:${webPort}`;
  const backendOrigin = `http://127.0.0.1:${apiPort}`;
  const children = [];
  function start(args, cwd, env) {
    const child = spawn(process.execPath, args, {
      cwd: resolve(root, cwd),
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "production", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.log = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => {
        child.log = (child.log + chunk).slice(-12000);
      });
    children.push(child);
    return child;
  }
  const api = start([backendEntry], "back", {
    API_PORT: String(apiPort),
    ...(contentDirectory ? { CONTENT_DIRECTORY: contentDirectory } : {}),
  });
  const web = start([serveCli, "./build/server/index.js"], "front", {
    HOST: "127.0.0.1",
    PORT: String(webPort),
    BACKEND_ORIGIN: backendOrigin,
    SITE_ORIGIN: origin,
    CONTENT_TIMEOUT_MS: "1000",
    ALLOW_INDEXING: "false",
  });
  async function ready(child, url) {
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null)
        throw new Error(`Production process exited: ${child.log}`);
      try {
        if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok)
          return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Process never became ready: ${url}\n${child.log}`);
  }
  return {
    origin,
    backendOrigin,
    api,
    web,
    ready: async () => {
      await ready(api, `${backendOrigin}/health`);
      await ready(web, origin);
    },
    stop: async () => {
      await Promise.all(children.map(stopProcess));
    },
    logs: () => children.map((c) => c.log).join("\n"),
  };
}
export async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = once(child, "exit");
  child.kill();
  await stopped;
}
