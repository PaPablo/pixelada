/** Panel 3D: vistas, medidas y avisos. Sin WebGL, solo falta la imagen. */
import { fmt } from '../model/analysis';
import { colorOfId } from '../model/voxels';
import type { ViewName } from '../view3d/orbit-camera';
import type { Scene3D } from '../view3d/scene';
import type { Derived } from './derived';
import { h, setAttr } from './dom';

const VIEWS: readonly [ViewName, string][] = [
  ['front', 'Frente'],
  ['side', 'Lado'],
  ['back', 'Atrás'],
  ['threeQuarter', '3/4'],
];

export function createView3dPanel(derived: Derived): HTMLElement {
  let scene: Scene3D | null = null;
  const stage = h('div', { class: 'stage stage-3d' });
  const viewBar = h('div', { class: 'view-bar', role: 'group', 'aria-label': 'Puntos de vista' });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const views = VIEWS.map(([view, label]) =>
    h('button', { type: 'button', class: 'btn small', disabled: true, 'aria-label': `Vista: ${label}`, onclick: () => scene?.setView(view) }, label),
  );
  viewBar.append(...views);
  stage.append(viewBar);
  const rotate = h('button', { type: 'button', class: 'btn small', disabled: true, 'aria-pressed': 'false',
    onclick: () => scene?.setAutoRotate(!scene.autoRotate) }, 'Giro automático');
  const syncMotion = (): void => {
    if (reduced.matches) scene?.setAutoRotate(false);
    rotate.disabled = !scene || reduced.matches;
    rotate.title = reduced.matches ? 'Desactivado: tu sistema pide menos movimiento.' : 'Giro automático';
  };
  reduced.addEventListener('change', syncMotion);

  const value = (): HTMLElement => h('dd', {});
  const base = value();
  const height = value();
  const depth = value();
  const voxels = value();
  const item = (label: string, dd: HTMLElement): HTMLElement => h('div', {}, h('dt', {}, label), dd);
  const notices = h('ul', { class: 'notices', 'aria-live': 'polite', 'aria-label': 'Avisos' });
  let noticeKey = '';

  const update = (): void => {
    const { analysis, mesh, grid, project } = derived.shown;
    const m = analysis.measures;
    base.textContent = m.baseMm === null ? 'sin base' : `${fmt(m.baseMm)} mm`;
    height.textContent = `${fmt(m.heightMm)} mm`;
    depth.textContent = `${fmt(m.depthMm)} mm`;
    voxels.textContent = fmt(m.voxels);
    const key = JSON.stringify(analysis.notices);
    if (key !== noticeKey) {
      noticeKey = key;
      notices.replaceChildren(
        ...analysis.notices.map((n) => h('li', { class: `notice ${n.level}`, 'data-notice': n.id }, n.text)),
      );
    }
    scene?.setModel(mesh, grid, (id) => colorOfId(project, id));
  };
  derived.subscribe(update);
  update();

  void (async () => {
    try {
      const { Scene3D: Ctor } = await import('../view3d/scene');
      scene = new Ctor(stage);
    } catch {
      stage.append(
        h('p', { class: 'no-webgl', role: 'alert' },
          'No se puede mostrar la vista 3D: WebGL no está disponible en este navegador. El editor, las medidas y la exportación siguen funcionando.'),
      );
      return;
    }
    scene.onAutoRotateChange = (on) => setAttr(rotate, 'aria-pressed', String(on));
    views.forEach((b) => (b.disabled = false));
    syncMotion();
    update();
  })();

  return h(
    'section',
    { class: 'panel', 'data-tab': '3d', 'aria-label': 'Vista 3D' },
    h('header', { class: 'panel-head' }, h('h2', {}, 'Vista 3D'), h('div', { class: 'spacer' }), rotate),
    stage,
    h('dl', { class: 'measures' }, item('Ø base', base), item('Alto', height), item('Grosor', depth), item('Vóxeles', voxels)),
    notices,
  );
}
