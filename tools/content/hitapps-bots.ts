import { applyBoard, sourceCards } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { simulationPosition, type SimulationPolicy } from './difficulty-selection';

function progress(board: Board) {
  const open = board.foundations.reduce((count, pile) => count + pile.length, 0);
  const visible = board.tableau.flat().filter(card => board.faceUp.includes(card)).length;
  return board.collected.length * 12 + open * 7 + visible * 3;
}

function progressChoices(deal: Deal, style: 'uncover' | 'foundation'): SimulationPolicy['choose'] {
  const seen = new Set<string>();
  return (board, legal) => {
    seen.add(simulationPosition(board));
    let best: BoardCommand | undefined;
    let bestScore = -Infinity;
    for (const action of legal) {
      if (action.type === 'transfer' && action.from.kind === 'tableau' && action.to.kind === 'tableau' &&
          !board.tableau[action.to.index].length &&
          sourceCards(board, action.from, deal).length === board.tableau[action.from.index].length) continue;
      const result = applyBoard(board, action, deal);
      if (typeof result === 'string') throw Error('Bot received an illegal command');
      const next = result.board;
      if (next.phase === 'won') return action;
      if (seen.has(simulationPosition(next))) continue;
      const room = next.tableau.filter(pile => !pile.length).length;
      const cover = next.tableau.flat().filter(card => !next.faceUp.includes(card)).length;
      let score = progress(next) + room * 2 - cover * (style === 'uncover' ? 12 : 4);
      if (action.type === 'transfer') {
        if (action.from.kind === 'waste') score += 4;
        if (action.to.kind === 'foundation') score += style === 'foundation' ? 8 : 2;
        if (action.to.kind === 'tableau' && board.tableau[action.to.index].length) score += 2;
      }
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    }
    return best ?? legal.find(action => action.type !== 'transfer');
  };
}

function boundedPlanner(deal: Deal): SimulationPolicy['choose'] {
  const { lock, frozen, bound, puzzle, starter, recovery } = deal;
  const canSearch = !lock && !frozen && !bound && !puzzle && !starter && !recovery &&
    !deal.initial.joker && !Object.values(deal.cards).some(card => card.ordered);
  const route = canSearch ? findReferenceRoute(deal, deal.initial, 1600).path : undefined;
  if (route) {
    let index = 0;
    return () => route[index++];
  }
  return progressChoices(deal, 'foundation');
}

/** Product strategies with different search methods. No authored witness, seed or level enters the decision. */
export const hitappsBotPolicies: readonly SimulationPolicy[] = [
  {
    id: 'uncover-and-consolidate', version: 1, detectCycles: true,
    start: deal => progressChoices(deal, 'uncover'),
    choose: (_board, legal) => legal[0],
  },
  {
    id: 'bounded-plan-and-foundation', version: 1, detectCycles: true,
    start: boundedPlanner,
    choose: (_board, legal) => legal[0],
  },
];
