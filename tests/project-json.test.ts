import { describe, expect, it } from 'vitest';
import { parseProject, serializeProject, validateProject } from '../src/model/project-json';
import { art, randomProject, rng } from './helpers';

type Loose = Record<string, any>;
const good = (): Loose => JSON.parse(serializeProject(art(['12......'], ['.3......'])));

describe('proyecto JSON', () => {
  it.each([1, 2, 3, 4, 5])('ida y vuelta conserva todo (semilla %i)', (seed) => {
    const p = randomProject(seed);
    expect(parseProject(serializeProject(p))).toEqual({ ok: true, project: p });
  });

  const bad: [string, (o: Loose) => unknown][] = [
    ['formato ajeno', (o) => (o.format = 'otro')],
    ['versión futura', (o) => (o.version = 99)],
    ['sin versión', (o) => delete o.version],
    ['ancho distinto de los datos', (o) => (o.w = 9)],
    ['ancho fuera de rango', (o) => (o.w = 4000)],
    ['alto no entero', (o) => (o.h = 8.5)],
    ['frente corto', (o) => o.front.pop()],
    ['espalda ausente', (o) => delete o.back],
    ['espalda con objeto', (o) => (o.back = { length: 64 })],
    ['paleta vacía', (o) => (o.palette = [])],
    ['paleta enorme', (o) => (o.palette = Array(33).fill('#000000'))],
    ['color inválido', (o) => (o.palette[0] = 'rojo')],
    ['color no texto', (o) => (o.palette[0] = 7)],
    ['índice alto', (o) => (o.front[3] = o.palette.length + 1)],
    ['índice negativo', (o) => (o.back[3] = -1)],
    ['índice decimal', (o) => (o.front[0] = 1.5)],
    ['índice nulo', (o) => (o.front[0] = null)],
    ['piel mayor que la mitad', (o) => (o.skin = 4)],
    ['grosor cero', (o) => (o.depth = 0)],
    ['píxel cero', (o) => (o.pixelMm = 0)],
    ['píxel texto', (o) => (o.pixelMm = '0.8')],
    ['interruptor no booleano', (o) => (o.independent = 1)],
    ['base nula', (o) => (o.base = null)],
    ['base con altura 9', (o) => (o.base.height = 9)],
    ['nombre no texto', (o) => (o.name = 5)],
  ];
  it.each(bad)('rechaza sin lanzar: %s', (_name, corrupt) => {
    const o = good();
    corrupt(o);
    const r = validateProject(o);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it.each(['', '{', 'null', '[]', '42', '"x"', '{"format":"pixelada"}', '\u0000'])('texto basura %j', (t) => {
    expect(parseProject(t).ok).toBe(false);
  });

  it('nunca lanza con JSON mutado al azar', () => {
    const r = rng(99);
    const text = serializeProject(art(['12......'], ['.3......']));
    for (let n = 0; n < 500; n++) {
      const i = Math.floor(r() * text.length);
      const c = String.fromCharCode(32 + Math.floor(r() * 95));
      const mutated = text.slice(0, i) + c + text.slice(i + 1 + Math.floor(r() * 3));
      expect(() => parseProject(mutated)).not.toThrow();
    }
  });
});
