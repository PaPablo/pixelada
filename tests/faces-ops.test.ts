import { describe, expect, it } from 'vitest';
import { effectiveAt, effectiveLayer, viewLayer, viewToModel } from '../src/model/faces';
import * as ops from '../src/model/ops';
import { flood, line, rect, withSymmetry } from '../src/model/raster';
import { emptyProject } from '../src/model/types';
import { art } from './helpers';

const blank = emptyProject(10, 12);

describe('espejo de la espalda', () => {
  it('pintar (xv, y) en la vista trasera modifica (W-1-xv, y)', () => {
    for (const w of [8, 9, 10]) {
      const p0 = emptyProject(w, 8);
      for (let xv = 0; xv < w; xv++) {
        const p = ops.paint(p0, 'back', [viewToModel('back', { x: xv, y: 3 }, w)], 4);
        expect(p.back[3 * w + (w - 1 - xv)]).toBe(4);
        expect(p.back.filter(Boolean).length).toBe(1);
        expect(viewLayer(p, 'back')[3 * w + xv]).toBe(4);
      }
    }
  });
  it('el frente no se espeja', () => {
    expect(viewToModel('front', { x: 2, y: 1 }, 10)).toEqual({ x: 2, y: 1 });
  });
});

describe('silueta compartida', () => {
  it('la otra cara hereda sin guardar nada y en vivo', () => {
    let p = ops.paint(blank, 'front', [{ x: 2, y: 2 }], 3);
    const i = 2 * 10 + 2;
    expect(p.back[i]).toBe(0);
    expect(effectiveAt(p, 'back', i)).toBe(3);
    p = ops.paint(p, 'front', [{ x: 2, y: 2 }], 5);
    expect(effectiveAt(p, 'back', i)).toBe(5);
  });
  it('deja de heredar al pintarla distinta', () => {
    let p = ops.paint(blank, 'front', [{ x: 2, y: 2 }], 3);
    p = ops.paint(p, 'back', [{ x: 2, y: 2 }], 7);
    p = ops.paint(p, 'front', [{ x: 2, y: 2 }], 1);
    const i = 2 * 10 + 2;
    expect([effectiveAt(p, 'front', i), effectiveAt(p, 'back', i)]).toEqual([1, 7]);
  });
  it('también hereda el frente de la espalda', () => {
    const p = ops.paint(blank, 'back', [{ x: 1, y: 1 }], 2);
    expect(effectiveAt(p, 'front', 11)).toBe(2);
  });
  it.each(['front', 'back'] as const)('borrar en %s borra en ambas', (face) => {
    let p = ops.paint(blank, 'front', [{ x: 2, y: 2 }], 3);
    p = ops.paint(p, 'back', [{ x: 2, y: 2 }], 4);
    p = ops.erase(p, face, [{ x: 2, y: 2 }]);
    expect(p.front.some(Boolean) || p.back.some(Boolean)).toBe(false);
  });
});

describe('silueta independiente', () => {
  it('no hereda y borra solo su cara', () => {
    let p = ops.setIndependent(blank, true);
    p = ops.paint(p, 'front', [{ x: 2, y: 2 }], 3);
    expect(effectiveAt(p, 'back', 22)).toBe(0);
    p = ops.paint(p, 'back', [{ x: 2, y: 2 }], 4);
    p = ops.erase(p, 'front', [{ x: 2, y: 2 }]);
    expect([p.front[22], p.back[22]]).toEqual([0, 4]);
  });
  it('al activarla se ve exactamente igual', () => {
    const p = art(['12......'], ['.34.....']);
    const q = ops.setIndependent(p, true);
    for (const f of ['front', 'back'] as const) expect(effectiveLayer(q, f)).toEqual(effectiveLayer(p, f));
  });
});

