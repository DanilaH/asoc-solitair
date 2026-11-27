import type { Board, BoardCommand, Deal, GameEvent, Location } from './types';
import { activeLocker, activateGold, boundStatus, canMelt, Change, collectTypedKey, decayAllowed, goldCounts,
  goldDecayMilestone, groupExtends, hammerAllowed, homeAllows, isStarter, Kind, magnetAllowed, magnetMatches,
  marks, melt, placerVerdict, playAllows, positiveFreezeMove, scissorsWrite, transferPuzzleMark, type SourceCard } from './hitapps-rules';

export interface HitappsDealRules {
  policy: 'hitapps-rules4-v1';
  assemblies: readonly { tag: number; halves: readonly [string, string]; card: string }[];
  gold?: { total: number; first: number; coinsPerActivation: number; eventKey?: string; rewardGroup?: string };
}
export interface HitappsBoardState {
  move: number;
  cards: Record<string, SourceCard>;
  spent: string[];
  generatedGold: number;
}
type ActiveBoard = Board & { hitapps: HitappsBoardState };
type Transfer = Extract<BoardCommand, {type: 'transfer'}>;
type Step = { board: Board; events: GameEvent[]; consumedMoves: number };

const open = (board: ActiveBoard, id: string) => board.faceUp.includes(id);
const hiddenOrLocked = (board: ActiveBoard, id: string) => !open(board, id) || activeLocker(board.hitapps.cards[id]);
const available = (board: ActiveBoard, id: string) => !hiddenOrLocked(board, id) && board.hitapps.cards[id].ice === 0;
const sameLocation = (left: Location, right: Location) => left.kind === right.kind && left.index === right.index;
const socketEdge = (board: Board, column: number) => board.joker?.column === column ? board.joker.boundary : 0;
const visibleSegment = (board: ActiveBoard, loc: Location) => loc.kind === 'tableau'
  ? (board.tableau[loc.index] ?? []).slice(socketEdge(board, loc.index)) : sourcePile(board, loc)?.slice(-1) ?? [];
export const jokerConflict = 'Джокер отделяет эти карты';

function crossesJoker(board: ActiveBoard, deal: Deal, to: Location, moving: string[]) {
  if (to.kind !== 'tableau' || board.joker?.column !== to.index || !moving.length) return false;
  const pile = board.tableau[to.index];
  if (pile.length !== board.joker.boundary) return false;
  if (isStarter(board.hitapps.cards[moving[0]].kind)) return true;
  const below = pile.at(-1), above = moving[0];
  return Boolean(below && deal.hitapps?.assemblies.some(pair => below !== above && pair.halves.includes(below) && pair.halves.includes(above)));
}

function binding(board: ActiveBoard, deal: Deal, ids: string[], position: number) {
  return boundStatus(ids.map(id => ({ available: available(board, id), kind: board.hitapps.cards[id].kind,
    category: deal.cards[id].category, bound: board.hitapps.cards[id].bound })), position).status;
}

export function hitappsPacket(board: ActiveBoard, index: number, deal: Deal, requestedRoot?: number) {
  const column = board.tableau[index], top = column?.at(-1);
  if (!top || !available(board, top)) return [];
  const edge = socketEdge(board, index);
  if (column.length <= edge) return [];
  let first = column.length - 1;
  while (first > edge) {
    const upper = column[first], lower = column[first - 1];
    const card = board.hitapps.cards[lower];
    if (!groupExtends(deal.cards[upper].category === deal.cards[lower].category, board.hitapps.cards[upper].bound,
      available(board, lower), card.kind === Kind.joker || isStarter(card.kind))) break;
    if (isStarter(board.hitapps.cards[top].kind)) break;
    first--;
  }
  const root = requestedRoot ?? first;
  if (!Number.isInteger(root) || root < first || root >= column.length) return [];
  if (root === first || board.hitapps.cards[column[root]].bound !== 2) return column.slice(root);
  return [];
}

const sourcePile = (board: Board, source: Location) => source.kind === 'tableau' ? board.tableau[source.index]
  : source.kind === 'waste' && source.index === 0 ? board.waste : undefined;

export function hitappsSources(board: ActiveBoard, from: Location, deal: Deal, root?: number) {
  if (from.kind === 'tableau') return hitappsPacket(board, from.index, deal, root);
  return sourcePile(board, from)?.slice(-1) ?? [];
}

