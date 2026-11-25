/** Zoom y desplazamiento de un panel. Matemática pura, en píxeles CSS. */
import type { Cell } from '../model/faces';

export const MIN_SCALE = 1;
export const MAX_SCALE = 64;

export class Viewport {
  scale = 8;
  x = 0;
  y = 0;
  /** Mientras sea true, el panel se reajusta solo al cambiar de tamaño. */
  auto = true;

  /** Encaja la rejilla usando el ancho y el alto disponibles. */
  fit(w: number, h: number, vw: number, vh: number, margin = 12): void {
    const raw = Math.min((vw - margin * 2) / w, (vh - margin * 2) / h);
    // Escala entera cuando cabe, para que todas las celdas midan lo mismo.
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw >= 2 ? Math.floor(raw) : raw));
    this.x = Math.round((vw - w * this.scale) / 2);
    this.y = Math.round((vh - h * this.scale) / 2);
    this.auto = true;
  }

  /** Cambia la escala manteniendo fijo el punto (cx, cy). */
  zoomTo(scale: number, cx: number, cy: number): void {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const k = next / this.scale;
    this.x = cx - (cx - this.x) * k;
    this.y = cy - (cy - this.y) * k;
    this.scale = next;
    this.auto = false;
  }

  pan(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.auto = false;
  }

  /** Evita perder la figura: siempre queda un trozo de rejilla a la vista. */
  keepVisible(w: number, h: number, vw: number, vh: number): void {
    const pad = 32;
    this.x = Math.min(vw - pad, Math.max(pad - w * this.scale, this.x));
    this.y = Math.min(vh - pad, Math.max(pad - h * this.scale, this.y));
  }

  cellAt(px: number, py: number): Cell {
    return { x: Math.floor((px - this.x) / this.scale), y: Math.floor((py - this.y) / this.scale) };
  }
}