describe('operaciones', () => {
  it('sin cambios devuelve el mismo objeto', () => {
    expect(ops.erase(blank, 'front', [{ x: 1, y: 1 }])).toBe(blank);
    expect(ops.paint(blank, 'front', [{ x: -1, y: 99 }], 1)).toBe(blank);
    expect(ops.paint(blank, 'front', [{ x: 1, y: 1 }], 99)).toBe(blank);
    expect(ops.setBase(blank, { height: blank.base.height })).toBe(blank);
  });
  it('contorno 4-vecinos', () => {
    const p = ops.outline(art(['........', '..1.....'], null), 'front', 2);
    const on = [...p.front].flatMap((v, i) => (v === 2 ? [[i % 8, Math.floor(i / 8)]] : []));
    expect(on).toEqual([
      [2, 0],
      [1, 1],
      [3, 1],
      [2, 2],
    ]);
  });
  it('voltear y desplazar mueven ambas caras en compartida', () => {
    const p = art(['1.......'], ['2.......']);
    const f = ops.flipHorizontal(p, 'front');
    expect([f.front[7], f.back[7]]).toEqual([1, 2]);
    const s = ops.shift(p, 'back', 1, 2);
    expect([s.front[17], s.back[17]]).toEqual([1, 2]);
    expect(ops.shift(p, 'front', -1, 0).front.some(Boolean)).toBe(false);
  });
  it('en independiente solo la cara activa', () => {
    const p = art(['1.......'], ['2.......'], { independent: true });
    const f = ops.flipHorizontal(p, 'back');
    expect([f.front[0], f.back[7]]).toEqual([1, 2]);
    expect(ops.clearFaces(p, 'front').back[0]).toBe(2);
  });
  it('copiar fija colores; con espejo no amplía la silueta', () => {
    const p = art(['12......'], null);
    expect([...ops.copyFace(p, 'front', false).back.slice(0, 2)]).toEqual([1, 2]);
    const asym = art(['12....3.'], null);
    const q = ops.copyFace(asym, 'front', true);
    expect([...effectiveLayer(q, 'back').slice(0, 8)]).toEqual([1, 3, 0, 0, 0, 0, 2, 0]);
    const ind = ops.copyFace({ ...asym, independent: true }, 'front', true);
    expect([...ind.back.slice(0, 8)]).toEqual([0, 3, 0, 0, 0, 0, 2, 1]);
  });
  it('redimensionar alinea abajo y centra', () => {
    const e = '........';
    const p = art([e, e, e, e, e, e, e, '1......2'], null);
    const q = ops.resize(p, 12, 10);
    expect([q.front[9 * 12 + 2], q.front[9 * 12 + 9]]).toEqual([1, 2]);
    expect(ops.resize(q, 8, 8).front).toEqual(p.front);
  });
  it('grosor y piel se mantienen coherentes', () => {
    const p = ops.setDepth(blank, 10);
    expect(p.skin).toBe(5);
    expect(ops.setDepth(ops.setSkin(p, 2), 3).skin).toBe(1);
  });
});

describe('rasterizado', () => {
  it('línea de Bresenham sin huecos', () => {
    const l = line(0, 0, 7, 3);
    expect(l[0]).toEqual({ x: 0, y: 0 });
    expect(l.at(-1)).toEqual({ x: 7, y: 3 });
    for (let i = 1; i < l.length; i++) {
      expect(Math.max(Math.abs(l[i].x - l[i - 1].x), Math.abs(l[i].y - l[i - 1].y))).toBe(1);
    }
  });
  it('rectángulo relleno y contorno', () => {
    expect(rect(3, 3, 1, 1, true).length).toBe(9);
    expect(rect(1, 1, 3, 3, false).length).toBe(8);
  });
  it('la inundación no cruza diagonales', () => {
    const l = art(['1.......', '.1......'], null);
    expect(flood(l.front, 8, 8, 0, 0)).toEqual([{ x: 0, y: 0 }]);
    expect(flood(l.front, 8, 8, -1, 0)).toEqual([]);
  });
  it('simetría con ancho impar no duplica el eje', () => {
    expect(withSymmetry([{ x: 4, y: 0 }], 9).length).toBe(1);
    expect(withSymmetry([{ x: 0, y: 0 }], 9)[1]).toEqual({ x: 8, y: 0 });
  });
});
