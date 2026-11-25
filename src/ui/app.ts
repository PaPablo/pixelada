/** Monta la aplicación y conecta sus piezas. */
import { FacePanel } from '../editor2d/panel';
import { otherFace } from '../model/faces';
import * as ops from '../model/ops';
import { sampleProject } from '../model/sample';
import { Session, type Tab } from '../model/session';
import { Store } from '../model/store';
import { LIMITS, emptyProject, type Face } from '../model/types';
import { createActionBar, createActions } from './actions';
import { loadAutosave, startAutosave } from './autosave';
import { Derived } from './derived';
import { h, setAttr } from './dom';
import { createFigureSettings } from './figure-settings';
import { createPalette } from './palette';
import { bindShortcuts } from './shortcuts';
import { toast } from './toasts';
import { createToolbar } from './toolbar';
import { createView3dPanel } from './view3d-panel';

const TAB_LABEL: Record<Tab, string> = { front: 'Frente', back: 'Espalda', '3d': 'Vista 3D' };

export function createApp(root: HTMLElement): void {
  const store = new Store(loadAutosave() ?? sampleProject());
  const session = new Session();
  const derived = new Derived(store);
  const panels = {} as Record<Face, FacePanel>;

  const isNarrow = window.matchMedia('(max-width: 759px)');
  /** Tras elegir algo con el ratón, el foco vuelve al lienzo para que Tab y los atajos sigan ahí. */
  const refocus = (): void => {
    if (!isNarrow.matches) panels[session.state.face].focus();
  };

  const actions = createActions(store, session);
  const toolbar = createToolbar(store, session, refocus);
  const palette = createPalette(store, session, refocus);

  const buildFace = (face: Face): HTMLElement => {
    const stage = h('div', { class: 'stage' });
    const percent = h('span', { class: 'zoom-value' });
    const panel = new FacePanel(face, stage, store, session, {
      viewChanged: () => (percent.textContent = `${Math.round(panel.viewport.scale * 10) / 10}×`),
      switchFace: () => {
        const other = otherFace(face);
        session.activate(other);
        panels[other].focus();
      },
      leave: () => toolbar.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus(),
    });
    panels[face] = panel;
    const zoomBtn = (text: string, label: string, run: () => void): HTMLButtonElement =>
      h('button', { type: 'button', class: 'btn small', 'aria-label': `${label} (${TAB_LABEL[face]})`, title: label, onclick: run }, text);
    const el = h(
      'section',
      { class: 'panel', 'data-tab': face, 'aria-label': TAB_LABEL[face] },
      h(
        'header',
        { class: 'panel-head' },
        h('h2', {}, TAB_LABEL[face]),
        h('span', { class: 'badge' }, 'Activo'),
        h('div', { class: 'spacer' }),
        zoomBtn('−', 'Alejar', () => panel.zoom(1 / 1.25)),
        percent,
        zoomBtn('+', 'Acercar', () => panel.zoom(1.25)),
        zoomBtn('Ajustar', 'Ajustar', () => panel.fit()),
      ),
      stage,
    );
    el.addEventListener('pointerdown', () => session.set({ face }));
    return el;
  };

  const front = buildFace('front');
  const back = buildFace('back');
  const view3d = createView3dPanel(derived);
  const panelEls = [front, back, view3d];

  const tabs = (['front', 'back', '3d'] as const).map((tab) =>
    h('button', { type: 'button', role: 'tab', class: 'tab', onclick: () => {
      session.set(tab === '3d' ? { tab } : { tab, face: tab });
    } }, TAB_LABEL[tab]),
  );

  const name = h('input', {
    type: 'text', class: 'field name', maxlength: LIMITS.nameMax, 'aria-label': 'Nombre de la figura',
    onchange: () => store.apply((p) => ops.setName(p, name.value.trim() || 'Figura')),
  });
  const saved = h('span', { class: 'saved', role: 'status' });
  const replace = (make: () => ReturnType<typeof emptyProject>, text: string): void => {
    if (store.apply(make)) toast(text, { label: 'Deshacer', run: () => store.undo() });
  };
  const fileActions = h(
    'div',
    { class: 'file-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => replace(() => emptyProject(), 'Figura nueva.') }, 'Nueva'),
    h('button', { type: 'button', class: 'btn', onclick: () => replace(sampleProject, 'Ejemplo cargado.') }, 'Ejemplo'),
  );
  const header = h('header', { class: 'app-head' }, h('h1', {}, 'Pixelada'), name, saved, h('div', { class: 'spacer' }), fileActions);

  const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Ajustes' }, ...createFigureSettings(store));
  root.append(
    header,
    h(
      'main',
      { class: 'workspace' },
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Vistas' }, ...tabs),
      toolbar,
      h('div', { class: 'panels' }, ...panelEls),
      h('div', { class: 'dock' }, palette, createActionBar(store, session, actions)),
    ),
    sidebar,
  );

  const sync = (): void => {
    const { face, tab } = session.state;
    for (const el of panelEls) {
      el.classList.toggle('active', el.dataset.tab === face);
      el.classList.toggle('shown', el.dataset.tab === tab);
    }
    tabs.forEach((t, i) => setAttr(t, 'aria-selected', String(panelEls[i].dataset.tab === tab)));
    if (document.activeElement !== name) name.value = store.project.name;
  };
  store.subscribe(sync);
  session.subscribe(sync);
  sync();

  const syncTabWarnings = (): void => {
    const n = derived.shown.analysis.notices.filter((x) => x.level === 'warn').length;
    tabs[2].textContent = n ? `${TAB_LABEL['3d']} ⚠ ${n}` : TAB_LABEL['3d'];
  };
  derived.subscribe(syncTabWarnings);
  syncTabWarnings();

  bindShortcuts(store, session, actions);
  startAutosave(store, (ok) => {
    saved.textContent = ok ? 'Guardado' : 'Autoguardado no disponible';
    saved.classList.toggle('bad', !ok);
  });
  if (!isNarrow.matches) panels.front.focus();
}
