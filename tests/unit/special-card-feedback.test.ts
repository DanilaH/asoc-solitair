import { expect, test } from 'vitest';
import { picturedSpecialsDeal as deal } from '../../src/content/campaign-v8-hitapps-specials';
import { applyBoard } from '../../src/domain/engine';
import { specialCardCues } from '../../src/game/special-card-feedback';

test('only the cards that thaw, lose a binding or join get a cue', () => {
  let before = deal.initial;
  const changes = new Map();
  for (const [index, command] of deal.winningPath.entries()) {
    const next = applyBoard(before, command, deal);
    if (typeof next === 'string') throw new Error(next);
    const cues = specialCardCues(before, next.board, deal);
    if (cues.length) changes.set(index, cues);
    expect(specialCardCues(next.board, next.board, deal)).toEqual([]);
    before = next.board;
  }
  expect(changes).toEqual(new Map([
    [1, [{ kind: 'thaw', id: 'shell-bottom' }, { kind: 'cut', id: 'shell-bottom', underIce: true }]],
    [4, [{ kind: 'thaw', id: 'shell-bottom' }, { kind: 'cut', id: 'pines', underIce: false }]],
    [6, [{ kind: 'join', id: 'shell-top' }]],
  ]));
});
