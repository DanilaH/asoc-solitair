import { applyBoard, assertBoard, boardRules, legalCommands, placeJoker } from './engine';
import { knownContinuation, solve } from './solver';
import { LEGACY_OWNER_PREVIEW } from './types';
import { migrateRandomJokerRights, randomJokerCount, unusedRandomJoker } from './random-joker-rights';
export { randomJokerCount } from './random-joker-rights';
import type { Attempt, BoardCommand, Deal, Save } from './types';

export const RANDOM_JOKER_PREVIEW = LEGACY_OWNER_PREVIEW === 'random-joker';

export function allowsRandomJoker(attempt: Attempt, deal: Deal) {
  return deal.randomJokerPreview === 1 && attempt.dealId === deal.id && !attempt.daily &&
    !attempt.randomJokerUsed && !attempt.board.joker && boardRules(attempt.board) === 3 && attempt.board.phase === 'playing';
}

export function placeRandomJoker(attempt: Attempt, deal: Deal, random: (bound: number) => number, makeId: () => string) {
  if (!allowsRandomJoker(attempt, deal)) return;
  const bound = Math.min(5, attempt.board.tableau.length);
  if (!bound) return;
  const column = random(bound), id = makeId();
  if (!Number.isSafeInteger(column) || column < 0 || column >= bound ||
      !/^azj-[A-Za-z0-9_-]{1,60}$/.test(id) || Object.hasOwn(deal.cards, id)) return;
  const board = placeJoker(attempt.board, column, deal);
  if (typeof board === 'string' || !board.joker) return;
  board.joker.card = { version: 1, id, nativeType: 2, faceUp: true };
  assertBoard(board, deal);
  return board;
}

export function proveRandomJoker(board: NonNullable<ReturnType<typeof placeRandomJoker>>, deal: Deal, deadline: number) {
  const column = board.joker!.column;
  for (const onto of legalCommands(board, deal)) {
    if (onto.type !== 'transfer' || onto.to.kind !== 'tableau' || onto.to.index !== column) continue;
    const held = applyBoard(board, onto, deal);
    if (typeof held === 'string') continue;
    const exits = legalCommands(held.board, deal);
    exits.sort((a, b) => Number(b.type === 'transfer' && b.to.kind === 'foundation') - Number(a.type === 'transfer' && a.to.kind === 'foundation'));
    for (const off of exits) {
      if (performance.now() >= deadline) return;
      if (off.type !== 'transfer' || off.from.kind !== 'tableau' || off.from.index !== column) continue;
      const restored = applyBoard(held.board, off, deal);
      if (typeof restored === 'string') continue;
      if (restored.board.phase === 'won') return [onto, off];
      let finishing = restored.board;
      const direct: BoardCommand[] = [];
      for (let i = 0; i < 4; i++) {
        const next = legalCommands(finishing, deal).find(move => move.type === 'transfer' && move.to.kind === 'foundation');
        if (!next) break;
        const step = applyBoard(finishing, next, deal);
        if (typeof step === 'string') break;
        direct.push(next);
        finishing = step.board;
        if (finishing.phase === 'won') return [onto, off, ...direct];
      }
      const tail = knownContinuation(restored.board, deal);
      if (tail) return [onto, off, ...tail];
    }
  }
  const result = solve(board, deal, 2500, deadline);
  return result.status === 'SOLVED' ? result.path : undefined;
}

export function randomJokerReady(save: Save, deal: Deal) {
  const { attempt } = save;
  if (!allowsRandomJoker(attempt, deal)) return false;
  if (deal.extraHelpers?.randomJokerCoins !== undefined) return randomJokerCount(save) > 0;
  return save.profile.jokers >= (deal.randomJokerCost ?? 0);
}

export function buyRandomJokerAccess(save: Save, deal: Deal, id: string, now: number) {
  const cost = deal.extraHelpers?.randomJokerCoins;
  if (cost === undefined || save.profile.coins < cost || randomJokerCount(save) > 0 ||
      save.randomJokers?.grants.some(grant => grant.id === id) || save.attempt.randomJokerAccess?.id === id ||
      !allowsRandomJoker(save.attempt, deal) || !Number.isSafeInteger(now) || now < 0 ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return false;
  migrateRandomJokerRights(save);
  save.profile.coins -= cost;
  (save.randomJokers ??= { version: 1, grants: [] }).grants.push({ version: 1, id, source: 'coins', cost, issuedAt: now });
  save.revision++;
  return true;
}

export function settleRandomJoker(save: Save, deal: Deal, request: {
  attemptId: string; revision: number; column: number; id: string; path: readonly BoardCommand[];
}) {
  const { attempt } = save;
  const cost = deal.randomJokerCost ?? 0;
  if (!randomJokerReady(save, deal)) return false;
  const right = deal.extraHelpers?.randomJokerCoins !== undefined ? unusedRandomJoker(save) : undefined;
  if (request.attemptId !== attempt.id || request.revision !== save.revision || !request.path.length) return false;
  const board = placeRandomJoker(attempt, deal, () => request.column, () => request.id);
  if (!board) return false;
  let replay = board;
  for (const action of request.path) {
    const result = applyBoard(replay, action, deal);
    if (typeof result === 'string') return false;
    replay = result.board;
  }
  if (replay.phase !== 'won') return false;
  if (right) {
    migrateRandomJokerRights(save);
    const owned = save.randomJokers!.grants.find(grant => grant.id === right.id)!;
    owned.consumed = true;
    attempt.randomJokerAccess = { ...owned };
  }
  attempt.board = board;
  attempt.undo = [];
  attempt.randomJokerUsed = true;
  save.profile.jokers -= cost;
  save.revision++;
  return true;
}

export function randomJokerColumn(bound: number) {
  const values = new Uint32Array(1);
  const threshold = 2 ** 32 - (2 ** 32 % bound);
  do { crypto.getRandomValues(values); } while (values[0] >= threshold);
  return values[0] % bound;
}
