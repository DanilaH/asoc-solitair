import { findContinue, type ContinueAttempt } from '../domain/continuation';
import type { Deal } from '../domain/types';

self.onmessage = (event: MessageEvent<{ attempt: ContinueAttempt; deal: Deal }>) => {
  const { attempt, deal } = event.data;
  self.postMessage(findContinue(attempt, deal, 3000, performance.now() + 1400));
};
