import { expect, open, test, touchTargets } from './util';

const SIZES = [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'tableta', width: 1024, height: 768 },
  { name: 'movil', width: 390, height: 844 },
];

for (const s of SIZES) {
  test(`capturas ${s.name}`, async ({ page }) => {
    await page.setViewportSize(s);
    await open(page);
    await page.waitForTimeout(700);
    if (s.name === 'movil') {
      for (const tab of ['Frente', 'Espalda', 'Vista 3D']) {
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `e2e/shots/movil-${tab.replace(' ', '')}.png` });
      }
      await page.screenshot({ path: 'e2e/shots/movil-completa.png', fullPage: true });
    } else {
      await page.screenshot({ path: `e2e/shots/${s.name}.png` });
      await page.screenshot({ path: `e2e/shots/${s.name}-completa.png`, fullPage: true });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await touchTargets(page.locator('#app'))).toEqual([]);
  });
}
