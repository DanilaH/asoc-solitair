import { dismissTeaching } from '../../tools/qa/navigation';
import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { BoardCommand, Save, Deal } from '../../src/domain/types';
test.describe.configure({ mode: 'parallel' });
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function ready(page: Page, deal: Deal) {
  await expect.poll(async () => (await read(page)).attempt.dealId).toBe(deal.id);
  await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  await expect(page.locator('#play-screen')).toBeVisible(); await dismissTeaching(page);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}
export async function move(page: Page, deal: Deal, cmd: BoardCommand) {
  const before=await read(page), rect=(await page.locator('#game-root').boundingBox())!;
  const frame=boardFrame(rect.width,rect.height), geometry=layout(before.attempt.board,deal,frame.height);
  const tap=(p:{x:number;y:number})=>page.touchscreen.tap(rect.x+frame.offsetX+p.x*frame.unit,rect.y+p.y*frame.unit);
  if(cmd.type==='transfer'){
    const id=cmd.from.kind==='waste'?before.attempt.board.waste.at(-1):packet(before.attempt.board,cmd.from.index,deal).at(-1);
    const from=geometry.poses.find(p=>p.id===id)!, to=geometry.targets.find(t=>t.location.kind===cmd.to.kind&&t.location.index===cmd.to.index)!;
    await tap(from);await tap(to);
  }else await tap(geometry.stock);
  await expect.poll(async()=> (await read(page)).revision,{message:`${deal.id}: ${JSON.stringify(cmd)}`}).toBeGreaterThan(before.revision);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
}
async function fixture(page:Page,index:number){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  const save=freshSave(campaignDeals[index],`fixture-${index}`);save.settings.reducedMotion=true;
  save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,index).map(d=>d.id)};
  await page.evaluate(value=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(value)),save);
  await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');await page.locator('#home-play').tap();await ready(page,campaignDeals[index]);
}

for (let chapter = 0; chapter < 4; chapter++) test(`chapter ${chapter + 1}: twenty consecutive levels win through real touch and Next`,async({page},info)=>{
  // Twenty complete games share this deadline; keep every per-action assertion bounded.
  // Hosted two-worker runs need more than ten minutes for the first chapter.
  test.skip(info.project.name!=='phone','Complete catalog on Pixel 7; compact layout/UX covered separately.'); test.setTimeout(1200000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await fixture(page,chapter*20);
  for(const deal of campaignDeals.slice(chapter*20,chapter*20+20)){
    await ready(page,deal);
    if(deal.campaignLevel!<=2){await expect(page.locator('#moves')).toHaveText('∞');await expect(page.locator('#hint')).toBeHidden();await expect(page.locator('#undo')).toBeHidden();}
    for(const cmd of deal.winningPath)await move(page,deal,cmd);
    await expect(page.locator('#result')).toBeVisible(); expect((await read(page)).attempt.board.phase).toBe('won');
    console.info(`Touch campaign ${deal.campaignLevel}/80 won`); await page.locator('#next-level').tap();
  }
  const completed=await read(page);expect(completed.platform!.completedCampaign).toHaveLength(chapter*20+20);
  expect(completed.profile.hints).toBe(7);expect(completed.profile.undos).toBe(5);
  if(chapter===3){
    await expect(page.locator('#home')).toBeVisible();await expect(page.locator('#campaign-progress')).toHaveText('80 / 80');
    await page.locator('#level-picker-open').tap();
    for(let i=0;i<3;i++)await page.locator('#chapter-prev').tap();
    await page.locator('#level-5').tap();await ready(page,campaignDeals[4]);await move(page,campaignDeals[4],campaignDeals[4].winningPath[0]);
    const current=await read(page);await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');await page.locator('#home-play').tap();await ready(page,campaignDeals[4]);
    const restored=await read(page);expect(restored.attempt.id).toBe(current.attempt.id);expect(restored.attempt.board).toEqual(current.attempt.board);expect(restored.profile).toEqual(current.profile);
  }
  expect(errors).toEqual([]);
});

test('the level-three Hint demonstration is free, replayable and survives reload',async({page})=>{
  await fixture(page,2);await page.locator('#hint').tap();await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#message')).toBeEmpty();
  expect((await read(page)).profile.hints).toBe(3);await page.locator('#hint').tap();expect((await read(page)).profile.hints).toBe(3);
  await move(page,campaignDeals[2],campaignDeals[2].winningPath[0]);await page.locator('#hint').tap();await expect(page.locator('#hint-count')).toHaveText('2');
  await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');await page.locator('#home-play').tap();await ready(page,campaignDeals[2]);
  expect((await read(page)).campaign!.tutorials).toContain('hint-demo');await expect(page.locator('#undo')).toBeHidden();
});

test('compact dense four-column layout stays inside the board and confirms abandonment of an unfinished attempt',async({page})=>{
  await fixture(page,16);const rect=(await page.locator('#game-root').boundingBox())!;const deal=campaignDeals[16];
  const geo=layout((await read(page)).attempt.board,deal,rect.height*540/rect.width);
  expect(geo.targets.filter(t=>t.location.kind==='tableau')).toHaveLength(4);
  await page.screenshot({path:`test-results/${test.info().project.name}-dense-campaign.png`});
  await move(page,deal,deal.winningPath[0]);const before=await read(page);
  await page.locator('#menu').tap();await page.locator('#levels-open').tap();await page.locator('#level-picker-open').tap();await page.locator('#level-1').tap();
  await expect(page.locator('#switch-level')).toBeVisible();await expect(page.locator('#switch-level')).toContainText('отметки пяти побед сбросятся');await page.locator('#switch-level [data-close]').tap();expect((await read(page)).attempt.id).toBe(before.attempt.id);
  await page.locator('#level-picker-open').tap();await page.locator('#level-1').tap();await page.locator('#switch-confirm').tap();await ready(page,campaignDeals[0]);
  expect((await read(page)).attempt.board).toEqual(campaignDeals[0].initial);expect((await read(page)).profile).toEqual(before.profile);
});

test('a tall banner reservation shrinks the field without covering cards or helper controls',async({page})=>{
  await fixture(page,11);await page.evaluate(()=>{const slot=document.querySelector<HTMLElement>('#banner-slot')!;slot.hidden=false;slot.style.height='90px';});
  await page.waitForTimeout(100);
  for(const cmd of campaignDeals[11].winningPath.slice(0,4))await move(page,campaignDeals[11],cmd);
  const canvas=(await page.locator('#game-root').boundingBox())!,dock=(await page.locator('#dock').boundingBox())!,slot=(await page.locator('#banner-slot').boundingBox())!;
  expect(canvas.y+canvas.height).toBeLessThanOrEqual(dock.y);expect(dock.y+dock.height).toBeLessThanOrEqual(slot.y);
  await page.screenshot({path:`test-results/${test.info().project.name}-reserved-banner.png`});
});
