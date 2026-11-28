import { requiresContinueProof, verifiesContinue, type ContinueProof, type ContinueResult } from '../domain/continuation';
import { boardKey } from '../domain/engine';
import type { Attempt, Deal } from '../domain/types';

export class ContinueCheck {
  private key?: string;
  private worker?: Worker;
  private timeout?: ReturnType<typeof setTimeout>;
  private result?: ContinueResult;
  private verified?: ContinueProof;

  constructor(private readonly changed: () => void) {}

  get status() { return this.result?.status ?? (this.worker ? 'CHECKING' : undefined); }
  get proof() { return this.verified; }

  update(attempt: Attempt, deal: Deal, visible: boolean) {
    if (!visible || !requiresContinueProof(attempt) || attempt.continued || attempt.lostLife ||
      attempt.board.phase !== 'exhausted' || attempt.board.movesLeft !== 0 || attempt.dealId !== deal.id) {
      this.clear();
      return;
    }
    const key = JSON.stringify([attempt.id, deal.id, boardKey(attempt.board)]);
    if (key === this.key) return;
    this.clear();
    this.key = key;
    try {
      const worker = new Worker(new URL('../game/continue.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      const snapshot = { id: attempt.id, dealId: attempt.dealId, board: attempt.board, continued: attempt.continued, lostLife: attempt.lostLife };
      const finish = (result: ContinueResult) => {
        if (this.worker !== worker) return;
        this.stop();
        if (result.status === 'PROVEN_RECOVERABLE') {
          const proof = { attemptId: attempt.id, deal, path: result.path };
          if (verifiesContinue(snapshot, proof)) this.verified = proof;
          else result = { status: 'UNKNOWN' };
        }
        this.result = result;
        this.changed();
      };
      worker.onmessage = (event: MessageEvent<ContinueResult>) => finish(event.data);
      worker.onerror = () => finish({ status: 'UNKNOWN' });
      this.timeout = setTimeout(() => finish({ status: 'UNKNOWN' }), 2400);
      worker.postMessage({ attempt: snapshot, deal });
    } catch {
      this.stop();
      this.result = { status: 'UNKNOWN' };
    }
  }

  private stop() {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.worker?.terminate();
    this.worker = undefined;
  }

  clear() {
    this.stop();
    this.key = undefined;
    this.result = undefined;
    this.verified = undefined;
  }
}
