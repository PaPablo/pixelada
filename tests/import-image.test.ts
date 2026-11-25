import { describe, expect, it } from 'vitest';
import { hexToLinear, hexToRgb, rgbToHex } from '../src/model/color';
import { effectiveLayer, viewLayer } from '../src/model/faces';
import { importImage } from '../src/model/import-image';
import { buildPalette, placeImage, resample, type Rgba } from '../src/model/quantize';
import { emptyProject } from '../src/model/types';
import { art, rng } from './helpers';

/** Imagen a partir de filas: '.' transparente, r/g/b/w colores. */
function image(rows: string[]): Rgba {
  const map: Record<string, number[]> = {
    '.': [9, 9, 9, 0], r: [255, 0, 0, 255], g: [0, 255, 0, 255], b: [0, 0, 255, 255], w: [255, 255, 255, 255], h: [255, 0, 0, 127],
  };
  return { width: rows[0].length, height: rows.length, data: rows.flatMap((r) => [...r].flatMap((c) => map[c])) };
}

const rgb = { palette: ['#ff0000', '#00ff00', '#0000ff'] };

describe('color', () => {
  it('ida y vuelta y conversión a lineal', () => {
    expect(rgbToHex(...hexToRgb('#0a80ff'))).toBe('#0a80ff');
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2159, 3);
  });
});

describe('encaje y muestreo', () => {
  it('mantiene proporción, abajo y centrada', () => {
    expect(placeImage(10, 10, 32, 48)).toEqual({ x: 0, y: 16, w: 32, h: 32 });
    expect(placeImage(10, 100, 32, 48)).toEqual({ x: 13, y: 0, w: 5, h: 48 });
    expect(placeImage(1000, 1, 8, 8)).toEqual({ x: 0, y: 7, w: 8, h: 1 });
  });
  it('vecino más cercano no inventa colores; el suavizado promedia sin teñir bordes', () => {
    const img = image(['r.', 'r.']);
    expect([...resample(img, 1, 1, false)]).toEqual([9, 9, 9, 0]);
    const s = [...resample(img, 1, 1, true)];
    expect(s.slice(0, 3)).toEqual([255, 0, 0]);
    expect(s[3]).toBeCloseTo(128, -1);
  });
  it('ampliar con suavizado conserva los colores de origen', () => {
    const s = resample(image(['rg']), 4, 2, true);
    expect([...s.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...s.slice(12, 16)]).toEqual([0, 255, 0, 255]);
  });
});

describe('paleta', () => {
  it('con pocos colores son los exactos y nunca supera el máximo', () => {
    expect(buildPalette(image(['rgb.']).data, 16)).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    const r = rng(3);
    const noise = Array.from({ length: 4000 }, (_, i) => (i % 4 === 3 ? 255 : Math.floor(r() * 256)));
    const p = buildPalette(noise, 16);
    expect(p.length).toBeLessThanOrEqual(16);
    expect(p.length).toBeGreaterThan(12);
  });
});

describe('importar', () => {
  const base = { ...emptyProject(8, 8), ...rgb };
  it('cuantiza a la paleta actual y alfa < 128 es vacío', () => {
    const p = importImage(base, image(['rg', 'h.']), { target: 'front', palette: 'current', smooth: false });
    expect([p.front[0], p.front[7], p.front[63], p.front[56]]).toEqual([1, 2, 0, 0]);
  });
  it('a la espalda se ve como la imagen y se guarda espejada', () => {
    const p = importImage(base, image(['rg']), { target: 'back', palette: 'current', smooth: false });
    const view = viewLayer(p, 'back');
    expect([view[56], view[63]]).toEqual([1, 2]);
    expect([p.back[56], p.back[63]]).toEqual([2, 1]);
  });
  it('ambas: la espalda hereda, o se copia si es independiente', () => {
    const o = { target: 'both', palette: 'current', smooth: false } as const;
    const shared = importImage({ ...base, back: new Uint8Array(64).fill(3) }, image(['r.']), o);
    expect(shared.back.some(Boolean)).toBe(false);
    expect(effectiveLayer(shared, 'back')).toEqual(shared.front);
    expect(importImage({ ...base, independent: true }, image(['r.']), o).back[56]).toBe(1);
  });
  it('paleta nueva en una cara conserva los colores de la otra', () => {
    const p0 = art(['........'], ['3.......'], { palette: ['#010101', '#020202', '#030303'] });
    const p = importImage(p0, image(['rw']), { target: 'front', palette: 'new', smooth: false });
    expect(p.palette).toEqual(['#030303', '#ff0000', '#ffffff']);
    expect(p.back[0]).toBe(1);
    expect(p.front[63]).toBe(3);
  });
  it('paleta nueva con la otra cara llena de colores no pasa de 32', () => {
    const palette = Array.from({ length: 32 }, (_, i) => rgbToHex(i, i, i));
    const back = Uint8Array.from({ length: 64 }, (_, i) => (i % 32) + 1);
    const p = importImage({ ...base, palette, back }, image(['rgbw']), { target: 'front', palette: 'new', smooth: false });
    expect(p.palette.length).toBe(32);
    expect(Math.max(...p.front)).toBeLessThanOrEqual(32);
  });
  it('imagen transparente no rompe la paleta', () => {
    const p = importImage(base, image(['..']), { target: 'both', palette: 'new', smooth: true });
    expect(p.palette).toEqual(rgb.palette);
  });
});
