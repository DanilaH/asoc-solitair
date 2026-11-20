import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { Save } from '../../src/domain/types';

const dist = '.recording/content8-onboarding/deliver-dist';
const port = 4273;
const server = await preview({ build: { outDir: dist }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch();
try {
  for (const [level, width, height, tier] of [[5, 320, 480, 'Сложный'], [10, 320, 568, 'Очень сложный']] as const) {
    const context = await browser.newContext({ baseURL: `http://127.0.0.1:${port}`, viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), deal = content8Dealer[level - 1];
    let save: Save = { ...freshSave(deal, 'difficulty-' + level), contentVersion: 8 };
    save.platform = { completedCampaign: Array.from({ length: level - 1 }, (_, i) => campaignId(i + 1)), receipts: [],
      continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0 };
    save.settings.reducedMotion = true;
    for (const move of deal.winningPath) save = dispatch(save, move, deal).next;
    assert.equal(save.attempt.board.phase, 'won');
    await page.goto('/');
    await page.locator('#app[data-ready=true]').waitFor();
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
    await page.evaluate(save => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(save)), save);
    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    const picker = page.locator('#level-picker');
    await page.locator('#level-picker-open').tap();
    await expect(picker).toBeVisible();
    await expect(page.locator('#level-' + (level + 1))).toHaveAccessibleName(new RegExp(tier));
    await picker.getByRole('button', { name: 'Закрыть' }).tap();
    await page.locator('#home-play').tap();
    await expect(page.locator('#next-level')).toContainText(`${tier} уровень ${level + 1}`);
    await page.locator('#next-level').tap();
    await expect(page.locator('#difficulty-title')).toHaveText(tier);
    await page.keyboard.press('Escape');
    await expect(page.locator('#result')).toBeVisible();
    assert.equal((await stored()).attempt.id, save.attempt.id);
    await page.locator('#next-level').tap();
    await page.locator('#difficulty-play').press('Enter');
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', content8Dealer[level].id);
    const active = await stored();
    assert.equal(active.profile.coins, save.profile.coins);
    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    await expect(page.locator('#home-play')).toContainText(tier);
    await page.locator('#home-play').tap();
    await expect(page.locator('#difficulty-entry')).not.toBeVisible();
    assert.equal((await stored()).attempt.id, active.attempt.id);
    await context.close();
    console.log(level, '→', level + 1, width, height, tier, 'PASS');
  }
} finally {
  await browser.close();
  server.httpServer.close();
}
