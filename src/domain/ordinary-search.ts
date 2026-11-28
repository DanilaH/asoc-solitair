import { applyBoard, boardKey, legalCommands, packet, sourceCards } from './engine';
import type { Board, BoardCommand, Deal, Location } from './types';

/** Symmetry-pruned actions for the ordinary, unlocked reference slice. */
export function referenceActions(board: Board, deal: Deal): BoardCommand[] {
  if (board.phase !== 'playing') return [];
  if (board.rulesVersion === 4) {
    const emptyHome = board.foundations.findIndex(pile => !pile.length);
    const emptyTableau = board.tableau.findIndex(pile => !pile.length);
    return legalCommands(board, deal).filter(action => {
      if (action.type !== 'transfer' || action.scissors) return true;
      if (action.to.kind === 'foundation') return board.foundations[action.to.index].length || action.to.index === emptyHome;
      if (action.to.kind !== 'tableau' || board.tableau[action.to.index].length) return true;
      return action.to.index === emptyTableau && (action.from.kind !== 'tableau' || action.root !== undefined ||
        packet(board, action.from.index, deal).length < board.tableau[action.from.index].length);
    });
  }
  const out: BoardCommand[] = [];
  const groups = board.tableau.map((_, i) => packet(board, i, deal));
  const firstFree = board.foundations.findIndex(group => !group.length);
  const emptyColumn = board.tableau.findIndex(group => !group.length);
  const sources: Location[] = [...groups.map((_, index) => ({ kind: 'tableau' as const, index })), { kind: 'waste', index: 0 }];
  for (const from of sources) {
    const ids = from.kind === 'tableau' ? groups[from.index] : sourceCards(board, from, deal);
    if (!ids.length) continue;
    const category = deal.cards[ids[0]].category;
    const leader = ids.some(id => deal.cards[id].leader);
    const upper = leader ? firstFree : board.foundations.findIndex(group => group.length && deal.cards[group[0]].category === category);
    if (upper >= 0) out.push({ type: 'transfer', from, to: { kind: 'foundation', index: upper } });
    for (const [index, receiving] of groups.entries()) {
      if (from.kind === 'tableau' && from.index === index) continue;
      const canUseEmpty = index === emptyColumn && (from.kind === 'waste' || board.tableau[from.index].length !== ids.length);
      const canJoin = receiving.length && deal.cards[receiving[0]].category === category && !receiving.some(id => deal.cards[id].leader);
      if (canUseEmpty || canJoin) out.push({ type: 'transfer', from, to: { kind: 'tableau', index } });
    }
  }
  if (board.stock.length || board.waste.length && board.recyclesLeft !== 0)
    out.push({ type: board.stock.length ? 'draw' : 'recycle' });
  return out;
}

type Node = { key: string; board: Board; parent?: Node; action?: BoardCommand; steps: number; score: number };
const key = (board: Board) => JSON.stringify([
  board.tableau.map(group => group.join(',')).sort(), board.foundations.map(group => group.join(',')).sort(),
  board.stock, board.waste, board.tableau.map(group => group.filter(id => board.faceUp.includes(id)).join(',')).sort(),
  board.recyclesLeft ?? null,
]);

