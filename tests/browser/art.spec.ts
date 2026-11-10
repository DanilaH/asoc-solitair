import { expect, test } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { introDeal } from '../../src/content/intro';
import { dispatch, freshSave } from '../../src/domain/engine';
import { UI_ART, artUrl, illustrationUrl } from '../../src/game/art';

test('the complete art pack decodes with transparent gutters and published image references resolve locally', async ({ page, baseURL }) => {
  const external: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on('request', request => { if (!request.url().startsWith(origin + '/') && /^https?:/.test(request.url())) external.push(request.url()); });
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const originals = [...new Set([introDeal, ...campaignDeals].flatMap(deal => Object.values(deal.cards).flatMap(card => card.image ? [card.image] : [])))];
  expect(originals.length).toBe(35);
  const illustrations = originals.map(illustrationUrl);
  expect(illustrations.every(url => url.startsWith('art/generated/'))).toBe(true);
  const urls = [...new Set([...UI_ART.map(artUrl), ...illustrations])];
  const defects = await page.evaluate(async urls => {
    const defects: string[] = [];
    for (const url of urls) {
      const img = new Image(); img.src = url;
      try { await img.decode(); } catch { defects.push('decode: ' + url); continue; }
      if (img.naturalWidth < 128 || img.naturalHeight < 128) defects.push('undersized: ' + url);
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0, solid = 0;
      for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] < 8) transparent++; if (pixels[i] > 220) solid++; }
      if (transparent < canvas.width * canvas.height * .015) defects.push('missing transparency: ' + url);
      if (solid < canvas.width * canvas.height * .04) defects.push('empty artwork: ' + url);
    }
    return defects;
  }, urls);
  expect(defects).toEqual([]);
  expect(external).toEqual([]);
});

test('static reduced-motion cards remain painted after viewport and banner backing-size changes', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const deal = campaignDeals[20]; let save = freshSave(deal, 'art-static-repaint'); save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, 20).map(d => d.id) };
  for (const command of deal.winningPath) {
    const result = dispatch(save, command, deal);
    if (result.events.some(event => event.type === 'complete')) break;
    save = result.next;
    if (save.attempt.board.foundations.every(ids => ids.length)) break;
  }
  await page.evaluate(value => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value)), save);
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true'); await page.locator('#home-play').tap();
  for (const [width, height] of [[520, 700], [320, 568], [360, 780], [520, 700]]) {
    await page.setViewportSize({ width, height });
    for (const banner of [90, 60]) {
      await page.locator('#banner-slot').evaluate((element, banner) => { (element as HTMLElement).hidden = false; (element as HTMLElement).style.height = `${banner}px`; }, banner);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const screenshot = await page.locator('canvas').screenshot();
      await page.route('**/art-repaint.png', route => route.fulfill({ body: screenshot, contentType: 'image/png', headers: { 'Cache-Control': 'no-store' } }), { times: 1 });
      const visibleCardPixels = await page.evaluate(async () => {
        const image = new Image(); image.src = '/art-repaint.png'; await image.decode();
        const bitmap = document.createElement('canvas'); bitmap.width = image.width; bitmap.height = image.height;
        const context = bitmap.getContext('2d')!; context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data; let count = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 220 && pixels[i + 1] > 200 && pixels[i + 2] > 170) count++;
        return count;
      });
      expect(visibleCardPixels, `Painted cards at ${width}×${height}, banner ${banner}`).toBeGreaterThan(500);
    }
  }
});
