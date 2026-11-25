/** Exportar, abrir y guardar. */
import { copyText, download } from '../export/download';
import { multicolorFiles, slug } from '../export/parts';
import { facePng } from '../export/png';
import { meshToStl } from '../export/stl';
import { createZip } from '../export/zip';
import { parseProject, serializeProject } from '../model/project-json';
import type { Store } from '../model/store';
import type { Face } from '../model/types';
import type { Derived } from './derived';
import { h } from './dom';
import { section } from './figure-settings';
import { toast } from './toasts';

const MAX_JSON_BYTES = 5_000_000;

export function createExportPanel(store: Store, derived: Derived): HTMLElement {
  const name = (): string => slug(store.project.name);
  const stl = h('button', { type: 'button', class: 'btn accent', onclick: () => {
    const { mesh, project } = derived.current();
    download(`${name()}.stl`, meshToStl(mesh, project.pixelMm), 'model/stl');
  } }, 'Descargar STL');
  const zip = h('button', { type: 'button', class: 'btn', onclick: () => {
    const { grid, project } = derived.current();
    download(`${name()}_colores.zip`, createZip(multicolorFiles(project, grid)), 'application/zip');
  } }, 'STL por color (ZIP)');
  const png = async (face: Face): Promise<void> => {
    const blob = await facePng(store.project, face);
    if (blob) download(`${name()}_${face === 'front' ? 'frente' : 'espalda'}.png`, blob, 'image/png');
    else toast('No se pudo crear el PNG.', undefined, 'error');
  };
  const sync = (): void => {
    const empty = derived.shown.mesh.faces === 0;
    stl.disabled = empty;
    zip.disabled = empty;
  };
  derived.subscribe(sync);
  sync();
  return section(
    'Exportar',
    true,
    h('div', { class: 'button-grid' },
      stl,
      zip,
      h('button', { type: 'button', class: 'btn', onclick: () => void png('front') }, 'PNG frente'),
      h('button', { type: 'button', class: 'btn', onclick: () => void png('back') }, 'PNG espalda'),
      h('button', { type: 'button', class: 'btn', onclick: () => saveProject(store) }, 'Guardar JSON'),
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        const ok = await copyText(serializeProject(store.project));
        toast(ok ? 'Proyecto copiado al portapapeles.' : 'No se pudo copiar el proyecto.', undefined, ok ? 'info' : 'error');
      } }, 'Copiar proyecto'),
    ),
  );
}

export function saveProject(store: Store): void {
  download(`${slug(store.project.name)}.pixelada.json`, serializeProject(store.project), 'application/json');
}

/** Botón y entrada de archivo para abrir un proyecto. Abrir se puede deshacer. */
export function createOpenButton(store: Store): HTMLElement {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Abrir proyecto', onchange: async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_JSON_BYTES) {
      toast('El archivo es demasiado grande para ser un proyecto.', undefined, 'error');
      return;
    }
    const r = parseProject(await file.text().catch(() => ''));
    if (!r.ok) {
      const more = r.errors.length > 3 ? ` (y ${r.errors.length - 3} más)` : '';
      toast(`No se pudo abrir. ${r.errors.slice(0, 3).join(' ')}${more}`, undefined, 'error');
      return;
    }
    const { project } = r;
    if (store.apply(() => project)) toast(`Abierto: ${project.name}.`, { label: 'Deshacer', run: () => store.undo() });
    else toast('El proyecto ya estaba abierto.');
  } });
  return h('span', {}, h('button', { type: 'button', class: 'btn', onclick: () => input.click() }, 'Abrir'), input);
}
