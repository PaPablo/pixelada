import { blank, cell, click, drag, expect, on, open, saved, test } from './util';

test.describe('editor 2D', () => {
  test.beforeEach(async ({ page }) => open(page, blank()));

  test('lápiz rápido sin huecos, y deshacer/rehacer en un paso', async ({ page }) => {
    await drag(page, await cell(page, 'front', 1, 1), await cell(page, 'front', 14, 6), 1);
    const s = await saved(page);
    expect(on(s.front).length).toBe(14);
    await page.keyboard.press('Control+z');
    expect(on((await saved(page)).front)).toEqual([]);
    await page.keyboard.press('Control+y');
    expect((await saved(page)).front).toEqual(s.front);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+Z');
    expect((await saved(page)).front).toEqual(s.front);
  });

  test('atajos: rectángulo, rellenar, gotero, borrador, mover', async ({ page }) => {
    await page.keyboard.press('r');
    await drag(page, await cell(page, 'front', 2, 2), await cell(page, 'front', 8, 8));
    expect(on((await saved(page)).front).length).toBe(24);
    await page.getByRole('button', { name: 'Color 2' }).click();
    await page.keyboard.press('g');
    await click(page, await cell(page, 'front', 5, 5));
    expect((await saved(page)).front.filter((c) => c === 2).length).toBe(25);
    await page.keyboard.press('i');
    await click(page, await cell(page, 'front', 2, 2));
    await expect(page.getByRole('button', { name: 'Color 1' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('e');
    await drag(page, await cell(page, 'front', 2, 2), await cell(page, 'front', 8, 2));
    expect(on((await saved(page)).front).length).toBe(42);
    await page.keyboard.press('h');
    await expect(page.getByRole('button', { name: 'Mover vista' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('b');
    await expect(page.getByRole('button', { name: 'Lápiz' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('la vista previa de la línea no deja rastro al mover', async ({ page }) => {
    await page.keyboard.press('l');
    const a = await cell(page, 'front', 0, 0);
    const b = await cell(page, 'front', 0, 10);
    const c = await cell(page, 'front', 10, 0);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y);
    expect(on((await saved(page)).front).length).toBe(11);
    await page.mouse.move(c.x, c.y);
    await page.mouse.up();
    expect(on((await saved(page)).front)).toEqual(Array.from({ length: 11 }, (_, x) => `${x},0`));
    await page.keyboard.press('Control+z');
    expect(on((await saved(page)).front)).toEqual([]);
  });

  test('simetría', async ({ page }) => {
    await page.getByRole('button', { name: 'Simetría' }).click();
    await click(page, await cell(page, 'front', 3, 4));
    expect(on((await saved(page)).front)).toEqual(['3,4', '12,4']);
  });

  test('recolorear es un solo paso y añadir color funciona', async ({ page }) => {
    await click(page, await cell(page, 'front', 3, 4));
    await page.getByLabel('Editar el color seleccionado').evaluate((el: HTMLInputElement) => {
      for (const v of ['#111111', '#222222', '#aabbcc']) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect((await saved(page)).palette[0]).toBe('#aabbcc');
    await page.keyboard.press('Control+z');
    const s = await saved(page);
    expect(s.palette[0]).toBe('#ff0000');
    expect(on(s.front)).toEqual(['3,4']);
    await page.getByRole('button', { name: 'Añadir color' }).click();
    expect((await saved(page)).palette.length).toBe(4);
    await page.keyboard.press('Escape');
    await page.locator('.toolbar').getByRole('button', { name: 'Deshacer' }).click();
    expect((await saved(page)).palette.length).toBe(3);
  });

  test('contorno, desplazar, limpiar y cambiar tamaño son deshacibles', async ({ page }) => {
    await click(page, await cell(page, 'front', 5, 5));
    await page.getByRole('button', { name: 'Añadir contorno' }).click();
    expect(on((await saved(page)).front).length).toBe(5);
    await page.getByRole('button', { name: 'Desplazar a la derecha' }).click();
    expect(on((await saved(page)).front)).toContain('7,5');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    expect(on((await saved(page)).front)).toEqual([]);
    await page.locator('.toast').getByRole('button', { name: 'Deshacer' }).click();
    expect(on((await saved(page)).front).length).toBe(5);
    await page.getByLabel('Ancho').fill('20');
    await page.getByRole('button', { name: 'Cambiar', exact: true }).click();
    const s = await saved(page);
    expect([s.w, s.h]).toEqual([20, 16]);
    expect(on(s.front, 20)).toContain('8,5');
    await page.locator('.toolbar').getByRole('button', { name: 'Deshacer' }).click();
    expect((await saved(page)).w).toBe(16);
  });

  test('rueda hace zoom y Ajustar lo restaura; pintar con zoom acierta la celda', async ({ page }) => {
    const p = await cell(page, 'front', 9, 4);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -300);
    await page.mouse.down();
    await page.mouse.up();
    expect(on((await saved(page)).front)).toEqual(['9,4']);
    await page.getByRole('button', { name: 'Ajustar (Frente)' }).click();
    await click(page, await cell(page, 'front', 2, 2));
    expect(on((await saved(page)).front)).toEqual(['2,2', '9,4']);
  });

  test('el autoguardado sobrevive a recargar', async ({ page }) => {
    await click(page, await cell(page, 'front', 5, 5));
    await page.waitForTimeout(600);
    await page.reload();
    expect(on((await saved(page)).front)).toEqual(['5,5']);
  });
});

test.describe('dos caras', () => {
  test('la espalda está espejada y la silueta es compartida', async ({ page }) => {
    await open(page, blank());
    await click(page, await cell(page, 'back', 2, 3));
    const s = await saved(page);
    expect(on(s.back)).toEqual(['13,3']);
    expect(on(s.front)).toEqual([]);
    // El frente lo muestra heredado: el gotero lo lee ahí.
    await page.getByRole('button', { name: 'Color 3' }).click();
    await page.keyboard.press('i');
    await click(page, await cell(page, 'front', 13, 3));
    await expect(page.getByRole('button', { name: 'Color 1' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('e');
    await click(page, await cell(page, 'front', 13, 3));
    expect(on((await saved(page)).back)).toEqual([]);
  });

  test('silueta independiente', async ({ page }) => {
    await open(page, blank());
    await click(page, await cell(page, 'front', 4, 4));
    await page.getByLabel('Silueta independiente por cara').check();
    expect(on((await saved(page)).back)).toEqual(['4,4']);
    await page.keyboard.press('e');
    await click(page, await cell(page, 'front', 4, 4));
    const s = await saved(page);
    expect([on(s.front), on(s.back)]).toEqual([[], ['4,4']]);
  });

  test('Tab alterna el panel, y Escape sale del lienzo sin trampas de teclado', async ({ page }) => {
    await open(page, blank());
    const front = page.locator('.panel[data-tab=front]');
    const back = page.locator('.panel[data-tab=back]');
    await click(page, await cell(page, 'front', 4, 4));
    await page.keyboard.press('Tab');
    await expect(back).toHaveClass(/active/);
    await expect(page.locator('[data-face=back]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(front).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Lápiz' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Borrador' })).toBeFocused();
    // Recorrer con el teclado llega a la paleta sin quedar atrapado en los lienzos.
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => !!document.activeElement?.closest('.palette'));
    }
    expect(reached).toBe(true);
    // Elegir herramienta con el ratón devuelve el foco al lienzo: Tab vuelve a alternar.
    await page.getByRole('button', { name: 'Rectángulo (R)' }).click();
    const active = await page.locator('.panel.active').getAttribute('data-tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('.panel.active')).not.toHaveAttribute('data-tab', active!);
  });

  test('copiar cara con botón y atajo', async ({ page }) => {
    await open(page, blank());
    await click(page, await cell(page, 'front', 4, 4));
    await page.getByRole('button', { name: 'Copiar frente a espalda' }).click();
    expect(on((await saved(page)).back)).toEqual(['4,4']);
    await page.keyboard.press('Control+z');
    await page.getByLabel('Silueta independiente por cara').check();
    await page.keyboard.press('Shift+C');
    expect(on((await saved(page)).back)).toEqual(['11,4']);
  });

  test('desplazar a la derecha en la espalda respeta la vista', async ({ page }) => {
    await open(page, blank());
    await click(page, await cell(page, 'back', 4, 4));
    await page.getByRole('button', { name: 'Desplazar a la derecha' }).click();
    expect(on((await saved(page)).back)).toEqual(['10,4']);
  });

  test('fantasma en el panel activo', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'fantasma' }).click();
    await page.waitForTimeout(200);
    await page.locator('[data-face=front]').screenshot({ path: 'e2e/shots/fantasma.png' });
  });
});

test.describe('táctil', () => {
  test.use({ hasTouch: true });

  test('un segundo dedo cancela el trazo y pellizca', async ({ page }) => {
    await open(page, blank());
    const a = await cell(page, 'front', 4, 4);
    const b = await cell(page, 'front', 8, 8);
    const c = await cell(page, 'front', 14, 14);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: { x: number; y: number }[]): Promise<unknown> =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ ...p, id })) });
    const value = page.locator('.panel[data-tab=front] .zoom-value');
    const before = await value.textContent();
    await touch('touchStart', [a]);
    await touch('touchStart', [a, b]);
    await touch('touchMove', [a, c]);
    await touch('touchEnd', []);
    await expect(value).not.toHaveText(before!);
    expect(on((await saved(page)).front)).toEqual([]);
    await page.getByRole('button', { name: 'Ajustar (Frente)' }).click();
    await page.touchscreen.tap(a.x, a.y);
    expect(on((await saved(page)).front)).toEqual(['4,4']);
  });
});
