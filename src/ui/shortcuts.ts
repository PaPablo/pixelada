/** Atajos de teclado globales. No actúan mientras se escribe en un campo o hay un diálogo abierto. */
import type { Session, Tool } from '../model/session';
import type { Store } from '../model/store';
import type { Actions } from './actions';

const TOOL_KEYS: Record<string, Tool> = {
  b: 'pencil', e: 'eraser', g: 'fill', i: 'picker', l: 'line', r: 'rect', h: 'pan',
};

function isTyping(t: EventTarget | null): boolean {
  if (t instanceof HTMLInputElement) return !['checkbox', 'range', 'color', 'button', 'radio'].includes(t.type);
  return t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

export function bindShortcuts(store: Store, session: Session, actions: Actions): void {
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || isTyping(e.target) || document.querySelector('dialog[open]')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (key === 'z' && !e.shiftKey) store.undo();
      else if (key === 'y' || (key === 'z' && e.shiftKey)) store.redo();
      else return;
      e.preventDefault();
      return;
    }
    if (e.altKey || e.repeat) return;
    const tool = TOOL_KEYS[key];
    if (tool && !e.shiftKey) session.set({ tool });
    else if (key === 'c') actions.copy(e.shiftKey);
    else return;
    e.preventDefault();
  });
}
