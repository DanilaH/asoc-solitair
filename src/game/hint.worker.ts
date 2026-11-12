import { resolveHint, type HintRequest, type HintResponse } from '../domain/hint';
self.onmessage = (event: MessageEvent<HintRequest>) => {
  const { requestId, revision, attemptId, board, deal } = event.data;
  const response: HintResponse = { requestId, revision, attemptId, dealId: deal.id, ...resolveHint(board, deal) };
  self.postMessage(response);
};
