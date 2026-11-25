import { describe, expect, it } from 'vitest';
import { analyze } from '../src/model/analysis';
import * as ops from '../src/model/ops';
import { sampleProject } from '../src/model/sample';
import { Store } from '../src/model/store';
import { emptyProject } from '../src/model/types';
import { buildVoxels } from '../src/model/voxels';
import { art } from './helpers';

const dot = (x: number) => (p: ReturnType<typeof emptyProject>) => ops.paint(p, 'front', [{ x: x % p.w, y: Math.floor(x / p.w) }], 1);

describe('historial', () => {
  it('guarda al menos 100 pasos y los recorre en ambos sentidos', () => {
    const s = new Store(emptyProject(16, 16));
    const first = s.project;
    for (let i = 0; i < 150; i++) expect(s.apply(dot(i))).toBe(true);
    const last = s.project;
    for (let i = 0; i < 150; i++) s.undo();
    expect(s.project).toEqual(first);
    expect(s.canUndo).toBe(false);
    for (let i = 0; i < 150; i++) s.redo();
    expect(s.project).toEqual(last);
  });
  it('una transacción es un solo paso y cancelar la revierte', () => {
    const s = new Store(emptyProject(16, 16));
    const first = s.project;
    s.begin();
    s.preview(dot(1)(s.project));
    s.preview(dot(2)(s.project));
    s.commit();
    s.undo();
    expect(s.project).toBe(first);
    s.begin();
    s.preview(dot(3)(s.project));
    s.cancel();
    expect(s.project).toBe(first);
  });
  it('deshacer durante un trazo lo cancela', () => {
    const s = new Store(emptyProject(16, 16));
    s.begin();
    s.preview(dot(1)(s.project));
    s.undo();
    expect(s.inTransaction).toBe(false);
    expect(s.project.front.some(Boolean)).toBe(false);
  });
  it('volver al valor inicial no crea un paso', () => {
    const s = new Store(emptyProject(16, 16));
    s.begin();
    s.preview(ops.setDepth(s.project, 8));
    s.preview(ops.setDepth(s.project, 6));
    s.commit();
    expect(s.canUndo).toBe(false);
  });
  it('restaura también paleta, tamaño y ajustes', () => {
    const s = new Store(emptyProject(16, 16));
    const first = s.project;
    s.apply((p) => ops.recolor(p, 1, '#abcdef'));
    s.apply((p) => ops.resize(p, 20, 30));
    s.apply((p) => ops.setBase(p, { diameter: 40 }));
    for (let i = 0; i < 3; i++) s.undo();
    expect(s.project).toEqual(first);
  });
});

describe('avisos y medidas', () => {
  const ids = (p: ReturnType<typeof emptyProject>): string[] => analyze(p, buildVoxels(p)).notices.map((n) => n.id);
  it('pieza única', () => expect(ids(art(['11......'], null))).toEqual(['single']));
  it('suelta, fina y pequeña', () => {
    const p = art(['1.1.....'], null, { depth: 2, skin: 1, pixelMm: 0.3 });
    expect(ids(p)).toEqual(['loose', 'thin', 'tiny']);
  });
  it('justo 1,2 mm no avisa', () => expect(ids(art(['1.......'], null, { depth: 3, skin: 1, pixelMm: 0.4 }))).toEqual(['single']));
  it('vacía', () => expect(ids(art(['........'], null))).toEqual(['empty']));
});

describe('caballero de ejemplo', () => {
  const p = sampleProject();
  it('mide 24 x 32, con frente y espalda distintos y silueta común', () => {
    expect([p.w, p.h, p.front.length, p.back.length]).toEqual([24, 32, 768, 768]);
    expect(p.back.some((c, i) => c && c !== p.front[i])).toBe(true);
    expect([...p.back].flatMap((c, i) => (c && !p.front[i] ? [`${i % 24},${Math.floor(i / 24)}`] : []))).toEqual([]);
  });
  it('es una sola pieza sobre su base', () => {
    const a = analyze(p, buildVoxels(p));
    expect(a.notices.map((n) => n.id)).toEqual(['single']);
    expect(a.measures).toMatchObject({ baseMm: 25.6, heightMm: 28, depthMm: 4.8 });
  });
});
