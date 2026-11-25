/** Tipos, límites y valores por defecto. Sin DOM. */

export type Face = 'front' | 'back';

export interface BaseSettings {
  enabled: boolean;
  /** Diámetro en píxeles (= vóxeles). */
  diameter: number;
  /** Altura en capas de vóxeles. */
  height: number;
  /** La capa superior se encoge 1 vóxel de radio. Solo con altura >= 2. */
  bevel: boolean;
  color: string;
}

/**
 * Una figura. Se trata como inmutable: cada operación devuelve otro objeto y
 * las capas nunca se modifican en el sitio, así el historial puede guardar
 * referencias sin copiar.
 */
export interface Project {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  /** Colores '#rrggbb'. Los píxeles guardan índice + 1; 0 es vacío. */
  readonly palette: readonly string[];
  /** Ambas capas en coordenadas del frente: fila a fila, y hacia abajo. */
  readonly front: Uint8Array;
  readonly back: Uint8Array;
  /** Silueta independiente por cara. */
  readonly independent: boolean;
  /** Capas de vóxeles en profundidad. */
  readonly depth: number;
  /** Capas exteriores que usan el color propio de cada cara. */
  readonly skin: number;
  readonly pixelMm: number;
  readonly base: Readonly<BaseSettings>;
}

export const LIMITS = {
  w: [8, 96],
  h: [8, 128],
  depth: [1, 32],
  baseDiameter: [4, 128],
  baseHeight: [1, 8],
  pixelMm: [0.1, 5],
  paletteMax: 32,
  nameMax: 60,
} as const;

/** Identificador de color de la base dentro de la rejilla de vóxeles. */
export const BASE_ID = LIMITS.paletteMax + 1;

export const HEX_RE = /^#[0-9a-f]{6}$/i;

export const DEFAULT_PALETTE: readonly string[] = [
  '#1c1420', '#f4ead8', '#8c93a3', '#c9d1dc', '#4c5163', '#c4302b',
  '#7e1a24', '#e8a33d', '#8a5a2b', '#f0c39a', '#3f7d4a', '#3a6ea5',
];

export const DEFAULT_BASE: Readonly<BaseSettings> = {
  enabled: true,
  diameter: 32,
  height: 3,
  bevel: true,
  color: '#3b3440',
};

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clampInt(v: number, [min, max]: readonly [number, number]): number {
  return Number.isFinite(v) ? clamp(Math.round(v), min, max) : min;
}

export function maxSkin(depth: number): number {
  return Math.max(1, Math.floor(depth / 2));
}

export function emptyProject(w = 32, h = 48, name = 'Figura'): Project {
  const depth = 6;
  return {
    name,
    w,
    h,
    palette: DEFAULT_PALETTE,
    front: new Uint8Array(w * h),
    back: new Uint8Array(w * h),
    independent: false,
    depth,
    skin: maxSkin(depth),
    pixelMm: 0.8,
    base: DEFAULT_BASE,
  };
}
