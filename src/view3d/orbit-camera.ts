/** Cámara orbital propia. Matemática pura; el centro es el de la figura. */
export type ViewName = 'front' | 'side' | 'back' | 'threeQuarter';

const DEG = Math.PI / 180;
const PITCH_MAX = 88 * DEG;

const VIEWS: Record<ViewName, readonly [number, number]> = {
  front: [0, 4 * DEG],
  side: [90 * DEG, 4 * DEG],
  back: [180 * DEG, 4 * DEG],
  threeQuarter: [35 * DEG, 20 * DEG],
};

export class OrbitCamera {
  yaw = VIEWS.threeQuarter[0];
  pitch = VIEWS.threeQuarter[1];
  /** 1 = encuadre completo; menor = más cerca. */
  zoom = 1;

  setView(view: ViewName): void {
    [this.yaw, this.pitch] = VIEWS[view];
    this.zoom = 1;
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.01;
    this.pitch = Math.min(PITCH_MAX, Math.max(-PITCH_MAX, this.pitch + dy * 0.01));
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(3, Math.max(0.12, this.zoom * factor));
  }

  /** Distancia que encuadra una caja (en vóxeles) vista desde cualquier ángulo. */
  distance(size: readonly [number, number, number], fovDeg: number, aspect: number): number {
    const tanV = Math.tan((fovDeg * DEG) / 2);
    const radius = Math.max(size[0], size[2]) / 2;
    const vertical = Math.max(size[1] / 2 + radius * 0.3, radius);
    const fit = Math.max(vertical / tanV, radius / (tanV * aspect));
    return (fit * 1.06 + radius) * this.zoom;
  }

  /** Dirección unitaria del centro hacia la cámara. */
  direction(): [number, number, number] {
    const c = Math.cos(this.pitch);
    return [Math.sin(this.yaw) * c, Math.sin(this.pitch), Math.cos(this.yaw) * c];
  }
}
