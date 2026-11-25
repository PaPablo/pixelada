import { readFile } from 'node:fs/promises';
import { blank, cell, click, expect, on, open, saved, test } from './util';

type P = import('@playwright/test').Page;

async function grab(page: P, button: string): Promise<{ name: string; bytes: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()]);
  return { name: d.suggestedFilename(), bytes: await readFile((await d.path())!) };
}

async function makePng(page: P, w: number, h: number, pixels: [number, number, string][]): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ w, h, pixels }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      for (const [x, y, color] of pixels) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
      return c.toDataURL('image/png').split(',')[1];
    },
    { w, h, pixels },
  );
  return Buffer.from(b64, 'base64');
}

test('STL descargado: bytes coherentes con la figura', async ({ page }) => {
  await open(page);
  const { name, bytes } = await grab(page, 'Descargar STL');
  expect(name).toBe('caballero.stl');
  const n = bytes.readUInt32LE(80);
  expect(n).toBeGreaterThan(1000);
  expect(bytes.length).toBe(84 + 50 * n);
});

test('el STL incluye lo último dibujado, sin esperar al debounce', async ({ page }) => {
  await open(page, blank({ base: { enabled: false, diameter: 20, height: 2, bevel: true, color: '#333333' } }));
  await click(page, await cell(page, 'front', 3, 3));
  await expect(page.getByRole('button', { name: 'Descargar STL' })).toBeEnabled();
  await click(page, await cell(page, 'front', 4, 3));
  const { bytes } = await grab(page, 'Descargar STL');
  // Bloque de 2 x 1 x 6 vóxeles: 2 * (2*1 + 2*6 + 1*6) = 40 caras.
  expect(bytes.readUInt32LE(80)).toBe(80);
});

test('ZIP por color', async ({ page }) => {
  await open(page);
  const { name, bytes } = await grab(page, 'STL por color (ZIP)');
  expect(name).toBe('caballero_colores.zip');
  expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
  expect(bytes.readUInt16LE(bytes.length - 14)).toBe(11);
});

test('PNG de cada cara a x16 con transparencia; la espalda, vista desde detrás', async ({ page }) => {
  await open(page, blank());
  await click(page, await cell(page, 'back', 2, 3));
  const { name, bytes } = await grab(page, 'PNG espalda');
  expect(name).toBe('prueba_espalda.png');
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const at = (x: number, y: number): number[] => [...ctx.getImageData(x * 16 + 8, y * 16 + 8, 1, 1).data];
    return { w: img.width, h: img.height, dot: at(2, 3), empty: at(13, 3) };
  }, bytes.toString('base64'));
  expect(px).toEqual({ w: 256, h: 256, dot: [255, 0, 0, 255], empty: [0, 0, 0, 0] });
});

test('guardar y abrir JSON: ida y vuelta deshacible', async ({ page }) => {
  await open(page, blank());
  await click(page, await cell(page, 'front', 3, 3));
  await click(page, await cell(page, 'back', 1, 1));
  const before = await saved(page);
  const { name, bytes } = await grab(page, 'Guardar JSON');
  expect(name).toBe('prueba.pixelada.json');
  await page.getByRole('button', { name: 'Nueva' }).click();
  expect((await saved(page)).w).toBe(32);
  await page.getByLabel('Abrir proyecto').setInputFiles({ name: 'a.json', mimeType: 'application/json', buffer: bytes });
  await expect(page.locator('.toast').last()).toContainText('Abierto');
  expect(await saved(page)).toEqual(before);
  await page.locator('.toolbar').getByRole('button', { name: 'Deshacer' }).click();
  expect((await saved(page)).w).toBe(32);
});

test('un JSON corrupto avisa y no cambia nada', async ({ page }) => {
  await open(page, blank());
  const before = await saved(page);
  const bad = Buffer.from(JSON.stringify(blank({ w: 17 })));
  await page.getByLabel('Abrir proyecto').setInputFiles({ name: 'a.json', mimeType: 'application/json', buffer: bad });
  await expect(page.locator('.toast.error')).toContainText('se esperaban 272 píxeles');
  expect(await saved(page)).toEqual(before);
});

