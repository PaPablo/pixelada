/**
 * Rejilla de vóxeles unificada (figura + base).
 * Ejes: x a la derecha vista desde el frente, y hacia arriba, z hacia el frente.
 */
import { effectiveLayer } from './faces';
import { BASE_ID, type Project } from './types';

export interface VoxelGrid {
  nx: number;
  ny: number;
  nz: number;
  /** 0 vacío, 1..32 índice de paleta, BASE_ID base. Orden x + nx * (y + ny * z). */
  data: Uint8Array;
  /** Posición de la rejilla de dibujo dentro de la unificada. */
  originX: number;
  originZ: number;
  /** Altura de la base (0 sin base). Primera capa de la figura. */
  figureY: number;
  /** Última fila dibujada (apoya en figureY); -1 sin dibujo. */
  bottomRow: number;
}

export function voxelIndex(g: VoxelGrid, x: number, y: number, z: number): number {
  return x + g.nx * (y + g.ny * z);
}

/** Disco de diámetro d en su propia rejilla d x d, así mide exactamente d. */
export function inDisc(x: number, z: number, d: number, inset: number): boolean {
  const c = (d - 1) / 2;
  const r = d / 2 - inset;
  return r > 0 && (x - c) ** 2 + (z - c) ** 2 <= r * r;
}

export function figureDepthSplit(depth: number): number {
  return Math.ceil(depth / 2);
}

/**
 * Color de la capa k (0 = la más frontal) de una columna con colores efectivos f y b.
 * Devuelve 0 si la columna no existe en esa capa.
 */
export function columnColor(p: Project, f: number, b: number, k: number): number {
  const { depth, skin, independent } = p;
  const split = figureDepthSplit(depth);
  if (independent && depth > 1 && !(k < split ? f : b)) return 0;
  // Las capas traseras de la piel llevan la espalda; todo lo demás, el frente.
  const isBack = k >= split && k >= depth - skin;
  return isBack ? b || f : f || b;
}

export function buildVoxels(p: Project): VoxelGrid {
  const { w, depth, base } = p;
  const front = effectiveLayer(p, 'front');
  const back = effectiveLayer(p, 'back');

  let top = -1;
  let bottom = -1;
  for (let i = 0; i < front.length; i++) {
    if (front[i] || back[i]) {
      const y = Math.floor(i / w);
      if (top < 0) top = y;
      bottom = y;
    }
  }
  const drawn = top < 0 ? 0 : bottom - top + 1;
  const b = base.enabled ? base.diameter : 0;
  const baseH = base.enabled ? base.height : 0;
  const nx = Math.max(w, b);
  const nz = Math.max(depth, b);
  const ny = baseH + drawn;
  const grid: VoxelGrid = {
    nx,
    ny,
    nz,
    data: new Uint8Array(nx * ny * nz),
    originX: Math.floor((nx - w) / 2),
    originZ: Math.floor((nz - depth) / 2),
    figureY: baseH,
    bottomRow: bottom,
  };

  const bx = Math.floor((nx - b) / 2);
  const bz = Math.floor((nz - b) / 2);
  for (let y = 0; y < baseH; y++) {
    const inset = base.bevel && baseH >= 2 && y === baseH - 1 ? 1 : 0;
    for (let z = 0; z < b; z++) {
      for (let x = 0; x < b; x++) {
        if (inDisc(x, z, b, inset)) grid.data[voxelIndex(grid, bx + x, y, bz + z)] = BASE_ID;
      }
    }
  }

  if (drawn) {
    for (let row = top; row <= bottom; row++) {
      const vy = baseH + (bottom - row);
      for (let x = 0; x < w; x++) {
        const f = front[row * w + x];
        const k0 = back[row * w + x];
        if (!f && !k0) continue;
        for (let k = 0; k < depth; k++) {
          const c = columnColor(p, f, k0, k);
          if (c) {
            const vz = grid.originZ + depth - 1 - k;
            grid.data[voxelIndex(grid, grid.originX + x, vy, vz)] = c;
          }
        }
      }
    }
  }
  return grid;
}

/** La base queda medio vóxel descentrada cuando su paridad no coincide con la figura. */
export function baseParityMismatch(p: Project): boolean {
  if (!p.base.enabled) return false;
  return (p.base.diameter - p.w) % 2 !== 0 || (p.base.diameter - p.depth) % 2 !== 0;
}

export function colorOfId(p: Project, id: number): string {
  return id === BASE_ID ? p.base.color : p.palette[id - 1];
}
