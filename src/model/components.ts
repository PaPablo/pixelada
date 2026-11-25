/** Componentes conexas 6-vecinas por BFS iterativo. */
import type { VoxelGrid } from './voxels';

export interface Components {
  /** Vóxeles ocupados. */
  total: number;
  /** Tamaño de cada componente, de mayor a menor. */
  sizes: number[];
  /** Componentes además del cuerpo principal (el mayor). */
  looseParts: number;
  looseVoxels: number;
}

export function findComponents(g: VoxelGrid): Components {
  const { nx, ny, nz, data } = g;
  const layer = nx * ny;
  const seen = new Uint8Array(data.length);
  const queue = new Int32Array(data.length);
  const sizes: number[] = [];

  for (let start = 0; start < data.length; start++) {
    if (!data[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % nx;
      const y = Math.floor(i / nx) % ny;
      const z = Math.floor(i / layer);
      for (let d = 0; d < 6; d++) {
        let j: number;
        if (d === 0) j = x < nx - 1 ? i + 1 : -1;
        else if (d === 1) j = x > 0 ? i - 1 : -1;
        else if (d === 2) j = y < ny - 1 ? i + nx : -1;
        else if (d === 3) j = y > 0 ? i - nx : -1;
        else if (d === 4) j = z < nz - 1 ? i + layer : -1;
        else j = z > 0 ? i - layer : -1;
        if (j >= 0 && data[j] && !seen[j]) {
          seen[j] = 1;
          queue[tail++] = j;
        }
      }
    }
    sizes.push(tail);
  }
  sizes.sort((a, b) => b - a);
  const total = sizes.reduce((a, b) => a + b, 0);
  return {
    total,
    sizes,
    looseParts: Math.max(0, sizes.length - 1),
    looseVoxels: total - (sizes[0] ?? 0),
  };
}
