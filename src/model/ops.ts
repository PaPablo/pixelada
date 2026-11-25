/**
 * Operaciones sobre la figura. Todas son puras: devuelven el mismo objeto si
 * nada cambia (así el historial puede descartar pasos vacíos).
 */
import { effectiveLayer, mirrorLayer, otherFace, type Cell } from './faces';
import { HEX_RE, LIMITS, clampInt, maxSkin, type BaseSettings, type Face, type Project } from './types';

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function withLayers(p: Project, front: Uint8Array, back: Uint8Array): Project {
  const sameFront = sameBytes(p.front, front);
  const sameBack = sameBytes(p.back, back);
  if (sameFront && sameBack) return p;
  return { ...p, front: sameFront ? p.front : front, back: sameBack ? p.back : back };
}

function withFace(p: Project, face: Face, layer: Uint8Array): Project {
  return face === 'front' ? withLayers(p, layer, p.back) : withLayers(p, p.front, layer);
}

function indices(p: Project, cells: readonly Cell[]): number[] {
  const out: number[] = [];
  for (const { x, y } of cells) {
    if (x >= 0 && y >= 0 && x < p.w && y < p.h) out.push(y * p.w + x);
  }
  return out;
}

/** Pinta celdas (coordenadas del modelo) en una cara. La otra hereda sin guardar nada. */
export function paint(p: Project, face: Face, cells: readonly Cell[], color: number): Project {
  if (color < 1 || color > p.palette.length) return p;
  const layer = p[face].slice();
  for (const i of indices(p, cells)) layer[i] = color;
  return withFace(p, face, layer);
}

/** Borra celdas: en ambas caras con silueta compartida, solo en la dada si es independiente. */
export function erase(p: Project, face: Face, cells: readonly Cell[]): Project {
  const front = p.front.slice();
  const back = p.back.slice();
  for (const i of indices(p, cells)) {
    if (!p.independent || face === 'front') front[i] = 0;
    if (!p.independent || face === 'back') back[i] = 0;
  }
  return withLayers(p, front, back);
}

/** Cambia el modo de silueta. Al independizar se fija lo heredado para que nada cambie de golpe. */
export function setIndependent(p: Project, on: boolean): Project {
  if (p.independent === on) return p;
  if (!on) return { ...p, independent: false };
  return {
    ...p,
    front: effectiveLayer(p, 'front'),
    back: effectiveLayer(p, 'back'),
    independent: true,
  };
}

/** Aplica una transformación a ambas caras (compartida) o solo a la activa (independiente). */
function mapFaces(p: Project, face: Face, fn: (layer: Uint8Array) => Uint8Array): Project {
  if (p.independent) return withFace(p, face, fn(p[face]));
  return withLayers(p, fn(p.front), fn(p.back));
}

export function flipHorizontal(p: Project, face: Face): Project {
  return mapFaces(p, face, (l) => mirrorLayer(l, p.w, p.h));
}

/** Desplaza en coordenadas del modelo. Lo que sale de la rejilla se pierde. */
export function shift(p: Project, face: Face, dx: number, dy: number): Project {
  return mapFaces(p, face, (l) => {
    const out = new Uint8Array(l.length);
    for (let y = 0; y < p.h; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= p.h) continue;
      for (let x = 0; x < p.w; x++) {
        const sx = x - dx;
        if (sx >= 0 && sx < p.w) out[y * p.w + x] = l[sy * p.w + sx];
      }
    }
    return out;
  });
}

export function clearFaces(p: Project, face: Face): Project {
  return mapFaces(p, face, (l) => new Uint8Array(l.length));
}

/** Rodea la silueta de la cara (4-vecinos) con un color. */
export function outline(p: Project, face: Face, color: number): Project {
  const { w, h } = p;
  const layer = effectiveLayer(p, face);
  const cells: Cell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (layer[i]) continue;
      if (
        (x > 0 && layer[i - 1]) ||
        (x < w - 1 && layer[i + 1]) ||
        (y > 0 && layer[i - w]) ||
        (y < h - 1 && layer[i + w])
      ) {
        cells.push({ x, y });
      }
    }
  }
  return paint(p, face, cells, color);
}

