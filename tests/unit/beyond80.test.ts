import { expect, it } from 'vitest';
import { beyond80Deals } from '../../src/content/campaign-v8-beyond';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { applyBoard, assertBoard, boardKey, freshSave } from '../../src/domain/engine';
import { BEYOND80_PREVIEW, CAMPAIGN_LENGTH, campaignId, unlockedLevel } from '../../src/domain/progression';
import { cardArtwork } from '../../src/game/art';
import { boardFrame, layout } from '../../src/game/layout';
import { advance } from '../../tools/qa/gameplay-oracle';

it('registers immutable level 81–87 IDs and keeps the first 80 IDs and old resolutions intact', () => {
  expect(beyond80Deals.map(deal => deal.campaignLevel)).toEqual([81, 82, 83, 84, 85, 86, 87]);
  for (const deal of beyond80Deals) expect(findDeal(deal.id)).toBe(deal);
  expect(campaignDeals.length).toBe(CAMPAIGN_LENGTH);
  const last = campaignDeals[79];
  expect(last.campaignLevel).toBe(80);
  expect(findDeal(last.id)).toBe(last);
  const cleared = freshSave(last, 'prior-save');
  cleared.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 80 }, (_, index) => campaignId(index + 1)) };
  expect(unlockedLevel(cleared)).toBe(BEYOND80_PREVIEW ? 81 : 80);
});

it('checks two distinct complete paths plus portrait geometry on every new board', () => {
  for (const deal of beyond80Deals) {
    assertBoard(deal.initial, deal);
    const paths = [deal.winningPath, ...deal.recoveryPaths!];
    expect(paths).toHaveLength(2);
    expect(paths[0]).not.toEqual(paths[1]);
    for (const path of paths) {
      let board = deal.initial;
      for (const command of path) {
        const played = applyBoard(board, command, deal);
        const oracle = advance(board, command, deal);
        if (typeof played === 'string' || !oracle) throw Error(deal.id + ' diverged');
        expect(boardKey(played.board)).toBe(boardKey(oracle));
        expect(played.board.movesLeft).toBe(oracle.movesLeft);
        board = played.board;
      }
      expect(board.phase).toBe('won');
      expect(board.movesLeft).toBeGreaterThanOrEqual(9);
    }
    for (const position of ['top', 'bottom'] as const) {
      const frame = boardFrame(296, 372, position, deal);
      for (const side of ['left', 'right'] as const) {
        const { targets } = layout(deal.initial, deal, frame, side, position);
        expect(targets).toHaveLength(deal.initial.tableau.length + deal.initial.foundations.length);
        expect(targets.every(target => target.x * frame.unit >= 0 && target.x * frame.unit <= 296 &&
          target.y * frame.unit >= 0 && target.y * frame.unit <= 372)).toBe(true);
      }
    }
  }
});

it('uses 42 fresh topic titles with variable category sizes and a mixture of illustrated and word cards', () => {
  const normalized = (text: string) => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const old = new Set([...content8Dealer, ...content8Wave, ...content8Late]
    .flatMap(deal => Object.values(deal.cards).filter(card => card.leader).map(card => normalized(card.text))));
  const cards = beyond80Deals.flatMap(deal => Object.values(deal.cards));
  const topics = cards.filter(card => card.leader).map(card => normalized(card.text));
  expect(new Set(topics).size).toBe(42);
  expect(topics.every(name => !old.has(name))).toBe(true);
  const sizes = new Set(cards.filter(card => card.leader).map(leader => cards.filter(card => card.category === leader.id).length));
  expect(sizes.size).toBeGreaterThanOrEqual(3);
  const board = beyond80Deals[0];
  const words = Object.values(board.cards).filter(card => card.category === 'ru81-2');
  expect(words.some(card => cardArtwork(card, board)?.endsWith('candle.webp'))).toBe(true);
  expect(words.some(card => !card.leader && !cardArtwork(card, board))).toBe(true);
});