function sourcePlans(board: ActiveBoard, except: Location) {
  return [
    ...board.tableau.flatMap((column, index) => sameLocation(except, { kind: 'tableau', index }) || column.length === socketEdge(board, index) ? [] : column.slice(-1)),
    ...board.waste.slice(-1),
    ...board.stock,
  ];
}

function magnetChoice(board: ActiveBoard, deal: Deal, from: Location, to: Location, reference: string) {
  const data = board.hitapps.cards, target = data[reference];
  const ordered = target.order > 0 && !target.puzzle;
  const required = ordered ? target.order + (to.kind === 'foundation' ? 1 : -1) : -1;
  const candidates = sourcePlans(board, to).filter(id => !sourcePile(board, from)?.slice(-1).includes(id));
  return candidates.find(id => {
    const card = data[id];
    if (target.lock && activeLocker(target)) return card.key?.type === target.lock.type && !card.key.used;
    const category = card.kind === Kind.category;
    const common = !hiddenOrLocked(board, id) || board.stock.includes(id);
    return magnetMatches(common && deal.cards[id].category === deal.cards[reference].category && card.kind !== Kind.joker &&
      !isStarter(card.kind) && (!category || required === 0), target.puzzle, card.puzzle, card.order, required, category);
  });
}

function evaluation(board: ActiveBoard, deal: Deal, from: Location, to: Location, moving: string[]) {
  if (to.kind === 'waste' || sameLocation(from, to) || !moving.length || crossesJoker(board, deal, to, moving)) return;
  const home = to.kind === 'foundation', ids = (home ? board.foundations : board.tableau)[to.index];
  if (!ids) return;
  const socket = !home && board.joker?.column === to.index;
  const data = board.hitapps.cards, id = moving[0], source = data[id], top = socket ? undefined : ids.at(-1), target = top ? data[top] : undefined;
  if (socket && ids.length !== board.joker!.boundary) return;
  const sourceColumn = visibleSegment(board, from), attached = from.kind === 'tableau' && sourceColumn.length
    ? binding(board, deal, sourceColumn, sourceColumn.indexOf(id)) : 0;
  const choice = top && source.kind === Kind.magnet ? magnetChoice(board, deal, from, to, top) : undefined;
  const targetLocked = Boolean(target && activeLocker(target));
  const verdict = placerVerdict(home ? 'home' : 'play', source, {
    occupied: Boolean(top), locked: targetLocked, frozen: Boolean(target?.ice), bound: attached,
    hammer: Boolean(top && hammerAllowed(home ? 3 : 2, false, ids.length, target!.kind, !open(board, top))),
    magnet: Boolean(top && magnetAllowed(home ? 3 : 2, false, ids.length, target!.kind, !open(board, top),
      Boolean(target!.ice), targetLocked, home ? 0 : binding(board, deal, ids, ids.length - 1), Boolean(choice), Boolean(choice))),
  });
  if (home) {
    const categoryLeader = moving.find(card => data[card].kind === Kind.category);
    const lastCategory = Boolean(categoryLeader && moving.at(-1) === categoryLeader && from.kind !== 'waste');
    if (!homeAllows({ verdict, occupied: Boolean(top), validCategory: Boolean(top && !categoryLeader &&
        deal.cards[ids[0]].category === deal.cards[id].category && moving.every(card => deal.cards[card].category === deal.cards[id].category)),
      categorySource: source.kind === Kind.category, categoryLast: lastCategory,
      sourceOrder: lastCategory ? data[moving.at(-1)!].order : source.order, targetOrder: target?.order ?? 0 })) return;
    return { ids, choice, top, categoryLeader, home };
  }
  if (!playAllows({ verdict, category: target?.kind === Kind.category, available: Boolean(top && available(board, top)),
    joker: Boolean(socket || target?.kind === Kind.joker), sameCategory: Boolean(top && deal.cards[top].category === deal.cards[id].category),
    samePuzzle: target?.puzzle === source.puzzle, sourceOrder: source.order, targetOrder: target?.order ?? 0 })) return;
  return { ids, choice, top, home };
}

function expose(board: ActiveBoard, id: string | undefined, events: GameEvent[]) {
  if (!id || open(board, id)) return;
  board.faceUp.push(id);
  marks(board.hitapps.cards[id], board.hitapps.move, Change.revealed);
  events.push({ type: 'flip', cards: [id] });
}

