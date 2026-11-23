import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { applyBoard, dispatch, legalCommands, sourceCards } from '../../src/domain/engine';
import type { Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import { fixture, move, read, seed } from './wallet-fixture';

test.skip(process.env.VITE_AZUR_FEEL_QA !== '1', 'Isolated AZUR feel QA build');

type Pulse = { cue: string; coins: number; stock: number; at: number };
async function observeBridge(page: Page) {
  await page.addInitScript(() => {
    const pulses: Pulse[] = [];
    const listeners = new Map<string, (event: { isActive: boolean }) => void>();
    const methods = (name: string, names: string[], events = false) => ({
      name,
      methods: [
        ...names.map(name => ({ name, rtype: 'promise' })),
        ...events ? [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'callback' }] : [],
      ],
    });
    Object.assign(window, {
      androidBridge: {}, feelPulses: pulses,
      setFeelActive: (isActive: boolean) => listeners.get('App.appStateChange')?.({ isActive }),
      Capacitor: {
        PluginHeaders: [
          methods('App', ['getState'], true), methods('SolitaireStorage', ['get', 'set', 'remove']),
          methods('SolitaireAudio', ['configure'], true), methods('SolitaireFeedback', ['pulse', 'cancel']),
        ],
        async nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (event: { isActive: boolean }) => void) {
          const id = `${plugin}.${options.eventName}`;
          if (method === 'addListener') listeners.set(id, callback);
          else listeners.delete(id);
          return id;
        },
        async nativePromise(plugin: string, method: string, options: { key: string; value: string; cue: string }) {
          if (plugin === 'App') return { isActive: true };
          if (plugin === 'SolitaireAudio') return { focused: true };
          if (plugin === 'SolitaireStorage') {
            if (method === 'get') return { value: localStorage.getItem(options.key) };
            if (method === 'set') localStorage.setItem(options.key, options.value);
            if (method === 'remove') localStorage.removeItem(options.key);
          }
          if (plugin === 'SolitaireFeedback' && method === 'pulse') {
            const save = JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save;
            pulses.push({ cue: options.cue, coins: save.profile.coins, stock: save.attempt.board.stock.length, at: performance.now() });
          }
          return {};
        },
      },
    });
  });
}
const pulses = (page: Page) => page.evaluate(() => (window as typeof window & { feelPulses: Pulse[] }).feelPulses);

test('committed draw gives a light intent while a rejected drag leaves the board and wallet alone', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await observeBridge(page);
  const deal = campaignDeals[16], start = fixture(16);
  await seed(page, start);
  const opening = legalCommands(start.attempt.board, deal).find(cmd => cmd.type === 'transfer' && cmd.to.kind === 'foundation');
  if (!opening) throw Error('Expected a legal transfer to a slot');
  await move(page, deal, opening);
  await expect.poll(async () => (await pulses(page)).map(pulse => pulse.cue)).toContain('transfer');
  const before = await read(page), board = before.attempt.board;
  const box = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(box.width, box.height, start.settings.deckPosition, deal);
  const geometry = layout(board, deal, frame, start.settings.deckSide, start.settings.deckPosition);
  const transfers = legalCommands(board, deal).filter(cmd => cmd.type === 'transfer');
  const candidate = transfers.map(command => ({
    command,
    target: geometry.targets.find(target => target.location.kind === 'foundation' &&
      typeof applyBoard(board, { ...command, to: target.location }, deal) === 'string'),
  })).find(item => item.target);
  if (!candidate?.target) throw Error('Expected a forbidden slot');
  const from = geometry.poses.find(pose => pose.id === sourceCards(board, candidate.command.from, deal).at(-1))!;
  const point = (p: { x: number; y: number }) => ({ x: box.x + frame.offsetX + p.x * frame.unit, y: box.y + p.y * frame.unit });
  const a = point(from), b = point(candidate.target);
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 8; i++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8 }] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await expect.poll(async () => (await pulses(page)).map(pulse => pulse.cue)).toContain('invalid-heavy');
  expect((await read(page)).attempt.board).toEqual(board);
  expect((await read(page)).profile).toEqual(before.profile);
  await move(page, deal, { type: 'draw' });
  await expect.poll(async () => (await pulses(page)).find(pulse => pulse.cue === 'draw')?.stock).toBe(board.stock.length - 1);
});

for (const pause of [false, true]) {
  test(`the saved reward precedes collect, and Next recovers after ${pause ? 'background' : 'coin landing'}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await observeBridge(page);
    const save = fixture(4, true), deal = campaignDeals[4], last = deal.winningPath.at(-1)!;
    const expected = dispatch(save, last, deal).next;
    await seed(page, save);
    await move(page, deal, last);
    const next = page.locator('#next-level');
    await expect(next).toHaveText('Забрать');
    expect((await read(page)).profile).toEqual(expected.profile);
    expect(Number(await page.locator('#coins').textContent())).toBeLessThan(expected.profile.coins);
    const before = (await pulses(page)).filter(pulse => pulse.cue === 'coin-land');
    expect(before.length).toBeGreaterThan(0);
    expect(before.every(pulse => pulse.coins === expected.profile.coins)).toBe(true);

    await next.tap();
    await expect(next).toHaveAttribute('aria-busy', 'true');
    await expect(next).toBeDisabled();
    if (pause) {
      await page.evaluate(() => {
        const app = window as typeof window & { setFeelActive: (active: boolean) => void };
        app.setFeelActive(false);
        app.setFeelActive(true);
      });
    }
    await expect(next).toBeEnabled();
    await expect(next).toHaveText(/уровень 6|Уровень 6/);
    await expect(page.locator('#coins')).toHaveText(String(expected.profile.coins));
    const landed = (await pulses(page)).filter(pulse => pulse.cue === 'coin-land');
    if (!pause) expect(landed.length).toBeGreaterThan(before.length);
    expect(landed.slice(1).every((pulse, index) => pulse.at - landed[index].at >= 340)).toBe(true);
    expect((await read(page)).profile).toEqual(expected.profile);
    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    await page.locator('#home-play').tap();
    await expect(next).toHaveText(/уровень 6|Уровень 6/);
    await expect(page.locator('#coins')).toHaveText(String(expected.profile.coins));
    expect((await pulses(page)).filter(pulse => pulse.cue === 'coin-land')).toHaveLength(0);
  });
}

test('reduced-motion result offers Next immediately and retains the full wallet', async ({ page }) => {
  const save = fixture(4, true), deal = campaignDeals[4], action = deal.winningPath.at(-1)!;
  save.settings.reducedMotion = true;
  const expected = dispatch(save, action, deal).next;
  await seed(page, save);
  await move(page, deal, action);
  await expect(page.locator('#next-level')).toHaveText(/уровень 6|Уровень 6/);
  await expect(page.locator('#coins')).toHaveText(String(expected.profile.coins));
  expect((await read(page)).profile).toEqual(expected.profile);
});
