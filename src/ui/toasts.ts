/** Mensajes breves. Las acciones destructivas ofrecen deshacer en vez de pedir confirmación. */
import { h } from './dom';

const region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
document.body.append(region);

export function toast(text: string, action?: { label: string; run: () => void }, level: 'info' | 'error' = 'info'): void {
  const el = h('div', { class: `toast ${level}` }, h('span', {}, text));
  const close = (): void => el.remove();
  if (action) {
    el.append(
      h('button', { type: 'button', class: 'btn small', onclick: () => { action.run(); close(); } }, action.label),
    );
  }
  region.append(el);
  while (region.children.length > 3) region.firstElementChild!.remove();
  setTimeout(close, level === 'error' ? 8000 : 4500);
}
