/** Datos derivados del proyecto (vóxeles, malla, análisis) con un debounce corto. */
import { analyze, type Analysis } from '../model/analysis';
import { meshAll, type Mesh } from '../model/mesh';
import { Emitter, type Store } from '../model/store';
import type { Project } from '../model/types';
import { buildVoxels, type VoxelGrid } from '../model/voxels';

const DELAY_MS = 60;

export interface Model {
  project: Project;
  grid: VoxelGrid;
  mesh: Mesh;
  analysis: Analysis;
}

function build(project: Project): Model {
  const grid = buildVoxels(project);
  return { project, grid, mesh: meshAll(grid), analysis: analyze(project, grid) };
}

export class Derived extends Emitter {
  private model: Model;
  private timer = 0;

  constructor(private readonly store: Store) {
    super();
    this.model = build(store.project);
    store.subscribe(() => {
      // Sin reiniciar el temporizador: durante un trazo largo la vista sigue actualizándose.
      if (!this.timer) this.timer = window.setTimeout(() => this.flush(), DELAY_MS);
    });
  }

  /** Modelo mostrado; puede ir unos milisegundos por detrás. */
  get shown(): Model {
    return this.model;
  }

  /** Modelo al día, para exportar. */
  current(): Model {
    this.flush();
    return this.model;
  }

  private flush(): void {
    clearTimeout(this.timer);
    this.timer = 0;
    if (this.model.project === this.store.project) return;
    this.model = build(this.store.project);
    this.emit();
  }
}
