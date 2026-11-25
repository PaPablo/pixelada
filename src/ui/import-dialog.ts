/** Diálogo para importar una imagen, con vista previa de lo que se va a aplicar. */
import { hexToRgb } from '../model/color';
import { effectiveLayer, viewLayer } from '../model/faces';
import { importImage, type ImportOptions } from '../model/import-image';
import type { Rgba } from '../model/quantize';
import type { Session } from '../model/session';
import type { Store } from '../model/store';
import type { Face, Project } from '../model/types';
import { h } from './dom';
import { toast } from './toasts';

const MAX_SIDE = 2048;

async function decode(file: File): Promise<Rgba> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawFace(canvas: HTMLCanvasElement, p: Project, face: Face): void {
  canvas.width = p.w;
  canvas.height = p.h;
  const ctx = canvas.getContext('2d')!;
  viewLayer(p, face).forEach((c, i) => {
    if (!c) return;
    ctx.fillStyle = `rgb(${hexToRgb(p.palette[c - 1]).join(' ')})`;
    ctx.fillRect(i % p.w, Math.floor(i / p.w), 1, 1);
  });
}

/** Con una sola imagen en la figura (o vacía), lo natural es aplicarla a ambas caras. */
function defaultTarget(p: Project, face: Face): ImportOptions['target'] {
  const front = effectiveLayer(p, 'front');
  const back = effectiveLayer(p, 'back');
  return front.every((c, i) => c === back[i]) ? 'both' : face;
}

export function createImportButton(store: Store, session: Session): HTMLElement {
  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'import-title' });
  const radio = (group: string, value: string, label: string): HTMLLabelElement =>
    h('label', { class: 'check' }, h('input', { type: 'radio', name: group, value }), label);
  const smooth = h('input', { type: 'checkbox' });
  const front = h('canvas', { class: 'preview', 'aria-label': 'Vista previa del frente', role: 'img' });
  const back = h('canvas', { class: 'preview', 'aria-label': 'Vista previa de la espalda', role: 'img' });
  const form = h(
    'form',
    { method: 'dialog' },
    h('h2', { id: 'import-title' }, 'Importar imagen'),
    h('div', { class: 'previews' }, h('figure', {}, front, h('figcaption', {}, 'Frente')), h('figure', {}, back, h('figcaption', {}, 'Espalda'))),
    h('fieldset', {}, h('legend', {}, 'Aplicar a'), radio('target', 'front', 'Frente'), radio('target', 'back', 'Espalda'), radio('target', 'both', 'Ambas')),
    h('fieldset', {}, h('legend', {}, 'Colores'), radio('palette', 'current', 'Usar la paleta actual'), radio('palette', 'new', 'Crear paleta (hasta 16)')),
    h('label', { class: 'check' }, smooth, 'Suavizar'),
    h('div', { class: 'dialog-actions' },
      h('button', { type: 'submit', class: 'btn', value: 'cancel', formnovalidate: true }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn accent', value: 'ok', autofocus: true }, 'Importar'),
    ),
  );
  dialog.append(form);

  let image: Rgba | null = null;
  const options = (): ImportOptions => {
    const data = new FormData(form);
    return {
      target: data.get('target') as ImportOptions['target'],
      palette: data.get('palette') as ImportOptions['palette'],
      smooth: smooth.checked,
    };
  };
  const check = (group: string, value: string): void => {
    form.querySelector<HTMLInputElement>(`input[name=${group}][value=${value}]`)!.checked = true;
  };
  const preview = (): void => {
    if (!image) return;
    const p = importImage(store.project, image, options());
    drawFace(front, p, 'front');
    drawFace(back, p, 'back');
  };
  form.addEventListener('change', preview);
  form.addEventListener('submit', (e) => {
    const img = image;
    if (!img || (e.submitter as HTMLButtonElement | null)?.value !== 'ok') return;
    const o = options();
    if (store.apply((p) => importImage(p, img, o))) {
      toast('Imagen importada.', { label: 'Deshacer', run: () => store.undo() });
    }
  });

  const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif', hidden: true, 'aria-label': 'Importar imagen', onchange: async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      image = await decode(file);
    } catch {
      toast('No se pudo leer la imagen. Usa un archivo PNG, JPG o GIF.', undefined, 'error');
      return;
    }
    check('target', defaultTarget(store.project, session.state.face));
    check('palette', 'new');
    preview();
    dialog.showModal();
  } });
  return h('span', {}, h('button', { type: 'button', class: 'btn', onclick: () => input.click() }, 'Importar imagen'), input, dialog);
}