function collectKeys(board: ActiveBoard, events: GameEvent[]) {
  const { cards, move } = board.hitapps;
  for (const id of [...board.waste.slice(-1), ...board.tableau.flatMap((column, index) => {
    const suffix: string[] = [];
    for (let position = column.length - 1; position >= socketEdge(board, index) && available(board, column[position]); position--) suffix.push(column[position]);
    return suffix;
  })]) {
    const key = cards[id].key;
    if (!key || key.used || !available(board, id)) continue;
    const locked = board.tableau.flat().find(card => cards[card].lock?.type === key.type && activeLocker(cards[card]));
    if (!locked) continue;
    const lock = cards[locked].lock!;
    const unlock = collectTypedKey(lock, key);
    events.push({ type: 'key', cards: [id], amount: lock.collected });
    if (unlock) {
      marks(cards[locked], move, Change.unlocked);
      events.push({ type: 'unlock', cards: [locked], amount: lock.required });
    }
  }
}

function assemble(board: ActiveBoard, deal: Deal, target: string[], moved: string[], events: GameEvent[]) {
  const [first, second] = target.slice(-2);
  if (!first || !second || !moved.some(id => id === first || id === second)) return;
  if (board.joker && target === board.tableau[board.joker.column] && target.length - 2 < board.joker.boundary) return;
  const data = board.hitapps.cards, tag = data[first].puzzle;
  if (!tag || tag !== data[second].puzzle) return;
  const match = deal.hitapps?.assemblies.find(row => row.tag === tag && row.halves.includes(first) && row.halves.includes(second));
  if (!match) return;
  transferPuzzleMark(data[match.card], [data[first], data[second]], board.hitapps.move);
  target.splice(-2, 2, match.card);
  board.hitapps.spent.push(first, second);
  board.faceUp = board.faceUp.filter(id => id !== first && id !== second);
  board.faceUp.push(match.card);
  events.push({ type: 'assemble', cards: [match.card, first, second], category: deal.cards[match.card].category });
}

export function hitappsGoals(deal: Deal) {
  const consumedHalves = new Set(deal.hitapps?.assemblies.flatMap(row => [...row.halves]));
  return Object.keys(deal.cards).filter(id => !consumedHalves.has(id) && !isStarter(deal.initial.hitapps!.cards[id].kind) &&
    deal.initial.hitapps!.cards[id].kind !== Kind.joker);
}

function completeHome(board: ActiveBoard, deal: Deal, events: GameEvent[]) {
  const goals = hitappsGoals(deal);
  for (const [index, ids] of board.foundations.entries()) {
    if (!ids.length) continue;
    const category = deal.cards[ids[0]].category;
    if (!goals.every(id => deal.cards[id].category !== category || ids.includes(id))) continue;
    board.collected.push(...ids);
    board.foundations[index] = [];
    events.push({ type: 'complete', cards: ids, category });
  }
}

function goldTick(board: ActiveBoard, deal: Deal, placed: readonly string[], decay: boolean, events: GameEvent[]) {
  const config = deal.hitapps?.gold;
  if (!config) return;
  const { move, cards } = board.hitapps;
  for (const id of placed) {
    const gold = cards[id]?.gold;
    if (gold && activateGold(gold)) events.push({ type: 'gold', cards: [id], amount: 0, reason: 'activated' });
  }
  const present = [...board.tableau.flat(), ...board.waste.slice(-1), ...board.foundations.flat()];
  const uncovered = present.find(id => cards[id].gold?.health && cards[id].gold!.appeared === 0 && available(board, id));
  if (uncovered) {
    cards[uncovered].gold!.appeared = move;
    events.push({ type: 'gold', cards: [uncovered], amount: 4, reason: 'appeared' });
  }
  if (decay) for (const id of present) {
    const card = cards[id], gold = card.gold;
    if (!gold || !decayAllowed(gold.health, available(board, id), gold.appeared, card.changedAt,
      Boolean(card.changed & Change.revealed), card.changedAt === move && Boolean(card.changed & Change.unlocked), move)) continue;
    gold.health--;
    events.push({ type: 'gold', cards: [id], amount: gold.health, reason: 'decay' });
    const milestone = goldDecayMilestone(gold.health);
    if (milestone) events.push({ type: 'gold', cards: [id], amount: gold.health, reason: milestone === 2 ? 'last-health' : 'destroyed' });
  }
  // Own hidden-candidate order, separate from the known source count conditions.
  const pool = board.tableau.flatMap(column => column.filter((id, position) => {
    const card = cards[id], above = column[position + 1];
    return !open(board, id) && !card.gold && !card.puzzle && !card.order && !card.bound && !cards[above]?.bound;
  }));
  const count = goldCounts(config.total, board.hitapps.generatedGold, pool.length, config.first);
  if (pool.length && count.remaining > 0 && (!count.firstComplete || count.runningOut)) {
    const id = pool[0];
    cards[id].gold = { health: 4, appeared: 0, activated: false };
    board.hitapps.generatedGold++;
    events.push({ type: 'gold', cards: [id], amount: 4, reason: 'generated' });
  }
}

