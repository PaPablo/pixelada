import { blank, cell, click, drag, expect, open, test } from './util';

/** Color medio de una zona del lienzo 3D (leído de una captura). */
async function sample(page: import('@playwright/test').Page, fx: number, fy: number): Promise<number[]> {
  const canvas = page.locator('.view-canvas');
  const png = (await canvas.screenshot()).toString('base64');
  return page.evaluate(
    async ([b64, x, y]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(Math.round(img.width * Number(x)), Math.round(img.height * Number(y)), 1, 1).data].slice(0, 3);
    },
    [png, fx, fy] as const,
  );
}

const solid = (c: number, patch = {}): Record<string, unknown> =>
  blank({ front: Array(256).fill(c), back: Array(256).fill(2), ...patch });

test('el frente se ve del color del frente y la espalda del suyo', async ({ page }) => {
  await open(page, solid(1));
  await expect(page.locator('.view-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Vista: Frente' }).click();
  await page.waitForTimeout(300);
  const f = await sample(page, 0.5, 0.45);
  expect(f[0]).toBeGreaterThan(f[1] + 80);
  await page.getByRole('button', { name: 'Vista: Atrás' }).click();
  await page.waitForTimeout(300);
  const b = await sample(page, 0.5, 0.45);
  expect(b[1]).toBeGreaterThan(b[0] + 80);
});

test('la izquierda del frente queda a la izquierda en 3D y a la derecha por detrás', async ({ page }) => {
  const front = Array.from({ length: 256 }, (_, i) => (i % 16 < 8 ? 1 : 3));
  await open(page, blank({ front }));
  await page.getByRole('button', { name: 'Vista: Frente' }).click();
  await page.waitForTimeout(300);
  let l = await sample(page, 0.42, 0.45);
  expect(l[0]).toBeGreaterThan(l[2] + 60);
  await page.getByRole('button', { name: 'Vista: Atrás' }).click();
  await page.waitForTimeout(300);
  l = await sample(page, 0.42, 0.45);
  expect(l[2]).toBeGreaterThan(l[0] + 60);
});

test('medidas y avisos en vivo', async ({ page }) => {
  await open(page, blank());
  await expect(page.locator('[data-notice=empty]')).toBeVisible();
  await click(page, await cell(page, 'front', 8, 15));
  await expect(page.locator('[data-notice=single]')).toBeVisible();
  await expect(page.locator('.measures')).toContainText('16 mm');
  await click(page, await cell(page, 'front', 9, 14));
  await expect(page.locator('[data-notice=loose]')).toContainText('1 parte suelta: quedan 6 vóxeles');
  await page.getByLabel('Grosor').fill('1');
  await expect(page.locator('[data-notice=thin]')).toBeVisible();
  await page.getByLabel('Tamaño del píxel').fill('0.3');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-notice=tiny]')).toContainText('resina');
});

test('girar, zoom y giro automático', async ({ page }) => {
  await open(page);
  const canvas = page.locator('.view-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(300);
  const b = (await canvas.boundingBox())!;
  const before = await canvas.screenshot();
  await drag(page, { x: b.x + 100, y: b.y + 100 }, { x: b.x + 220, y: b.y + 120 });
  await page.waitForTimeout(200);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  const auto = page.getByRole('button', { name: 'Giro automático' });
  await auto.click();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Vista: 3/4' }).click();
  await expect(auto).toHaveAttribute('aria-pressed', 'false');
});

test('con menos movimiento no hay giro automático', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.locator('.view-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Giro automático' })).toBeDisabled();
});

test.describe('sin WebGL', () => {
  test.use({ allowErrors: true });
  test('hay mensaje y el editor y las medidas siguen', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type.startsWith('webgl') ? null : (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    await open(page, blank());
    await expect(page.locator('.no-webgl')).toContainText('WebGL no está disponible');
    await click(page, await cell(page, 'front', 8, 15));
    await expect(page.locator('[data-notice=single]')).toBeVisible();
  });
});
