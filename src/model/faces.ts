/** Color efectivo de cada cara, conversión vista <-> modelo. */
import type { Face, Project } from './types';

export interface Cell {
  x: number;
  y: number;
}

export function otherFace(face: Face): Face {
  return face === 'front' ? 'back' : 'front';
}

/** La espalda se ve espejada. La conversión es su propia inversa. */
export function viewToModelX(face: Face, xv: number, w: number): number {
  return face === 'back' ? w - 1 - xv : xv;
}

export function viewToModel(face: Face, c: Cell, w: number): Cell {
  return { x: viewToModelX(face, c.x, w), y: c.y };
}

/** Color visible de una celda del modelo: el propio o, en silueta compartida, el heredado. */
export function effectiveAt(p: Project, face: Face, i: number): number {
  const own = p[face][i];
  if (own !== 0 || p.independent) return own;
  return p[otherFace(face)][i];
}

/** Capa completa de colores efectivos, en coordenadas del modelo. */
export function effectiveLayer(p: Project, face: Face): Uint8Array {
  const own = p[face];
  if (p.independent) return own;
  const other = p[otherFace(face)];
  const out = new Uint8Array(own.length);
  for (let i = 0; i < out.length; i++) out[i] = own[i] || other[i];
  return out;
}

/** Espeja una capa horizontalmente (modelo -> vista de la espalda y viceversa). */
export function mirrorLayer(layer: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(layer.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y * w + x] = layer[y * w + (w - 1 - x)];
  }
  return out;
}

/** Capa tal como se dibuja en el panel de esa cara. */
export function viewLayer(p: Project, face: Face): Uint8Array {
  const layer = effectiveLayer(p, face);
  return face === 'back' ? mirrorLayer(layer, p.w, p.h) : layer;
}
