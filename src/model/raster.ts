/** Rasterizado en coordenadas de vista. Puede devolver celdas fuera de la rejilla. */
import type { Cell } from './faces';

export function line(x0: number, y0: number, x1: number, y1: number): Cell[] {
  const out: Cell[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function rect(x0: number, y0: number, x1: number, y1: number, filled: boolean): Cell[] {
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);
  const out: Cell[] = [];
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      if (filled || x === xa || x === xb || y === ya || y === yb) out.push({ x, y });
    }
  }
  return out;
}

/** Inundación 4-conexa iterativa sobre una capa; devuelve las celdas alcanzadas. */
export function flood(layer: Uint8Array, w: number, h: number, x: number, y: number): Cell[] {
  if (x < 0 || y < 0 || x >= w || y >= h) return [];
  const target = layer[y * w + x];
  const seen = new Uint8Array(w * h);
  const stack = [y * w + x];
  seen[stack[0]] = 1;
  const out: Cell[] = [];
  const visit = (i: number): void => {
    if (!seen[i] && layer[i] === target) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  while (stack.length) {
    const i = stack.pop()!;
    const cx = i % w;
    const cy = (i - cx) / w;
    out.push({ x: cx, y: cy });
    if (cx > 0) visit(i - 1);
    if (cx < w - 1) visit(i + 1);
    if (cy > 0) visit(i - w);
    if (cy < h - 1) visit(i + w);
  }
  return out;
}

/** Añade las celdas reflejadas respecto al eje vertical central. */
export function withSymmetry(cells: readonly Cell[], w: number): Cell[] {
  const out = cells.slice();
  for (const c of cells) {
    const mx = w - 1 - c.x;
    if (mx !== c.x) out.push({ x: mx, y: c.y });
  }
  return out;
}
