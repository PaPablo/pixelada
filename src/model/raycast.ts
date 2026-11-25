/** Raycasting sobre la rejilla de vóxeles (DDA de Amanatides y Woo). */
import { viewToModelX, type Cell } from './faces';
import { BASE_ID, type Face, type Project } from './types';
import { figureDepthSplit, voxelIndex, type VoxelGrid } from './voxels';

type Vec3 = readonly [number, number, number];

export interface Hit {
  x: number;
  y: number;
  z: number;
  id: number;
  normal: [number, number, number];
}

/** Primer vóxel que toca el rayo, con la normal de la cara golpeada. */
export function raycast(g: VoxelGrid, origin: Vec3, dir: Vec3): Hit | null {
  const size = [g.nx, g.ny, g.nz];
  let tNear = 0;
  let tFar = Infinity;
  let axis = -1;
  for (let a = 0; a < 3; a++) {
    if (dir[a] === 0) {
      if (origin[a] < 0 || origin[a] >= size[a]) return null;
      continue;
    }
    const t0 = (0 - origin[a]) / dir[a];
    const t1 = (size[a] - origin[a]) / dir[a];
    const enter = Math.min(t0, t1);
    if (enter > tNear) {
      tNear = enter;
      axis = a;
    }
    tFar = Math.min(tFar, Math.max(t0, t1));
  }
  if (tNear >= tFar) return null;

  const pos = [0, 0, 0];
  const step = [0, 0, 0];
  const tMax = [Infinity, Infinity, Infinity];
  const tDelta = [Infinity, Infinity, Infinity];
  for (let a = 0; a < 3; a++) {
    const p = origin[a] + dir[a] * tNear;
    // En la cara de entrada, el redondeo puede caer al otro lado: se fija a mano.
    const v = a === axis ? (dir[a] > 0 ? 0 : size[a] - 1) : Math.floor(p);
    pos[a] = Math.min(size[a] - 1, Math.max(0, v));
    if (dir[a] === 0) continue;
    step[a] = Math.sign(dir[a]);
    tDelta[a] = Math.abs(1 / dir[a]);
    tMax[a] = (pos[a] + (step[a] > 0 ? 1 : 0) - origin[a]) / dir[a];
  }

  for (;;) {
    const id = g.data[voxelIndex(g, pos[0], pos[1], pos[2])];
    if (id) {
      const normal: [number, number, number] = [0, 0, 0];
      if (axis >= 0) normal[axis] = -step[axis];
      return { x: pos[0], y: pos[1], z: pos[2], id, normal };
    }
    axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
    pos[axis] += step[axis];
    if (pos[axis] < 0 || pos[axis] >= size[axis]) return null;
    tMax[axis] += tDelta[axis];
  }
}

/**
 * Celda de VISTA y cara que corresponden a un impacto, o null si no es pintable:
 * la base, los laterales y las caras interiores de una silueta independiente no lo son.
 */
export function hitToCell(p: Project, g: VoxelGrid, hit: Hit): { face: Face; cell: Cell } | null {
  if (hit.id === BASE_ID || hit.normal[2] === 0) return null;
  const k = g.originZ + p.depth - 1 - hit.z;
  const face: Face = hit.normal[2] > 0 ? 'front' : 'back';
  if ((face === 'front') !== k < figureDepthSplit(p.depth)) return null;
  const x = hit.x - g.originX;
  const y = g.bottomRow - (hit.y - g.figureY);
  if (x < 0 || x >= p.w || y < 0 || y >= p.h) return null;
  return { face, cell: { x: viewToModelX(face, x, p.w), y } };
}
