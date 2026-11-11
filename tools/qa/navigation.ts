import type { Page } from '@playwright/test';
/** Exercise the same visible routes a player uses; no runtime test bridge. */
export async function dismissTeaching(page: Page) {
  if (await page.locator('#learn-rule').isVisible()) {
    await page.locator('#learn-rule .primary').tap();
    await page.locator('#learn-rule').waitFor({ state: 'hidden' });
  }
}
export async function pauseOptions(page: Page) {
  const details = page.locator('#pause-options');
  if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').tap();
}
export async function showHome(page: Page) {
  await dismissTeaching(page);
  if (await page.locator('#app').getAttribute('data-screen') === 'game') {
    await page.locator('#menu').tap(); await page.locator('#levels-open').tap();
  }
}