function effectOfStarter(board: ActiveBoard, deal: Deal, target: NonNullable<ReturnType<typeof evaluation>>, kind: number,
  events: GameEvent[]) {
  const id = target.top!, card = board.hitapps.cards[id];
  if (kind === Kind.magnet && activeLocker(card) && target.choice) {
    const key = board.hitapps.cards[target.choice].key!;
    if (collectTypedKey(card.lock!, key)) {
      marks(card, board.hitapps.move, Change.unlocked);
      events.push({ type: 'unlock', cards: [id], amount: card.lock!.required });
    }
    events.push({ type: 'key', cards: [target.choice], amount: card.lock!.collected });
  } else if (card.ice) {
    card.ice = 0;
    events.push({ type: 'ice', cards: [id], amount: 0, reason: 'booster-break' });
    return true;
  } else if (card.bound) {
    card.bound = 1;
    events.push({ type: 'cut', cards: [id], reason: 'booster' });
  } else if (kind === Kind.magnet && target.choice) {
    const from = [board.stock, board.waste, ...board.tableau].find(pile => pile.includes(target.choice!))!;
    from.splice(from.indexOf(target.choice), 1);
    const donor = board.tableau.indexOf(from);
    if (donor >= 0) {
      if (board.joker?.column === donor && from.length === board.joker.boundary) delete board.joker;
      expose(board, from.at(-1), events);
    }
    expose(board, target.choice, events);
    target.ids.push(target.choice);
    marks(board.hitapps.cards[target.choice], board.hitapps.move, Change.placed);
    events.push({ type: 'transfer', cards: [target.choice], category: deal.cards[target.choice].category, cause: 'magnet' });
    assemble(board, deal, target.ids, [target.choice], events);
  } else if (kind === Kind.hammer) {
    // Own direct target effect for a non-special top card. No arbitrary hidden reveal.
    target.ids.pop();
    board.waste.push(id);
    expose(board, target.ids.at(-1), events);
    events.push({ type: 'draw', cards: [id], cause: 'hammer' });
  }
  return false;
}

function scissors(board: ActiveBoard, cmd: Transfer, events: GameEvent[]) {
  const data = board.hitapps.cards;
  const from = visibleSegment(board, cmd.from).at(-1);
  const target = cmd.to.kind === 'tableau' ? visibleSegment(board, cmd.to).reverse() : [];
  if (cmd.scissors === 'unbind') {
    const id = target.find(id => open(board, id) && data[id].bound === 1);
    if (!id) return false;
    scissorsWrite('unbind', data[id], data[id]);
    events.push({ type: 'unbind', cards: [id] });
    return true;
  }
  if (!from || !data[from].scissors || !open(board, from)) return false;
  if (cmd.scissors === 'discard') {
    scissorsWrite('discard', data[from], data[from]);
    events.push({ type: 'discard', cards: [from] });
    return true;
  }
  const id = target.find(id => open(board, id) && data[id].bound === 2);
  if (!id) return false;
  scissorsWrite('cut', data[from], data[id]);
  events.push({ type: 'cut', cards: [id, from] });
  return true;
}

