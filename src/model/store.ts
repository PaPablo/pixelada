/** Estado del proyecto con transacciones e historial. Sin DOM. */
import { History } from './history';
import type { Project } from './types';

export type Listener = () => void;

export class Emitter {
  private readonly listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected emit(): void {
    for (const fn of [...this.listeners]) fn();
  }
}

function sameArray(a: ArrayLike<unknown>, b: ArrayLike<unknown>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Igualdad de contenido: evita pasos de historial que no cambian nada. */
export function sameProject(a: Project, b: Project): boolean {
  if (a === b) return true;
  for (const k of ['name', 'w', 'h', 'independent', 'depth', 'skin', 'pixelMm'] as const) {
    if (a[k] !== b[k]) return false;
  }
  for (const k of ['enabled', 'diameter', 'height', 'bevel', 'color'] as const) {
    if (a.base[k] !== b.base[k]) return false;
  }
  return sameArray(a.palette, b.palette) && sameArray(a.front, b.front) && sameArray(a.back, b.back);
}

export class Store extends Emitter {
  private readonly history = new History<Project>(200);
  private current: Project;
  private base: Project | null = null;

  constructor(initial: Project) {
    super();
    this.current = initial;
  }

  get project(): Project {
    return this.current;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get inTransaction(): boolean {
    return this.base !== null;
  }

  /** Estado al empezar la transacción (o el actual si no hay). */
  get baseline(): Project {
    return this.base ?? this.current;
  }

  begin(): void {
    if (this.base) this.commit();
    this.base = this.current;
  }

  /** Cambio en vivo: se ve al instante, pero no entra en el historial hasta commit(). */
  preview(next: Project): void {
    if (next === this.current) return;
    this.current = next;
    this.emit();
  }

  commit(): void {
    const base = this.base;
    this.base = null;
    if (base && !sameProject(base, this.current)) {
      this.history.push(base);
      this.emit();
    }
  }

  cancel(): void {
    const base = this.base;
    this.base = null;
    if (base && base !== this.current) {
      this.current = base;
      this.emit();
    }
  }

  /** Cambio de un solo paso. Devuelve si cambió algo. */
  apply(fn: (p: Project) => Project): boolean {
    if (this.base) this.commit();
    const next = fn(this.current);
    if (sameProject(next, this.current)) return false;
    this.history.push(this.current);
    this.current = next;
    this.emit();
    return true;
  }

  undo(): void {
    if (this.base) {
      this.cancel();
      return;
    }
    this.restore(this.history.undo(this.current));
  }

  redo(): void {
    if (this.base) return;
    this.restore(this.history.redo(this.current));
  }

  private restore(p: Project | null): void {
    if (!p) return;
    this.current = p;
    this.emit();
  }
}
