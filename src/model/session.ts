/** Estado de la sesión de edición: no se guarda en el proyecto ni en el historial. */
import { Emitter } from './store';
import type { Face } from './types';

export type Tool = 'pencil' | 'eraser' | 'fill' | 'picker' | 'line' | 'rect' | 'pan';
export type Tab = Face | '3d';

export interface SessionState {
  tool: Tool;
  /** Índice de paleta + 1. */
  color: number;
  face: Face;
  /** Pestaña visible en pantallas estrechas. */
  tab: Tab;
  symmetry: boolean;
  grid: boolean;
  ghost: boolean;
  rectFilled: boolean;
  paint3d: boolean;
}

export class Session extends Emitter {
  private s: SessionState = {
    tool: 'pencil',
    color: 1,
    face: 'front',
    tab: 'front',
    symmetry: false,
    grid: true,
    ghost: false,
    rectFilled: false,
    paint3d: false,
  };

  get state(): Readonly<SessionState> {
    return this.s;
  }

  set(patch: Partial<SessionState>): void {
    const changed = (Object.keys(patch) as (keyof SessionState)[]).some((k) => patch[k] !== this.s[k]);
    if (!changed) return;
    this.s = { ...this.s, ...patch };
    this.emit();
  }

  /** Activa una cara y muestra su pestaña. */
  activate(face: Face): void {
    this.set({ face, tab: face });
  }
}
