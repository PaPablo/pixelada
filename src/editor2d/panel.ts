/** Panel 2D de una cara: Pointer Events, trazos, zoom y pellizco. */
import type { Cell } from '../model/faces';
import { line } from '../model/raster';
import type { Session } from '../model/session';
import type { Store } from '../model/store';
import type { Face } from '../model/types';
import { PanelRenderer } from './renderer';
import { applyCells, applyFill, applyShape, pickColor } from './tools';
import { Viewport } from './viewport';

interface Point {
  x: number;
  y: number;
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'free'; id: number; last: Cell; erase: boolean }
  | { kind: 'shape'; id: number; start: Cell; tool: 'line' | 'rect' }
  | { kind: 'fill'; id: number }
  | { kind: 'pick'; id: number }
  | { kind: 'pan'; id: number; last: Point }
  | { kind: 'pinch'; dist: number; mid: Point };

export interface PanelHooks {
  /** Cambió el zoom o el encuadre. */
  viewChanged(): void;
  /** Tab: pasar a la otra cara. */
  switchFace(): void;
  /** Escape: salir del lienzo. */
  leave(): void;
}

export class FacePanel {
  readonly canvas = document.createElement('canvas');
  readonly viewport = new Viewport();
  private readonly renderer: PanelRenderer;
  private readonly pointers = new Map<number, Point>();
  private gesture: Gesture = { kind: 'none' };
  private hover: Cell | null = null;
  private frame = 0;
  private gridKey = '';
  /** Con true, Tab navega como siempre (tras Escape o si se llegó con el teclado). */
  private tabFree = false;
  private pointerFocus = false;

