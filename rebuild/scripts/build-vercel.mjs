import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isBuiltin } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = process.argv[2];
if (!["frontend", "backend"].includes(target)) throw Error("Specify frontend or backend");
const appRoot = resolve(root, target), output = resolve(appRoot, ".vercel/output");
// Only generated output may be removed; preserve .vercel/project.json and env files.
if (relative(appRoot, output) !== [".vercel", "output"].join(sep)) throw Error("Unsafe output directory");
await rm(output, { recursive: true, force: true });
const fn = resolve(output, "functions/server.func"), assets = resolve(output, "static");
await mkdir(fn, { recursive: true });
await mkdir(assets, { recursive: true });
const filenames = [];
if (target === "backend") {
  // Copy only image files, including older registered album variants for cache overlap.
  const media = await realpath(resolve(appRoot, "content/media"));
  await mkdir(resolve(assets, "photos"));
  for (const name of (await readdir(media)).sort()) {
    if (!/^[a-z0-9][a-z0-9.-]*\.(?:jpg|jpeg|png|webp|avif)$/.test(name)) continue;
    const source = await realpath(resolve(media, name)), rel = relative(media, source);
    if (rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw Error("Image escapes media directory");
    const info = await stat(source);
    if (!info.isFile() || info.size > 4_000_000) throw Error(`Photo exceeds SSR proxy payload budget: ${name}`);
    await cp(source, resolve(assets, "photos", name));
    filenames.push(name);
  }
  const content = JSON.parse(await readFile(resolve(appRoot, "content/media.json"), "utf8"));
  const gallery = JSON.parse(await readFile(resolve(appRoot, "content/gallery.json"), "utf8"));
  for (const item of [...content, ...gallery.photos])
    for (const src of [item.src, ...item.variants.map(v => v.src)])
      if (!filenames.includes(src.split("/").at(-1))) throw Error(`Missing source photo: ${src}`);
} else {
  await cp(resolve(appRoot, "build/client"), assets, { recursive: true });
  await rm(resolve(assets, ".vite"), { recursive: true, force: true });
}
const bundled = await build({
  absWorkingDir: root,
  entryPoints: [resolve(appRoot, target === "backend" ? "src/vercel.ts" : "vercel-handler.mjs")],
  outfile: resolve(fn, "index.mjs"), bundle: true, platform: "node", target: "node24", format: "esm",
  // CommonJS dependencies still need Node's require when bundled as ESM.
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  define: { "process.env.NODE_ENV": '"production"', ...(target === "backend" ? { __RONIELLA_STATIC_MEDIA__: JSON.stringify(filenames) } : {}) },
  logLevel: "warning", metafile: true,
});
for (const outputFile of Object.values(bundled.metafile.outputs))
  for (const dependency of outputFile.imports)
    if (dependency.external && !isBuiltin(dependency.path))
      throw Error(`Function depends on an unpackaged module: ${dependency.path}`);
const bytes = (await stat(resolve(fn, "index.mjs"))).size;
if (bytes > 200_000_000) throw Error("Function exceeds bundle size budget");
await writeFile(resolve(fn, ".vc-config.json"), JSON.stringify({ runtime: "nodejs24.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 30, supportsResponseStreaming: true }, null, 2) + "\n");
const routes = target === "backend" ? [
  { src: "/(.*)", headers: { "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" }, continue: true },
  { handle: "filesystem" },
  { src: "/(.*)", dest: "/server" },
] : [
  { handle: "filesystem" },
  { src: "/(.*)", dest: "/server" },
];
await writeFile(resolve(output, "config.json"), JSON.stringify({ version: 3, routes }, null, 2) + "\n");
console.log(`Vercel ${target}: ${(bytes / 1024 / 1024).toFixed(2)} MiB function; ${filenames.length} backend static photos. No hosting or database changes.`);
