/** Lápiz y borrador sobre las caras frontal y trasera del modelo. */
import { applyCells } from '../editor2d/tools';
import type { Cell } from '../model/faces';
import { hitToCell, raycast } from '../model/raycast';
import type { Session } from '../model/session';
import type { Store } from '../model/store';
import type { Face } from '../model/types';
import type { VoxelGrid } from '../model/voxels';
import type { GridRay, PaintHandler, Scene3D } from './scene';

export interface ModelSource {
  readonly shown: { grid: VoxelGrid };
  current(): { grid: VoxelGrid };
}

export function bindPaint3d(scene: Scene3D, store: Store, session: Session, source: ModelSource): void {
  let face: Face = 'front';
  let erase = false;
  /** Rejilla del inicio del trazo: así el borrador no perfora lo que va quedando detrás. */
  let grid: VoxelGrid | null = null;

  const find = (g: VoxelGrid, ray: GridRay): { face: Face; cell: Cell } | null => {
    const hit = raycast(g, ray.origin, ray.dir);
    return hit && hitToCell(store.baseline, g, hit);
  };

  const handler: PaintHandler = {
    start(ray) {
      const s = session.state;
      if (s.tool !== 'pencil' && s.tool !== 'eraser') return false;
      const g = source.current().grid;
      const at = find(g, ray);
      if (!at) return false;
      grid = g;
      face = at.face;
      erase = s.tool === 'eraser';
      session.set({ face });
      store.begin();
      store.preview(applyCells(store.project, face, [at.cell], erase, s));
      return true;
    },
    move(rays) {
      if (!grid || !store.inTransaction) return;
      // Si se borra la fila de los pies, la figura baja: el resto del trazo ya no casa con lo que se ve.
      if (source.shown.grid.bottomRow !== grid.bottomRow) return;
      const cells: Cell[] = [];
      for (const ray of rays) {
        const at = find(grid, ray);
        if (at?.face === face) cells.push(at.cell);
      }
      if (cells.length) store.preview(applyCells(store.project, face, cells, erase, session.state));
    },
    end(cancelled) {
      grid = null;
      if (cancelled) store.cancel();
      else store.commit();
    },
  };

  const sync = (): void => {
    const on = session.state.paint3d;
    scene.paint = on ? handler : null;
    scene.canvas.classList.toggle('painting', on);
  };
  session.subscribe(sync);
  sync();
}
