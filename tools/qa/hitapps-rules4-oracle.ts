/** Independent replay for Rules4. This module imports the data shape only. */
import type { Board, BoardCommand, Deal, Location } from '../../src/domain/types';

export function advanceRules4(input: Board, action: BoardCommand, deal: Deal): Board | null {
  if (input.rulesVersion !== 4 || !input.hitapps || !deal.hitapps || input.phase !== 'playing') return null;
  const next = structuredClone(input), state = next.hitapps!, metadata = state.cards, turn = ++state.move;
  const appeared = new Set<string>();
  const exposed = (id?: string) => id !== undefined && next.faceUp.includes(id);
  const locked = (id: string) => {
    const lock = metadata[id].lock;
    return lock !== undefined && lock.collected < lock.required;
  };
  const eligible = (id: string) => exposed(id) && !locked(id) && metadata[id].ice === 0;
  const special = (id: string) => metadata[id].kind >= 5;
  const family = (id: string) => deal.cards[id].category;
  const pileAt = ({ kind, index }: Location) => kind === 'tableau' ? next.tableau[index] : kind === 'foundation'
    ? next.foundations[index] : index === 0 ? next.waste : undefined;
  const support = (pile: string[] | undefined) => next.joker && pile === next.tableau[next.joker.column] ? next.joker.boundary : 0;
  const stamp = (id: string, flag: number) => {
    const card = metadata[id];
    card.changed = flag | (card.changedAt === turn ? card.changed : 0);
    card.changedAt = turn;
  };
  const reveal = (id?: string) => {
    if (id && !exposed(id)) { next.faceUp.push(id); appeared.add(id); stamp(id, 1); }
  };
  const resolvedBinding = (pile: string[], index: number) => {
    const central = pile[index];
    if (!eligible(central) || metadata[central].kind > 1) return 0;
    const category = family(central);
    const root = pile.slice(0, index + 1).reverse();
    for (const id of root) {
      if (!eligible(id) || metadata[id].kind > 1 || family(id) !== category) break;
      if (metadata[id].bound) return metadata[id].bound === 1 ? 1 : 3;
    }
    for (const id of pile.slice(index + 1)) {
      if (!eligible(id) || metadata[id].kind > 1) break;
      if (metadata[id].bound) return metadata[id].bound === 1 ? 2 : 4;
      if (family(id) !== category) break;
    }
    return 0;
  };
  const unlocks = new Set<string>();
  const markKey = (id: string, receiver: string) => {
    const key = metadata[id].key!, lock = metadata[receiver].lock!;
    if (lock.collected + key.amount > 65535) throw Error('Oracle rejected oversized lock');
    lock.collected += key.amount;
    key.used = true;
    if (lock.collected >= lock.required) { unlocks.add(receiver); stamp(receiver, 4); }
  };
  const replacePair = (pile: string[], last: readonly string[]) => {
    if (pile.length - 2 < support(pile)) return;
    const low = pile[pile.length - 2], high = pile[pile.length - 1];
    const match = deal.hitapps!.assemblies.find(row => row.halves.includes(low) && row.halves.includes(high) && low !== high);
    if (!match || !last.some(card => card === low || card === high) || !metadata[low].puzzle || metadata[low].puzzle !== metadata[high].puzzle) return;
    if ([low, high].some(card => metadata[card].changedAt === turn && (metadata[card].changed & 2))) stamp(match.card, 2);
    pile.splice(pile.length - 2, 2, match.card);
    next.faceUp = next.faceUp.filter(id => id !== low && id !== high).concat(match.card);
    state.spent.push(low, high);
  };
  let melting = false, broken = false;
  const activation: string[] = [];
  switch (action.type) {
    case 'draw': {
      const top = next.stock.shift();
      if (!top) return null;
      next.waste.push(top);
      reveal(top);
      break;
    }
    case 'recycle': {
      if (next.stock.length || !next.waste.length || next.recyclesLeft === 0) return null;
      if (next.recyclesLeft !== undefined) next.recyclesLeft--;
      const turned = new Set(next.waste);
      next.stock = [...next.waste];
      next.waste = [];
      next.faceUp = next.faceUp.filter(id => !turned.has(id));
      break;
    }
    case 'transfer': {
      const origin = action.from.kind !== 'foundation' ? pileAt(action.from) : undefined;
      const target = pileAt(action.to);
      if (action.scissors) {
        const carrier = origin?.slice(support(origin)).at(-1);
        if (action.scissors !== 'unbind' && (!carrier || !exposed(carrier) || !metadata[carrier].scissors)) return null;
        const desired = action.scissors === 'cut' ? 2 : 1;
        const candidate = action.to.kind === 'tableau' && target ? target.slice(support(target)).reverse().find(id => exposed(id) && metadata[id].bound === desired) : undefined;
        if (action.scissors !== 'discard' && !candidate) return null;
        if (candidate) metadata[candidate].bound = action.scissors === 'cut' ? 1 : 0;
        if (action.scissors !== 'unbind') metadata[carrier!].scissors = false;
        break;
      }
      if (!origin?.length || !target || origin === target || action.to.kind === 'waste') return null;
      const sourceTop = origin[origin.length - 1];
      const boundary = action.from.kind === 'tableau' && next.joker?.column === action.from.index ? next.joker.boundary : 0;
      let position = origin.length - 1;
      if (action.from.kind === 'tableau') {
        if (!eligible(sourceTop) || position < boundary) return null;
        while (position > boundary && !special(sourceTop)) {
          const upper = origin[position], lower = origin[position - 1], binding = metadata[upper].bound;
          if (!eligible(lower) || metadata[lower].kind > 4 || metadata[lower].kind === 2 || binding === 1 ||
            (binding !== 2 && family(lower) !== family(upper))) break;
          position--;
        }
        if (action.root !== undefined) {
          if (action.root < position || action.root >= origin.length || action.root !== position && metadata[origin[action.root]].bound === 2) return null;
          position = action.root;
        }
      }
      const group = origin.slice(position), root = group[0], card = metadata[root], home = action.to.kind === 'foundation';
      const onJoker = support(target) > 0;
      if (onJoker) {
        const underneath = target.at(-1);
        if (target.length !== support(target) || special(root) || deal.hitapps.assemblies.some(pair =>
          underneath !== undefined && underneath !== root && pair.halves.includes(underneath) && pair.halves.includes(root))) return null;
      }
      const recipient = onJoker ? undefined : target.at(-1);
      const ascending = group.find(id => metadata[id].kind === 0);
      const receiver = recipient ? metadata[recipient] : undefined;
      const sourceBinding = action.from.kind === 'tableau' ? resolvedBinding(origin.slice(boundary), position - boundary) : 0;
      let pull: string | undefined;
      if (card.kind === 5 && recipient && receiver) {
        const order = receiver.order && !receiver.puzzle ? receiver.order + (home ? 1 : -1) : -1;
        const candidates = next.tableau.flatMap((column, index) => (!home && index === action.to.index) || column.length === support(column) ? [] : column.slice(-1))
          .concat(next.waste.slice(-1), next.stock).filter(id => id !== sourceTop);
        pull = candidates.find(id => {
          const value = metadata[id];
          if (locked(recipient)) return !!value.key && !value.key.used && value.key.type === receiver.lock!.type;
          return (next.stock.includes(id) || exposed(id) && !locked(id)) && family(recipient) === family(id) &&
            value.kind !== 2 && value.kind < 5 && (value.kind !== 0 || order === 0) &&
            (order === 0 ? value.kind === 0 : order > 0 ? value.order === order : !receiver.puzzle || value.puzzle === receiver.puzzle);
        });
      }
      if (home && (sourceBinding >= 2 || card.kind === 6)) return null;
      if (card.kind === 6) {
        if (!recipient || !receiver || !exposed(recipient) || receiver.kind === 2 || receiver.kind >= 5) return null;
      } else if (card.kind === 5) {
        if (!recipient || !receiver || (home ? !pull : !exposed(recipient) || receiver.kind === 2 ||
            (locked(recipient) ? !pull : receiver.kind === 0 && !receiver.ice || !(receiver.ice || resolvedBinding(target, target.length - 1) === 3 || pull)))) return null;
      } else if (home) {
        const lastLeader = Boolean(ascending === group.at(-1) && ascending && action.from.kind !== 'waste');
        const order = lastLeader ? metadata[ascending!].order : card.order;
        if (card.kind === 2 || card.puzzle || (!recipient ? card.kind !== 0 && !lastLeader : !!ascending ||
          !group.every(id => family(id) === family(target[0])) || order !== 0 && order !== receiver!.order + 1)) return null;
      } else if (recipient && (card.kind === 2 ? locked(recipient) || Boolean(receiver?.ice) :
        !onJoker && receiver?.kind !== 2 && (!eligible(recipient) || receiver!.kind === 0 || family(recipient) !== family(root) ||
          receiver!.puzzle !== card.puzzle || card.order !== 0 && receiver!.order !== card.order + 1))) return null;

      melting = card.kind !== 2 && (card.kind >= 5 || home || position === 0 || !(onJoker || receiver?.kind === 2));
      origin.length = position;
      if (action.from.kind === 'tableau') {
        if (next.joker?.column === action.from.index && origin.length === next.joker.boundary) delete next.joker;
        reveal(origin.at(-1));
      }
      if (card.kind >= 5) {
        state.spent.push(...group);
        next.faceUp = next.faceUp.filter(id => !group.includes(id));
        if (card.kind === 5 && locked(recipient!) && pull) markKey(pull, recipient!);
        else if (receiver!.ice) { receiver!.ice = 0; broken = true; }
        else if (receiver!.bound) receiver!.bound = 1;
        else if (card.kind === 5 && pull) {
          const from = [next.stock, next.waste, ...next.tableau].find(pile => pile.includes(pull!))!;
          from.splice(from.indexOf(pull), 1);
          if (next.tableau.includes(from)) {
            if (support(from) && from.length === support(from)) delete next.joker;
            reveal(from.at(-1));
          }
          reveal(pull);
          target.push(pull);
          stamp(pull, 2);
          replacePair(target, [pull]);
        } else if (card.kind === 6) {
          next.waste.push(target.pop()!);
          reveal(target.at(-1));
        }
      } else {
        target.push(...(home && ascending ? [ascending, ...group.filter(id => id !== ascending)] : group));
        group.forEach(id => stamp(id, 2));
        activation.push(...group);
        if (!home && recipient) activation.push(recipient);
        replacePair(target, group);
      }
      break;
    }
  }
  const suffixKeys = next.tableau.flatMap(column => {
    const reversed = column.slice(support(column)).reverse();
    const boundary = reversed.findIndex(id => !eligible(id));
    return boundary < 0 ? reversed : reversed.slice(0, boundary);
  });
  for (const id of next.waste.slice(-1).concat(suffixKeys)) {
    const key = metadata[id].key;
    if (!key || key.used || !eligible(id)) continue;
    const receiver = next.tableau.flat().find(card => locked(card) && metadata[card].lock!.type === key.type);
    if (receiver) markKey(id, receiver);
  }
  if (melting && !broken) for (const id of next.tableau.flat())
    if (metadata[id].ice && exposed(id) && !locked(id) && !appeared.has(id) && !unlocks.has(id)) metadata[id].ice--;
  const gold = deal.hitapps.gold;
  if (gold) {
    for (const id of activation) if (metadata[id].gold?.health) Object.assign(metadata[id].gold!, { activated: true, health: 0 });
    const present = next.tableau.flat().concat(next.waste.slice(-1), next.foundations.flat());
    const visible = present.find(id => !!metadata[id].gold?.health && !metadata[id].gold!.appeared && eligible(id));
    if (visible) metadata[visible].gold!.appeared = turn;
    if (action.type !== 'recycle') for (const id of present) {
      const token = metadata[id].gold;
      if (token?.health && eligible(id) && token.appeared !== turn && !appeared.has(id) && !unlocks.has(id)) token.health--;
    }
    const spots = next.tableau.flatMap(column => column.filter((id, i) => {
      const card = metadata[id];
      return !exposed(id) && !card.gold && !card.puzzle && !card.order && !card.bound && !metadata[column[i + 1]]?.bound;
    }));
    const remaining = gold.total - state.generatedGold;
    if (remaining > 0 && spots.length && (state.generatedGold < gold.first || spots.length <= remaining)) {
      metadata[spots[0]].gold = { health: 4, appeared: 0, activated: false };
      state.generatedGold++;
    }
  }
  const halves = deal.hitapps.assemblies.flatMap(row => Array.from(row.halves));
  const goals = Object.keys(deal.cards).filter(id => !halves.includes(id) && metadata[id].kind < 5 && metadata[id].kind !== 2);
  next.foundations.forEach((stack, index) => {
    if (stack.length && !goals.some(id => family(id) === family(stack[0]) && !stack.includes(id))) {
      next.collected.push(...stack);
      next.foundations[index] = [];
    }
  });
  if (next.movesLeft !== null) next.movesLeft--;
  if (next.retainedMoves !== undefined && next.retainedMoves > 0) next.retainedMoves--;
  next.phase = goals.every(id => next.collected.includes(id)) ? 'won' : next.movesLeft === 0 ? 'exhausted' : 'playing';
  return next;
}
