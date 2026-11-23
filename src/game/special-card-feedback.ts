import type { Board, Deal } from '../domain/types';
import { isBoundCard } from '../domain/bound-cards';
import { frozenLayers } from '../domain/frozen-cards';
import { isPictureJoined } from '../domain/puzzle-pairs';

export type SpecialCardCue =
  | { kind: 'thaw' | 'join'; id: string }
  | { kind: 'cut'; id: string; underIce: boolean };

/** Only changes caused by a committed transfer are presented. */
export function specialCardCues(before: Board, after: Board, deal: Deal): SpecialCardCue[] {
  const cues: SpecialCardCue[] = [];
  for (const id of Object.keys(deal.frozen?.layers ?? {})) {
    if (after.faceUp.includes(id) && frozenLayers(after, deal, id) < frozenLayers(before, deal, id))
      cues.push({ kind: 'thaw', id });
  }
  for (const id of Object.keys(deal.bound?.scissorsByCard ?? {})) {
    if (after.faceUp.includes(id) && isBoundCard(before, deal, id) && !isBoundCard(after, deal, id))
      cues.push({ kind: 'cut', id, underIce: frozenLayers(before, deal, id) > 0 });
  }
  for (const pair of deal.puzzle?.pairs ?? []) {
    if (!isPictureJoined(before, pair) && isPictureJoined(after, pair))
      cues.push({ kind: 'join', id: pair.top });
  }
  return cues;
}