export function hitappsStep(input: ActiveBoard, command: BoardCommand, deal: Deal): Step | string {
  if (input.phase !== 'playing' || !deal.hitapps) return 'Попытка уже завершена';
  const board = structuredClone(input), state = board.hitapps, events: GameEvent[] = [];
  state.move++;
  let positive = false, boosterBrokeIce = false;
  let placed: string[] = [];
  if (command.type === 'draw') {
    const id = board.stock.shift();
    if (!id) return 'Колода пуста';
    board.waste.push(id);
    expose(board, id, events);
    events.unshift({ type: 'draw', cards: [id] });
  } else if (command.type === 'recycle') {
    if (board.stock.length || !board.waste.length || board.recyclesLeft === 0) return 'Повтор недоступен';
    if (board.recyclesLeft !== undefined) board.recyclesLeft--;
    board.stock = board.waste;
    board.waste = [];
    board.faceUp = board.faceUp.filter(id => !board.stock.includes(id));
    events.push({ type: 'recycle' });
  } else if (command.scissors) {
    if (!scissors(board, command, events)) {
      if ([command.from, command.to].some(location => location.kind === 'tableau' && location.index === board.joker?.column))
        return jokerConflict;
      return 'Ножницы недоступны для этой карты';
    }
  } else {
    const moving = hitappsSources(board, command.from, deal, command.root);
    const from = sourcePile(board, command.from);
    if (crossesJoker(board, deal, command.to, moving)) return jokerConflict;
    const target = evaluation(board, deal, command.from, command.to, moving);
    if (!target || !from) return 'Сюда нельзя перенести карты';
    const position = from.length - moving.length, root = state.cards[moving[0]], starter = isStarter(root.kind);
    const jokerSupport = command.to.kind === 'tableau' && board.joker?.column === command.to.index;
    positive = positiveFreezeMove({ joker: root.kind === Kind.joker, starter, spendsMove: true,
      discriminator: target.home ? 3 : 2, position, previousJoker: Boolean(jokerSupport || (target.top && state.cards[target.top].kind === Kind.joker)),
      placeOnJokerPositive: false, fallback: false });
    from.splice(position);
    if (command.from.kind === 'tableau') {
      if (board.joker?.column === command.from.index && from.length === board.joker.boundary) delete board.joker;
      expose(board, from.at(-1), events);
    }
    events.unshift({ type: 'transfer', cards: moving, category: deal.cards[moving[0]].category });
    if (starter) {
      state.spent.push(...moving);
      board.faceUp = board.faceUp.filter(id => !moving.includes(id));
      boosterBrokeIce = effectOfStarter(board, deal, target, root.kind, events);
    } else {
      const leader = target.categoryLeader;
      target.ids.push(...(leader ? [leader, ...moving.filter(id => id !== leader)] : moving));
      for (const id of moving) marks(state.cards[id], state.move, Change.placed);
      placed = [...moving, ...(target.top && !target.home ? [target.top] : [])];
      assemble(board, deal, target.ids, moving, events);
    }
  }
  collectKeys(board, events);
  if (positive && !boosterBrokeIce) for (const id of board.tableau.flat()) {
    const card = state.cards[id], now = card.changedAt === state.move;
    if (canMelt(card.ice, !open(board, id), activeLocker(card), now,
      Boolean(card.changed & Change.revealed), now && Boolean(card.changed & Change.unlocked))) {
      const fact = melt(card);
      events.push({ type: 'ice', cards: [id], amount: card.ice, reason: fact === 2 ? 'thawed' : 'layer' });
    }
  }
  goldTick(board, deal, placed, command.type !== 'recycle', events);
  completeHome(board, deal, events);
  if (board.movesLeft !== null) board.movesLeft--;
  if (board.retainedMoves !== undefined) board.retainedMoves = Math.max(0, board.retainedMoves - 1);
  board.phase = hitappsGoals(deal).every(id => board.collected.includes(id)) ? 'won' : board.movesLeft === 0 ? 'exhausted' : 'playing';
  assertHitappsBoard(board, deal);
  return { board, events, consumedMoves: 1 };
}

export function hitappsCommands(board: ActiveBoard, deal: Deal) {
  const commands: BoardCommand[] = [];
  if (board.phase !== 'playing') return commands;
  const sources: Location[] = [{ kind: 'waste', index: 0 }, ...board.tableau.map((_, index): Location => ({ kind: 'tableau', index }))];
  const targets: Location[] = [...board.foundations.map((_, index): Location => ({ kind: 'foundation', index })), ...sources.slice(1)];
  for (const from of sources) {
    const group = hitappsSources(board, from, deal), pile = sourcePile(board, from);
    if (group.length && pile) {
      for (let offset = 0; offset < group.length; offset++) {
        const root = offset ? pile.length - group.length + offset : undefined;
        const chosen = offset ? hitappsSources(board, from, deal, root) : group;
        for (const to of targets) if (evaluation(board, deal, from, to, chosen)) {
          commands.push({ type: 'transfer', from, to, ...(root === undefined ? {} : { root }) });
        }
      }
    }
    const segment = visibleSegment(board, from), top = segment.at(-1);
    if (top && board.hitapps.cards[top].scissors && open(board, top)) {
      for (const to of sources.slice(1)) if (visibleSegment(board, to).some(id => open(board, id) && board.hitapps.cards[id].bound === 2))
        commands.push({ type: 'transfer', from, to, scissors: 'cut' });
      commands.push({ type: 'transfer', from, to: from, scissors: 'discard' });
    }
    if (from.kind === 'tableau' && segment.some(id => open(board, id) && board.hitapps.cards[id].bound === 1))
      commands.push({ type: 'transfer', from, to: from, scissors: 'unbind' });
  }
  if (board.stock.length) commands.push({ type: 'draw' });
  else if (board.waste.length && board.recyclesLeft !== 0) commands.push({ type: 'recycle' });
  return commands;
}

