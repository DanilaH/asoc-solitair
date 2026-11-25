import { expect, test } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { move, read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary C8 release profile');

/** Observe the JS-to-native boundary. A no-fill response never counts as a display. */
test('one banner slot survives Home to game and AdsBreak waits out a modal', async ({ page }) => {
  const deal = findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!;
  const save = freshSave(deal, 'asoc-ads-checkpoint');
  save.contentVersion = 8; save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const at = Date.UTC(2026, 10, 25, 12);
  await page.clock.install({ time: new Date(at) });
  await page.addInitScript(value => {
    const record: { method: string; options: Record<string, string> }[] = [];
    const method = (name:string) => ({ name,rtype:'promise' });
    const headers = (name: string, list:string[], events=false) => ({
      name,methods:[...list.map(method),...events?[{name:'addListener',rtype:'callback'}, {name:'removeListener',rtype:'callback'}]:[]],
    });
    const key = 'asoc-solitaire.save.v1';
    localStorage.setItem(key, JSON.stringify(value));
    Object.assign(window,{
      androidBridge:{}, p0AdsTrace:record,
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
            if(method==='pendingShown')return {shown:null};
            if(method==='show')return {shown:false,outcome:'unavailable'};
            if(method==='measureBanner')return {webView:{x:0,y:0,width:360,height:640},root:{width:360,height:640},adHeight:50};
          }
          return {};
        },
      },
    });
  },save);
  const actions = (method:string) => page.evaluate(method => (window as unknown as { p0AdsTrace: { method:string; options:Record<string,string> }[] }).p0AdsTrace.filter(call => call.method === method), method);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
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
  await page.clock.fastForward(3_000);
  await expect.poll(async () => (await actions('show')).length).toBe(1);
  expect((await actions('show'))[0].options).toMatchObject({kind:'interstitial',placement:'ads-break'});
  expect((await read(page)).attempt.adBreakShown).toBeUndefined();
  expect((await read(page)).profile.coins).toBe(save.profile.coins);
});