test('un autoguardado corrupto abre el ejemplo', async ({ page }) => {
  await open(page, '{"format":"pixelada","version":1,"w":"x"}');
  expect((await saved(page)).name).toBe('Caballero');
});

test('copiar proyecto al portapapeles', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, blank());
  await page.getByRole('button', { name: 'Copiar proyecto' }).click();
  await expect(page.locator('.toast')).toContainText('copiado');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(text)).toMatchObject({ format: 'pixelada', version: 1, w: 16 });
});

test('importar PNG a ambas caras con paleta nueva, y deshacer', async ({ page }) => {
  await open(page, blank());
  const buffer = await makePng(page, 2, 1, [[0, 0, '#123456'], [1, 0, '#fedcba']]);
  await page.locator('input[type=file][accept*=png]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer });
  const dialog = page.locator('dialog[open]');
  await expect(dialog.getByLabel('Ambas')).toBeChecked();
  await page.screenshot({ path: 'e2e/shots/importar.png' });
  await dialog.getByRole('button', { name: 'Importar' }).click();
  let s = await saved(page);
  expect(s.palette).toEqual(['#123456', '#fedcba']);
  expect(on(s.front).length).toBe(128);
  expect([s.front[15 * 16], s.front[15 * 16 + 15]]).toEqual([1, 2]);
  await page.keyboard.press('Control+z');
  s = await saved(page);
  expect(s.palette.length).toBe(3);
});

test('importar solo a la espalda con la paleta actual; cancelar no hace nada', async ({ page }) => {
  await open(page, blank({ front: Array.from({ length: 256 }, (_, i) => (i === 0 ? 1 : 0)), back: Array.from({ length: 256 }, (_, i) => (i === 0 ? 2 : 0)) }));
  const buffer = await makePng(page, 2, 1, [[0, 0, '#ee1100'], [1, 0, '#0011ee']]);
  const file = { name: 'a.png', mimeType: 'image/png', buffer };
  await page.locator('input[type=file][accept*=png]').setInputFiles(file);
  const dialog = page.locator('dialog[open]');
  await expect(dialog.getByRole('radio', { name: 'Frente' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  expect(on((await saved(page)).front)).toEqual(['0,0']);
  await page.locator('input[type=file][accept*=png]').setInputFiles(file);
  await dialog.getByRole('radio', { name: 'Espalda' }).check();
  await dialog.getByLabel('Usar la paleta actual').check();
  await dialog.getByRole('button', { name: 'Importar' }).click();
  const s = await saved(page);
  expect([s.back[15 * 16], s.back[15 * 16 + 15]]).toEqual([3, 1]);
  expect(on(s.front)).toEqual(['0,0']);
});

test('un cierre tardío del diálogo anterior no anula la imagen nueva', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener(
      'close',
      (e) => {
        if (!e.isTrusted) return;
        e.stopImmediatePropagation();
        const { target } = e;
        setTimeout(() => target?.dispatchEvent(new Event('close')), 800);
      },
      true,
    );
  });
  await open(page, blank());
  const buffer = await makePng(page, 2, 1, [[0, 0, '#123456'], [1, 0, '#fedcba']]);
  const file = { name: 'a.png', mimeType: 'image/png', buffer };
  const dialog = page.locator('dialog[open]');
  await page.locator('input[type=file][accept*=png]').setInputFiles(file);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('input[type=file][accept*=png]').setInputFiles(file);
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(1200);
  await dialog.getByRole('button', { name: 'Importar' }).click();
  expect(on((await saved(page)).front).length).toBe(128);
});

test('un archivo que no es imagen avisa', async ({ page }) => {
  await open(page, blank());
  await page.locator('input[type=file][accept*=png]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('nada') });
  await expect(page.locator('.toast.error')).toContainText('No se pudo leer la imagen');
});
