import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import { dailyForDay } from '../../src/content/daily';
import type { Deal, Save, BoardCommand } from '../../src/domain/types';
test.use({ timezoneId: 'UTC' });
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function seed(page: Page, index: number) {
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  const save = freshSave(campaignDeals[index], `ux-${index}`); save.settings.reducedMotion=true; save.meta!.winCycle=3;
  save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,index).map(d=>d.id)};
  await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),save); await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
}
async function move(page: Page, deal: Deal, cmd: BoardCommand) {
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal',deal.id);
  const s=await read(page), r=(await page.locator('canvas').boundingBox())!, f=boardFrame(r.width,r.height), g=layout(s.attempt.board,deal,f.height,s.settings.deckSide);
  const tap=(p:{x:number;y:number})=>page.touchscreen.tap(r.x+f.offsetX+p.x*f.unit,r.y+p.y*f.unit);
  if(cmd.type==='transfer') {const id=cmd.from.kind==='waste'?s.attempt.board.waste.at(-1):packet(s.attempt.board,cmd.from.index,deal).at(-1);await tap(g.poses.find(p=>p.id===id)!);await tap(g.targets.find(t=>t.location.kind===cmd.to.kind&&t.location.index===cmd.to.index)!);}else await tap(g.stock);
  await expect.poll(async()=>(await read(page)).revision).toBeGreaterThan(s.revision);
}
test('all eighty levels are browsable in bounded pages, locked future pages and browsing preserve the active attempt',async({page})=>{
  await seed(page,0); const before=await read(page);
  for(let i=0;i<4;i++){
    await expect(page.locator('#level-grid button:visible')).toHaveCount(20);
    await expect(page.locator('#chapter-label')).toHaveText(`Уровни ${i*20+1}–${i*20+20}`);
    if(i)await expect(page.locator(`#level-${i*20+1}`)).toBeDisabled();if(i<3)await page.locator('#chapter-next').tap();
  }
  expect((await read(page)).attempt).toEqual(before.attempt); expect((await read(page)).profile).toEqual(before.profile);
});
test('restart confirmation can cancel freely and resets the cycle only after a confirmed replacement',async({page})=>{
  await seed(page,3);await page.locator('#home-play').tap();await move(page,campaignDeals[3],campaignDeals[3].winningPath[0]);const before=await read(page);
  await page.locator('#menu').tap();await page.locator('#restart').tap();await expect(page.locator('#restart-confirm')).toBeVisible();await page.locator('#restart-confirm [data-close]').tap();expect((await read(page)).attempt).toEqual(before.attempt);
  await page.locator('#menu').tap();await page.locator('#restart').tap();await page.locator('#restart-confirm-yes').tap();await expect.poll(async()=>(await read(page)).attempt.id).not.toBe(before.attempt.id);
  const next=await read(page);expect(next.attempt.board).toEqual(campaignDeals[3].initial);expect(next.profile).toEqual(before.profile);expect(next.meta!.winCycle).toBe(0);
});
test('a stale daily is labelled training before play; replacing it can be cancelled without changing either mode',async({page})=>{
  await page.clock.install({time:new Date('2026-11-09T22:00:00Z')});await seed(page,3);await page.locator('#daily-play').tap();const daily=dailyForDay('2026-11-09');await move(page,daily,daily.winningPath[0]);
  await page.clock.setSystemTime(new Date('2026-11-10T00:01:00Z'));await page.locator('#menu').tap();await page.locator('#levels-open').tap();const before=await read(page);
  await page.locator('#daily-play').tap();await expect(page.locator('#replace-daily')).toBeVisible();await page.locator('#replace-daily [data-close]').tap();expect((await read(page)).attempt).toEqual(before.attempt);expect((await read(page)).parked).toEqual(before.parked);
  await page.locator('#daily-resume-old').tap();await expect(page.locator('#level-number')).toContainText('ТРЕНИРОВКА');await expect(page.locator('#message')).toContainText('без награды');
});
test('short 320×568 screen keeps the helper dock inside the viewport and accepts new-content touches',async({page})=>{
  await page.setViewportSize({width:320,height:568});await seed(page,26);await page.locator('#home-play').tap();
  const dock=(await page.locator('#dock').boundingBox())!, canvas=(await page.locator('canvas').boundingBox())!;
  expect(dock.y+dock.height).toBeLessThanOrEqual(568);expect(canvas.y+canvas.height).toBeLessThanOrEqual(dock.y);
  for(const cmd of campaignDeals[26].winningPath.slice(0,4))await move(page,campaignDeals[26],cmd);
  await page.screenshot({path:`test-results/${test.info().project.name}-short-new-content.png`});
});
