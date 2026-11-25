/** Aplica las herramientas a una cara. Recibe celdas de VISTA y convierte al modelo al final. */
import { viewLayer, viewToModel, type Cell } from '../model/faces';
import * as ops from '../model/ops';
import { flood, line, rect, withSymmetry } from '../model/raster';
import type { SessionState, Tool } from '../model/session';
import type { Face, Project } from '../model/types';

export type DrawTool = Exclude<Tool, 'pan' | 'picker'>;

type Options = Pick<SessionState, 'color' | 'symmetry' | 'rectFilled'>;

/** Pinta o borra celdas de vista, con simetría si está activa. */
export function applyCells(p: Project, face: Face, cells: readonly Cell[], erase: boolean, o: Options): Project {
  const all = (o.symmetry ? withSymmetry(cells, p.w) : cells).map((c) => viewToModel(face, c, p.w));
  return erase ? ops.erase(p, face, all) : ops.paint(p, face, all, o.color);
}

export function applyFill(p: Project, face: Face, at: Cell, o: Options): Project {
  const layer = viewLayer(p, face);
  const seeds = o.symmetry ? withSymmetry([at], p.w) : [at];
  const cells = seeds.flatMap((c) => flood(layer, p.w, p.h, c.x, c.y));
  return applyCells(p, face, cells, false, { ...o, symmetry: false });
}

/** Forma completa de línea o rectángulo, siempre desde el estado inicial del trazo. */
export function applyShape(base: Project, face: Face, tool: 'line' | 'rect', a: Cell, b: Cell, o: Options): Project {
  const cells = tool === 'line' ? line(a.x, a.y, b.x, b.y) : rect(a.x, a.y, b.x, b.y, o.rectFilled);
  return applyCells(base, face, cells, false, o);
}

/** Color visible en una celda de vista (0 = vacío o fuera). */
export function pickColor(p: Project, face: Face, c: Cell): number {
  if (c.x < 0 || c.y < 0 || c.x >= p.w || c.y >= p.h) return 0;
  return viewLayer(p, face)[c.y * p.w + c.x];
}
