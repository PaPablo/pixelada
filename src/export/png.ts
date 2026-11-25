/** PNG de una cara, tal como se ve en su panel (la espalda, vista desde detrás). */
import { hexToRgb } from '../model/color';
import { viewLayer } from '../model/faces';
import type { Face, Project } from '../model/types';

export const PNG_SCALE = 16;

export function facePng(p: Project, face: Face): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = p.w * PNG_SCALE;
  canvas.height = p.h * PNG_SCALE;
  const ctx = canvas.getContext('2d')!;
  viewLayer(p, face).forEach((c, i) => {
    if (!c) return;
    ctx.fillStyle = `rgb(${hexToRgb(p.palette[c - 1]).join(' ')})`;
    ctx.fillRect((i % p.w) * PNG_SCALE, Math.floor(i / p.w) * PNG_SCALE, PNG_SCALE, PNG_SCALE);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
