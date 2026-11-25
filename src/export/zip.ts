/** ZIP sin compresión (método "store"). */
import { crc32 } from './crc32';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const UTF8_FLAG = 0x0800;
/** 1980-01-01 00:00, la fecha mínima de ZIP: el mismo proyecto da siempre el mismo archivo. */
const DOS_DATE = 0x21;

export function createZip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const files = entries.map((e) => ({ name: encoder.encode(e.name), data: e.data, crc: crc32(e.data) }));
  const local = files.reduce((n, f) => n + 30 + f.name.length + f.data.length, 0);
  const central = files.reduce((n, f) => n + 46 + f.name.length, 0);
  const out = new Uint8Array(local + central + 22);
  const view = new DataView(out.buffer);
  let o = 0;
  const u16 = (v: number): void => {
    view.setUint16(o, v, true);
    o += 2;
  };
  const u32 = (v: number): void => {
    view.setUint32(o, v, true);
    o += 4;
  };
  const raw = (b: Uint8Array): void => {
    out.set(b, o);
    o += b.length;
  };
  /** Campos comunes a la cabecera local y a la central. */
  const common = (f: (typeof files)[number]): void => {
    u16(20); // versión necesaria
    u16(UTF8_FLAG);
    u16(0); // método store
    u16(0); // hora
    u16(DOS_DATE);
    u32(f.crc);
    u32(f.data.length);
    u32(f.data.length);
    u16(f.name.length);
    u16(0); // campo extra
  };

  const offsets: number[] = [];
  for (const f of files) {
    offsets.push(o);
    u32(0x04034b50);
    common(f);
    raw(f.name);
    raw(f.data);
  }
  const start = o;
  files.forEach((f, i) => {
    u32(0x02014b50);
    u16(20); // versión que lo creó
    common(f);
    u16(0); // comentario
    u16(0); // disco
    u16(0); // atributos internos
    u32(0); // atributos externos
    u32(offsets[i]);
    raw(f.name);
  });
  const size = o - start;
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(files.length);
  u16(files.length);
  u32(size);
  u32(start);
  u16(0);
  return out;
}
