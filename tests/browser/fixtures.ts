import { expect, type Page } from '@playwright/test';
import { introDeal } from '../../src/content/intro';
import { freshSave } from '../../src/domain/engine';
export async function openIntro(page: Page) {
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  await page.evaluate(value => localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(value)), freshSave(introDeal,'browser-control'));
  await resume(page);
}
export async function resume(page: Page) {
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  await page.locator('#home-play').tap();
  await expect(page.locator('#play-screen')).toBeVisible();
}
