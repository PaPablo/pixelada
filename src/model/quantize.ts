/** Muestreo y cuantización de imágenes. Puro: trabaja sobre bytes RGBA. */
import { hexToRgb, rgbToHex } from './color';

export interface Rgba {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Encaja la imagen en la rejilla: proporción intacta, abajo y centrada. */
export function placeImage(sw: number, sh: number, w: number, h: number): Placement {
  const k = Math.min(w / sw, h / sh);
  const dw = Math.min(w, Math.max(1, Math.round(sw * k)));
  const dh = Math.min(h, Math.max(1, Math.round(sh * k)));
  return { x: Math.floor((w - dw) / 2), y: h - dh, w: dw, h: dh };
}

/** Reescala a w x h: vecino más cercano o promedio de área (con alfa premultiplicado). */
export function resample(img: Rgba, w: number, h: number, smooth: boolean): Uint8ClampedArray {
  const { width: sw, height: sh, data } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const cx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / w));
      const cy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / h));
      if (!smooth) {
        const i = (cy * sw + cx) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = data[i + c];
        continue;
      }
      const x0 = Math.min(cx, Math.floor((x * sw) / w));
      const y0 = Math.min(cy, Math.floor((y * sh) / h));
      const x1 = Math.max(x0 + 1, Math.ceil(((x + 1) * sw) / w));
      const y1 = Math.max(y0 + 1, Math.ceil(((y + 1) * sh) / h));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let sy = y0; sy < Math.min(sh, y1); sy++) {
        const wy = Math.min(sy + 1, ((y + 1) * sh) / h) - Math.max(sy, (y * sh) / h);
        for (let sx = x0; sx < Math.min(sw, x1); sx++) {
          const weight = wy * (Math.min(sx + 1, ((x + 1) * sw) / w) - Math.max(sx, (x * sw) / w));
          if (weight <= 0) continue;
          const i = (sy * sw + sx) * 4;
          const wa = weight * data[i + 3];
          r += data[i] * wa;
          g += data[i + 1] * wa;
          b += data[i + 2] * wa;
          a += wa;
          area += weight;
        }
      }
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
        out[o + 3] = a / area;
      }
    }
  }
  return out;
}

/** Distancia perceptual barata ("redmean"). */
function distance(a: readonly number[], r: number, g: number, b: number): number {
  const mean = (a[0] + r) / 2;
  const dr = a[0] - r;
  const dg = a[1] - g;
  const db = a[2] - b;
  return (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
}

/** Índice (desde 0) del color más parecido. */
export function nearest(palette: readonly (readonly number[])[], r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = distance(palette[i], r, g, b);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

interface Entry {
  rgb: [number, number, number];
  n: number;
}

/** Paleta de hasta `max` colores (median cut). Con pocos colores devuelve los exactos. */
export function buildPalette(pixels: ArrayLike<number>, max: number): string[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const hex = rgbToHex(pixels[i], pixels[i + 1], pixels[i + 2]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  if (counts.size <= max) return [...counts.keys()];
  const boxes: Entry[][] = [[...counts].map(([hex, n]) => ({ rgb: hexToRgb(hex), n }))];

  const spread = (box: Entry[]): { axis: number; range: number } => {
    let axis = 0;
    let range = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 255;
      let hi = 0;
      for (const e of box) {
        lo = Math.min(lo, e.rgb[c]);
        hi = Math.max(hi, e.rgb[c]);
      }
      if (hi - lo > range) {
        range = hi - lo;
        axis = c;
      }
    }
    return { axis, range };
  };
  const weight = (box: Entry[]): number => box.reduce((n, e) => n + e.n, 0);

  while (boxes.length < max) {
    // Divide la caja con más variación, ponderada por su número de píxeles.
    let pick = -1;
    let score = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const s = spread(box).range * Math.sqrt(weight(box));
      if (s > score) {
        score = s;
        pick = i;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick];
    const { axis } = spread(box);
    box.sort((a, b) => a.rgb[axis] - b.rgb[axis]);
    const half = weight(box) / 2;
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i].n;
      cut = i + 1;
      if (acc >= half) break;
    }
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }
  const colors = boxes.map((box) => {
    const n = weight(box);
    const avg = [0, 1, 2].map((c) => Math.round(box.reduce((s, e) => s + e.rgb[c] * e.n, 0) / n));
    return rgbToHex(avg[0], avg[1], avg[2]);
  });
  return [...new Set(colors)];
}
