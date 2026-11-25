/** Acciones sobre la cara activa (o ambas, según el modo de silueta). */
import * as ops from '../model/ops';
import type { Session } from '../model/session';
import type { Store } from '../model/store';
import { h } from './dom';
import { toast } from './toasts';

export interface Actions {
  outline(): void;
  flip(): void;
  /** Desplazamiento en coordenadas de vista de la cara activa. */
  shift(dx: number, dy: number): void;
  clear(): void;
  copy(mirror: boolean): void;
}

export function createActions(store: Store, session: Session): Actions {
  const undo = { label: 'Deshacer', run: () => store.undo() };
  return {
    outline: () => store.apply((p) => ops.outline(p, session.state.face, session.state.color)),
    flip: () => store.apply((p) => ops.flipHorizontal(p, session.state.face)),
    shift: (dx, dy) => {
      const { face } = session.state;
      store.apply((p) => ops.shift(p, face, face === 'back' ? -dx : dx, dy));
    },
    clear: () => {
      const { face } = session.state;
      if (store.apply((p) => ops.clearFaces(p, face))) {
        toast(store.project.independent ? `${face === 'front' ? 'Frente' : 'Espalda'}: limpio.` : 'Figura limpia.', undo);
      }
    },
    copy: (mirror) => {
      const { face } = session.state;
      const done = store.apply((p) => ops.copyFace(p, face, mirror));
      const text = face === 'front' ? 'Frente copiado a la espalda' : 'Espalda copiada al frente';
      toast(done ? `${text}${mirror ? ' (espejado)' : ''}.` : 'Las dos caras ya eran iguales.', done ? undo : undefined);
    },
  };
}

export function createActionBar(store: Store, session: Session, a: Actions): HTMLElement {
  const btn = (text: string, title: string, onclick: () => void, cls = ''): HTMLButtonElement =>
    h('button', { type: 'button', class: `btn ${cls}`, title, 'aria-label': title, onclick }, text);
  const mirror = h('input', { type: 'checkbox' });
  const copy = h('button', { type: 'button', class: 'btn', onclick: () => a.copy(mirror.checked) });
  const clear = btn('Limpiar', 'Limpiar', () => a.clear(), 'danger');
  const sync = (): void => {
    const back = session.state.face === 'back';
    copy.textContent = back ? 'Copiar espalda a frente' : 'Copiar frente a espalda';
    copy.title = `${copy.textContent} (C; Mayús+C espejado)`;
    const scope = store.project.independent ? (back ? 'la espalda' : 'el frente') : 'ambas caras';
    clear.title = `Limpiar ${scope}`;
  };
  store.subscribe(sync);
  session.subscribe(sync);
  sync();
  return h(
    'section',
    { class: 'action-bar', 'aria-label': 'Acciones' },
    btn('Contorno', 'Añadir contorno con el color actual', () => a.outline()),
    btn('Voltear', 'Voltear horizontalmente', () => a.flip()),
    h(
      'div',
      { class: 'arrows', role: 'group', 'aria-label': 'Desplazar 1 píxel' },
      btn('←', 'Desplazar a la izquierda', () => a.shift(-1, 0)),
      btn('↑', 'Desplazar hacia arriba', () => a.shift(0, -1)),
      btn('↓', 'Desplazar hacia abajo', () => a.shift(0, 1)),
      btn('→', 'Desplazar a la derecha', () => a.shift(1, 0)),
    ),
    clear,
    h('div', { class: 'copy-group' }, copy, h('label', { class: 'check' }, mirror, 'Espejar')),
  );
}
