import { clearUndo } from './history';
import { applyBoard, assertBoard, boardRules, legalCommands, placeJoker } from './engine';
import { continuationLookup, knownContinuation } from './solver';
import { findReferenceRoute } from './ordinary-search';
import { LEGACY_OWNER_PREVIEW } from './types';
import { migrateRandomJokerRights, randomJokerCount, unusedRandomJoker } from './random-joker-rights';
export { randomJokerCount } from './random-joker-rights';
import type { Attempt, BoardCommand, Deal, Save } from './types';

export const RANDOM_JOKER_PREVIEW = LEGACY_OWNER_PREVIEW === 'random-joker';

export function allowsRandomJoker(attempt: Attempt, deal: Deal) {
  return deal.randomJokerPreview === 1 && attempt.dealId === deal.id && !attempt.daily &&
    !attempt.randomJokerUsed && !attempt.board.joker &&
    boardRules(attempt.board) >= 3 && attempt.board.phase === 'playing' && randomJokerColumns(attempt, deal).length > 0;
}

/** Normative placement checks include empty, lock, face-up, ice and bound state. */
export function randomJokerColumns(attempt: Attempt, deal: Deal): number[] {
  return attempt.board.tableau.flatMap((_, column) =>
    typeof placeJoker(attempt.board, column, deal) === 'string' ? [] : [column]);
}

export function placeRandomJoker(attempt: Attempt, deal: Deal, random: (bound: number) => number, makeId: () => string) {
  if (!allowsRandomJoker(attempt, deal)) return;
  const columns = randomJokerColumns(attempt, deal), choice = random(columns.length);
  if (!Number.isSafeInteger(choice) || choice < 0 || choice >= columns.length) return;
  return placeRandomJokerAt(attempt, deal, columns[choice], makeId());
}

export function placeRandomJokerAt(attempt: Attempt, deal: Deal, column: number, id: string) {
  if (!allowsRandomJoker(attempt, deal) || !randomJokerColumns(attempt, deal).includes(column) ||
      !/^azj-[A-Za-z0-9_-]{1,60}$/.test(id) || Object.hasOwn(deal.cards, id)) return;
  const board = placeJoker(attempt.board, column, deal);
  if (typeof board === 'string' || !board.joker) return;
  board.joker.card = { version: 1, id, nativeType: 2, faceUp: true };
  assertBoard(board, deal);
  return board;
}

export function proveRandomJoker(board: NonNullable<ReturnType<typeof placeRandomJoker>>, deal: Deal, deadline: number) {
  const column = board.joker!.column;
  const continuation = boardRules(board) === 4 ? continuationLookup(board, deal, deadline)
    : (state: typeof board) => knownContinuation(state, deal);
  for (const onto of legalCommands(board, deal)) {
    if (performance.now() >= deadline) return;
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
      const tail = continuation(restored.board);
      if (tail) return [onto, off, ...tail];
    }
  }
  const result = findReferenceRoute(deal, board, 2500, true, deadline, 'verified-specials', continuation);
  return result.status === 'FOUND' ? result.path : undefined;
}

/** Uniform eligible first choice, then random sampling without replacement under one deadline. */
export function findRandomJokerPlacement(attempt: Attempt, deal: Deal, id: string,
  random: (bound: number) => number = randomJokerColumn, deadline = performance.now() + 3200) {
  if (!allowsRandomJoker(attempt, deal)) return;
  const columns = randomJokerColumns(attempt, deal);
  while (columns.length && performance.now() < deadline) {
    const choice = random(columns.length);
    if (!Number.isSafeInteger(choice) || choice < 0 || choice >= columns.length) return;
    const [column] = columns.splice(choice, 1), candidate = placeRandomJokerAt(attempt, deal, column, id);
    if (!candidate) continue;
    const slice = Math.min(deadline, performance.now() + Math.max(220, (deadline - performance.now()) / (columns.length + 1)));
    const path = proveRandomJoker(candidate, deal, slice);
    if (path) return { column, id, path };
  }
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
  const board = placeRandomJokerAt(attempt, deal, request.column, request.id);
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
  clearUndo(attempt);
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
