/** Herramientas, historial e interruptores de vista. */
import type { Session, SessionState, Tool } from '../model/session';
import type { Store } from '../model/store';
import { h, setAttr } from './dom';
import { icon, type IconName } from './icons';

const TOOLS: readonly { tool: Tool; label: string; key: string }[] = [
  { tool: 'pencil', label: 'Lápiz', key: 'B' },
  { tool: 'eraser', label: 'Borrador', key: 'E' },
  { tool: 'fill', label: 'Rellenar', key: 'G' },
  { tool: 'picker', label: 'Gotero', key: 'I' },
  { tool: 'line', label: 'Línea', key: 'L' },
  { tool: 'rect', label: 'Rectángulo', key: 'R' },
  { tool: 'pan', label: 'Mover vista', key: 'H' },
];

type ToggleKey = 'rectFilled' | 'symmetry' | 'grid' | 'ghost';
const TOGGLES: readonly { key: ToggleKey; label: string; icon: IconName }[] = [
  { key: 'rectFilled', label: 'Rectángulo relleno', icon: 'solid' },
  { key: 'symmetry', label: 'Simetría horizontal', icon: 'symmetry' },
  { key: 'grid', label: 'Cuadrícula', icon: 'grid' },
  { key: 'ghost', label: 'Mostrar el otro lado como fantasma', icon: 'ghost' },
];

function iconButton(name: IconName, label: string, shortcut: string, onclick: () => void): HTMLButtonElement {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return h('button', { type: 'button', class: 'icon-btn', title, 'aria-label': title, onclick }, icon(name));
}

export function createToolbar(store: Store, session: Session, refocus: () => void): HTMLElement {
  const toolButtons = TOOLS.map(({ tool, label, key }) => {
    const b = iconButton(tool, label, key, () => {
      session.set({ tool });
      refocus();
    });
    b.dataset.tool = tool;
    return b;
  });
  const undo = iconButton('undo', 'Deshacer', 'Ctrl+Z', () => store.undo());
  const redo = iconButton('redo', 'Rehacer', 'Ctrl+Y', () => store.redo());
  const toggles = TOGGLES.map((t) => {
    const b = iconButton(t.icon, t.label, '', () => {
      const patch: Partial<SessionState> = { [t.key]: !session.state[t.key] };
      session.set(patch);
    });
    b.dataset.toggle = t.key;
    return b;
  });
  const el = h(
    'div',
    { class: 'toolbar', role: 'toolbar', 'aria-label': 'Herramientas' },
    h('div', { class: 'tool-group' }, ...toolButtons),
    h('div', { class: 'tool-group' }, undo, redo),
    h('div', { class: 'tool-group' }, ...toggles),
  );
  const sync = (): void => {
    const s = session.state;
    for (const b of toolButtons) setAttr(b, 'aria-pressed', String(b.dataset.tool === s.tool));
    toggles.forEach((b, i) => setAttr(b, 'aria-pressed', String(s[TOGGLES[i].key])));
    undo.disabled = !store.canUndo;
    redo.disabled = !store.canRedo;
  };
  store.subscribe(sync);
  session.subscribe(sync);
  sync();
  return el;
}
