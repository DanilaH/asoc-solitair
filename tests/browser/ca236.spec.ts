import { expect, test, type Page } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { Deal, Save } from '../../src/domain/types';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1' || process.env.VITE_ASOC_ARCHIVE_227 === '1', 'Ordinary release profile');
if (process.env.ASOC_CA236_RECORD === '1') test.use({ video: 'on' });
const ids = {
  2: 'campaign-ha4-2-280006-4f50c85dae3c8c5f-272bb506-core-stage1-v1-m1',
  6: 'campaign-ha4-6-680057-a9d537d3500896af-9524f5b7-core-stage1-v1-m1',
};
function fixture(level: 2 | 6) {
  const deal = findDeal(ids[level])!, save = freshSave(deal, 'ca236-ui');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: level-1 }, (_, i) => campaignId(i+1)) };
  save.profile.coins = 800;
  save.unlockSchedule = { version: 1 };
  return { deal, save };
}
async function seed(page: Page, save: Save, play = true) {
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(value));
  },save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  if (play) {
    await page.locator('#home-play').tap();
    await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0');
  }
}
async function helpers(page: Page) {
  await page.locator('#menu').tap();
  if (!await page.locator('#pause-options').getAttribute('open')) await page.locator('#pause-options>summary').tap();
  await page.locator('#helpers-open').tap();
  await expect(page.locator('#helpers')).toBeVisible();
}
test('CA-01 old early Shuffle prize claims, reloads and leaves Tasks locked', async ({ page },info) => {
  const {save}=fixture(2);
  save.dailyBonus={version:1,day:Math.floor(Date.now()/86400000)-1,roundId:'old-shuffle',catalog:'azur-compiled-r1',
    columns:[{kind:'Shuffle',quantity:2},{kind:'Coins',quantity:100},{kind:'Undo',quantity:2},{kind:'Joker',quantity:1}],
    slots:[0,1,2,0,1,2,1,2,0,3,3,3],revealed:[0,3,8],won:0};
  await seed(page,save,false);
  await expect(page.locator('#daily-tasks-open')).toBeHidden();
  await page.locator('#daily-bonus-open').tap();
  await page.screenshot({path:info.outputPath('CA01-before-claim.png')});
  await page.locator('#daily-bonus-claim').tap();
  await expect.poll(async()=>(await read(page)).dailyTasks?.inventory.shuffles).toBe(2);
  await expect(page.locator('#daily-tasks-open')).toBeHidden();
  await page.screenshot({path:info.outputPath('CA01-claimed.png')});
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  expect((await read(page)).dailyTasks?.inventory.shuffles).toBe(2);
  await expect(page.locator('#daily-tasks-open')).toBeHidden();
  await page.locator('#home-play').tap();
  await helpers(page);
  const hints=(await read(page)).profile.hints;
  await page.locator('#buy-hint').tap();
  await expect.poll(async()=>(await read(page)).profile.hints).toBe(hints+1);
  expect((await read(page)).dailyTasks?.weeks).toEqual([]);
  await expect(page.locator('#daily-tasks-open')).toHaveAttribute('hidden');
});
test('CA-02 new layout retains prior losses, restart count and lives', async ({page},info) => {
  const {save}=fixture(6); save.attempt.director={restarts:2,previousLosses:2};
  save.attempt.sourceDifficulty={outcome:'Restart',restarts:2};
  await seed(page,save);
  await page.locator('#menu').tap(); await page.locator('#restart').tap();
  await expect(page.locator('#restart-confirm-copy')).toContainText('новый расклад');
  await page.locator('#restart-confirm-yes').tap();
  await expect.poll(async()=>(await read(page)).attempt.id).not.toBe(save.attempt.id);
  const next=await read(page);
  expect(next.attempt.dealId).not.toBe(save.attempt.dealId);
  expect(next.attempt.director).toEqual({restarts:3,previousLosses:2});
  expect(next.attempt.sourceDifficulty).toEqual({outcome:'Restart',restarts:3});
  expect(next.campaignLives?.remaining??5).toBe(5);
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0');
  await page.screenshot({path:info.outputPath('CA02-new-layout.png')});
});
test('CA-04 earned slot waits for explicit use and survives reload', async ({page},info) => {
  const {save,deal}=fixture(6); save.platform!.bonusSlotCredits={version:1,tableau:1,foundation:0};
  await seed(page,save);
  await page.locator('#bonus-foundation').tap();
  await expect(page.locator('#bonus-credit')).toBeHidden();
  await page.locator('#bonus-offer [data-close]').first().tap();
  await page.locator('#bonus-tableau').tap();
  await expect(page.locator('#bonus-credit')).toBeVisible();
  await page.screenshot({path:info.outputPath('CA04-pending-slot.png')});
  const coins=(await read(page)).profile.coins;
  await page.locator('#bonus-credit').tap();
  await expect.poll(async()=>(await read(page)).attempt.board.tableau.length).toBe(deal.initial.tableau.length+1);
  expect((await read(page)).profile.coins).toBe(coins);
  expect((await read(page)).platform?.bonusSlotCredits?.tableau).toBe(0);
  await page.screenshot({path:info.outputPath('CA04-used-slot.png')});
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  expect((await read(page)).attempt.board.tableau.length).toBe(deal.initial.tableau.length+1);
});
test('CA-03 off-route paid hint is responsive and charges once', async ({page},info) => {
  const {save,deal}=fixture(6), next=applyBoard(save.attempt.board,deal.winningPath[1],deal);
  if(typeof next==='string') throw Error(next); save.attempt.board=next.board;
  await seed(page,save);
  const hints=(await read(page)).profile.hints;
  await page.locator('#hint').tap();
  await expect.poll(async()=>(await read(page)).profile.hints).toBe(hints-1);
  await page.screenshot({path:info.outputPath('CA03-off-route-hint.png')});
  await page.locator('#hint').tap();
  expect((await read(page)).profile.hints).toBe(hints-1);
});
test('CA-05 L2 copy, worker placement, one right and no empty target', async ({page},info) => {
  const {save,deal}=fixture(2);
  for(const action of deal.winningPath.slice(0,5)) {const next=applyBoard(save.attempt.board,action,deal);if(typeof next==='string')throw Error(next);save.attempt.board=next.board;}
  await seed(page,save); await helpers(page);
  await page.locator('#random-joker-open').tap();
  await expect(page.locator('#random-joker-copy')).toContainText('с уровня 2');
  await expect(page.locator('#random-joker-copy')).not.toContainText('уровне 16');
  await page.screenshot({path:info.outputPath('CA05-buy-copy.png')});
  await page.locator('#random-joker-confirm').tap();
  await expect.poll(async()=>(await read(page)).randomJokers?.grants.length).toBe(1);
  await helpers(page); await page.locator('#random-joker-open').tap();
  const before=await read(page);
  await page.locator('#random-joker-confirm').tap();
  await expect.poll(async()=>(await read(page)).attempt.randomJokerUsed,{timeout:6000}).toBe(true);
  const after=await read(page), column=after.attempt.board.joker!.column;
  expect(before.attempt.board.tableau[column].length).toBeGreaterThan(0);
  expect(after.profile.coins).toBe(before.profile.coins);
  expect(after.randomJokers?.grants.filter(g=>g.consumed).length).toBe(1);
  await page.screenshot({path:info.outputPath('CA05-proved-placement.png')});
});
