import { blank, drag, expect, on, open, saved, test } from './util';

type P = import('@playwright/test').Page;

const full = (): Record<string, unknown> =>
  blank({ front: Array(256).fill(1), back: Array(256).fill(2), base: { enabled: true, diameter: 20, height: 2, bevel: true, color: '#333333' } });

async function center(page: P): Promise<{ x: number; y: number; w: number; h: number }> {
  const b = (await page.locator('.view-canvas').boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
}

async function ready(page: P, view: string): Promise<void> {
  await expect(page.locator('.view-canvas')).toBeVisible();
  await page.getByRole('button', { name: `Vista: ${view}` }).click();
  await page.getByRole('button', { name: 'Pintar en 3D' }).click();
  await page.waitForTimeout(200);
}

test('pinta el frente con el ratón, sin huecos y en un solo paso', async ({ page }) => {
  await open(page, full());
  await ready(page, 'Frente');
  await page.getByRole('button', { name: 'Color 3' }).click();
  const c = await center(page);
  await drag(page, { x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }, 2);
  const s = await saved(page);
  const xs = s.front.flatMap((v, i) => (v === 3 ? [i % 16] : [])).sort((a, b) => a - b);
  expect(xs.length).toBeGreaterThan(5);
  expect(xs).toEqual(Array.from({ length: xs.length }, (_, i) => xs[0] + i));
  expect(s.back.every((v) => v === 2)).toBe(true);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).front.every((v) => v === 1)).toBe(true);
});

test('con la carga lenta, pintar no se habilita hasta que funciona', async ({ page }) => {
  await page.route('**/view3d/paint3d*', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await open(page, full());
  await ready(page, 'Frente');
  await page.getByRole('button', { name: 'Color 3' }).click();
  const c = await center(page);
  await page.mouse.click(c.x, c.y);
  expect((await saved(page)).front.filter((v) => v === 3).length).toBe(1);
});

test('por detrás pinta la espalda, en el lado que se ve', async ({ page }) => {
  await open(page, full());
  await ready(page, 'Atrás');
  await page.getByRole('button', { name: 'Color 3' }).click();
  const c = await center(page);
  await page.mouse.click(c.x - 50, c.y);
  const s = await saved(page);
  expect(s.front.every((v) => v === 1)).toBe(true);
  const xs = s.back.flatMap((v, i) => (v === 3 ? [i % 16] : []));
  expect(xs.length).toBe(1);
  // A la izquierda vista desde detrás = x alta en el modelo.
  expect(xs[0]).toBeGreaterThan(8);
  await expect(page.locator('.panel.active')).toHaveAttribute('data-tab', 'back');
});

test('el borrador borra en ambas caras y no perfora', async ({ page }) => {
  await open(page, full());
  await ready(page, 'Frente');
  await page.keyboard.press('e');
  const c = await center(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 0; i < 6; i++) await page.mouse.move(c.x + (i % 2), c.y);
  await page.mouse.up();
  const s = await saved(page);
  expect(on(s.front).length).toBeGreaterThanOrEqual(254);
  expect(on(s.front)).toEqual(on(s.back));
  expect(on(s.front).length).toBeLessThan(256);
});

test('fuera de la figura, sobre la base o con Mayús gira en vez de pintar', async ({ page }) => {
  await open(page, full());
  await ready(page, 'Frente');
  await page.getByRole('button', { name: 'Color 3' }).click();
  const c = await center(page);
  const canvas = page.locator('.view-canvas');
  let before = await canvas.screenshot();
  await drag(page, { x: c.x - c.w / 2 + 8, y: c.y - c.h / 2 + 8 }, { x: c.x - c.w / 2 + 70, y: c.y - c.h / 2 + 8 });
  await page.waitForTimeout(150);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole('button', { name: 'Vista: Frente' }).click();
  await page.waitForTimeout(150);
  before = await canvas.screenshot();
  await page.keyboard.down('Shift');
  await drag(page, { x: c.x, y: c.y }, { x: c.x + 60, y: c.y });
  await page.keyboard.up('Shift');
  await page.waitForTimeout(150);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  expect((await saved(page)).front.every((v) => v === 1)).toBe(true);
});

test('con el modo apagado, arrastrar sobre la figura solo gira', async ({ page }) => {
  await open(page, full());
  await expect(page.locator('.view-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Vista: Frente' }).click();
  await page.getByRole('button', { name: 'Color 3' }).click();
  const c = await center(page);
  await drag(page, { x: c.x, y: c.y }, { x: c.x + 60, y: c.y });
  expect((await saved(page)).front.every((v) => v === 1)).toBe(true);
});

test.describe('táctil', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('un dedo pinta; un segundo dedo cancela y gira', async ({ page }) => {
    await open(page, full());
    await page.getByRole('tab', { name: 'Vista 3D' }).click();
    await ready(page, 'Frente');
    await page.getByRole('button', { name: 'Color 3' }).click();
    await page.locator('.view-canvas').scrollIntoViewIfNeeded();
    const c = await center(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: { x: number; y: number }[]): Promise<unknown> =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })) });
    await touch('touchStart', [{ x: c.x - 20, y: c.y }]);
    await touch('touchMove', [{ x: c.x + 20, y: c.y }]);
    await touch('touchEnd', []);
    let s = await saved(page);
    const painted = s.front.filter((v) => v === 3).length;
    expect(painted).toBeGreaterThan(1);

    await page.locator('.toolbar').getByRole('button', { name: 'Deshacer' }).click();
    await page.locator('.view-canvas').scrollIntoViewIfNeeded();
    const d = await center(page);
    await touch('touchStart', [{ x: d.x - 20, y: d.y }]);
    await touch('touchStart', [{ x: d.x - 20, y: d.y }, { x: d.x + 20, y: d.y }]);
    await touch('touchMove', [{ x: d.x - 60, y: d.y }, { x: d.x + 60, y: d.y }]);
    await touch('touchEnd', []);
    s = await saved(page);
    expect(s.front.every((v) => v === 1)).toBe(true);
    await page.screenshot({ path: 'e2e/shots/movil-pintar3d.png' });
  });
});
