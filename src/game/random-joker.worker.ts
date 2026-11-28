import { findRandomJokerPlacement } from '../domain/random-joker';
import type { Attempt, Deal } from '../domain/types';

self.onmessage = (event: MessageEvent<{ attempt: Attempt; deal: Deal; id: string }>) => {
  const { attempt, deal, id } = event.data;
  self.postMessage(findRandomJokerPlacement(attempt, deal, id) ?? null);
};
