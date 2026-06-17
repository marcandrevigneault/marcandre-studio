// Generates lightweight gradient SVG placeholders so the site looks intentional
// before real photos are added. Replace the files in /public/photos with your own.
// Run with:  node tools/gen-placeholders.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

function svg(w, h, stops, { angle = 135, glow, label } = {}) {
  const id = 'g' + Math.abs(stops.join('').length);
  const gstops = stops
    .map((c, i) => `<stop offset="${(i / (stops.length - 1)) * 100}%" stop-color="${c}"/>`)
    .join('');
  const glowEl = glow
    ? `<circle cx="${glow.x}" cy="${glow.y}" r="${glow.r}" fill="${glow.c}" opacity="${glow.o ?? 0.5}"/>`
    : '';
  const labelEl = label
    ? `<text x="50%" y="96%" text-anchor="middle" font-family="Georgia,serif" font-size="${Math.round(
        h * 0.05
      )}" fill="rgba(255,255,255,0.28)" letter-spacing="2">${label}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${id}" gradientTransform="rotate(${angle} 0.5 0.5)">${gstops}</linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  ${glowEl}
  <rect width="${w}" height="${h}" filter="url(#n)" opacity="0.05"/>
  ${labelEl}
</svg>`;
}

function write(path, content) {
  const full = resolve(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  console.log('wrote', path);
}

// --- Kyoto: dark, warm-grey, misty ---
const kyoto = [
  ['#26241f', '#3a352c', '#15140f'],
  ['#2b2620', '#4a3a2c', '#1a1712'],
  ['#1e1c19', '#33302a', '#0f0e0c'],
  ['#222a24', '#3a443a', '#12150f'],
  ['#272320', '#403a32', '#16130f'],
  ['#2a2520', '#534332', '#19140f'],
];
write('photos/kyoto/cover.svg', svg(1600, 1000, ['#1a1813', '#3b342a', '#0d0c09'], { angle: 110, glow: { x: 1200, y: 300, r: 500, c: '#c89b6a', o: 0.18 }, label: 'KYOTO' }));
kyoto.forEach((s, i) => write(`photos/kyoto/0${i + 1}.svg`, svg(1200, 1500, s, { angle: 120 + i * 15 })));

// --- Salt flats: bright, cool, airy ---
const salt = [
  ['#eaf0f5', '#cdddec', '#f6f8fa'],
  ['#dfe8f0', '#b9cfe2', '#eef3f7'],
  ['#e7eef4', '#c3d6e6', '#f3f6f9'],
  ['#f1ece2', '#dcc9ac', '#f8f4ec'],
  ['#e9eef2', '#cbd9e5', '#f4f7f9'],
  ['#11131c', '#1f2a3d', '#05070d'],
];
write('photos/salt/cover.svg', svg(1600, 1000, ['#eef3f7', '#c6d8e8', '#f7f9fb'], { angle: 95, glow: { x: 800, y: 700, r: 600, c: '#ffffff', o: 0.5 }, label: 'UYUNI' }));
salt.forEach((s, i) => write(`photos/salt/0${i + 1}.svg`, svg(1200, 1500, s, { angle: 90 + i * 8 })));

// --- Science article covers ---
write('photos/science/hydroponics.svg', svg(1600, 900, ['#0e2a26', '#1f5d4f', '#08201c'], { angle: 130, glow: { x: 400, y: 250, r: 400, c: '#5fe0b0', o: 0.22 }, label: 'HYDROPONICS' }));
write('photos/science/golden-hour.svg', svg(1600, 900, ['#3a1f0c', '#c97b2a', '#1a0e05'], { angle: 100, glow: { x: 1150, y: 600, r: 480, c: '#ffd27a', o: 0.4 }, label: 'GOLDEN HOUR' }));

// --- Favicon ---
write(
  'favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1a1916"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" font-size="34" fill="#c89b6a">M</text></svg>`
);

console.log('done');
