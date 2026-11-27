import { CAMPAIGN_LENGTH } from '../../src/domain/progression';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, findDeal, savedDealDefinitions, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay, dailyPool } from '../../src/content/daily';
import { bonusKinds, bonusOffer, openBonusSlot } from '../../src/domain/bonus-slots';
import { applyBoard, freshSave } from '../../src/domain/engine';
import type { Board, Deal } from '../../src/domain/types';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';

test.skipIf(process.env.ASOC_QA_C8_GEOMETRY !== '1')('C8 uses a single bounded grid for issued, Daily and retained Deal IDs', () => {
  assert.ok(releaseProfile, 'the C8 release profile must be active');
  assert.equal(releaseProfile!.id, 'c8-release-v1');
  assert.equal(releaseProfile!.capabilities.proofShuffle, 'active');
  assert.equal(releaseProfile!.capabilities.bonusSlots, 'active');
  assert.equal(releaseProfile!.capabilities.frozenBoundPuzzleGoldenStarter, 'active');
  assert.equal(releaseProfile!.capabilities.purchases, 'off');
  assert.equal(campaignDeals.length, CAMPAIGN_LENGTH);

  const issued = new Map<string, Deal>();
  for (const base of campaignDeals) {
    for (const difficultyPenalty of [-5, 0, 10]) {
      const save = freshSave(base, 'grid-audit');
      save.difficultyPenalty = difficultyPenalty;
      const selected = selectCampaignDeal(save, base);
      issued.set(selected.id, selected);
      for (const previous of [save.attempt, freshSave(selected, 'grid-retry').attempt]) {
        previous.board.phase = 'exhausted';
        previous.director = { restarts: 2, previousLosses: 2 };
        const retry = selectCampaignDeal(save, base, previous);
        issued.set(retry.id, retry);
      }
    }
  }
  for (const level of [30, 33, 36, 39]) {
    assert.ok([...issued.values()].some(deal => deal.campaignLevel === level && deal.shuffleCost === 'charge'));
  }
  for (const level of [22, 30, 40]) {
    assert.ok([...issued.values()].some(deal => deal.campaignLevel === level && deal.bonusSlots));
  }

  const daily = dailyPool.map((_, i) => dailyForDay('2026-01-' + String(i + 1).padStart(2, '0')));
  const saved = [...savedDealDefinitions()];
  assert.equal(new Set(daily.map(deal => deal.daily!.poolId)).size, 28);
  const definitions = new Map([...issued.values(), ...daily, ...saved].map(deal => [deal.id, deal]));
  let cases = 0, replayed = 0, bonusCases = 0;
  for (const deal of definitions.values()) {
    assert.equal(findDeal(deal.id)?.id, deal.id);
    const states = new Set<Board>([deal.initial]);
    const densest = (board: Board) => Math.max(...board.tableau.map(pile => pile.length));
    const filled = (board: Board) => board.foundations.filter(pile => pile.length).length;
    let current = deal.initial, tall = current, upper = current;
    const fans = new Map<number, Board>();
    for (const move of deal.winningPath) {
      const applied = applyBoard(current, move, deal);
      if (typeof applied === 'string') break;
      replayed++;
      current = applied.board;
      if (current.phase !== 'playing') break;
      if (densest(current) > densest(tall)) tall = current;
      if (filled(current) > filled(upper)) upper = current;
      if (!fans.has(Math.min(3, current.waste.length))) fans.set(Math.min(3, current.waste.length), current);
    }
    states.add(tall); states.add(upper);
    let stock = deal.initial;
    while (stock.stock.length && stock.phase === 'playing') {
      const drawn = applyBoard(stock, { type: 'draw' }, deal);
      if (typeof drawn === 'string') break;
      stock = drawn.board;
      const fan = Math.min(3, stock.waste.length);
      if (!fans.has(fan)) fans.set(fan, stock);
    }
    states.add(stock);
    for (const fan of fans.values()) states.add(fan);
    const paid = freshSave(deal, 'grid-paid');
    for (const kind of bonusKinds) if (openBonusSlot(paid.attempt, deal, kind)) {
      states.add(structuredClone(paid.attempt.board));
      bonusCases++;
    }
    for (const [width, height] of [[296, 208], [296, 275], [336, 420], [496, 470], [744, 826]]) {
      for (const row of ['top', 'bottom'] as const) for (const side of ['left', 'right'] as const) {
        const frame = boardFrame(width, height, row, deal), card = cardMetrics(deal);
        const cw = card.width * frame.unit, ch = card.height * frame.unit;
        const label = `${deal.id} ${width}x${height} ${row}-${side}`;
        assert.ok(Math.abs(ch - cw * 166 / 138) < 0.001, label);
        const origin = layout(deal.initial, deal, frame, side, row);
        const stockBase = origin.stock.y + origin.stock.thickness;
        for (const board of states) {
          const geometry = layout(board, deal, frame, side, row);
          assert.ok(Math.abs(geometry.stock.y + geometry.stock.thickness - stockBase) < 0.001, label);
          const bounds = (x: number, y: number) => {
            const left = x * frame.unit - cw / 2, top = y * frame.unit - ch / 2;
            assert.ok(left >= -0.001 && top >= -0.001 && left + cw <= width + 0.001 && top + ch <= height + 0.001, label);
          };
          for (const pose of geometry.poses) bounds(pose.x, pose.y);
          if (geometry.joker) bounds(geometry.joker.x, geometry.joker.y);
          for (const kind of bonusKinds) {
            const targets = geometry.targets.filter(target => target.location.kind === kind);
            targets.forEach(({ x, y }, i) => {
              bounds(x, y);
              assert.ok(Math.abs(x * frame.unit - (cw / 2 + i * cw * 152 / 138)) < 0.001, label);
              if (i > 0) assert.ok((x - targets[i - 1].x) * frame.unit > cw, label);
            });
            const bonus = bonusOffer(deal, kind), before = origin.offers.find(offer => offer.kind === kind);
            if (bonus && before && targets[bonus.index]) {
              assert.deepEqual({ x: targets[bonus.index].x, y: targets[bonus.index].y }, { x: before.x, y: before.y }, label);
            }
          }
          const foundation = geometry.targets.find(target => target.location.kind === 'foundation');
          const tableau = geometry.targets.filter(target => target.location.kind === 'tableau');
          const waste = geometry.poses.filter(pose => board.waste.includes(pose.id));
          if (foundation) {
            for (const target of tableau) assert.ok((target.y - foundation.y) * frame.unit > ch, label);
            for (const pose of waste) assert.ok(Math.abs(pose.y - foundation.y) * frame.unit > ch, label);
          }
          cases++;
        }
      }
    }
  }
  console.info(JSON.stringify({ profile: releaseProfile!.id, campaign: campaignDeals.length, issued: issued.size,
    daily: daily.length, retained: saved.length, distinctIds: definitions.size, cases, replayed, bonusCases }));
}, 240_000);