export function findReferenceRoute(deal: Deal, initial: Board, cap: number, allowLower = true, deadline = Infinity,
  mode?: 'verified-specials', continuation?: (board: Board) => BoardCommand[] | null) {
  const plainR4 = initial.rulesVersion === 4 && initial.hitapps && !deal.hitapps?.assemblies.length && !deal.hitapps?.gold && !initial.joker &&
    Object.values(initial.hitapps.cards).every(card => !card.bound && !card.scissors && !card.ice && !card.lock && !card.key && card.kind <= 1);
  const identity = plainR4 ? key : mode === 'verified-specials' || initial.rulesVersion === 4 ? boardKey : key;
  const heap: Node[] = [], seen = new Map<string, number>();
  const weights = new Map<string, number>();
  for (const card of Object.values(deal.cards)) weights.set(card.category, (weights.get(card.category) ?? 0) + 1);
  const score = (board: Board, steps: number) => {
    let distance = 0, opened = 0;
    for (const group of board.foundations) if (group.length) {
      const cat = deal.cards[group[0]].category;
      distance += weights.get(cat)! - group.length;
      opened += group.length;
    }
    if (initial.rulesVersion === 4) {
      const hidden = board.tableau.flat().filter(id => !board.faceUp.includes(id)).length;
      return (board.collected.length + opened) * -8 + distance * .3 + hidden * 1.4 + board.stock.length * .09 + steps * .52;
    }
    return (board.collected.length + opened) * -6 + distance * .28 + board.stock.length * .19
      + board.tableau.filter(group => group.length).length * .6 + steps * .78;
  };
  function push(board: Board, steps: number, parent?: Node, action?: BoardCommand) {
    const key = identity(board);
    if ((seen.get(key) ?? Infinity) <= steps) return;
    seen.set(key, steps);
    const node: Node = { key, board, parent, action, steps, score: score(board, steps) };
    let i = heap.length;
    heap.push(node);
    while (i) {
      const parent = (i - 1) >> 1;
      if (heap[parent].score <= node.score) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = node;
  }
  function pop() {
    const top = heap[0], tail = heap.pop()!;
    let i = 0;
    if (heap.length) {
      while (2 * i + 1 < heap.length) {
        let next = 2 * i + 1;
        if (heap[next + 1]?.score < heap[next].score) next++;
        if (heap[next].score >= tail.score) break;
        heap[i] = heap[next]; i = next;
      }
      heap[i] = tail;
    }
    return top;
  }
  push(initial, 0);
  let visited = 0;
  while (heap.length && visited < cap && performance.now() < deadline) {
    const node = pop();
    if ((seen.get(node.key) ?? Infinity) < node.steps) continue;
    visited++;
    const tail = node.board.phase === 'won' ? [] : continuation?.(node.board);
    if (tail) {
      const path: BoardCommand[] = [];
      for (let n: Node = node; n.parent; n = n.parent) path.push(n.action!);
      return { status: 'FOUND' as const, path: [...path.reverse(), ...tail], visited };
    }
    // AZUR's five native hint groups guide exploration, never replace a win proof.
    const priority = (action: BoardCommand) => action.type !== 'transfer' ? 4
      : action.to.kind === 'foundation' ? (action.from.kind === 'waste' ? 0 : 1)
      : action.from.kind === 'waste' ? 2
      : action.from.kind === 'tableau' && action.to.kind === 'tableau' && !node.board.tableau[action.to.index].length &&
        !node.board.tableau[action.from.index].some(id => !node.board.faceUp.includes(id)) ? 3.5 : 3;
    const actions = referenceActions(node.board, deal);
    if (continuation) actions.sort((a, b) => priority(a) - priority(b));
    for (const action of actions) {
      if (continuation && performance.now() >= deadline) break;
      if (!allowLower && action.type === 'transfer' && action.to.kind === 'tableau') continue;
      const result = applyBoard(node.board, action, deal);
      if (typeof result === 'string') {
        // Ordered ranks, locked targets and puzzle constraints can reject a proposal.
        if (mode === 'verified-specials') continue;
        throw Error(result);
      }
      if (result.board.phase === 'exhausted') continue;
      const tail = continuation?.(result.board);
      if (tail) {
        const path: BoardCommand[] = [action];
        for (let n: Node = node; n.parent; n = n.parent) path.push(n.action!);
        return { status: 'FOUND' as const, path: [...path.reverse(), ...tail], visited };
      }
      push(result.board, node.steps + (result.consumedMoves ?? 1), node, action);
    }
  }
  return { status: (heap.length ? 'UNKNOWN' : 'NO_ROUTE_IN_PRUNED_GRAPH') as 'UNKNOWN' | 'NO_ROUTE_IN_PRUNED_GRAPH', visited };
}
