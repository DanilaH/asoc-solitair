import { pauseOptions } from '../../tools/qa/navigation';
import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import { dailyForDay } from '../../src/content/daily';
import type { Deal, Save, BoardCommand } from '../../src/domain/types';
test.use({ timezoneId: 'UTC' });
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
// Gameplay stays fixed while the independent active-time checkpoint can advance.
const attemptWithoutClock = (attempt: Save['attempt']) => ({ ...attempt, telemetry: attempt.telemetry && { ...attempt.telemetry, activeMs: 0 } });
async function seed(page: Page, index: number) {
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  const save = freshSave(campaignDeals[index], `ux-${index}`); save.settings.reducedMotion=true;save.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys']}; save.meta!.winCycle=3;
  save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,index).map(d=>d.id)};
  await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),save); await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
}
async function move(page: Page, deal: Deal, cmd: BoardCommand) {
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal',deal.id);
  const s=await read(page), r=(await page.locator('canvas').boundingBox())!, f=boardFrame(r.width,r.height,s.settings.deckPosition,deal), g=layout(s.attempt.board,deal,f.height,s.settings.deckSide,s.settings.deckPosition);
  const tap=(p:{x:number;y:number})=>page.touchscreen.tap(r.x+f.offsetX+p.x*f.unit,r.y+p.y*f.unit);
  if(cmd.type==='transfer') {const id=cmd.from.kind==='waste'?s.attempt.board.waste.at(-1):packet(s.attempt.board,cmd.from.index,deal).at(-1);await tap(g.poses.find(p=>p.id===id)!);await tap(g.targets.find(t=>t.location.kind===cmd.to.kind&&t.location.index===cmd.to.index)!);}else await tap(g.stock);
  await expect.poll(async()=>(await read(page)).revision).toBeGreaterThan(s.revision);
}
test('all eighty levels are browsable in bounded pages, locked future pages and browsing preserve the active attempt',async({page})=>{
  await seed(page,0); const before=await read(page);
  await expect(page.locator('#level-grid')).toBeHidden(); await page.locator('#level-picker-open').tap();
  for(let i=0;i<4;i++){
    await expect(page.locator('#level-grid button:visible')).toHaveCount(20);
    await expect(page.locator('#chapter-label')).toHaveText(`Уровни ${i*20+1}–${i*20+20}`);
    if(i)await expect(page.locator(`#level-${i*20+1}`)).toBeDisabled();if(i<3)await page.locator('#chapter-next').tap();
  }
  expect(attemptWithoutClock((await read(page)).attempt)).toEqual(attemptWithoutClock(before.attempt)); expect((await read(page)).profile).toEqual(before.profile);
});
test('restart confirmation can cancel freely and resets the cycle only after a confirmed replacement',async({page})=>{
  await seed(page,3);await page.locator('#home-play').tap();await move(page,campaignDeals[3],campaignDeals[3].winningPath[0]);const before=await read(page);
  await page.locator('#menu').tap();await page.locator('#restart').tap();await expect(page.locator('#restart-confirm')).toBeVisible();await page.locator('#restart-confirm [data-close]').tap();expect(attemptWithoutClock((await read(page)).attempt)).toEqual(attemptWithoutClock(before.attempt));
  await page.locator('#menu').tap();await page.locator('#restart').tap();await page.locator('#restart-confirm-yes').tap();await expect.poll(async()=>(await read(page)).attempt.id).not.toBe(before.attempt.id);
  const next=await read(page);expect(next.attempt.board).toEqual(campaignDeals[3].initial);expect(next.profile).toEqual(before.profile);expect(next.meta!.winCycle).toBe(0);
});
test('a stale daily is labelled training before play; replacing it can be cancelled without changing either mode',async({page})=>{
  await page.clock.install({time:new Date('2026-11-09T22:00:00Z')});await seed(page,3);await page.locator('#daily-play').tap();const daily=dailyForDay('2026-11-09');await move(page,daily,daily.winningPath[0]);
  await page.clock.setSystemTime(new Date('2026-11-10T00:01:00Z'));await page.locator('#menu').tap();await page.locator('#levels-open').tap();const before=await read(page);
  await page.locator('#daily-play').tap();await expect(page.locator('#replace-daily')).toBeVisible();await page.locator('#replace-daily [data-close]').tap();expect(attemptWithoutClock((await read(page)).attempt)).toEqual(attemptWithoutClock(before.attempt));expect((await read(page)).parked).toEqual(before.parked);
  await page.locator('#daily-resume-old').tap();await expect(page.locator('#level-number')).toContainText('ТРЕНИРОВКА');await expect(page.locator('#message')).toBeEmpty();
});
test('short 320×568 screen keeps the helper dock inside the viewport and accepts new-content touches',async({page})=>{
  await page.setViewportSize({width:320,height:568});await seed(page,26);await page.locator('#home-play').tap();
  const dock=(await page.locator('#dock').boundingBox())!, canvas=(await page.locator('canvas').boundingBox())!;
  expect(dock.y+dock.height).toBeLessThanOrEqual(568);expect(canvas.y+canvas.height).toBeLessThanOrEqual(dock.y);
  for(const cmd of campaignDeals[26].winningPath.slice(0,4))await move(page,campaignDeals[26],cmd);
  await page.screenshot({path:`test-results/${test.info().project.name}-short-new-content.png`});
});

