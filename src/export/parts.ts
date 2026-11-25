/** Piezas por color para impresión multimaterial. */
import { meshAll, meshColors, type Mesh } from '../model/mesh';
import type { Project } from '../model/types';
import { colorOfId, type VoxelGrid } from '../model/voxels';
import { meshToStl } from './stl';
import type { ZipEntry } from './zip';

export interface ColorPart {
  hex: string;
  mesh: Mesh;
}

/** Nombre de archivo seguro en cualquier sistema. */
export function slug(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'figura';
}

/** Un sólido cerrado por color. Los colores iguales (también el de la base) van juntos. */
export function colorParts(p: Project, grid: VoxelGrid): ColorPart[] {
  const groups = new Map<string, Set<number>>();
  const used = [...new Set(grid.data)].filter(Boolean).sort((a, b) => a - b);
  for (const id of used) {
    const hex = colorOfId(p, id);
    const set = groups.get(hex);
    if (set) set.add(id);
    else groups.set(hex, new Set([id]));
  }
  return [...groups].map(([hex, ids]) => ({ hex, mesh: meshColors(grid, ids) }));
}

/** Pieza completa y una pieza por color, todas con el mismo origen para que encajen solas. */
export function multicolorFiles(p: Project, grid: VoxelGrid): ZipEntry[] {
  const base = slug(p.name);
  const files: ZipEntry[] = [{ name: `${base}_completa.stl`, data: meshToStl(meshAll(grid), p.pixelMm) }];
  colorParts(p, grid).forEach((part, i) => {
    const n = String(i + 1).padStart(2, '0');
    files.push({ name: `${base}_${n}_${part.hex.slice(1)}.stl`, data: meshToStl(part.mesh, p.pixelMm) });
  });
  return files;
}
