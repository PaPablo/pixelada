/** Importa una imagen a una o ambas caras. */
import { hexToRgb } from './color';
import { mirrorLayer, otherFace } from './faces';
import { buildPalette, nearest, placeImage, resample, type Rgba } from './quantize';
import { LIMITS, type Face, type Project } from './types';

export const MAX_IMAGE_COLORS = 16;

export interface ImportOptions {
  target: Face | 'both';
  palette: 'current' | 'new';
  smooth: boolean;
}

export function importImage(p: Project, img: Rgba, o: ImportOptions): Project {
  const { w, h } = p;
  const place = placeImage(img.width, img.height, w, h);
  const px = resample(img, place.w, place.h, o.smooth);

  let palette: string[] = [...p.palette];
  let front = p.front;
  let back = p.back;
  if (o.palette === 'new') {
    // Si la otra cara se queda, se conservan los colores que usa y se renumeran.
    const keep = o.target === 'both' ? null : p[otherFace(o.target)];
    const kept: string[] = [];
    const remap = new Uint8Array(LIMITS.paletteMax + 1);
    if (keep) {
      for (const c of [...new Set(keep)].sort((a, b) => a - b)) {
        if (!c) continue;
        const hex = p.palette[c - 1];
        if (!kept.includes(hex)) kept.push(hex);
        remap[c] = kept.indexOf(hex) + 1;
      }
    }
    const room = Math.min(MAX_IMAGE_COLORS, LIMITS.paletteMax - kept.length);
    const fresh = room > 0 ? buildPalette(px, room) : [];
    const next = [...new Set([...kept, ...fresh])];
    if (next.length) {
      palette = next;
      if (keep) {
        const moved = keep.map((c) => remap[c]);
        if (o.target === 'front') back = moved;
        else front = moved;
      }
    }
  }

  const rgb = palette.map(hexToRgb);
  const layer = new Uint8Array(w * h);
  for (let y = 0; y < place.h; y++) {
    for (let x = 0; x < place.w; x++) {
      const i = (y * place.w + x) * 4;
      if (px[i + 3] < 128) continue;
      layer[(place.y + y) * w + place.x + x] = nearest(rgb, px[i], px[i + 1], px[i + 2]) + 1;
    }
  }

  if (o.target === 'back') {
    // La imagen se interpreta como vista desde detrás.
    back = mirrorLayer(layer, w, h);
  } else {
    front = layer;
    // En silueta compartida la espalda hereda; en independiente hay que copiarla.
    if (o.target === 'both') back = p.independent ? layer.slice() : new Uint8Array(w * h);
  }
  return { ...p, palette, front, back };
}
