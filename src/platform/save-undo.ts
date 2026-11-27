import { MAX_UNDO_HISTORY } from '../domain/history';
import type { SourceCard } from '../domain/hitapps-rules';
import type { Attempt, Save } from '../domain/types';

type StoredAttempt = Attempt & { undoEncoding?: 'hitapps-delta-v1' };
type StoredSave = Omit<Save, 'attempt' | 'parked'> & {
  attempt: StoredAttempt;
  parked?: Partial<Record<'campaign' | 'daily', StoredAttempt>>;
};

// Short histories stay ordinary JSON. Larger Rules4 histories store card-state
// changes relative to the next frame, ending at the fully stored active board.
const PACK_FROM = 48;
function sameCard(a: SourceCard, b: SourceCard) {
  return a === b || (a.kind === b.kind && a.order === b.order && a.puzzle === b.puzzle &&
    a.bound === b.bound && a.scissors === b.scissors && a.ice === b.ice &&
    a.changedAt === b.changedAt && a.changed === b.changed &&
    a.lock?.type === b.lock?.type && a.lock?.required === b.lock?.required && a.lock?.collected === b.lock?.collected &&
    a.key?.type === b.key?.type && a.key?.amount === b.key?.amount && a.key?.used === b.key?.used &&
    a.gold?.health === b.gold?.health && a.gold?.appeared === b.gold?.appeared && a.gold?.activated === b.gold?.activated);
}

function pack(attempt: Attempt): StoredAttempt {
  if (attempt.board.rulesVersion !== 4 || !attempt.board.hitapps || attempt.undo.length < PACK_FROM) return attempt;
  let next = attempt.board.hitapps.cards;
  const undo = attempt.undo.slice();
  for (let i = undo.length - 1; i >= 0; i--) {
    const board = undo[i];
    if (!board.hitapps || board.rulesVersion !== 4) throw Error('Отмена меняет правила попытки');
    const cards: Record<string, SourceCard> = {};
    for (const [id, card] of Object.entries(board.hitapps.cards)) {
      if (!next[id] || !sameCard(card, next[id])) cards[id] = card;
    }
    undo[i] = { ...board, hitapps: { ...board.hitapps, cards } };
    next = board.hitapps.cards;
  }
  return { ...attempt, undo, undoEncoding: 'hitapps-delta-v1' };
}

export function parseSavedState(raw: string): Save {
  const save = JSON.parse(raw) as StoredSave;
  for (const attempt of [save.attempt, ...Object.values(save.parked ?? {})]) {
    if (attempt?.undoEncoding === undefined) continue;
    if (attempt.undoEncoding !== 'hitapps-delta-v1' || attempt.board?.rulesVersion !== 4 ||
        !attempt.board.hitapps?.cards || !Array.isArray(attempt.undo) || attempt.undo.length > MAX_UNDO_HISTORY)
      throw Error('Повреждена упакованная история');
    let next = attempt.board.hitapps.cards;
    for (let i = attempt.undo.length - 1; i >= 0; i--) {
      const board = attempt.undo[i], delta = board?.hitapps?.cards;
      if (board?.rulesVersion !== 4 || !delta || Array.isArray(delta) || typeof delta !== 'object' ||
          Object.keys(delta).some(id => !Object.hasOwn(next, id))) throw Error('Повреждена упакованная история');
      next = { ...next, ...delta };
      board.hitapps!.cards = structuredClone(next);
    }
    delete attempt.undoEncoding;
  }
  return save;
}

export function serializeSave(save: Save) {
  const parked = save.parked;
  return JSON.stringify({ ...save, attempt: pack(save.attempt),
    ...(parked && { parked: {
      ...(parked.campaign && { campaign: pack(parked.campaign) }),
      ...(parked.daily && { daily: pack(parked.daily) }),
    } }) });
}
