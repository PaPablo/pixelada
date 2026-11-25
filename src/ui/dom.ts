/** Utilidades mínimas de DOM. */
import type { Store } from '../model/store';
import type { Project } from '../model/types';

type Child = Node | string | null;
type Props = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

/** Crea un elemento: `on*` son eventos, los booleanos atributos presentes/ausentes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null) el.append(c);
  return el;
}

/** Escribe un atributo solo si cambia. */
export function setAttr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Control con cambio en vivo: se ve al mover y entra en el historial como un solo paso. */
export function bindLive(store: Store, el: HTMLInputElement, apply: (p: Project, value: string) => Project): void {
  let editing = false;
  el.addEventListener('input', () => {
    if (!editing || !store.inTransaction) store.begin();
    editing = true;
    store.preview(apply(store.project, el.value));
  });
  const finish = (): void => {
    if (editing && store.inTransaction) store.commit();
    editing = false;
  };
  el.addEventListener('change', () => {
    if (editing) finish();
    else store.apply((p) => apply(p, el.value));
  });
  el.addEventListener('blur', finish);
}