/** Only the simulator asks whether an unresolved stock/waste card could be placed. */
export function hitappsDeckLookahead(board: ActiveBoard, deal: Deal) {
  const from: Location = { kind: 'waste', index: 0 };
  const targets: Location[] = [...board.foundations.map((_, index): Location => ({ kind: 'foundation', index })),
    ...board.tableau.map((_, index): Location => ({ kind: 'tableau', index }))];
  return [...board.stock, ...board.waste].some(id => targets.some(to => evaluation(board, deal, from, to, [id])));
}

export function hitappsStateKey(state: HitappsBoardState) {
  return [state.generatedGold, [...state.spent].sort(), Object.keys(state.cards).sort().map(id => {
    const card = state.cards[id];
    return [id, card.ice, card.bound, card.scissors, card.lock?.collected, card.key?.used, card.gold &&
      [card.gold.health, card.gold.appeared === 0 ? 0 : card.gold.appeared === state.move ? 1 : 2, card.gold.activated],
    card.changedAt === state.move ? card.changed : 0];
  })];
}

export function assertHitappsBoard(board: ActiveBoard, deal: Deal) {
  const config = deal.hitapps, state = board.hitapps;
  const nat = (value: number, maximum = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
  assertHitappsJoker(board, deal);
  if (config?.policy !== 'hitapps-rules4-v1' || !nat(state.move) || !nat(state.generatedGold) || !Array.isArray(state.spent))
    throw Error('Некорректная версия специальных правил');
  const deck = [...board.tableau.flat(), ...board.foundations.flat(), ...board.stock, ...board.waste, ...board.collected, ...state.spent];
  const expected = Object.keys(deal.cards);
  const assembled = config.assemblies.map(row => row.card);
  if (deck.length !== new Set(deck).size || deck.some(id => !Object.hasOwn(deal.cards, id)) ||
      Object.keys(state.cards).length !== expected.length || expected.some(id => !state.cards[id] || (!deck.includes(id) && !assembled.includes(id))))
    throw Error('Нарушена целостность специальных карт');
  for (const id of expected) {
    const card = state.cards[id], initial = deal.initial.hitapps?.cards[id];
    if (!initial || card.kind !== initial.kind || card.puzzle !== initial.puzzle || card.order !== initial.order ||
        !nat(card.kind, 6) || !nat(card.order, 65535) || !nat(card.puzzle) || !nat(card.ice, 99) || !nat(card.bound, 2) ||
        typeof card.scissors !== 'boolean' || !nat(card.changedAt, state.move) || !nat(card.changed, 7) ||
        Boolean(card.lock) !== Boolean(initial.lock) || Boolean(card.key) !== Boolean(initial.key) ||
        (card.lock && (!initial.lock || card.lock.type !== initial.lock.type || card.lock.required !== initial.lock.required ||
          !nat(card.lock.collected, 65535) || !nat(card.lock.required, 65535) || card.lock.required < 1 || !nat(card.lock.type, 65535) || card.lock.type < 1)) ||
        (card.key && (!initial.key || card.key.type !== initial.key.type || card.key.amount !== initial.key.amount ||
          !nat(card.key.type, 65535) || card.key.type < 1 || !nat(card.key.amount, 65535) || card.key.amount < 1 || typeof card.key.used !== 'boolean')) ||
        (card.gold && (!config.gold || !nat(card.gold.health, 4) || !nat(card.gold.appeared, state.move) ||
          typeof card.gold.activated !== 'boolean' || card.gold.activated && card.gold.health !== 0))) throw Error('Повреждено состояние карты');
  }
  for (const row of config.assemblies) {
    const done = deck.includes(row.card);
    if (!row.tag || row.halves[0] === row.halves[1] || row.halves.some(id => state.cards[id]?.puzzle !== row.tag ||
      state.spent.includes(id) !== done)) throw Error('Некорректное состояние сборки');
  }
  const consumed = new Set(config.assemblies.flatMap(row => [...row.halves]));
  if (state.spent.some(id => !consumed.has(id) && !isStarter(state.cards[id].kind)) || new Set(board.faceUp).size !== board.faceUp.length ||
      board.faceUp.some(id => !deck.includes(id) || board.stock.includes(id) || state.spent.includes(id)) ||
      [...board.foundations.flat(), ...board.waste, ...board.collected].some(id => !board.faceUp.includes(id))) throw Error('Состояние открытых карт повреждено');
  for (const [piles, initial, cap] of [[board.tableau, deal.initial.tableau, deal.bonusSlots?.tableau],
    [board.foundations, deal.initial.foundations, deal.bonusSlots?.foundation]] as const) {
    if (piles.length !== initial.length && !(cap && piles.length === initial.length + 1)) throw Error('Неверное число слотов');
  }
  if (board.movesLeft !== null && !nat(board.movesLeft) || (board.phase === 'exhausted') !== (board.movesLeft === 0 && board.phase !== 'won') ||
      (board.phase === 'won') !== hitappsGoals(deal).every(id => board.collected.includes(id)) || !['won', 'playing', 'exhausted'].includes(board.phase))
    throw Error('Несогласованные фаза и бюджет');
  if (deal.recovery ? !nat(board.recyclesLeft!, deal.recovery.freeRecycles) : board.recyclesLeft !== undefined)
    throw Error('Некорректный запас повторов');
  if (state.generatedGold !== Object.values(state.cards).filter(card => card.gold).length ||
      state.generatedGold > (config.gold?.total ?? 0)) throw Error('Некорректный счётчик золотых карт');
}


function assertHitappsJoker(board: ActiveBoard, deal: Deal) {
  const socket = board.joker;
  if (!socket) return;
  const pile = board.tableau[socket.column];
  if (!Number.isInteger(socket.column) || !Number.isInteger(socket.boundary) || socket.boundary < 1 ||
      !pile || socket.boundary > pile.length || !open(board, pile[socket.boundary - 1]) ||
      (!board.hitapps.cards[pile[socket.boundary - 1]] || activeLocker(board.hitapps.cards[pile[socket.boundary - 1]])) ||
      pile.slice(socket.boundary).some(id => !open(board, id))) throw Error('Некорректный Джокер');
  const card = socket.card;
  if (card && (deal.randomJokerPreview !== 1 || card.version !== 1 || card.nativeType !== 2 || card.faceUp !== true ||
      !/^azj-[A-Za-z0-9_-]{1,60}$/.test(card.id) || Object.hasOwn(deal.cards, card.id))) throw Error('Повреждена карта случайного Джокера');
}

/** Retire only the dangling support proven by the immediately preceding snapshot.
 * 0.21.0 consumed a hammer from waste and pushed the former support card to waste.
 */
export function repairHammerJoker(board: Board, prior: Board | undefined, deal: Deal) {
  const socket = board.joker, state = board.hitapps;
  if (board.rulesVersion !== 4 || !socket || !state || prior?.rulesVersion !== 4 || !prior.hitapps ||
      JSON.stringify(prior.joker) !== JSON.stringify(socket)) return;
  const oldColumn = prior.tableau[socket.column], column = board.tableau[socket.column], hammer = prior.waste.at(-1);
  if (!oldColumn || !column || oldColumn.length !== socket.boundary || column.length !== socket.boundary - 1 ||
      !hammer || prior.hitapps.cards[hammer]?.kind !== Kind.hammer || state.move !== prior.hitapps.move + 1) return;
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!equal(board.tableau, prior.tableau.map((pile, index) => index === socket.column ? pile.slice(0, -1) : pile)) ||
      !equal(board.waste, [...prior.waste.slice(0, -1), oldColumn.at(-1)]) ||
      !equal(state.spent, [...prior.hitapps.spent, hammer]) || !equal(board.stock, prior.stock)) return;
  assertHitappsBoard({ ...prior, hitapps: prior.hitapps }, deal);
  const repaired = { ...board, hitapps: state };
  delete repaired.joker;
  assertHitappsBoard(repaired, deal);
  return repaired;
}
