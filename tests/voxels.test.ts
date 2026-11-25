import { describe, expect, it } from 'vitest';
import { findComponents } from '../src/model/components';
import { BASE_ID, type Project } from '../src/model/types';
import { baseParityMismatch, buildVoxels, inDisc, voxelIndex } from '../src/model/voxels';
import { art } from './helpers';

/** Colores de la columna (0,0) de delante hacia atrás. */
function column(patch: Partial<Project>, f = '1', b = '2'): number[] {
  const p = art([`${f}.......`], [`${b}.......`], patch);
  const g = buildVoxels(p);
  return Array.from({ length: p.depth }, (_, k) => g.data[voxelIndex(g, g.originX, 0, g.originZ + p.depth - 1 - k)]);
}

describe('color por profundidad', () => {
  it('D par, piel máxima: mitad y mitad', () => {
    expect(column({ depth: 6, skin: 3 })).toEqual([1, 1, 1, 2, 2, 2]);
  });
  it('D impar: la capa central es del frente', () => {
    expect(column({ depth: 5, skin: 2 })).toEqual([1, 1, 1, 2, 2]);
    expect(column({ depth: 7, skin: 3 })).toEqual([1, 1, 1, 1, 2, 2, 2]);
  });
  it('piel fina: el interior es del frente', () => {
    expect(column({ depth: 6, skin: 1 })).toEqual([1, 1, 1, 1, 1, 2]);
    expect(column({ depth: 6, skin: 2 })).toEqual([1, 1, 1, 1, 2, 2]);
    expect(column({ depth: 5, skin: 1 })).toEqual([1, 1, 1, 1, 2]);
  });
  it('D = 1 toma el frente, o la espalda si no hay frente', () => {
    expect(column({ depth: 1, skin: 1 })).toEqual([1]);
    expect(column({ depth: 1, skin: 1 }, '.', '2')).toEqual([2]);
    expect(column({ depth: 1, skin: 1, independent: true }, '.', '2')).toEqual([2]);
  });
  it('en compartida la cara vacía hereda', () => {
    expect(column({ depth: 4, skin: 2 }, '.', '2')).toEqual([2, 2, 2, 2]);
    expect(column({ depth: 4, skin: 2 }, '1', '.')).toEqual([1, 1, 1, 1]);
  });
  it('en independiente cada mitad existe solo si su cara existe', () => {
    expect(column({ depth: 4, skin: 2, independent: true }, '1', '.')).toEqual([1, 1, 0, 0]);
    expect(column({ depth: 5, skin: 1, independent: true }, '.', '2')).toEqual([0, 0, 0, 2, 2]);
  });
});

describe('rejilla unificada', () => {
  it('recorta filas vacías y apoya los pies en la base', () => {
    const p = art(['........', '..1.....', '..1.....', '........'], null, {
      base: { enabled: true, diameter: 12, height: 2, bevel: false, color: '#222222' },
    });
    const g = buildVoxels(p);
    expect([g.nx, g.ny, g.nz]).toEqual([12, 4, 12]);
    expect(g.figureY).toBe(2);
    const x = g.originX + 2;
    expect(g.data[voxelIndex(g, x, 2, g.originZ)]).toBe(1);
    expect(g.data[voxelIndex(g, x, 3, g.originZ)]).toBe(1);
    expect(g.data[voxelIndex(g, 6, 1, 6)]).toBe(BASE_ID);
  });

  it('el disco mide exactamente su diámetro, par o impar', () => {
    for (let d = 4; d <= 128; d++) {
      let any = false;
      for (let z = 0; z < d; z++) any ||= inDisc(0, z, d, 0);
      expect(any).toBe(true);
    }
  });

  it('el bisel encoge solo la capa superior y no se aplica con altura 1', () => {
    const size = (height: number, y: number): number => {
      const g = buildVoxels(
        art(['........'], null, { base: { enabled: true, diameter: 10, height, bevel: true, color: '#222222' } }),
      );
      let n = 0;
      for (let x = 0; x < g.nx; x++) if (g.data[voxelIndex(g, x, y, 5)]) n++;
      return n;
    };
    expect(size(3, 0)).toBe(10);
    expect(size(3, 2)).toBe(8);
    expect(size(1, 0)).toBe(10);
  });

  it('avisa de paridad distinta', () => {
    const p = art(['1.......'], null, { depth: 6 });
    expect(baseParityMismatch({ ...p, base: { ...p.base, enabled: true, diameter: 12 } })).toBe(false);
    expect(baseParityMismatch({ ...p, base: { ...p.base, enabled: true, diameter: 13 } })).toBe(true);
  });
});

describe('partes sueltas', () => {
  it('una pieza conectada', () => {
    expect(findComponents(buildVoxels(art(['11......', '.1......'], null))).looseParts).toBe(0);
  });
  it('un píxel unido solo por la diagonal cuenta como suelto', () => {
    const c = findComponents(buildVoxels(art(['111.....', '111.....', '...1....'], null, { depth: 6 })));
    expect(c.looseParts).toBe(1);
    expect(c.looseVoxels).toBe(6);
  });
  it('una base que no cubre los pies también', () => {
    const base = { enabled: true, diameter: 4, height: 2, bevel: false, color: '#222222' };
    const rows = ['1......1', '11111111', '1......1'];
    expect(findComponents(buildVoxels(art(rows, null, { base }))).looseParts).toBe(1);
    const covered = art(rows, null, { base: { ...base, diameter: 14 } });
    expect(findComponents(buildVoxels(covered)).looseParts).toBe(0);
  });
  it('no se desborda con una figura enorme', () => {
    const p = art(['1'.repeat(96)], null);
    const n = 96 * 128;
    const g = buildVoxels({ ...p, w: 96, h: 128, depth: 32, skin: 16, front: new Uint8Array(n).fill(1), back: new Uint8Array(n) });
    expect(findComponents(g).sizes).toEqual([n * 32]);
  });
});
