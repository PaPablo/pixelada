/** Medidas y avisos en vivo. */
import { findComponents } from './components';
import type { Project } from './types';
import { baseParityMismatch, type VoxelGrid } from './voxels';

export interface Measures {
  /** null sin base. */
  baseMm: number | null;
  heightMm: number;
  depthMm: number;
  voxels: number;
}

export type NoticeId = 'empty' | 'loose' | 'thin' | 'tiny' | 'parity' | 'single';

export interface Notice {
  id: NoticeId;
  level: 'ok' | 'warn' | 'info';
  text: string;
}

export interface Analysis {
  measures: Measures;
  notices: Notice[];
}

const round = (v: number): number => Math.round(v * 100) / 100;
export const fmt = (v: number): string => round(v).toLocaleString('es-ES');
const plural = (n: number, one: string, many: string): string => `${fmt(n)} ${n === 1 ? one : many}`;

export const MIN_THICKNESS_MM = 1.2;
export const MIN_PIXEL_MM = 0.4;

export function analyze(p: Project, g: VoxelGrid): Analysis {
  const c = findComponents(g);
  const depthMm = round(p.depth * p.pixelMm);
  const notices: Notice[] = [];

  if (g.bottomRow < 0) {
    notices.push({ id: 'empty', level: 'info', text: 'La figura está vacía. Dibuja en cualquiera de las dos caras.' });
  }
  if (c.looseParts > 0) {
    const parts = plural(c.looseParts, 'parte suelta', 'partes sueltas');
    const verb = c.looseVoxels === 1 ? 'queda' : 'quedan';
    const vox = plural(c.looseVoxels, 'vóxel', 'vóxeles');
    notices.push({
      id: 'loose',
      level: 'warn',
      text: `${parts}: ${verb} ${vox} fuera del cuerpo principal. Únelas por un lado; la diagonal no cuenta.`,
    });
  }
  if (g.bottomRow >= 0 && depthMm < MIN_THICKNESS_MM) {
    notices.push({
      id: 'thin',
      level: 'warn',
      text: `Grosor de ${fmt(depthMm)} mm: por debajo de ${fmt(MIN_THICKNESS_MM)} mm se rompe con facilidad.`,
    });
  }
  if (p.pixelMm < MIN_PIXEL_MM) {
    notices.push({
      id: 'tiny',
      level: 'warn',
      text: `Píxel de ${fmt(p.pixelMm)} mm: menor que una boquilla de ${fmt(MIN_PIXEL_MM)} mm. Mejor resina que FDM.`,
    });
  }
  if (c.sizes.length === 1 && g.bottomRow >= 0) {
    notices.push({ id: 'single', level: 'ok', text: 'Una sola pieza conectada.' });
  }
  if (baseParityMismatch(p)) {
    notices.push({
      id: 'parity',
      level: 'info',
      text: 'El diámetro de la base y la figura no son ambos pares o impares: la base queda medio píxel descentrada.',
    });
  }
  return {
    measures: {
      baseMm: p.base.enabled ? round(p.base.diameter * p.pixelMm) : null,
      heightMm: round(g.ny * p.pixelMm),
      depthMm,
      voxels: c.total,
    },
    notices,
  };
}
