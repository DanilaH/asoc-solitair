import { expect, test } from '@playwright/test';
import { fixture, read, seed } from './wallet-fixture';

test.skip(process.env.VITE_C8_OWNER_PREVIEW !== 'offer-campaigns', 'Local context-offer preview');
test.use({ video: 'on' });

test('shows the three separate AZUR presenters, preserves the two-show cap and never opens checkout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const save = fixture(15);
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  await seed(page, save);
  const before = await read(page);
  const panel = page.locator('#context-offer-preview');
  const show = async (trigger: number, handler: string) => {
    await page.locator('#wallet-open').tap();
    await page.locator('#offer-campaign-preview-open').tap();
    await page.locator(`#offer-campaign-preview [data-offer-event="${trigger}"]`).tap();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-presenter', handler);
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y + box.height).toBeLessThanOrEqual(568);
    await expect(panel.getByText('Покупки недоступны')).toBeVisible();
    await page.waitForTimeout(550);
    await panel.getByRole('button', { name: 'Готово' }).tap();
  };
  await show(0, 'ShowWelcomeOffer');
  await page.reload();
  await page.locator('#home-play').tap();
  await show(5, 'ShowWelcomeOffer');
  await show(5, 'ShowBoostersCoinsOffer');
  await show(6, 'ShowBoostersHintOffer');
  const after = await read(page);
  expect(after.profile).toEqual(before.profile);
  expect(after.attempt.board).toEqual(before.attempt.board);
  expect(after.commerce).toEqual(before.commerce);
  expect(after.offerCampaigns?.accounts[0].campaigns.find(c => c.campaignId === 'welcome-qa')).toMatchObject({ shows: 2, activations: 1 });
});
