import type { Mesh } from '../src/model/mesh';
import { emptyProject, type Project } from '../src/model/types';

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Figura a partir de filas de texto: '.' vacío, '1'-'9' índice de paleta. */
export function art(front: string[], back: string[] | null, patch: Partial<Project> = {}): Project {
  const w = Math.max(8, front[0].length);
  const h = Math.max(8, front.length);
  const base = emptyProject(w, h);
  const layer = (rows: string[]): Uint8Array => {
    const out = new Uint8Array(w * h);
    rows.forEach((r, y) => [...r].forEach((c, x) => (out[y * w + x] = c === '.' ? 0 : Number(c))));
    return out;
  };
  return {
    ...base,
    front: layer(front),
    back: back ? layer(back) : new Uint8Array(w * h),
    base: { ...base.base, enabled: false },
    ...patch,
  };
}

export function randomProject(seed: number): Project {
  const r = rng(seed);
  const int = (a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
  const w = int(8, 20);
  const h = int(8, 20);
  const p = emptyProject(w, h);
  const fill = (): Uint8Array => Uint8Array.from({ length: w * h }, () => (r() < 0.5 ? 0 : int(1, 5)));
  const depth = int(1, 7);
  return {
    ...p,
    front: fill(),
    back: fill(),
    independent: r() < 0.5,
    depth,
    skin: int(1, Math.max(1, Math.floor(depth / 2))),
    pixelMm: 0.8,
    base: { enabled: r() < 0.7, diameter: int(4, 30), height: int(1, 8), bevel: r() < 0.5, color: '#123456' },
  };
}

/** Aristas dirigidas sin inversa, como multiconjunto (en diagonales hay 4 caras por arista). */
export function unpairedEdges(mesh: Mesh): number {
  const balance = new Map<string, number>();
  const p = mesh.positions;
  const key = (i: number): string => `${p[i]},${p[i + 1]},${p[i + 2]}`;
  for (let t = 0; t < p.length; t += 9) {
    const v = [key(t), key(t + 3), key(t + 6)];
    for (let k = 0; k < 3; k++) {
      const a = v[k];
      const b = v[(k + 1) % 3];
      const forward = a < b;
      const id = forward ? `${a}|${b}` : `${b}|${a}`;
      balance.set(id, (balance.get(id) ?? 0) + (forward ? 1 : -1));
    }
  }
  let bad = 0;
  for (const n of balance.values()) bad += Math.abs(n);
  return bad;
}

/** Volumen con signo (teorema de la divergencia): positivo si las caras miran hacia fuera. */
export function signedVolume(mesh: Mesh): number {
  const p = mesh.positions;
  let sum = 0;
  for (let t = 0; t < p.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.subarray(t, t + 9);
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return sum / 6;
}

export interface StlData {
  triangles: number;
  normals: number[][];
  vertices: number[][][];
  min: number[];
  max: number[];
}

export function readStl(bytes: Uint8Array): StlData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangles = view.getUint32(80, true);
  const normals: number[][] = [];
  const vertices: number[][][] = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < triangles; t++) {
    const o = 84 + t * 50;
    const v3 = (k: number): number[] => [0, 4, 8].map((d) => view.getFloat32(o + k * 12 + d, true));
    normals.push(v3(0));
    const tri = [v3(1), v3(2), v3(3)];
    vertices.push(tri);
    for (const v of tri) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], v[a]);
        max[a] = Math.max(max[a], v[a]);
      }
    }
  }
  return { triangles, normals, vertices, min, max };
}
