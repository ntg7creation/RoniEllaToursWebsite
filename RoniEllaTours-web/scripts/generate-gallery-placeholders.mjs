// Deterministic, local SVG illustrations; replace individual src values with photos later.
import fs from 'node:fs/promises';
import { galleryAlbums } from '../src/content/gallery.js';

await fs.mkdir('public/placeholders/gallery', { recursive: true });
const palettes = [
  ['#efe0c6', '#c59955', '#916647', '#614837'],
  ['#ecdbc1', '#b78652', '#a7755c', '#71553d'],
  ['#f1e4d3', '#cfa767', '#8c7955', '#615a43'],
];
for (const album of galleryAlbums) {
  for (const [index, image] of album.images.entries()) {
    const [sky, sun, middle, front] = palettes[index % palettes.length];
    const shift = (index % 4) * 35;
    const scenery = {
      china: `<path d="M0 430 160 ${220 + shift} 310 420 490 ${150 + shift} 690 400 800 270V600H0Z" fill="${middle}"/><path d="M-20 470Q180 310 390 430T840 340" fill="none" stroke="${front}" stroke-width="35"/><path d="M330 400v-60h60v60m-170-8v-45h45v38" fill="${front}"/>`,
      greece: `<path d="M0 460Q170 390 380 470T800 420V600H0Z" fill="${middle}"/><g fill="${front}"><path d="M180 ${240 + shift} 400 ${140 + shift} 620 ${240 + shift}Z"/><path d="M190 ${260 + shift}h420v24H190Z"/><path d="M220 ${284 + shift}h42v220h-42zm105 0h42v220h-42zm105 0h42v220h-42zm105 0h42v220h-42z"/><path d="M170 520h460v24H170Z"/></g>`,
      egypt: `<path d="M0 480Q200 380 400 460T800 410V600H0Z" fill="${sun}"/><path d="M65 490 300 ${160 + shift} 535 490Z" fill="${middle}"/><path d="M300 ${160 + shift} 350 490H535Z" fill="${front}"/><path d="M420 510 585 ${290 + shift} 760 510Z" fill="${middle}"/>`,
      uzbekistan: `<g fill="${middle}"><path d="M230 480V300Q230 ${110 + shift} 400 ${140 + shift}Q570 ${110 + shift} 570 300V480Z"/><path d="M140 480V180h45v300zm480 0V210h45v270z"/></g><path d="M345 480V365Q400 260 455 365V480Z" fill="${front}"/><path d="M90 480h620v45H90Z" fill="${front}"/><path d="M400 ${140 + shift}v-55" stroke="${front}" stroke-width="8"/>`,
      journeys: `<path d="M0 430 220 210 420 430 620 250 800 430V600H0Z" fill="${middle}"/><path d="M310 600Q570 410 400 350Q290 315 510 280" fill="none" stroke="${sun}" stroke-width="35"/>`,
    }[album.id];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-labelledby="title"><title id="title">${image.alt}</title><rect width="800" height="600" fill="${sky}"/><circle cx="${610 - shift}" cy="${120 + index * 3}" r="65" fill="${sun}"/>${scenery}<path d="M0 550Q220 510 430 555T800 530V600H0Z" fill="${front}" opacity=".3"/></svg>`;
    await fs.writeFile(`public${image.src}`, svg);
  }
}
console.log('Generated 50 gallery placeholders.');
