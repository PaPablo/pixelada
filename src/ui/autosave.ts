/** Autoguardado en localStorage. Nunca lanza: sin almacenamiento, la app sigue igual. */
import { parseProject, serializeProject } from '../model/project-json';
import type { Store } from '../model/store';
import type { Project } from '../model/types';

const KEY = 'pixelada.autosave';

export function loadAutosave(): Project | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    const r = parseProject(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

export function startAutosave(store: Store, onStatus: (ok: boolean) => void): void {
  let timer = 0;
  let saved: Project | null = null;
  const save = (): void => {
    clearTimeout(timer);
    timer = 0;
    if (store.project === saved) return;
    try {
      localStorage.setItem(KEY, serializeProject(store.project));
      saved = store.project;
      onStatus(true);
    } catch {
      onStatus(false);
    }
  };
  store.subscribe(() => {
    if (!timer) timer = window.setTimeout(save, 400);
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
}
