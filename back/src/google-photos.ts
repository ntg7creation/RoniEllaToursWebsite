// Import only the data already published by a public album page; never execute its scripts.
// Google does not document this page format. Fail closed if its structure changes.
export function parsePublicAlbum(html: string) {
  const match = /AF_initDataCallback\(\{key: 'ds:1',\s*hash: '[^']*',\s*data:([\s\S]*?),\s*sideChannel: \{\}\}\);/.exec(html);
  if (!match) throw Error("Public album data is unavailable. Check sharing settings or Google's page format.");
  const data: unknown = JSON.parse(match[1]!);
  if (!Array.isArray(data) || !Array.isArray(data[1]) || !Array.isArray(data[3]))
    throw Error("Unrecognized Google Photos album structure");
  const [photos, metadata] = [data[1] as unknown[], data[3] as unknown[]];
  if (data[2] || !Number.isInteger(metadata[21]) || metadata[21] !== photos.length)
    throw Error("Album is paginated or incomplete; refusing to replace the current cache with a partial album.");
  if (!photos.length || photos.length > 2000) throw Error("Album must contain 1–2000 public photos");
  if (typeof metadata[1] !== "string" || !metadata[1].trim()) throw Error("Album title is missing");
  const seen = new Set<string>();
  return {
    title: metadata[1],
    photos: photos.map(item => {
      if (!Array.isArray(item) || typeof item[0] !== "string" || !Array.isArray(item[1]) || item[8] !== 2)
        throw Error("Unsupported album item (only still photos are supported)");
      const [url, width, height] = item[1] as unknown[];
      if (typeof url !== "string" || !Number.isInteger(width) || !Number.isInteger(height) || Number(width) < 1 || Number(height) < 1)
        throw Error("Photo URL or dimensions are missing");
      const source = new URL(url);
      if (source.protocol !== "https:" || !/^lh\d+\.googleusercontent\.com$/.test(source.hostname) || source.username || source.password || source.port || source.search || source.hash)
        throw Error("Unexpected album image host");
      if (seen.has(item[0])) throw Error("Duplicate album item");
      seen.add(item[0]);
      return { sourceId: item[0], url, width: Number(width), height: Number(height) };
    }),
  };
}

// Read actual delivery dimensions, including portrait photos, without an imaging dependency.
export function jpegDimensions(bytes: Uint8Array) {
  const data = Buffer.from(bytes);
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) throw Error("Expected a JPEG image");
  let offset = 2;
  while (offset + 4 < data.length) {
    if (data[offset] !== 0xff) throw Error("Invalid JPEG marker");
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++]!;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) throw Error("Invalid JPEG segment");
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (length < 8) throw Error("Invalid JPEG frame");
      const height = data.readUInt16BE(offset + 3), width = data.readUInt16BE(offset + 5);
      if (!width || !height) throw Error("Invalid JPEG dimensions");
      return { width, height };
    }
    offset += length;
  }
  throw Error("JPEG dimensions not found");
}
