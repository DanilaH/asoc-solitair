import { expect, test } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { AZUR_VICTORY_SAVE_KEY } from '../../src/domain/azur-victory-reward';
import { dispatch } from '../../src/domain/engine';
import { SAVE_KEY } from '../../src/platform/storage';
import { fixture, move, read, seed } from './wallet-fixture';

test.skip(process.env.VITE_AZUR_VICTORY_QA !== '1', 'Separate AZUR victory QA profile');

for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`source-shaped amount commits once and shows its split at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const save = fixture(4, true), deal = campaignDeals[4], last = deal.winningPath.at(-1)!;
    const baseline = dispatch(save, last, deal).next;
    const remaining = baseline.attempt.board.movesLeft ?? 0;
    const base = deal.training ? 25 : 50;
    const bonus = remaining * 5;
    const expected = baseline.profile.coins - (25 + remaining * 2) + base + bonus;
    const standard = JSON.stringify({ ...save, sentinel: 'ordinary-profile' });
    await page.addInitScript(({ standard, key }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, standard);
      const trace: unknown[] = [];
      document.addEventListener('solitaire:qa-analytics', event => {
        const detail = (event as CustomEvent).detail;
        if (detail.event === 'azur_victory_qa') trace.push(detail.params);
      });
      Object.assign(window, { victoryQaTrace: trace });
    }, { standard, key: SAVE_KEY });
    const trace = () => page.evaluate(() => (window as typeof window & { victoryQaTrace: unknown[] }).victoryQaTrace);
    await seed(page, save, AZUR_VICTORY_SAVE_KEY);
    await move(page, deal, last, AZUR_VICTORY_SAVE_KEY);
    await expect(page.locator('#result-source-base')).toHaveText('+' + base);
    await expect(page.locator('#result-source-moves')).toHaveText('+' + bonus);
    expect((await read(page, AZUR_VICTORY_SAVE_KEY)).profile.coins).toBe(expected);
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(standard);
    expect(await trace()).toMatchObject([{ provenance: 'SOURCE_COMPILED_DEFAULT', base, bonus, amount: base + bonus }]);

    await expect(page.locator('#win-video-offers')).toBeHidden();
    const next = page.locator('#next-level');
    await expect(next).toHaveText('Забрать');
    await next.tap();
    await expect(next).toHaveAttribute('aria-busy', 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(next).toHaveText(/уровень 6|Уровень 6/);
    await expect(page.locator('#coins')).toHaveText(String(expected));
    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    await page.locator('#home-play').tap();
    await expect(page.locator('#result-source-moves')).toHaveText('+' + bonus);
    await expect(next).toHaveText(/уровень 6|Уровень 6/);
    expect(await trace()).toEqual([]);
    expect((await read(page, AZUR_VICTORY_SAVE_KEY)).profile.rewards.filter(id => id === `win:${save.attempt.id}`)).toHaveLength(1);
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(standard);
  });
}
