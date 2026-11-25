import { describe, expect, it } from 'vitest';
import { meshToStl } from '../src/export/stl';
import { DIRS, meshAll, meshColors } from '../src/model/mesh';
import { buildVoxels, type VoxelGrid } from '../src/model/voxels';
import { emptyProject } from '../src/model/types';
import { art, randomProject, readStl, signedVolume, unpairedEdges } from './helpers';

const count = (g: VoxelGrid): number => g.data.reduce((n, v) => n + (v ? 1 : 0), 0);

function cross(a: readonly number[], b: readonly number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]].map((x) => x + 0);
}

function occupiedBounds(g: VoxelGrid): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  g.data.forEach((v, i) => {
    if (!v) return;
    const c = [i % g.nx, Math.floor(i / g.nx) % g.ny, Math.floor(i / (g.nx * g.ny))];
    c.forEach((n, a) => {
      min[a] = Math.min(min[a], n);
      max[a] = Math.max(max[a], n + 1);
    });
  });
  return { min, max };
}

describe('mallado', () => {
  it('cada dirección cumple u x v = normal', () => {
    for (const { n, u, v } of DIRS) expect(cross(u, v)).toEqual([...n]);
  });

  it('un vóxel suelto da 6 caras y volumen 1', () => {
    const m = meshAll(buildVoxels(art(['1.......'], null, { depth: 1, skin: 1 })));
    expect(m.faces).toBe(6);
    expect(signedVolume(m)).toBeCloseTo(1);
    expect(unpairedEdges(m)).toBe(0);
  });

  it('vóxeles en diagonal siguen dando aristas emparejadas', () => {
    expect(unpairedEdges(meshAll(buildVoxels(art(['1.......', '.1......'], null))))).toBe(0);
  });

  it.each(Array.from({ length: 25 }, (_, i) => i + 1))('figura aleatoria %i: completa y por color, cerradas', (seed) => {
    const g = buildVoxels(randomProject(seed));
    const all = meshAll(g);
    expect(unpairedEdges(all)).toBe(0);
    expect(signedVolume(all)).toBeCloseTo(count(g), 3);
    expect(all.positions.length / 9).toBe(2 * all.faces);

    let volume = 0;
    for (const id of new Set(g.data)) {
      if (!id) continue;
      const part = meshColors(g, new Set([id]));
      expect(unpairedEdges(part)).toBe(0);
      const stl = meshToStl(part, 0.8);
      expect(readStl(stl).triangles).toBe(2 * part.faces);
      expect(stl.length).toBe(84 + 50 * 2 * part.faces);
      volume += signedVolume(part);
    }
    expect(volume).toBeCloseTo(count(g), 3);
  });
});

describe('STL', () => {
  it('tamaño, recuento y normales coherentes con el devanado', () => {
    const m = meshAll(buildVoxels(randomProject(7)));
    const bytes = meshToStl(m, 0.8);
    const stl = readStl(bytes);
    expect(stl.triangles).toBe(2 * m.faces);
    expect(bytes.length).toBe(84 + 50 * stl.triangles);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).not.toBe('solid');
    let wrong = 0;
    stl.vertices.forEach(([a, b, c], t) => {
      const n = cross(
        b.map((v, i) => v - a[i]),
        c.map((v, i) => v - a[i]),
      );
      const len = Math.hypot(...n);
      if (n.some((v, i) => Math.abs(v / len - stl.normals[t][i]) > 1e-3)) wrong++;
    });
    expect(wrong).toBe(0);
  });

  it('con base que contiene a la figura la caja es ps x (Ø, Ø, alto)', () => {
    const rows = ['........', '.111....', '.111....', '.1.1....'];
    for (const [d, depth] of [
      [16, 6],
      [17, 6],
      [20, 5],
      [8, 8],
    ]) {
      const p = art(rows, null, {
        depth,
        skin: 1,
        base: { enabled: true, diameter: d, height: 3, bevel: true, color: '#222222' },
      });
      const s = readStl(meshToStl(meshAll(buildVoxels(p)), p.pixelMm));
      const size = s.max.map((v, i) => v - s.min[i]);
      expect(size[0]).toBeCloseTo(0.8 * d, 4);
      expect(size[1]).toBeCloseTo(0.8 * d, 4);
      expect(size[2]).toBeCloseTo(0.8 * (3 + 3), 4);
      expect(s.min[2]).toBe(0);
    }
  });

  it.each([3, 11, 19, 23])('caja general = vóxeles ocupados, zMin = 0 (semilla %i)', (seed) => {
    const p = randomProject(seed);
    const g = buildVoxels(p);
    const { min, max } = occupiedBounds(g);
    const s = readStl(meshToStl(meshAll(g), p.pixelMm));
    const ps = p.pixelMm;
    const near = (a: number[], b: number[]): void => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
    near(s.min, [min[0] * ps, -max[2] * ps, min[1] * ps]);
    near(s.max, [max[0] * ps, -min[2] * ps, max[1] * ps]);
    expect(s.min[2]).toBe(0);
  });

  it('sin dibujo ni base sale una malla vacía', () => {
    const p = emptyProject();
    const m = meshAll(buildVoxels({ ...p, base: { ...p.base, enabled: false } }));
    expect(m.faces).toBe(0);
    expect(meshToStl(m, 0.8).length).toBe(84);
  });
});
