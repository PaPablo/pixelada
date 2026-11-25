/** Proyecto JSON versionado. La lectura valida todo y nunca lanza. */
import { HEX_RE, LIMITS, maxSkin, type Project } from './types';

export const FORMAT = 'pixelada';
export const VERSION = 1;

export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

export function serializeProject(p: Project): string {
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    name: p.name,
    w: p.w,
    h: p.h,
    palette: p.palette,
    front: Array.from(p.front),
    back: Array.from(p.back),
    independent: p.independent,
    depth: p.depth,
    skin: p.skin,
    pixelMm: p.pixelMm,
    base: p.base,
  });
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Lee y valida. No lanza con ninguna entrada. */
export function parseProject(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['El archivo no es JSON válido.'] };
  }
  return validateProject(raw);
}

export function validateProject(raw: unknown): ParseResult {
  if (!isObj(raw)) return { ok: false, errors: ['El proyecto debe ser un objeto JSON.'] };
  if (raw.format !== FORMAT) return { ok: false, errors: ['No es un proyecto de Pixelada.'] };
  if (raw.version !== VERSION) {
    return { ok: false, errors: [`Versión de proyecto no compatible: ${JSON.stringify(raw.version) ?? 'ninguna'}.`] };
  }
  const errors: string[] = [];

  const int = (o: Obj, key: string, label: string, [min, max]: readonly [number, number]): number => {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
      errors.push(`${label}: se esperaba un entero entre ${min} y ${max}.`);
      return min;
    }
    return v;
  };
  const bool = (o: Obj, key: string, label: string): boolean => {
    const v = o[key];
    if (typeof v !== 'boolean') errors.push(`${label}: se esperaba verdadero o falso.`);
    return v === true;
  };
  const hex = (v: unknown, label: string): string => {
    if (typeof v !== 'string' || !HEX_RE.test(v)) {
      errors.push(`${label}: se esperaba un color #rrggbb.`);
      return '#000000';
    }
    return v.toLowerCase();
  };

  let name = '';
  if (typeof raw.name !== 'string' || raw.name.length > LIMITS.nameMax) {
    errors.push(`Nombre: se esperaba texto de hasta ${LIMITS.nameMax} caracteres.`);
  } else name = raw.name;

  const w = int(raw, 'w', 'Ancho', LIMITS.w);
  const h = int(raw, 'h', 'Alto', LIMITS.h);

  const palette: string[] = [];
  if (!Array.isArray(raw.palette) || raw.palette.length < 1 || raw.palette.length > LIMITS.paletteMax) {
    errors.push(`Paleta: se esperaban entre 1 y ${LIMITS.paletteMax} colores.`);
  } else {
    raw.palette.forEach((c, i) => palette.push(hex(c, `Color ${i + 1} de la paleta`)));
  }

  const layer = (key: 'front' | 'back', label: string): Uint8Array => {
    const v = raw[key];
    if (!Array.isArray(v) || v.length !== w * h) {
      errors.push(`${label}: se esperaban ${w * h} píxeles (${w} x ${h}).`);
      return new Uint8Array(0);
    }
    for (let i = 0; i < v.length; i++) {
      const c: unknown = v[i];
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > palette.length) {
        errors.push(`${label}: índice de color fuera de rango en el píxel ${i}.`);
        return new Uint8Array(0);
      }
    }
    return Uint8Array.from(v as number[]);
  };
  const front = layer('front', 'Frente');
  const back = layer('back', 'Espalda');

  const independent = bool(raw, 'independent', 'Silueta independiente');
  const depth = int(raw, 'depth', 'Grosor', LIMITS.depth);
  const skin = int(raw, 'skin', 'Capas de piel', [1, maxSkin(depth)]);

  let pixelMm = 0.8;
  const [minMm, maxMm] = LIMITS.pixelMm;
  if (typeof raw.pixelMm !== 'number' || !(raw.pixelMm >= minMm && raw.pixelMm <= maxMm)) {
    errors.push(`Tamaño del píxel: se esperaba un número entre ${minMm} y ${maxMm}.`);
  } else pixelMm = raw.pixelMm;

  const b = raw.base;
  if (!isObj(b)) {
    errors.push('Base: faltan sus datos.');
    return { ok: false, errors };
  }
  const base = {
    enabled: bool(b, 'enabled', 'Base activa'),
    diameter: int(b, 'diameter', 'Diámetro de la base', LIMITS.baseDiameter),
    height: int(b, 'height', 'Altura de la base', LIMITS.baseHeight),
    bevel: bool(b, 'bevel', 'Bisel de la base'),
    color: hex(b.color, 'Color de la base'),
  };

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    project: { name, w, h, palette, front, back, independent, depth, skin, pixelMm, base },
  };
}