/**
 * Copia los colores visibles de una cara a la otra y los fija (corta la herencia).
 * Con silueta compartida y espejo solo recolorea: nunca amplía la silueta.
 */
export function copyFace(p: Project, from: Face, mirror: boolean): Project {
  const to = otherFace(from);
  const src = effectiveLayer(p, from);
  const layer = mirror ? mirrorLayer(src, p.w, p.h) : src.slice();
  if (!p.independent && mirror) {
    const current = effectiveLayer(p, to);
    for (let i = 0; i < layer.length; i++) {
      if (!current[i]) layer[i] = 0;
      else if (!layer[i]) layer[i] = p[to][i];
    }
  }
  return withFace(p, to, layer);
}

/** Cambia el tamaño de la rejilla: alinea abajo y centra en horizontal. */
export function resize(p: Project, newW: number, newH: number): Project {
  const w = clampInt(newW, LIMITS.w);
  const h = clampInt(newH, LIMITS.h);
  if (w === p.w && h === p.h) return p;
  const ox = Math.floor((w - p.w) / 2);
  const oy = h - p.h;
  const fit = (l: Uint8Array): Uint8Array => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < p.h; y++) {
      const ty = y + oy;
      if (ty < 0 || ty >= h) continue;
      for (let x = 0; x < p.w; x++) {
        const tx = x + ox;
        if (tx >= 0 && tx < w) out[ty * w + tx] = l[y * p.w + x];
      }
    }
    return out;
  };
  return { ...p, w, h, front: fit(p.front), back: fit(p.back) };
}

export function recolor(p: Project, color: number, hex: string): Project {
  const i = color - 1;
  if (i < 0 || i >= p.palette.length || !HEX_RE.test(hex)) return p;
  const value = hex.toLowerCase();
  if (p.palette[i] === value) return p;
  const palette = p.palette.slice();
  palette[i] = value;
  return { ...p, palette };
}

export function addColor(p: Project, hex: string): Project {
  if (p.palette.length >= LIMITS.paletteMax || !HEX_RE.test(hex)) return p;
  return { ...p, palette: [...p.palette, hex.toLowerCase()] };
}

/** Cambia el grosor. Si la piel estaba al máximo, sigue al máximo. */
export function setDepth(p: Project, value: number): Project {
  const depth = clampInt(value, LIMITS.depth);
  if (depth === p.depth) return p;
  const skin = p.skin >= maxSkin(p.depth) ? maxSkin(depth) : Math.min(p.skin, maxSkin(depth));
  return { ...p, depth, skin };
}

export function setSkin(p: Project, value: number): Project {
  const skin = clampInt(value, [1, maxSkin(p.depth)]);
  return skin === p.skin ? p : { ...p, skin };
}

export function setPixelMm(p: Project, value: number): Project {
  if (!Number.isFinite(value)) return p;
  const [min, max] = LIMITS.pixelMm;
  const mm = Math.min(max, Math.max(min, Math.round(value * 100) / 100));
  return mm === p.pixelMm ? p : { ...p, pixelMm: mm };
}

export function setBase(p: Project, patch: Partial<BaseSettings>): Project {
  const base = { ...p.base, ...patch };
  base.diameter = clampInt(base.diameter, LIMITS.baseDiameter);
  base.height = clampInt(base.height, LIMITS.baseHeight);
  base.color = HEX_RE.test(base.color) ? base.color.toLowerCase() : p.base.color;
  const same = (Object.keys(base) as (keyof BaseSettings)[]).every((k) => base[k] === p.base[k]);
  return same ? p : { ...p, base };
}

export function setName(p: Project, name: string): Project {
  const value = name.slice(0, LIMITS.nameMax);
  return value === p.name ? p : { ...p, name: value };
}
