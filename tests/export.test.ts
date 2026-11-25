import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crc32 } from '../src/export/crc32';
import { colorParts, multicolorFiles, slug } from '../src/export/parts';
import { createZip } from '../src/export/zip';
import { sampleProject } from '../src/model/sample';
import { buildVoxels } from '../src/model/voxels';
import { art, readStl, rng, signedVolume, unpairedEdges } from './helpers';

/** unzip del sistema: en PATH o el que trae Git for Windows. */
function findUnzip(): string {
  for (const c of ['unzip', 'C:\\Program Files\\Git\\usr\\bin\\unzip.exe']) {
    if (path.isAbsolute(c) && !existsSync(c)) continue;
    if (spawnSync(c, ['-v']).status === 0) return c;
  }
  throw new Error('No se encuentra "unzip". Instálalo o añade Git for Windows para ejecutar esta prueba.');
}

describe('piezas por color', () => {
  it('el caballero: todas cerradas y sin solaparse', () => {
    const p = sampleProject();
    const g = buildVoxels(p);
    const parts = colorParts(p, g);
    expect(parts.length).toBe(new Set(g.data).size - 1);
    let volume = 0;
    for (const part of parts) {
      expect(unpairedEdges(part.mesh)).toBe(0);
      volume += signedVolume(part.mesh);
    }
    expect(volume).toBeCloseTo(g.data.filter(Boolean).length, 2);
  });
  it('colores iguales forman una sola pieza, incluida la base', () => {
    const p = art(['12......'], null, {
      palette: ['#aa0000', '#aa0000'],
      base: { enabled: true, diameter: 8, height: 2, bevel: false, color: '#aa0000' },
    });
    const parts = colorParts(p, buildVoxels(p));
    expect(parts.map((x) => x.hex)).toEqual(['#aa0000']);
    expect(unpairedEdges(parts[0].mesh)).toBe(0);
  });
  it('incluye la pieza completa y nombres únicos', () => {
    const p = { ...sampleProject(), name: 'Ñandú / Épico' };
    const names = multicolorFiles(p, buildVoxels(p)).map((f) => f.name);
    expect(names[0]).toBe('nandu-epico_completa.stl');
    expect(new Set(names).size).toBe(names.length);
    expect(slug('///')).toBe('figura');
  });
});

describe('ZIP', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pixelada-zip-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  let unzip = '';
  beforeAll(() => {
    unzip = findUnzip();
  });

  it('CRC propio = CRC de zlib', () => {
    const r = rng(5);
    for (const n of [0, 1, 9, 1000]) {
      const b = Uint8Array.from({ length: n }, () => Math.floor(r() * 256));
      expect(crc32(b)).toBe(zlib.crc32(b));
    }
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('unzip del sistema lo acepta, los CRC cuadran y el contenido es idéntico', () => {
    const p = sampleProject();
    const files = [...multicolorFiles(p, buildVoxels(p)), { name: 'vacío.txt', data: new Uint8Array(0) }];
    const zip = path.join(dir, 'a.zip');
    writeFileSync(zip, createZip(files));
    const t = spawnSync(unzip, ['-t', zip], { encoding: 'utf8' });
    expect(t.status, t.stdout + t.stderr).toBe(0);
    expect(t.stdout).toContain('No errors detected');
    const out = path.join(dir, 'out');
    expect(spawnSync(unzip, ['-q', zip, '-d', out]).status).toBe(0);
    for (const f of files.slice(0, -1)) {
      const bytes = readFileSync(path.join(out, f.name));
      expect(bytes.equals(Buffer.from(f.data))).toBe(true);
      expect(bytes.length).toBe(84 + 50 * readStl(new Uint8Array(bytes)).triangles);
    }
  });

  it('unzip detecta un byte cambiado (la prueba anterior no es vacía)', () => {
    const bytes = createZip([{ name: 'a.bin', data: new Uint8Array(100).fill(7) }]);
    bytes[60] ^= 1;
    const zip = path.join(dir, 'malo.zip');
    writeFileSync(zip, bytes);
    expect(spawnSync(unzip, ['-t', zip]).status).not.toBe(0);
  });
});
