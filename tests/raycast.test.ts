import { describe, expect, it } from 'vitest';
import { viewLayer } from '../src/model/faces';
import { hitToCell, raycast } from '../src/model/raycast';
import { sampleProject } from '../src/model/sample';
import { buildVoxels, voxelIndex } from '../src/model/voxels';
import { art, randomProject, rng } from './helpers';

describe('raycast por vóxeles', () => {
  it('coincide con un recorrido a pasos muy finos', () => {
    const r = rng(42);
    let hits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = buildVoxels(randomProject(seed));
      const size = [g.nx, g.ny, g.nz];
      for (let n = 0; n < 40; n++) {
        const origin = size.map((s) => s / 2 + (r() - 0.5) * 80) as [number, number, number];
        const target = size.map((s) => r() * s);
        const d = target.map((t, a) => t - origin[a]);
        const len = Math.hypot(...d);
        const dir = d.map((v) => v / len) as [number, number, number];
        let slow = -1;
        for (let t = 0; t < 250 && slow < 0; t += 0.002) {
          const p = origin.map((o, a) => Math.floor(o + dir[a] * t));
          if (p.every((v, a) => v >= 0 && v < size[a])) {
            const i = voxelIndex(g, p[0], p[1], p[2]);
            if (g.data[i]) slow = i;
          }
        }
        const hit = raycast(g, origin, dir);
        const fast = hit ? voxelIndex(g, hit.x, hit.y, hit.z) : -1;
        // El paso fino puede saltarse una esquina rozada: entonces el DDA encuentra algo antes.
        if (fast === slow) hits++;
      }
    }
    expect(hits).toBeGreaterThan(12 * 40 * 0.98);
  });

  it('da la normal de la cara golpeada', () => {
    const g = buildVoxels(art(['1.......'], null, { depth: 3, skin: 1 }));
    expect(raycast(g, [0.5, 0.5, 50], [0, 0, -1])?.normal.map((v) => v + 0)).toEqual([0, 0, 1]);
    expect(raycast(g, [0.5, 0.5, -50], [0, 0, 1])?.normal.map((v) => v + 0)).toEqual([0, 0, -1]);
    expect(raycast(g, [0.5, 50, 1.5], [0, -1, 0])?.normal.map((v) => v + 0)).toEqual([0, 1, 0]);
    expect(raycast(g, [5.5, 0.5, 50], [0, 0, -1])).toBeNull();
    expect(raycast(g, [0.5, 0.5, 50], [0, 0, 1])).toBeNull();
  });
});

describe('impacto -> celda', () => {
  it('cada píxel del caballero se alcanza de frente y por detrás, en su celda de vista', () => {
    const p = sampleProject();
    const g = buildVoxels(p);
    for (const face of ['front', 'back'] as const) {
      const layer = viewLayer(p, face);
      for (let i = 0; i < layer.length; i++) {
        const xv = i % p.w;
        const y = Math.floor(i / p.w);
        const x = face === 'back' ? p.w - 1 - xv : xv;
        const vy = g.figureY + g.bottomRow - y;
        if (vy < g.figureY || vy >= g.ny) continue;
        const z = face === 'front' ? 200 : -200;
        const hit = raycast(g, [g.originX + x + 0.5, vy + 0.5, z], [0, 0, face === 'front' ? -1 : 1]);
        if (layer[i]) expect(hitToCell(p, g, hit!)).toEqual({ face, cell: { x: xv, y } });
        else expect(hit).toBeNull();
      }
    }
  });
  it('la base, los laterales y las caras interiores no se pintan', () => {
    const p = sampleProject();
    const g = buildVoxels(p);
    expect(hitToCell(p, g, raycast(g, [g.nx / 2, 1.5, 200], [0, 0, -1])!)).toBeNull();
    expect(hitToCell(p, g, raycast(g, [-50, g.figureY + 0.5, g.originZ + 1.5], [1, 0, 0])!)).toBeNull();
    const q = art(['1.......'], ['11......'], { independent: true });
    const gq = buildVoxels(q);
    const inner = raycast(gq, [1.5, 0.5, 50], [0, 0, -1])!;
    expect(inner.normal[2]).toBe(1);
    expect(hitToCell(q, gq, inner)).toBeNull();
  });
});
