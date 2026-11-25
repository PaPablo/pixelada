/** Dibujo de un panel 2D en su lienzo. */
import { effectiveLayer, mirrorLayer, otherFace, viewLayer, type Cell } from '../model/faces';
import type { Face, Project } from '../model/types';
import type { Viewport } from './viewport';

export interface DrawOptions {
  grid: boolean;
  symmetry: boolean;
  ghost: boolean;
  hover: Cell | null;
}

const CHECK: readonly [number, number, number][] = [
  [58, 45, 56],
  [48, 37, 47],
];

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export class PanelRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buffer = document.createElement('canvas');
  private readonly ghost = document.createElement('canvas');

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(p: Project, face: Face, v: Viewport, cssW: number, cssH: number, o: DrawOptions): void {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(cssW * dpr));
    const ch = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const { w, h } = p;
    const layer = viewLayer(p, face);
    this.paintLayer(this.buffer, layer, p, true);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    const s = v.scale * dpr;
    const x0 = Math.round(v.x * dpr);
    const y0 = Math.round(v.y * dpr);
    const gw = Math.round(w * s);
    const gh = Math.round(h * s);
    ctx.drawImage(this.buffer, x0, y0, gw, gh);

    if (o.ghost) this.drawGhost(p, face, x0, y0, s, gw, gh, dpr);

    const line = Math.max(1, Math.round(dpr));
    if (o.grid && v.scale >= 4) {
      for (let x = 0; x <= w; x++) {
        ctx.fillStyle = x % 8 === 0 ? 'rgba(255,214,190,.42)' : 'rgba(255,214,190,.11)';
        ctx.fillRect(x0 + Math.round(x * s), y0, line, gh);
      }
      for (let y = 0; y <= h; y++) {
        ctx.fillStyle = y % 8 === 0 ? 'rgba(255,214,190,.42)' : 'rgba(255,214,190,.11)';
        ctx.fillRect(x0, y0 + Math.round(y * s), gw, line);
      }
    }
    ctx.strokeStyle = 'rgba(255,214,190,.55)';
    ctx.lineWidth = line;
    ctx.strokeRect(x0 - line / 2, y0 - line / 2, gw + line, gh + line);

    if (o.symmetry) {
      ctx.strokeStyle = '#ff7a2f';
      ctx.lineWidth = 2 * line;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(x0 + gw / 2, y0 - 6 * dpr);
      ctx.lineTo(x0 + gw / 2, y0 + gh + 6 * dpr);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (o.hover && o.hover.x >= 0 && o.hover.y >= 0 && o.hover.x < w && o.hover.y < h) {
      const hx = x0 + Math.round(o.hover.x * s);
      const hy = y0 + Math.round(o.hover.y * s);
      const hs = Math.max(2, Math.round(s));
      ctx.lineWidth = line;
      ctx.strokeStyle = '#000';
      ctx.strokeRect(hx - 0.5, hy - 0.5, hs + 1, hs + 1);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(hx + line - 0.5, hy + line - 0.5, hs + 1 - 2 * line, hs + 1 - 2 * line);
    }
  }

  private paintLayer(target: HTMLCanvasElement, layer: Uint8Array, p: Project, checker: boolean): void {
    const { w, h } = p;
    if (target.width !== w || target.height !== h) {
      target.width = w;
      target.height = h;
    }
    const ctx = target.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const palette = p.palette.map(hexToRgb);
    for (let i = 0; i < layer.length; i++) {
      const c = layer[i];
      if (!c && !checker) continue;
      const y = Math.floor(i / w);
      const rgb = c ? palette[c - 1] : CHECK[((i % w) + y) & 1];
      img.data.set(rgb, i * 4);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /** La otra cara, alineada en coordenadas del modelo: colores tenues y contorno. */
  private drawGhost(
    p: Project, face: Face, x0: number, y0: number, s: number, gw: number, gh: number, dpr: number,
  ): void {
    const { ctx } = this;
    const { w, h } = p;
    const other = effectiveLayer(p, otherFace(face));
    const layer = face === 'back' ? mirrorLayer(other, w, h) : other;
    this.paintLayer(this.ghost, layer, p, false);
    ctx.globalAlpha = 0.32;
    ctx.drawImage(this.ghost, x0, y0, gw, gh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(120,225,255,.75)';
    const t = Math.max(1, Math.round(1.5 * dpr));
    const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : layer[y * w + x]);
    for (let y = 0; y <= h; y++) {
      for (let x = 0; x <= w; x++) {
        const px = x0 + Math.round(x * s);
        const py = y0 + Math.round(y * s);
        const here = at(x, y) !== 0;
        if (here !== (at(x - 1, y) !== 0)) ctx.fillRect(px, py, t, Math.ceil(s));
        if (here !== (at(x, y - 1) !== 0)) ctx.fillRect(px, py, Math.ceil(s), t);
      }
    }
  }
}
