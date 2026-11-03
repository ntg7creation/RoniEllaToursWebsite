// Optional, reproducible public asset acquisition. Runtime never requests these services.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = new URL(
  "../front/public/assets/editorial/",
  import.meta.url,
);
await mkdir(directory, { recursive: true });
const photoDirectory = new URL("../back/content/media/", import.meta.url);
await mkdir(photoDirectory, { recursive: true });
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
};
async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
const records = [];
for (const [name, sourceUrl, author, license, licenseUrl] of [
  [
    "samarkand",
    "https://commons.wikimedia.org/wiki/File:Samarcanda,_Regist%C3%A1n_(cropped).jpg",
    "LBM1948; source crop by Teseo",
    "CC BY-SA 4.0",
    "https://creativecommons.org/licenses/by-sa/4.0/",
  ],
  [
    "bukhara",
    "https://commons.wikimedia.org/wiki/File:Bujar%C3%A1,_Po-i-Kalyan_01.jpg",
    "LBM1948",
    "CC BY-SA 4.0",
    "https://creativecommons.org/licenses/by-sa/4.0/",
  ],
  [
    "china",
    "https://commons.wikimedia.org/wiki/File:Great_Wall_of_China_at_Mutianyu.JPG",
    "CTLiotta",
    "CC0 1.0",
    "https://creativecommons.org/publicdomain/zero/1.0/",
  ],
]) {
  const html = await (await get(sourceUrl)).text();
  const previews = [
    ...html.matchAll(
      /href="(https:\/\/(?:upload|thumb)\.wikimedia\.org\/[^"]+)"/g,
    ),
  ].map((match) => match[1].replaceAll("&amp;", "&"));
  const preview =
    previews.find((url) =>
      url.includes(
        `/${name === "samarkand" ? 3840 : name === "bukhara" ? 1280 : 960}px-`,
      ),
    ) ?? previews.find((url) => /\/960px-/.test(url));
  if (!preview) throw Error(`Missing Commons preview: ${sourceUrl}`);
  const response = await get(preview);
  if (!response.headers.get("content-type")?.startsWith("image/"))
    throw Error("Expected an image");
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(`${name}.jpg`, photoDirectory), bytes);
  records.push({
    file: `${name}.jpg`,
    sourceUrl,
    downloadUrl: preview,
    author,
    license,
    licenseUrl,
    treatment:
      "Unmodified Commons thumbnail; CSS crops in some layouts. Existing source crop noted in attribution.",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  });
  console.log(`Saved ${name}.jpg (${bytes.length} bytes)`);
}
const fontUrl =
  "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500..600&family=Noto+Sans+Hebrew:wght@400..600&display=swap";
let css = await (await get(fontUrl)).text();
const fontFiles = new Map();
for (const match of css.matchAll(
  /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g,
)) {
  const url = match[1];
  if (fontFiles.has(url)) continue;
  const filename = `font-${String(fontFiles.size + 1).padStart(2, "0")}.woff2`;
  const bytes = Buffer.from(await (await get(url)).arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "wOF2")
    throw Error("Expected WOFF2 font");
  await writeFile(new URL(filename, directory), bytes);
  fontFiles.set(url, filename);
  records.push({
    file: filename,
    sourceUrl: url,
    license: "SIL Open Font License 1.1",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  });
}
for (const [url, filename] of fontFiles)
  css = css.replaceAll(url, `/assets/editorial/${filename}`);
await writeFile(new URL("fonts.css", directory), css);
for (const family of ["frankruhllibre", "notosanshebrew"]) {
  const licenseUrl = `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`;
  await writeFile(
    new URL(`${family}-OFL.txt`, directory),
    await (await get(licenseUrl)).text(),
  );
}
await writeFile(
  new URL("credits.json", photoDirectory),
  JSON.stringify(
    {
      schemaVersion: 1,
      retrievedAt: new Date().toISOString(),
      fontCssSource: fontUrl,
      assets: records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${fontFiles.size} local font files, original licenses and asset credits`,
);
