import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { campaignDeals } from '../../src/content/campaign';
import { dailyPool } from '../../src/content/daily';
import { introDeal } from '../../src/content/intro';
import { cardArtwork } from '../../src/game/art';

it('every published category has one visual language, with word leaders and unchanged card definitions', () => {
  const illustrated = new Set<string>();
  for (const deal of [introDeal, ...campaignDeals, ...dailyPool]) {
    const before = JSON.stringify(deal.cards);
    for (const category of new Set(Object.values(deal.cards).map(c => c.category))) {
      const members = Object.values(deal.cards).filter(c => c.category === category && !c.leader);
      const pictures = members.map(c => cardArtwork(c, deal));
      expect(new Set(pictures.map(Boolean)).size, `${deal.id}/${category}`).toBe(1);
      for (const path of pictures) if (path) { expect(existsSync('public/' + path), path).toBe(true); illustrated.add(path); }
    }
    for (const card of Object.values(deal.cards).filter(c => c.leader)) expect(cardArtwork(card, deal)).toBeUndefined();
    expect(JSON.stringify(deal.cards)).toBe(before);
  }
  expect(illustrated.size).toBeGreaterThan(100);
});
