/** Ajustes de la figura: cuerpo, base y lienzo. */
import * as ops from '../model/ops';
import type { Store } from '../model/store';
import { LIMITS, clampInt, maxSkin, type Project } from '../model/types';
import { fmt } from '../model/analysis';
import { bindLive, h } from './dom';

export function section(title: string, open: boolean, ...children: (Node | string)[]): HTMLDetailsElement {
  return h('details', { class: 'card', open }, h('summary', {}, title), h('div', { class: 'card-body' }, ...children));
}

export function createFigureSettings(store: Store): HTMLElement[] {
  const syncs: ((p: Project) => void)[] = [];
  let uid = 0;

  const slider = (
    label: string,
    range: readonly [number, number],
    get: (p: Project) => number,
    set: (p: Project, v: number) => Project,
    format: (v: number, p: Project) => string,
    max?: (p: Project) => number,
  ): HTMLElement => {
    const id = `s${uid++}`;
    const input = h('input', { type: 'range', id, min: range[0], max: range[1], step: 1 });
    const out = h('output', { for: id });
    bindLive(store, input, (p, v) => set(p, Number(v)));
    syncs.push((p) => {
      if (max) {
        const m = String(max(p));
        if (input.max !== m) input.max = m;
        input.disabled = max(p) <= range[0];
      }
      const v = get(p);
      if (input.value !== String(v)) input.value = String(v);
      out.textContent = format(v, p);
    });
    return h('div', { class: 'row' }, h('label', { for: id }, label), out, input);
  };

  const toggle = (label: string, get: (p: Project) => boolean, set: (p: Project, on: boolean) => Project): HTMLLabelElement => {
    const input = h('input', { type: 'checkbox', onchange: () => store.apply((p) => set(p, input.checked)) });
    syncs.push((p) => (input.checked = get(p)));
    return h('label', { class: 'check' }, input, label);
  };

  const layers = (v: number, p: Project): string => `${v} ${v === 1 ? 'capa' : 'capas'} · ${fmt(v * p.pixelMm)} mm`;

  const mm = h('input', {
    type: 'number', class: 'field', id: 'pixel-mm', min: LIMITS.pixelMm[0], max: LIMITS.pixelMm[1], step: 0.05, inputmode: 'decimal',
  });
  bindLive(store, mm, (p, v) => (v === '' ? p : ops.setPixelMm(p, Number(v))));
  const syncMm = (): void => void (mm.value = String(store.project.pixelMm));
  mm.addEventListener('change', syncMm);
  syncs.push(() => {
    if (document.activeElement !== mm) syncMm();
  });

  const body = section(
    'Cuerpo',
    true,
    h('div', { class: 'row inline' }, h('label', { for: 'pixel-mm' }, 'Tamaño del píxel (mm)'), mm),
    slider('Grosor', LIMITS.depth, (p) => p.depth, ops.setDepth, layers),
    slider('Capas de piel', [1, 16], (p) => p.skin, ops.setSkin, (v) => `${v} por cara`, (p) => maxSkin(p.depth)),
    toggle('Silueta independiente por cara', (p) => p.independent, ops.setIndependent),
  );

  const bevel = toggle('Bisel en la capa superior', (p) => p.base.bevel, (p, bevelOn) => ops.setBase(p, { bevel: bevelOn }));
  const baseColor = h('input', { type: 'color', class: 'color-input', id: 'base-color' });
  bindLive(store, baseColor, (p, color) => ops.setBase(p, { color }));
  syncs.push((p) => {
    if (baseColor.value !== p.base.color) baseColor.value = p.base.color;
    const input = bevel.querySelector('input')!;
    input.disabled = p.base.height < 2;
    bevel.title = p.base.height < 2 ? 'El bisel necesita una base de al menos 2 capas.' : '';
  });
  const baseFields = h(
    'fieldset',
    { class: 'plain' },
    slider('Diámetro', LIMITS.baseDiameter, (p) => p.base.diameter, (p, diameter) => ops.setBase(p, { diameter }),
      (v, p) => `${v} px · ${fmt(v * p.pixelMm)} mm`),
    slider('Altura', LIMITS.baseHeight, (p) => p.base.height, (p, height) => ops.setBase(p, { height }), layers),
    bevel,
    h('div', { class: 'row inline' }, h('label', { for: 'base-color' }, 'Color de la base'), baseColor),
  );
  syncs.push((p) => (baseFields.disabled = !p.base.enabled));
  const base = section(
    'Base',
    true,
    toggle('Base circular', (p) => p.base.enabled, (p, enabled) => ops.setBase(p, { enabled })),
    baseFields,
  );

  const w = h('input', { type: 'number', class: 'field', id: 'grid-w', min: LIMITS.w[0], max: LIMITS.w[1] });
  const hh = h('input', { type: 'number', class: 'field', id: 'grid-h', min: LIMITS.h[0], max: LIMITS.h[1] });
  const syncSize = (): void => {
    w.value = String(store.project.w);
    hh.value = String(store.project.h);
  };
  let sizeKey = '';
  syncs.push((p) => {
    const k = `${p.w}x${p.h}`;
    if (k !== sizeKey) {
      sizeKey = k;
      syncSize();
    }
  });
  const form = h(
    'form',
    { class: 'size-form', onsubmit: (e) => {
      e.preventDefault();
      store.apply((p) => ops.resize(p, clampInt(Number(w.value), LIMITS.w), clampInt(Number(hh.value), LIMITS.h)));
      syncSize();
    }, novalidate: true },
    h('label', { for: 'grid-w' }, 'Ancho'), w,
    h('label', { for: 'grid-h' }, 'Alto'), hh,
    h('button', { type: 'submit', class: 'btn' }, 'Cambiar'),
  );
  const canvas = section('Lienzo', true, form, h('p', { class: 'hint' }, 'Alinea abajo y centra. Lo que no cabe se recorta.'));

  const sync = (): void => syncs.forEach((f) => f(store.project));
  store.subscribe(sync);
  sync();
  return [body, base, canvas];
}