test('card reading stays finger-sized on a short field and never spends a move', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, 16); await page.locator('#home-play').tap();
  for (const selector of ['#menu', '#inspect']) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const before = await read(page), deal = campaignDeals[16];
  await page.locator('#inspect').tap();
  const rect = (await page.locator('canvas').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, before.settings.deckPosition, deal);
  const g = layout(before.attempt.board, deal, frame.height, before.settings.deckSide, before.settings.deckPosition);
  const pose = g.poses.find(p => p.faceUp && before.attempt.board.tableau.some(col => col.at(-1) === p.id))!;
  await page.touchscreen.tap(rect.x + frame.offsetX + pose.x * frame.unit, rect.y + pose.y * frame.unit);
  await expect(page.locator('#inspect-dialog')).toBeVisible();
  await expect(page.locator('#word-title')).toHaveText(deal.cards[pose.id].text);
  await page.locator('#inspect-dialog .primary').tap();
  const after = await read(page);
  expect(after.attempt.board).toEqual(before.attempt.board);
  expect(after.profile).toEqual(before.profile);
  await expect(page.locator('#inspect')).toHaveAttribute('aria-pressed', 'false');
});

for (const level of [3, 17]) test(`level ${level}: bottom deck works on both sides through Hint, reload and a complete touch win`, async ({ page }) => {
  test.setTimeout(120000);
  await seed(page, level - 1); await page.locator('#home-play').tap();
  const deal = campaignDeals[level - 1];
  async function place(side: 'left' | 'right') {
    const before = await read(page);
    await page.locator('#menu').tap(); await pauseOptions(page); await page.locator('#appearance-settings').tap();
    await page.locator('button[data-deck-position=bottom]').tap(); await page.locator(`button[data-deck-side=${side}]`).tap();
    await page.locator('#appearance .primary').tap();
    const after = await read(page);
    expect(after.attempt.board).toEqual(before.attempt.board); expect(after.attempt.id).toBe(before.attempt.id);
    expect(after.attempt.undo).toEqual(before.attempt.undo); expect(after.attempt.streak).toEqual(before.attempt.streak);
    expect(after.profile).toEqual(before.profile); expect(after.parked).toEqual(before.parked);
  }
  await place('left');
  const beforeHint = await read(page); await page.locator('#hint').tap();
  await expect(page.locator('#hint')).toBeEnabled(); await expect(page.locator('#message')).toBeEmpty();
  expect((await read(page)).attempt.board).toEqual(beforeHint.attempt.board);
  await move(page, deal, deal.winningPath[0]);
  if (level === 17) {
    await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(beforeHint.attempt.board);
    await move(page, deal, deal.winningPath[0]);
  }
  const middle = Math.floor(deal.winningPath.length / 2);
  for (const cmd of deal.winningPath.slice(1, middle)) await move(page, deal, cmd);
  await place('right'); const beforeReload = await read(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const restored = await read(page);
  expect(restored.settings.deckPosition).toBe('bottom'); expect(restored.settings.deckSide).toBe('right');
  expect(restored.attempt.id).toBe(beforeReload.attempt.id); expect(restored.attempt.board).toEqual(beforeReload.attempt.board);
  expect(restored.profile).toEqual(beforeReload.profile);
  await page.locator('#home-play').tap();
  if (level === 17) {
    await page.evaluate(() => { const slot = document.querySelector<HTMLElement>('#banner-slot')!; slot.hidden = false; slot.style.height = '60px'; });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const canvas = (await page.locator('canvas').boundingBox())!, dock = (await page.locator('#dock').boundingBox())!, slot = (await page.locator('#banner-slot').boundingBox())!;
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(dock.y); expect(dock.y + dock.height).toBeLessThanOrEqual(slot.y);
  }
  await page.screenshot({ path: `test-results/${test.info().project.name}-bottom-deck-${level}.png` });
  for (const cmd of deal.winningPath.slice(middle)) await move(page, deal, cmd);
  await expect(page.locator('#result')).toBeVisible(); expect((await read(page)).attempt.board.phase).toBe('won');
});

test('ordered games have no permanent instructional paragraph on 320×568', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const level of [23, 30]) {
    await seed(page, level - 1); await page.locator('#home-play').tap();
    await expect(page.locator('#message')).toBeEmpty();
    expect(await page.locator('#message').evaluate(e => getComputedStyle(e).visibility)).toBe('hidden');
    const canvas = (await page.locator('canvas').boundingBox())!, dock = (await page.locator('#dock').boundingBox())!;
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(dock.y);
  }
});
