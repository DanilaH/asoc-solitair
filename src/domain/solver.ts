import { applyBoard, boardKey, boardRules, legalCommands } from './engine';
import type { Board, BoardCommand, Deal } from './types';
import { bonusKinds, bonusOffer, pilesFor } from './bonus-slots';
export type SearchResult = { status: 'SOLVED'; path: BoardCommand[]; visited: number }
  | { status: 'UNKNOWN' | 'UNSOLVABLE'; visited: number };

export function solve(start: Board, deal: Deal, limit = 8000, deadline = Infinity): SearchResult {
  const queue: { board: Board; path: BoardCommand[] }[] = [{ board: start, path: [] }];
  const seen = new Map<string, number>();
  seen.set(boardKey(start), start.movesLeft ?? Infinity);
  let head = 0;
  while (head < queue.length && head < limit && performance.now() < deadline) {
    const { board, path } = queue[head++];
    if (board.phase === 'won') return { status: 'SOLVED', path, visited: head };
    for (const action of legalCommands(board, deal)) {
      const result = applyBoard(board, action, deal);
      if (typeof result === 'string') continue;
      const remaining = result.board.movesLeft ?? Infinity;
      const key = boardKey(result.board);
      if (seen.has(key) && seen.get(key)! >= remaining) continue;
      seen.set(key, remaining);
      queue.push({ board: result.board, path: [...path, action] });
    }
  }
  return { status: head < queue.length ? 'UNKNOWN' : 'UNSOLVABLE', visited: head };
}

export function knownContinuation(board: Board, deal: Deal): BoardCommand[] | null {
  const legacy = boardRules(board) === 2;
  const routes = legacy ? [deal.legacyWinningPath ?? deal.winningPath] : [deal.winningPath, ...(deal.recoveryPaths ?? [])];
  const match = (state: Board) => {
    for (const route of routes) {
      const continuation = matchRoute(state, deal, route);
      if (continuation) return continuation;
    }
    return null;
  };
  const direct = match(board), lower = bonusOffer(deal, 'tableau');
  if (direct || !lower || !board.tableau[lower.index]?.length) return direct;
  // A group temporarily parked in the extra column can rejoin an authored route.
  for (const action of legalCommands(board, deal)) {
    if (action.type !== 'transfer' || action.from.kind !== 'tableau' || action.from.index !== lower.index) continue;
    const next = applyBoard(board, action, deal);
    if (typeof next === 'string') continue;
    const continuation = match(next.board);
    if (continuation) return [action, ...continuation];
  }
  return null;
}

/** Request-local witness index. Slot permutations are matched, budgets are replayed. */
export function continuationLookup(initial: Board, deal: Deal, deadline = Infinity) {
  // Same-category ordinary words may trade places after draw/transfer changes.
  // This is a candidate-tail index, never a search-state equivalence. IDs and
  // last-transition marks remain untouched on the actual board. Full normative
  // replay below rejects any special-card, order, gold or budget mismatch.
  const contents = (board: Board, pile: string[]) => JSON.stringify(pile.map(id => {
    const card = deal.cards[id], source = board.hitapps?.cards[id];
    return [card.category, card.leader, card.rank, board.faceUp.includes(id), source?.kind, source?.order,
      source?.puzzle, source?.bound, source?.scissors, source?.ice, source?.lock?.collected,
      source?.key?.used, source?.gold?.health];
  }));
  const key = (board: Board) => JSON.stringify([boardRules(board), board.tableau.map(pile=>contents(board,pile)),
    board.foundations.map(pile=>contents(board,pile)).sort(), contents(board,board.stock), contents(board,board.waste),
    contents(board,board.collected.slice().sort()), board.joker, board.keys, board.recyclesLeft, board.retainedMoves,
    board.hitapps?.generatedGold, board.hitapps?.spent.length]);
  const routes = boardRules(initial) === 2 ? [deal.legacyWinningPath ?? deal.winningPath]
    : [deal.winningPath, ...(deal.recoveryPaths ?? [])];
  const index = new Map<string, { foundations: string[]; path: BoardCommand[] }[]>();
  for (const witness of routes) {
    if (performance.now() >= deadline) break;
    let current: Board = { ...structuredClone(deal.initial), rulesVersion: boardRules(initial), movesLeft: null };
    for (const kind of bonusKinds) {
      const offer = bonusOffer(deal, kind);
      if (offer && pilesFor(initial, kind).length > offer.index) pilesFor(current, kind).push([]);
    }
    for (let i = 0; i < witness.length && performance.now() < deadline; i++) {
      const id = key(current), rows = index.get(id) ?? [];
      rows.push({ foundations: current.foundations.map(pile=>contents(current,pile)), path: witness.slice(i) }); index.set(id, rows);
      const next = applyBoard(current, witness[i], deal);
      if (typeof next === 'string') break;
      current = next.board;
    }
  }
  return (board: Board): BoardCommand[] | null => {
    if (performance.now() >= deadline) return null;
    for (const row of index.get(key(board)) ?? []) {
      if (performance.now() >= deadline) return null;
      const used = new Set<number>();
      const slots = row.foundations.map(pile => {
        const at = board.foundations.findIndex((other, i) => !used.has(i) && contents(board,other) === pile);
        used.add(at); return at;
      });
      if (slots.some(at => at < 0)) continue;
      const path = row.path.map(action => action.type === 'transfer' ? { ...action,
        from: action.from.kind === 'foundation' ? { ...action.from, index: slots[action.from.index] } : action.from,
        to: action.to.kind === 'foundation' ? { ...action.to, index: slots[action.to.index] } : action.to,
      } : action);
      let replay = board;
      let valid = true;
      for (const action of path) {
        if (performance.now() >= deadline) return null;
        const next = applyBoard(replay, action, deal);
        if (typeof next === 'string') { valid = false; break; }
        replay = next.board;
      }
      if (valid && replay.phase === 'won') return path;
    }
    return null;
  };
}

function matchRoute(board: Board, deal: Deal, witness: BoardCommand[]): BoardCommand[] | null {
  let current: Board = { ...structuredClone(deal.initial), rulesVersion: boardRules(board), movesLeft: null };
  for (const kind of bonusKinds) {
    const offer = bonusOffer(deal, kind);
    if (offer && pilesFor(board, kind).length > offer.index) pilesFor(current, kind).push([]);
  }
  for (let index = 0; index < witness.length; index++) {
    // Foundation slots have identical rules. Match their contents, then map the
    // stored route back to the player's actual slots; tableau/locks stay exact.
    const used = new Set<number>();
    const slots: number[] = [];
    // Reserve matches sequentially so multiple empty slots remain a bijection.
    for (let i = 0; i < current.foundations.length; i++) {
      slots[i] = board.foundations.findIndex((other, j) => !used.has(j) && JSON.stringify(current.foundations[i]) === JSON.stringify(other));
      if (slots[i] >= 0) used.add(slots[i]);
    }
    if (slots.length === board.foundations.length && slots.every(i => i >= 0) &&
      boardKey(current) === boardKey({ ...board, foundations: slots.map(i => board.foundations[i]) })) {
      const path = witness.slice(index).map(action => action.type === 'transfer' ? {
        ...action,
        from: action.from.kind === 'foundation' ? { ...action.from, index: slots[action.from.index] } : action.from,
        to: action.to.kind === 'foundation' ? { ...action.to, index: slots[action.to.index] } : action.to,
      } : action);
      if (board.movesLeft === null || path.length <= board.movesLeft) return path;
    }
    const result = applyBoard(current, witness[index], deal);
    if (typeof result === 'string') return null;
    current = result.board;
  }
  return null;
}
