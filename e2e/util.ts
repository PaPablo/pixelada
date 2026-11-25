import { test as base, expect, type Locator, type Page } from '@playwright/test';

/** Cada prueba falla si la página lanza errores o escribe errores en consola. */
export const test = base.extend<{ allowErrors: boolean }>({
  allowErrors: [false, { option: true }],
  page: async ({ page, allowErrors }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await use(page);
    if (!allowErrors) expect(errors).toEqual([]);
  },
});
export { expect };

export type Saved = {
  w: number; h: number; front: number[]; back: number[]; palette: string[]; depth: number; independent: boolean;
  name: string; pixelMm: number;
};

export async function open(page: Page, project?: unknown): Promise<void> {
  if (project) {
    const text = typeof project === 'string' ? project : JSON.stringify(project);
    await page.addInitScript((t) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('pixelada.autosave', t);
        sessionStorage.setItem('seeded', '1');
      }
    }, text);
  }
  await page.goto('/');
  await expect(page.locator('[data-face=front]')).toBeAttached();
}

/** Figura vacía de 16 x 16 con base. */
export function blank(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: 'pixelada', version: 1, name: 'Prueba', w: 16, h: 16, palette: ['#ff0000', '#00ff00', '#0000ff'],
    front: Array(256).fill(0), back: Array(256).fill(0), independent: false, depth: 6, skin: 3, pixelMm: 0.8,
    base: { enabled: true, diameter: 20, height: 2, bevel: true, color: '#333333' }, ...patch,
  };
}

/** Estado actual, leído del autoguardado. */
export async function saved(page: Page): Promise<Saved> {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  return page.evaluate(() => JSON.parse(localStorage.getItem('pixelada.autosave') ?? 'null'));
}

/** Centro en pantalla de una celda de VISTA, con el panel ajustado. */
export async function cell(page: Page, face: 'front' | 'back', x: number, y: number, w = 16, h = 16): Promise<{ x: number; y: number }> {
  const canvas = page.locator(`[data-face=${face}]`);
  const b = (await canvas.boundingBox())!;
  const raw = Math.min((b.width - 24) / w, (b.height - 24) / h);
  const s = raw >= 2 ? Math.floor(raw) : raw;
  const ox = Math.round((b.width - w * s) / 2);
  const oy = Math.round((b.height - h * s) / 2);
  return { x: b.x + ox + (x + 0.5) * s, y: b.y + oy + (y + 0.5) * s };
}

export async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }, steps = 4): Promise<void> {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
}

export async function click(page: Page, p: { x: number; y: number }): Promise<void> {
  await page.mouse.click(p.x, p.y);
}

export const on = (layer: number[], w = 16): string[] =>
  layer.flatMap((c, i) => (c ? [`${i % w},${Math.floor(i / w)}`] : []));

export async function touchTargets(root: Locator): Promise<string[]> {
  return root.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('button, summary, input[type=text], input[type=number], input[type=color], label.check')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ r: b.getBoundingClientRect(), n: b.textContent?.trim() || b.getAttribute('aria-label') || b.id }))
      .filter(({ r }) => r.width < 40 || r.height < 40)
      .map(({ r, n }) => `${n}: ${r.width}x${r.height}`),
  );
}
