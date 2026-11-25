/** Escena Three.js. Muestra exactamente la malla que se exporta y solo dibuja cuando hace falta. */
import {
  BufferAttribute, BufferGeometry, DirectionalLight, GridHelper, HemisphereLight, LineBasicMaterial, Mesh,
  MeshLambertMaterial, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer,
} from 'three';
import { hexToLinear } from '../model/color';
import type { Mesh as VoxelMesh } from '../model/mesh';
import type { VoxelGrid } from '../model/voxels';
import { OrbitCamera, type ViewName } from './orbit-camera';

type Vec3 = [number, number, number];

/** Rayo en coordenadas de la rejilla de vóxeles. */
export interface GridRay {
  origin: Vec3;
  dir: Vec3;
}

/** Gestos de pintura: devolver false en start deja el gesto a la cámara. */
export interface PaintHandler {
  start(ray: GridRay): boolean;
  move(rays: GridRay[]): void;
  end(cancelled: boolean): void;
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'orbit'; id: number; x: number; y: number }
  | { kind: 'paint'; id: number; x: number; y: number }
  | { kind: 'pinch'; dist: number; x: number; y: number };

const FOV = 32;

export class Scene3D {
  readonly canvas: HTMLCanvasElement;
  readonly orbit = new OrbitCamera();
  paint: PaintHandler | null = null;
  onAutoRotateChange: (on: boolean) => void = () => {};
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 2000);
  private readonly mesh: Mesh<BufferGeometry, MeshLambertMaterial>;
  private floor: GridHelper | null = null;
  private floorSize = 0;
  private size: Vec3 = [1, 1, 1];
  private frame = 0;
  private last = 0;
  private rotating = false;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: Gesture = { kind: 'none' };

  /** Lanza si WebGL no está disponible. */
  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearAlpha(0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'view-canvas';
    this.canvas.setAttribute('aria-label', 'Vista 3D de la figura. Arrastra para girar.');
    this.canvas.setAttribute('role', 'img');
    host.append(this.canvas);

    this.mesh = new Mesh(new BufferGeometry(), new MeshLambertMaterial({ vertexColors: true }));
    const key = new DirectionalLight(0xffffff, 2.3);
    key.position.set(-0.6, 0.9, 1);
    this.camera.add(key);
    this.scene.add(this.mesh, this.camera, new HemisphereLight(0xfff1e6, 0x6b4a52, 1.9));

    this.bind();
    new ResizeObserver(() => this.resize()).observe(host);
    this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.canvas.addEventListener('webglcontextrestored', () => this.invalidate());
    this.resize();
  }

  get autoRotate(): boolean {
    return this.rotating;
  }

  setAutoRotate(on: boolean): void {
    if (on === this.rotating) return;
    this.rotating = on;
    this.last = 0;
    this.onAutoRotateChange(on);
    this.invalidate();
  }

  setView(view: ViewName): void {
    this.setAutoRotate(false);
    this.orbit.setView(view);
    this.invalidate();
  }

  setModel(mesh: VoxelMesh, grid: VoxelGrid, colorOf: (id: number) => string): void {
    const colors = new Float32Array(mesh.faces * 18);
    const cache = new Map<number, Vec3>();
    for (let f = 0; f < mesh.faces; f++) {
      const id = mesh.faceColor[f];
      let c = cache.get(id);
      if (!c) cache.set(id, (c = hexToLinear(colorOf(id))));
      for (let v = 0; v < 6; v++) colors.set(c, f * 18 + v * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    this.mesh.position.set(-grid.nx / 2, 0, -grid.nz / 2);
    this.size = [grid.nx, Math.max(1, grid.ny), grid.nz];
    this.updateFloor(Math.ceil((Math.max(grid.nx, grid.nz) * 1.7) / 16) * 16);
    this.invalidate();
  }

  invalidate(): void {
    if (!this.frame) this.frame = requestAnimationFrame((t) => this.render(t));
  }

  private updateFloor(size: number): void {
    if (size === this.floorSize) return;
    this.floorSize = size;
    if (this.floor) {
      this.scene.remove(this.floor);
      this.floor.dispose();
    }
    this.floor = new GridHelper(size, size / 4, 0xffb48a, 0xffb48a);
    const m = this.floor.material as LineBasicMaterial;
    m.transparent = true;
    m.opacity = 0.13;
    m.depthWrite = false;
    this.floor.position.y = -0.05;
    this.scene.add(this.floor);
  }

  private resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private placeCamera(): void {
    const d = this.orbit.distance(this.size, FOV, this.camera.aspect);
    const [x, y, z] = this.orbit.direction();
    const cy = this.size[1] / 2;
    this.camera.position.set(x * d, cy + y * d, z * d);
    this.camera.near = Math.max(0.1, d / 100);
    this.camera.far = d + this.floorSize * 2 + 50;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, cy, 0);
    this.camera.updateMatrixWorld();
  }

  private render(t: number): void {
    this.frame = 0;
    if (!this.host.clientWidth) return;
    if (this.rotating) {
      if (this.last) this.orbit.yaw += Math.min(100, t - this.last) * 0.0007;
      this.last = t;
      this.invalidate();
    }
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
  }

  private ray(clientX: number, clientY: number): GridRay {
    const r = this.canvas.getBoundingClientRect();
    this.placeCamera();
    const p = new Vector3(((clientX - r.left) / r.width) * 2 - 1, 1 - ((clientY - r.top) / r.height) * 2, 0.5);
    p.unproject(this.camera);
    const o = this.camera.position;
    const d = p.sub(o).normalize();
    const m = this.mesh.position;
    return { origin: [o.x - m.x, o.y - m.y, o.z - m.z], dir: [d.x, d.y, d.z] };
  }

  private bind(): void {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : 1;
        const delta = Math.max(-120, Math.min(120, e.deltaY * unit));
        this.orbit.zoomBy(Math.exp(delta * (e.ctrlKey ? 0.008 : 0.002)));
        this.invalidate();
      },
      { passive: false },
    );
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e, false));
    c.addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener('lostpointercapture', (e) => this.up(e, false));
  }

  private down(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // El puntero puede haberse soltado ya.
    }
    if (this.pointers.size === 2) {
      if (this.gesture.kind === 'paint') this.paint?.end(true);
      this.gesture = { kind: 'pinch', ...this.pinchState() };
      return;
    }
    if (this.pointers.size > 2) return;
    const at = { id: e.pointerId, x: e.clientX, y: e.clientY };
    const wantsPaint = this.paint && e.button === 0 && !e.shiftKey;
    if (wantsPaint && this.paint!.start(this.ray(e.clientX, e.clientY))) {
      this.gesture = { kind: 'paint', ...at };
      this.setAutoRotate(false);
      return;
    }
    this.setAutoRotate(false);
    this.gesture = { kind: 'orbit', ...at };
  }

  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;
    if (g.kind === 'pinch') {
      if (this.pointers.size < 2) return;
      const next = this.pinchState();
      if (next.dist > 0) this.orbit.zoomBy(g.dist / next.dist);
      this.orbit.rotate(next.x - g.x, next.y - g.y);
      this.gesture = { kind: 'pinch', ...next };
      this.invalidate();
      return;
    }
    if (g.kind === 'none' || g.id !== e.pointerId) return;
    if (g.kind === 'orbit') {
      this.orbit.rotate(e.clientX - g.x, e.clientY - g.y);
      this.invalidate();
    } else {
      // Interpola en pantalla cada pocos píxeles para no dejar huecos.
      const n = Math.max(1, Math.ceil(Math.hypot(e.clientX - g.x, e.clientY - g.y) / 3));
      const rays: GridRay[] = [];
      for (let i = 1; i <= n; i++) {
        rays.push(this.ray(g.x + ((e.clientX - g.x) * i) / n, g.y + ((e.clientY - g.y) * i) / n));
      }
      this.paint?.move(rays);
    }
    g.x = e.clientX;
    g.y = e.clientY;
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.delete(e.pointerId)) return;
    const g = this.gesture;
    if (g.kind === 'pinch') {
      if (this.pointers.size === 0) this.gesture = { kind: 'none' };
      return;
    }
    if (g.kind === 'none' || g.id !== e.pointerId) return;
    if (g.kind === 'paint') this.paint?.end(cancelled);
    this.gesture = { kind: 'none' };
  }

  private pinchState(): { dist: number; x: number; y: number } {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
