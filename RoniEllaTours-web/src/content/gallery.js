// Local media records are deliberately independent of the gallery components.
// A future album adapter can return the same { id, src, alt, caption } shape.
export const galleryAlbums = [
  { id: 'china', title: 'סין', count: 12 },
  { id: 'greece', title: 'יוון', count: 12 },
  { id: 'egypt', title: 'מצרים', count: 12 },
  { id: 'uzbekistan', title: 'אוזבקיסטן', count: 12 },
  { id: 'journeys', title: 'רגעים מהדרך', count: 2 },
].map(album => ({
  ...album,
  images: Array.from({ length: album.count }, (_, index) => ({
    id: `${album.id}-${index + 1}`,
    src: `/placeholders/gallery/${album.id}-${index + 1}.svg`,
    alt: `איור להמחשה — ${album.title}, ${index + 1}`,
    caption: album.title,
    placeholder: true,
    ratio: ['3 / 4', '3 / 2', '4 / 5', '16 / 9', '5 / 4'][index % 5],
  })),
}));

// A seeded shuffle keeps the “All” view mixed without changing on every render.
const interleavedImages = Array.from(
  { length: Math.max(...galleryAlbums.map(album => album.images.length)) },
  (_, index) => galleryAlbums.map(album => album.images[index]).filter(Boolean),
).flat();
let shuffleSeed = 78241;
for (let index = interleavedImages.length - 1; index > 0; index -= 1) {
  shuffleSeed = (Math.imul(shuffleSeed, 1664525) + 1013904223) >>> 0;
  const target = Math.floor((shuffleSeed / 4294967296) * (index + 1));
  [interleavedImages[index], interleavedImages[target]] = [interleavedImages[target], interleavedImages[index]];
}
export const mixedGalleryImages = interleavedImages;
