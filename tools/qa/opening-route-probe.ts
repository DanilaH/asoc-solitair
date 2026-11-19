import { writeFile } from 'node:fs/promises';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { applyBoard, boardKey } from '../../src/domain/engine';
import { findReferenceRoute, referenceActions } from '../../src/domain/ordinary-search';
import { knownContinuation } from '../../src/domain/solver';
import { resolveHint } from '../../src/domain/hint';
import type { BoardCommand } from '../../src/domain/types';

const evidence = [];
for (const level of [6, 11, 15]) {
  const deal = { ...content8Dealer[level - 1], recoveryPaths: [] };
  let board = deal.initial;
  const trail: BoardCommand[] = [];
  for (const command of deal.winningPath) {
    if (trail.length > 1 && trail.length < 36) {
      for (const alternative of referenceActions(board, deal)) {
        if (JSON.stringify(alternative) === JSON.stringify(command)) continue;
        const change = applyBoard(board, alternative, deal);
        if (typeof change === 'string' || knownContinuation(change.board, deal)) continue;
        const proof = findReferenceRoute(deal, change.board, 4000);
        if (proof.status !== 'FOUND') continue;
        const hint = resolveHint(change.board, deal);
        if (hint.status !== 'SOLVED') continue;
        evidence.push({ level, step: trail.length + 1, alternative, key: boardKey(change.board), hint: hint.action,
          path: [...trail, alternative, ...proof.path], remaining: change.board.movesLeft, delta: trail.length + 1 + proof.path.length - deal.winningPath.length });
        break;
      }
    }
    if (evidence.at(-1)?.level === level) break;
    const next = applyBoard(board, command, deal);
    if (typeof next === 'string') throw Error(next);
    board = next.board;
    trail.push(command);
  }
}
await writeFile('.authoring/content8-onboarding/unscripted.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.map(e => ({ level: e.level, step: e.step, alternative: e.alternative, hint: e.hint, delta: e.delta })));
