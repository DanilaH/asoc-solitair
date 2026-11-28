import { boardKey } from './engine';
import type { Attempt, Save } from './types';

/** An offered candidate Hint reserves a charge, then settles with the suggested move. */
export function stagedHint(attempt: Attempt | undefined) {
  const hint=attempt?.stagedHint;
  return hint && attempt.board.phase==='playing' && hint.key===boardKey(attempt.board) ? hint : undefined;
}
export function availableHintCharges(save: Save) {
  const reserved=[save.parked?.campaign,save.parked?.daily].filter(attempt=>stagedHint(attempt)).length;
  return Math.max(0,save.profile.hints-reserved);
}
