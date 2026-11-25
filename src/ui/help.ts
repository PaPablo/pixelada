/** Diálogo con los atajos de teclado. */
import { h } from './dom';

const ROWS: readonly [string, string][] = [
  ['B', 'Lápiz'],
  ['E', 'Borrador'],
  ['G', 'Rellenar'],
  ['I', 'Gotero'],
  ['L', 'Línea'],
  ['R', 'Rectángulo'],
  ['H', 'Mover vista'],
  ['Tab', 'Alternar cara (con el foco en un lienzo)'],
  ['Escape', 'Salir del lienzo o cancelar el trazo'],
  ['C', 'Copiar la cara activa a la otra'],
  ['Mayús + C', 'Copiarla espejada'],
  ['Ctrl + Z', 'Deshacer'],
  ['Ctrl + Y, Ctrl + Mayús + Z', 'Rehacer'],
  ['Rueda, pellizco', 'Zoom'],
  ['Botón central', 'Mover la vista con cualquier herramienta'],
  ['Mayús + arrastrar', 'Girar mientras pintas en 3D'],
];

export function createHelpButton(): HTMLElement {
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': 'help-title' },
    h(
      'form',
      { method: 'dialog' },
      h('h2', { id: 'help-title' }, 'Atajos'),
      h('dl', { class: 'keys' }, ...ROWS.flatMap(([k, t]) => [h('dt', {}, k), h('dd', {}, t)])),
      h('div', { class: 'dialog-actions' }, h('button', { type: 'submit', class: 'btn accent', autofocus: true }, 'Cerrar')),
    ),
  );
  return h('span', { class: 'help' }, h('button', { type: 'button', class: 'btn', onclick: () => dialog.showModal() }, 'Atajos'), dialog);
}
