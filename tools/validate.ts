import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { introDeal } from '../src/content/intro';
import { campaignDeals, campaignRecords } from '../src/content/campaign';
import { applyBoard, assertBoard, dispatch, freshSave } from '../src/domain/engine';
import { RULES_VERSION, CONTENT_VERSION } from '../src/domain/types';
import { layout, cardMetrics } from '../src/game/layout';

await mkdir('docs/validation', { recursive: true });
const summary = [];
for (const deal of [introDeal, ...campaignDeals]) {
  let board = structuredClone(deal.initial);
  const expected = Object.keys(deal.cards).sort();
  let largestPacket = 0, flips = 0, completions = 0;
  const independent = () => {
    const ids = [...board.tableau.flat(), ...board.foundations.flat(), ...board.stock, ...board.waste, ...board.collected].sort();
    if (JSON.stringify(ids) !== JSON.stringify(expected) || new Set(ids).size !== expected.length) throw Error(`${deal.id}: card conservation failed`);
    const { width, height } = cardMetrics(deal), geometry = layout(board, deal, 565);
    for (const pose of geometry.poses) if (pose.x - width / 2 < 0 || pose.x + width / 2 > 540 || pose.y - height / 2 < 0 || pose.y + height / 2 > 565.01) throw Error(`${deal.id}: out-of-board card ${pose.id}`);
  };
  independent();
  for (const action of deal.winningPath) {
    const result = applyBoard(board, action, deal);
    if (typeof result === 'string') throw Error(`${deal.id}: ${result}`);
    board = result.board; assertBoard(board, deal); independent();
    for (const event of result.events) {
      if (event.type === 'transfer') largestPacket = Math.max(largestPacket, event.cards?.length ?? 0);
      if (event.type === 'flip') flips++;
      if (event.type === 'complete') completions++;
    }
  }
  if (board.phase !== 'won') throw Error(`${deal.id}: recorded path did not win`);
  const finalBoard = board;
  if (deal.tutorialPath) {
    let save = freshSave(deal, 'validation-joker');
    save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0, completedCampaign: campaignDeals.filter(d => d.campaignLevel! < deal.campaignLevel!).map(d => d.id) };
    for (const cmd of deal.tutorialPath) {
      const result = dispatch(save, cmd, deal);
      if (!result.accepted) throw Error(`${deal.id}: alternate witness refused: ${result.reason}`);
      save = result.next; board = save.attempt.board; independent();
    }
    if (board.phase !== 'won' || save.profile.jokers !== 0) throw Error(`${deal.id}: alternate Joker witness failed`);
    board = finalBoard;
  }
  const texts = Object.values(deal.cards).map(c => c.text.toLocaleLowerCase('ru-RU'));
  if (new Set(texts).size !== texts.length) throw Error(`${deal.id}: ambiguous duplicate caption`);
  for (const card of Object.values(deal.cards)) {
    if (!card.explanation?.trim()) throw Error(`${deal.id}: missing local explanation`);
    if (card.image) await access(`public/${card.image}`);
  }
  const record = {
    dealId: deal.id, dealVersion: deal.version, rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION,
    initialSha256: createHash('sha256').update(JSON.stringify(deal.initial)).digest('hex'),
    ...(deal.tutorialPath ? { alternateTutorialPath: deal.tutorialPath, alternateReplay: 'PASS' } : {}),
    exactInitialState: deal.initial, winningPath: deal.winningPath, moveCount: deal.winningPath.length,
    budget: deal.initial.movesLeft, slack: board.movesLeft, replay: 'PASS', editorialStatus: deal.editorialStatus,
    independence: 'Witness replay uses the game engine. Card multiset/conservation, local assets, captions and layout bounds are checked separately. No optimality or human-difficulty claim.',
    coverage: { cards: expected.length, columns: board.tableau.length, categories: completions, largestPacket, flips, recycleCount: deal.winningPath.filter(c => c.type === 'recycle').length, tags: deal.tags ?? [] },
  };
  await writeFile(`docs/validation/${deal.id}.json`, JSON.stringify(record, null, 2) + '\n');
  if (deal.campaignLevel) summary.push({ level: deal.campaignLevel, title: deal.title, ...record, exactInitialState: undefined, winningPath: undefined });
  console.info(`${deal.id}: PASS, ${record.moveCount} moves, ${record.coverage.recycleCount} recycle, slack ${record.slack ?? '∞'}`);
}
if (campaignDeals.length !== 26 || campaignDeals[0].initial.movesLeft !== null || campaignDeals[1].initial.movesLeft !== null) throw Error('Campaign/tutor bank contract failed');
if (!summary.some(r => r.coverage.largestPacket >= 2) || !summary.some(r => r.coverage.recycleCount >= 2) || !summary.some(r => r.slack === 0)) throw Error('Missing advertised campaign coverage');
await writeFile('docs/validation/campaign-index.json', JSON.stringify({ version: 1, contentVersion: CONTENT_VERSION, deals: summary, authoring: campaignRecords.map(r => ({ id: r.id, seed: r.authoringSeed, searchVisited: r.searchVisited })) }, null, 2) + '\n');
