import { expect, test, type Page } from '@playwright/test';
import { dailyForDay } from '../../src/content/daily';
import type { Save } from '../../src/domain/types';
import { findDeal } from '../../src/content/campaign';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { move, read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary C8 release profile');

async function installBridge(page: Page, save: Save, filled = false) {
  const at = Date.UTC(2026, 10, 25, 12);
  await page.clock.install({ time: new Date(at) });
  await page.addInitScript(({ value, filled }) => {
    let sequence = 0, shown: object | null = null;
    const coffee: { phase: string; reason?: string; now: number }[] = [];
    document.addEventListener('solitaire:coffee', event => coffee.push((event as CustomEvent).detail));
    const record: { method: string; options: Record<string, string> }[] = [];
    const method = (name:string) => ({ name,rtype:'promise' });
    const headers = (name: string, list:string[], events=false) => ({
      name,methods:[...list.map(method),...events?[{name:'addListener',rtype:'callback'}, {name:'removeListener',rtype:'callback'}]:[]],
    });
    const key = 'asoc-solitaire.save.v1';
    localStorage.setItem(key, JSON.stringify(value));
    Object.assign(window,{
      androidBridge:{}, p0AdsTrace:record, p0CoffeeTrace: coffee,
      Capacitor: {
        PluginHeaders:[
          headers('App',['getState'],true),
          headers('SolitaireStorage',['get','set','remove','readRecoveryClock']),
          headers('SolitaireAudio',['configure'],true),headers('SolitaireFeedback',['pulse','cancel']),
          headers('SolitaireAnalytics',['report']),
          headers('SolitaireAds',['status','prepareInterstitial','show','pending','acknowledge',
            'pendingShown','acknowledgeShown','hideBanner','measureBanner','placeBanner','dispose'],true),
        ],
        async nativeCallback(_plugin:string, _method:string,_options:object,_callback:unknown){return 'listener';},
        async nativePromise(plugin:string, method:string, options:Record<string,string>){
          if (plugin==='App') return {isActive:true};
          if (plugin==='SolitaireAudio') return {focused:true};
          if (plugin==='SolitaireStorage') {
            if (method==='get') return {value:localStorage.getItem(options.key)};
            if (method==='set') localStorage.setItem(options.key,options.value);
            if (method==='readRecoveryClock') return { boot:1,elapsed:performance.now() };
            return {};
          }
          if (plugin==='SolitaireAds') {
            record.push({ method, options });
            if(method==='status')return {ready:true,mode:'test',banner:true,interstitial:true,interstitialLoaded:true,rewarded:true};
            if(method==='pending')return {receipts:[],activeLife:null};
            if (method === 'pendingShown') return { shown };
            if (method === 'acknowledgeShown') { shown = null; return {}; }
            if (method === 'show') {
              if (!filled) return { shown: false, outcome: 'unavailable' };
              shown = { ...options, schema: 1, id: 'transport-show-' + ++sequence, shownAt: Date.now() };
              return { shown: true, outcome: 'dismissed' };
            }
            if (method === 'measureBanner') {
              const width = Number(options.viewportWidth), height = innerHeight;
              return { webView: { x: 0, y: 0, width, height }, root: { width, height }, adHeight: 50 };
            }
          }
          return {};
        },
      },
    });
  }, { value: save, filled });
  const actions = (method:string) => page.evaluate(method => (window as unknown as { p0AdsTrace: { method:string; options:Record<string,string> }[] }).p0AdsTrace.filter(call => call.method === method), method);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  return actions;
}

/** Observe the JS-to-native boundary. A no-fill response never counts as a display. */
test('one banner slot survives Home to game and closing a modal cannot authorize Coffee', async ({ page }) => {
  const deal = findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!;
  const save = freshSave(deal, 'asoc-ads-checkpoint');
  save.contentVersion = 8; save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const actions = await installBridge(page, save);
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#app > #banner-slot')).toBeVisible();
  await expect.poll(async()=>(await actions('placeBanner')).length).toBe(1);
  const box = await page.locator('#banner-slot').boundingBox();
  await page.locator('#home-play').tap();
  await expect(page.locator('#play-screen')).toBeVisible();
  expect(await page.locator('#banner-slot').boundingBox()).toEqual(box);
  expect(await actions('hideBanner')).toHaveLength(0);
  await move(page,deal,deal.winningPath[0]);
  await page.locator('#menu').tap();
  await expect(page.locator('#settings-done')).toBeVisible();
  await page.clock.fastForward(181_000);
  expect(await actions('show')).toHaveLength(0);
  expect((await actions('hideBanner')).length).toBeGreaterThan(0);
  await page.locator('#settings-done').tap();
  await page.clock.fastForward(300_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await actions('show')).toHaveLength(0);
  await move(page, deal, deal.winningPath[1]);
  await expect(page.locator('.coffee-pause-label')).toBeVisible();
  expect(await actions('show')).toHaveLength(0);
  await expect.poll(async () => (await actions('show')).length).toBe(1);
  expect((await actions('show'))[0].options).toMatchObject({kind:'interstitial',placement:'ads-break'});
  expect((await read(page)).attempt.adBreakShown).toBeUndefined();
  expect((await read(page)).profile.coins).toBe(save.profile.coins);
});

for (const mode of ['campaign', 'daily'] as const) {
  test(`three durable Coffee callbacks in a single ${mode} attempt`, async ({ page }) => {
    const deal = mode === 'daily' ? dailyForDay('2026-11-25') : findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!;
    const save = freshSave(deal, 'repeat-ad-checkpoint');
    save.contentVersion = 8;
    save.settings.reducedMotion = true;
    save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
      winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
    const calls = await installBridge(page, save, true);
    await page.locator(mode === 'campaign' ? '#home-play' : '#daily-play').tap();
    await expect(page.locator('#play-screen')).toBeVisible();
    for (const [index, action] of deal.winningPath.slice(0, 3).entries()) {
      await page.clock.fastForward(181_000);
      expect(await calls('show')).toHaveLength(index);
      await move(page, deal, action);
      const before = await read(page);
      await expect.poll(async () => (await read(page)).campaignAds?.coffeeDisplays?.[0]?.count).toBe(index + 1);
      const after = await read(page);
      expect(after.attempt.id).toBe(before.attempt.id);
      expect(after.attempt.board).toEqual(before.attempt.board);
      expect(after.profile.coins).toBe(before.profile.coins);
      expect((await calls('show'))[index].options).toMatchObject({ mode, placement: 'ads-break' });
    }
    const trace = await page.evaluate(() => (window as unknown as { p0CoffeeTrace: { phase: string; now: number }[] }).p0CoffeeTrace);
    const notices = trace.filter(row => row.phase === 'notice-painted');
    const requests = trace.filter(row => row.phase === 'request');
    expect(notices).toHaveLength(3);
    expect(requests.every((row, index) => row.now - notices[index].now >= 850)).toBe(true);
  });
}

test('Settings → Home shows menu interstitial only after the shared clock, with a preserved board', async ({ page }) => {
  const deal = findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!;
  const save = freshSave(deal, 'menu-ad-checkpoint');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const calls = await installBridge(page, save, true);
  const goHome = async () => {
    await page.locator('#menu').tap();
    await page.locator('#levels-open').tap();
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#home-play')).toBeEnabled();
  };
  await page.locator('#home-play').tap();
  const board = (await read(page)).attempt.board;
  await goHome();
  expect(await calls('show')).toHaveLength(0);
  await page.clock.fastForward(121_000);
  await page.locator('#home-play').tap();
  await goHome();
  expect((await calls('show')).map(c => c.options.placement)).toEqual(['menu']);
  expect((await read(page)).platform?.lastFullscreenAt).toBeGreaterThan(0);
  await page.locator('#home-play').tap();
  await goHome();
  expect(await calls('show')).toHaveLength(1);
  expect((await read(page)).attempt.board).toEqual(board);
});

test('L2 teaching and the next L3 lesson suppress forced advertising even after cooldown', async ({ page }) => {
  test.setTimeout(75_000);
  const deal = findDeal('campaign-c8-dealer-002')!;
  const save = freshSave(deal, 'start-ad-checkpoint');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: [campaignId(1)] };
  const calls = await installBridge(page, save, true);
  await expect.poll(async () => (await calls('placeBanner')).length).toBe(1);
  await page.locator('#home-play').tap();
  await expect(page.locator('#lesson-copy')).toHaveText('Положите тему в верхний слот.');
  expect((await calls('hideBanner')).length).toBeGreaterThan(0);
  await page.clock.fastForward(121_000);
  for (const action of deal.winningPath) await move(page, deal, action);
  expect(await calls('show')).toHaveLength(0);
  await expect(page.locator('#next-level')).toBeVisible();
  if (await page.locator('#next-level').textContent() === 'Забрать') await page.locator('#next-level').tap();
  await page.locator('#next-level').tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).toBe('campaign-c8-dealer-003');
  expect(await calls('show')).toHaveLength(0);
});
