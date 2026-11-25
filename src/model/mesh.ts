/** Mallado por caras expuestas. La misma malla alimenta la vista previa y el STL. */
import type { VoxelGrid } from './voxels';

type V3 = readonly [number, number, number];
interface Dir {
  n: V3;
  u: V3;
  v: V3;
}

/** Tangentes con u x v = normal, para que el orden p, p+u, p+u+v, p+v sea antihorario desde fuera. */
export const DIRS: readonly Dir[] = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];

/** Geometría no indexada, en unidades de vóxel: 6 vértices (2 triángulos) por cara. */
export interface Mesh {
  faces: number;
  positions: Float32Array;
  normals: Float32Array;
  /** Identificador de color (vóxel) de cada cara. */
  faceColor: Uint8Array;
}

const ORDER = [0, 1, 2, 0, 2, 3] as const;

/**
 * @param include qué vóxeles pertenecen al sólido. Se genera una cara contra todo
 *   vecino que no pertenezca, de modo que el sólido siempre queda cerrado.
 */
function meshWhere(g: VoxelGrid, include: (id: number) => boolean): Mesh {
  const { nx, ny, nz, data } = g;
  const member = new Uint8Array(256);
  for (let id = 1; id < 256; id++) member[id] = include(id) ? 1 : 0;

  const stride = [1, nx, nx * ny];
  const size = [nx, ny, nz];
  const visit = (emit: (dir: number, x: number, y: number, z: number, id: number) => void): void => {
    let i = 0;
    const pos = [0, 0, 0];
    for (let z = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++, i++) {
          const id = data[i];
          if (!member[id]) continue;
          pos[0] = x;
          pos[1] = y;
          pos[2] = z;
          for (let d = 0; d < 6; d++) {
            const axis = d >> 1;
            const positive = (d & 1) === 0;
            const outside = positive ? pos[axis] === size[axis] - 1 : pos[axis] === 0;
            const neighbour = outside ? 0 : data[i + (positive ? stride[axis] : -stride[axis])];
            if (!member[neighbour]) emit(d, x, y, z, id);
          }
        }
      }
    }
  };

  let faces = 0;
  visit(() => faces++);

  const positions = new Float32Array(faces * 18);
  const normals = new Float32Array(faces * 18);
  const faceColor = new Uint8Array(faces);
  let f = 0;
  let o = 0;
  visit((d, x, y, z, id) => {
    const { n, u, v } = DIRS[d];
    const px = x + (n[0] > 0 ? 1 : 0);
    const py = y + (n[1] > 0 ? 1 : 0);
    const pz = z + (n[2] > 0 ? 1 : 0);
    for (const c of ORDER) {
      const a = c === 1 || c === 2 ? 1 : 0;
      const b = c >= 2 ? 1 : 0;
      positions[o] = px + a * u[0] + b * v[0];
      positions[o + 1] = py + a * u[1] + b * v[1];
      positions[o + 2] = pz + a * u[2] + b * v[2];
      normals[o] = n[0];
      normals[o + 1] = n[1];
      normals[o + 2] = n[2];
      o += 3;
    }
    faceColor[f++] = id;
  });
  return { faces, positions, normals, faceColor };
}

export function meshAll(g: VoxelGrid): Mesh {
  return meshWhere(g, () => true);
}

/** Sólido cerrado formado solo por los vóxeles con esos identificadores. */
export function meshColors(g: VoxelGrid, ids: ReadonlySet<number>): Mesh {
  return meshWhere(g, (id) => ids.has(id));
}