  constructor(
    readonly face: Face,
    private readonly host: HTMLElement,
    private readonly store: Store,
    private readonly session: Session,
    private readonly hooks: PanelHooks,
  ) {
    const name = face === 'front' ? 'Frente' : 'Espalda';
    this.canvas.className = 'face-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute(
      'aria-label',
      `Lienzo: ${name}. Tab cambia de cara; Escape vuelve a las herramientas.`,
    );
    this.canvas.dataset.face = face;
    host.append(this.canvas);
    this.renderer = new PanelRenderer(this.canvas);
    this.bind();
    new ResizeObserver(() => this.refit()).observe(host);
    store.subscribe(() => this.requestDraw());
    session.subscribe(() => this.requestDraw());
  }

  focus(): void {
    this.pointerFocus = true;
    this.canvas.focus({ preventScroll: true });
    this.pointerFocus = false;
    this.tabFree = false;
  }

  private get size(): { w: number; h: number } {
    return { w: this.host.clientWidth, h: this.host.clientHeight };
  }

  fit(): void {
    const { w, h } = this.size;
    if (!w || !h) return;
    const p = this.store.project;
    this.viewport.fit(p.w, p.h, w, h);
    this.viewChanged();
  }

  zoom(factor: number): void {
    const { w, h } = this.size;
    this.viewport.zoomTo(this.viewport.scale * factor, w / 2, h / 2);
    this.viewChanged();
  }

  private refit(): void {
    if (this.viewport.auto) this.fit();
    else this.viewChanged();
  }

  private viewChanged(): void {
    const { w, h } = this.size;
    const p = this.store.project;
    if (w && h) this.viewport.keepVisible(p.w, p.h, w, h);
    this.hooks.viewChanged();
    this.requestDraw();
  }

  private requestDraw(): void {
    if (!this.frame) this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    this.frame = 0;
    const { w, h } = this.size;
    if (!w || !h) return;
    const p = this.store.project;
    const key = `${p.w}x${p.h}`;
    if (key !== this.gridKey) {
      this.gridKey = key;
      this.fit();
    }
    const s = this.session.state;
    this.renderer.draw(p, this.face, this.viewport, w, h, {
      grid: s.grid,
      symmetry: s.symmetry,
      ghost: s.ghost && s.face === this.face,
      hover: this.hover,
    });
  }

  private point(e: PointerEvent | WheelEvent): Point {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bind(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e, false));
    c.addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener('lostpointercapture', (e) => this.up(e, false));
    c.addEventListener('pointerleave', () => this.setHover(null));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const { x, y } = this.point(e);
        const unit = e.deltaMode === 1 ? 16 : 1;
        const delta = Math.max(-120, Math.min(120, e.deltaY * unit));
        this.viewport.zoomTo(this.viewport.scale * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0025)), x, y);
        this.viewChanged();
      },
      { passive: false },
    );
    c.addEventListener('focus', () => {
      if (!this.pointerFocus && c.matches(':focus-visible')) this.tabFree = true;
      this.session.activate(this.face);
    });
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.tabFree = true;
        if (this.store.inTransaction) this.abort();
        else this.hooks.leave();
      } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !this.tabFree) {
        e.preventDefault();
        this.hooks.switchFace();
      }
    });
  }

  private setHover(cell: Cell | null): void {
    if (cell?.x === this.hover?.x && cell?.y === this.hover?.y) return;
    this.hover = cell;
    this.requestDraw();
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    this.focus();
    this.session.activate(this.face);
    const pt = this.point(e);
    this.pointers.set(e.pointerId, pt);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // El puntero puede haberse soltado ya.
    }
    if (this.pointers.size === 2) {
      this.abort();
      this.gesture = { kind: 'pinch', ...this.pinchState() };
      return;
    }
    if (this.pointers.size > 2 || this.gesture.kind !== 'none') return;

    const s = this.session.state;
    const id = e.pointerId;
    if (e.button === 1 || s.tool === 'pan') {
      if (e.button <= 1) this.gesture = { kind: 'pan', id, last: pt };
      return;
    }
    if (e.button !== 0) return;
    const cell = this.viewport.cellAt(pt.x, pt.y);
    const { face, store } = this;
    switch (s.tool) {
      case 'pencil':
      case 'eraser': {
        const erase = s.tool === 'eraser';
        store.begin();
        this.gesture = { kind: 'free', id, last: cell, erase };
        store.preview(applyCells(store.project, face, [cell], erase, s));
        break;
      }
      case 'line':
      case 'rect':
        store.begin();
        this.gesture = { kind: 'shape', id, start: cell, tool: s.tool };
        store.preview(applyShape(store.baseline, face, s.tool, cell, cell, s));
        break;
      case 'fill':
        store.begin();
        this.gesture = { kind: 'fill', id };
        store.preview(applyFill(store.project, face, cell, s));
        break;
      case 'picker':
        this.gesture = { kind: 'pick', id };
        this.pick(cell);
        break;
    }
  }

  private pick(cell: Cell): void {
    const color = pickColor(this.store.project, this.face, cell);
    if (color) this.session.set({ color });
  }

  private move(e: PointerEvent): void {
    const pt = this.point(e);
    const cell = this.viewport.cellAt(pt.x, pt.y);
    this.setHover(e.pointerType === 'touch' ? null : cell);
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, pt);
    const g = this.gesture;
    const { store, face } = this;

    if (g.kind === 'pinch') {
      if (this.pointers.size < 2) return;
      const next = this.pinchState();
      const v = this.viewport;
      v.pan(next.mid.x - g.mid.x, next.mid.y - g.mid.y);
      if (g.dist > 0) v.zoomTo((v.scale * next.dist) / g.dist, next.mid.x, next.mid.y);
      this.gesture = { kind: 'pinch', ...next };
      this.viewChanged();
      return;
    }
    if (g.kind === 'none' || g.id !== e.pointerId) return;
    const s = this.session.state;
    if (g.kind === 'pan') {
      this.viewport.pan(pt.x - g.last.x, pt.y - g.last.y);
      g.last = pt;
      this.viewChanged();
    } else if (g.kind === 'pick') {
      this.pick(cell);
    } else if (!store.inTransaction) {
      // Se canceló desde fuera (deshacer o Escape): el resto del arrastre no pinta.
      this.gesture = { kind: 'none' };
    } else if (g.kind === 'fill') {
      return;
    } else if (g.kind === 'shape') {
      store.preview(applyShape(store.baseline, face, g.tool, g.start, cell, s));
    } else {
      const events = e.getCoalescedEvents?.() ?? [];
      const cells: Cell[] = [];
      for (const ev of events.length ? events : [e]) {
        const q = this.point(ev);
        const to = this.viewport.cellAt(q.x, q.y);
        cells.push(...line(g.last.x, g.last.y, to.x, to.y));
        g.last = to;
      }
      store.preview(applyCells(store.project, face, cells, g.erase, s));
    }
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.delete(e.pointerId)) return;
    const g = this.gesture;
    if (g.kind === 'pinch') {
      // Los dedos que quedan apoyados no pintan: hay que soltarlos todos.
      if (this.pointers.size === 0) this.gesture = { kind: 'none' };
      return;
    }
    if (g.kind === 'none' || g.id !== e.pointerId) return;
    if (cancelled) this.abort();
    else if (g.kind === 'free' || g.kind === 'shape' || g.kind === 'fill') this.store.commit();
    this.gesture = { kind: 'none' };
  }

  /** Cancela el trazo en curso sin dejar rastro en el historial. */
  private abort(): void {
    const k = this.gesture.kind;
    if (k === 'free' || k === 'shape' || k === 'fill') this.store.cancel();
    this.gesture = { kind: 'none' };
  }

  private pinchState(): { dist: number; mid: Point } {
    const [a, b] = [...this.pointers.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }
}
