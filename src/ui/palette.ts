/** Paleta compartida por los dos paneles. */
import * as ops from '../model/ops';
import type { Session } from '../model/session';
import type { Store } from '../model/store';
import { HEX_RE, LIMITS } from '../model/types';
import { bindLive, h, setAttr } from './dom';

/** Color nuevo que no repite ninguno de la paleta. */
function freshColor(palette: readonly string[]): string {
  for (let i = 0; ; i++) {
    const hue = (palette.length * 137.5 + i * 41) % 360;
    const f = (n: number): string => {
      const k = (n + hue / 30) % 12;
      const v = 0.58 - 0.28 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    const hex = `#${f(0)}${f(8)}${f(4)}`;
    if (!palette.includes(hex)) return hex;
  }
}

export function createPalette(store: Store, session: Session, refocus: () => void): HTMLElement {
  const list = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Colores de la paleta' });
  const picker = h('input', { type: 'color', class: 'color-input', 'aria-label': 'Editar el color seleccionado' });
  const hex = h('input', {
    type: 'text', class: 'field hex', maxlength: 7, spellcheck: 'false', 'aria-label': 'Código hexadecimal del color seleccionado',
  });
  const add = h('button', { type: 'button', class: 'btn', onclick: () => {
    if (store.apply((p) => ops.addColor(p, freshColor(p.palette)))) {
      session.set({ color: store.project.palette.length });
      picker.click();
    }
  } }, 'Añadir color');

  bindLive(store, picker, (p, v) => ops.recolor(p, session.state.color, v));
  hex.addEventListener('change', () => {
    const v = hex.value.startsWith('#') ? hex.value : `#${hex.value}`;
    if (HEX_RE.test(v)) store.apply((p) => ops.recolor(p, session.state.color, v));
    sync();
  });

  let key = '';
  const sync = (): void => {
    const { palette } = store.project;
    let { color } = session.state;
    if (color > palette.length) {
      // Deshacer puede acortar la paleta.
      color = palette.length;
      session.set({ color });
    }
    const nextKey = palette.join();
    if (key !== nextKey) {
      key = nextKey;
      while (list.children.length > palette.length) list.lastElementChild!.remove();
      palette.forEach((c, i) => {
        let b = list.children[i] as HTMLButtonElement | undefined;
        if (!b) {
          b = h('button', { type: 'button', class: 'swatch', onclick: () => {
            session.set({ color: i + 1 });
            refocus();
          } });
          list.append(b);
        }
        b.style.setProperty('--swatch', c);
        setAttr(b, 'aria-label', `Color ${i + 1}: ${c}`);
        b.title = c;
      });
    }
    [...list.children].forEach((b, i) => setAttr(b, 'aria-pressed', String(i + 1 === color)));
    const value = palette[color - 1];
    if (picker.value !== value) picker.value = value;
    if (document.activeElement !== hex || !HEX_RE.test(hex.value)) hex.value = value;
    add.disabled = palette.length >= LIMITS.paletteMax;
  };
  store.subscribe(sync);
  session.subscribe(sync);
  sync();
  return h(
    'section',
    { class: 'palette', 'aria-label': 'Paleta' },
    list,
    h('div', { class: 'palette-tools' }, picker, hex, add),
  );
}
