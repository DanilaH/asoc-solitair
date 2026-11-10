import { expect, test } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { introDeal } from '../../src/content/intro';
import { UI_ART, artUrl, illustrationUrl } from '../../src/game/art';

test('the complete art pack decodes with transparent gutters and published image references resolve locally', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173') && /^https?:/.test(request.url())) external.push(request.url()); });
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
