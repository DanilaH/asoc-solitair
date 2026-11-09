import Phaser from 'phaser';
import { getBackingStoreSize, getRenderPixelRatio } from '@danilah/mini-games-kit/core';
import { destroyRenderer } from '@danilah/mini-games-kit/phaser';
import { installTouchActivation } from '@danilah/mini-games-kit/feel';
import { campaignDeals, findDeal } from './content/campaign';
import { CAMPAIGN_LENGTH, completedLevels, unlockedLevel, helperUnlocked, freeHintDemo } from './domain/progression';
import { beginDeal } from './domain/campaign';
import { lesson } from './app/tutorial';
import { boardKey, dispatch, freshSave, STREAK } from './domain/engine';
import { BALANCE } from './domain/balance';
import type { BoardCommand, Command } from './domain/types';
import { BoardScene } from './game/BoardScene';
import { createRuntime } from './platform/runtime';
import { SaveStore, createStorage } from './platform/storage';
import { createTelemetry } from './platform/telemetry';
import { createAds } from './platform/ads';
import { NativeBanner } from './platform/banner';
import { applyReceipt, platformState, purchaseHelper, interstitialEligible, markCampaignWin, useContinue, type RewardPlacement } from './domain/services';
import type { Save, Result } from './domain/types';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let deal = campaignDeals[0];
let screen: 'home' | 'game' = 'home';
let scene: BoardScene | undefined;
let game: Phaser.Game | undefined;
let worker: Worker | undefined;
let workerDeadline: ReturnType<typeof setTimeout> | undefined;
let outcomeTimer: ReturnType<typeof setTimeout> | undefined;
let guideTimer: ReturnType<typeof setTimeout> | undefined;
let messageTimer: ReturnType<typeof setTimeout> | undefined;
let inspectMode = false;
let alive = true;
let ready = false;
const abort = new AbortController();
const domOptions = { signal: abort.signal };
const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const runtime = createRuntime(() => { scene?.cancel(); }, () => {
  if (runtime.activity.getBlockReasons().some(r => r !== 'modal' && r !== 'screen')) return;
  if (screen === 'game' && scene?.back()) return;
  if (dialogs.some(d => d.open)) closeDialogs();
  else if (inspectMode) setInspect(false);
  else openDialog('#settings');
});

function closeDialogs() { dialogs.forEach(d => d.close()); runtime.activity.setBlocked('modal', false); }
function openDialog(selector: string) { closeDialogs(); scene?.cancel(); runtime.activity.setBlocked('modal', true); $<HTMLDialogElement>(selector).showModal(); }
function message(text: string, error = false) {
  clearTimeout(messageTimer); $('#message').textContent = text; $('#message').classList.toggle('error', error);
  if (error) messageTimer = setTimeout(() => message('Собирайте карты одной категории вместе'), 1800);
}
function setInspect(value: boolean) { inspectMode = value; $('#inspect').setAttribute('aria-pressed', String(value)); scene?.setInspect(value); message(value ? 'Нажмите на открытую карточку' : 'Собирайте карты одной категории вместе'); }

async function start() {
try {
  runtime.activity.setBlocked('screen', true);
  const store = new SaveStore(createStorage(), findDeal, () => {
    const initial = freshSave(deal, crypto.randomUUID());
    initial.settings.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return initial;
  });
  let save = await store.open();
  deal = findDeal(save.attempt.dealId)!;
  let requestedLevel: number | undefined;
  let outcomeViewed = false;
  let removeForeground: (() => void) | undefined;
  let saving = false, serviceBusy = false;
  let pendingWrites = 0;
  let banner: NativeBanner | undefined;
  const launchedAt = Date.now();
  const telemetry = createTelemetry(() => save, runtime.activity);
  const setInput = () => scene?.setEnabled(screen === 'game' && ready && !saving && !runtime.activity.isBlocked() && !store.needsRecovery);
  const updateBanner = () => banner?.setEligible(Boolean(screen === 'game' && ads.status.banner && deal.campaignLevel !== undefined && deal.campaignLevel >= BALANCE.ads.bannerFromLevel), runtime.activity.isBlocked());
  store.onChange = value => { save = value; deal = findDeal(value.attempt.dealId)!; telemetry.sync(); renderHud(); renderHome(); updateBanner(); };
  async function write<T>(change: (next: Save) => T): Promise<T> {
    pendingWrites++; saving = true; setInput();
    try { return await store.mutate(change); }
    finally { saving = --pendingWrites > 0; setInput(); renderHud(); renderHome(); }
  }
  const ads = createAds({
    activity: runtime.activity,
    async beforeShow(request) {
      await store.mutate(next => { const state = platformState(next); state.lastFullscreenAt = Date.now(); if (request.kind === 'interstitial') state.winsSinceInterstitial = 0; });
    },
    async commit(receipt) {
      const result = await store.mutate(next => applyReceipt(next, receipt));
      if (result === 'applied') telemetry.track('reward_granted', { attemptId: receipt.attempt, dealId: receipt.dealId, mode: receipt.mode, reason: `rewarded_${receipt.placement}`, amount: receipt.placement === 'continue' ? BALANCE.continueMoves : BALANCE.rewardedCharges[receipt.placement] });
      // Ack failure must not freeze spending/restart or replay the already durable grant.
      if (runtime.activity.getBlockReasons().every(r => r === 'modal')) { scene?.sync(); if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs(); }
      return result;
    },
    onStatus() { renderHud(); updateBanner(); if ((deal.campaignLevel ?? 0) > BALANCE.ads.interstitialAfterLevel) void ads.prepareInterstitial(); },
    onEvent(event) { telemetry.track('ad_event', { format: event.kind, phase: event.phase }); },
  });
  if (ads.bridge) banner = new NativeBanner(ads.bridge, $('#banner-slot'));
  telemetry.track('session_start');
  if (save.attempt.telemetry?.started && save.attempt.board.phase === 'playing') telemetry.track('level_resume');
  let activeHint: { key: string; action: BoardCommand; guaranteed: boolean } | undefined;

  runtime.setMute(!save.settings.sfx); runtime.setHaptics(save.settings.haptics);
  const coins = Array.from({ length: 24 }, () => { const node = document.createElement('span'); node.className = 'flying-coin'; node.textContent = '✦'; $('#coin-layer').append(node); return { node, busy: false, animation: null as Animation | null }; });
  function coinBurst() {
    if (save.settings.reducedMotion || new URLSearchParams(location.search).get('fxCoins') === '0') return;
    const source = $('#streak-reward').getBoundingClientRect(), target = $('.coin-icon').getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const coin = coins.find(c => !c.busy); if (!coin) break;
      coin.busy = true; coin.node.style.display = 'block';
      const sx = source.x + source.width / 2 - 10, sy = source.y + source.height / 2 - 10;
      const tx = target.x + target.width / 2 - 10, ty = target.y + target.height / 2 - 10;
      coin.animation = coin.node.animate([{ transform: `translate(${sx}px,${sy}px) scale(.5)`, opacity: 0 },
        { transform: `translate(${sx + (i - 3.5) * 10}px,${sy - 35 - i % 3 * 8}px) scale(1)`, opacity: 1, offset: .27 },
        { transform: `translate(${tx}px,${ty}px) scale(.8)`, opacity: 1 }], { duration: 550, delay: i * 23, easing: 'ease-in-out' });
      coin.animation.onfinish = () => { coin.busy = false; coin.node.style.display = 'none'; $('.wallet').classList.remove('bump'); void $('.wallet').offsetWidth; $('.wallet').classList.add('bump'); };
    }
  }
  function renderHud() {
    const board = save.attempt.board;
    $('#level-number').textContent = deal.campaignLevel ? `УРОВЕНЬ ${deal.campaignLevel}` : 'ПРОБНАЯ РАЗДАЧА';
    $('.level h1').textContent = deal.title;
    const hintUnlocked = helperUnlocked(save, 'hint', deal), undoUnlocked = helperUnlocked(save, 'undo', deal);
    $('#hint').hidden = !hintUnlocked; $('#undo').hidden = !undoUnlocked;
    $('#hint-offer').hidden = !hintUnlocked; $('#undo-offer').hidden = !undoUnlocked;
    $('#helpers-open').hidden = !hintUnlocked && !undoUnlocked;
    $('#restart').hidden = screen === 'home'; $('#restart-copy').hidden = screen === 'home'; $('#levels-open').hidden = screen === 'home';
    $('#settings-done').textContent = screen === 'home' ? 'Готово' : 'Вернуться к картам';
    const instruction = lesson(save, deal);
    $('#hint').classList.toggle('attention', instruction?.attention === 'hint');
    $('#undo').classList.toggle('attention', instruction?.attention === 'undo');
    $('#app').dataset.lesson = String(Boolean(instruction));
    $('#coins').textContent = String(save.profile.coins);
    $('#moves').textContent = board.movesLeft === null ? '∞' : String(board.movesLeft);
    $('#move-fill').style.width = `${100 * (board.movesLeft ?? 1) / (deal.initial.movesLeft ?? 1)}%`;
    $('#hint-count').textContent = String(save.profile.hints); $('#undo-count').textContent = String(save.profile.undos);
    $<HTMLButtonElement>('#hint').disabled = board.phase !== 'playing' || Boolean(workerDeadline) || saving;
    $<HTMLButtonElement>('#undo').disabled = board.phase === 'won' || !save.attempt.undo.length || saving;
    const tier = STREAK[save.attempt.streak.tier];
    $('#streak').replaceChildren(...Array.from({ length: tier.count }, (_, index) => { const cell = document.createElement('i'); cell.className = index < save.attempt.streak.progress ? 'filled' : ''; return cell; }));
    $('#streak').setAttribute('aria-label', `${save.attempt.streak.progress} из ${tier.count}`);
    $('#streak-reward').firstChild!.textContent = `+${tier.coins} `;
    $<HTMLInputElement>('#sfx').checked = save.settings.sfx;
    $<HTMLInputElement>('#reduced').checked = save.settings.reducedMotion;
    $<HTMLInputElement>('#haptics').checked = save.settings.haptics;
    $('#helper-wallet').textContent = `${save.profile.coins} монет`;
    $('#hint-stock').textContent = String(save.profile.hints); $('#undo-stock').textContent = String(save.profile.undos);
    for (const helper of ['hint', 'undo'] as const) {
      $<HTMLButtonElement>(`#buy-${helper}`).disabled = serviceBusy || saving || save.profile.coins < BALANCE.helperPrices[helper];
      $<HTMLButtonElement>(`#video-${helper}`).disabled = serviceBusy || !ads.status.rewarded;
    }
    $('#video-unavailable').hidden = Boolean(ads.status.rewarded);
    $('#result-continue').hidden = board.phase !== 'exhausted' || Boolean(save.attempt.continued);
    $<HTMLButtonElement>('#result-continue').disabled = serviceBusy || (!platformState(structuredClone(save)).continueCredits && !ads.status.rewarded);
    $('#result-continue').textContent = platformState(structuredClone(save)).continueCredits > 0 ? '+10 ходов · использовать запас' : '+10 ходов · видео';
    $('#save-retry').hidden = !store.needsRecovery;
  }
  function outcome() {
    if (save.attempt.board.phase === 'playing') return;
    const won = save.attempt.board.phase === 'won';
    outcomeViewed = true;
    $('#result-title').textContent = won ? 'Всё сошлось!' : 'Ходы закончились';
    $('#result-copy').textContent = won ? (deal.campaignLevel === CAMPAIGN_LENGTH ? 'Все 20 уровней пройдены. Любую раздачу можно сыграть ещё раз.' : 'Все категории этой раздачи собраны.') : 'Можно отменить последний ход или попробовать тот же расклад снова.';
    $('#result-rewards').innerHTML = won ? `<div class="reward-line"><span>За победу</span><strong>+${BALANCE.winCoins}</strong></div>${save.attempt.board.movesLeft === null ? '' : `<div class="reward-line"><span>Осталось ходов: ${save.attempt.board.movesLeft}</span><strong>+${BALANCE.coinsPerRemainingMove * save.attempt.board.movesLeft}</strong></div>`}<div class="reward-line"><span>Серии за партию · уже получено</span><strong>${save.attempt.streak.coins}</strong></div>` : '';
    $('#result-rewards').hidden = !won;
    $('#result-undo').hidden = won || !save.profile.undos || !save.attempt.undo.length;
    $('#next-level').hidden = !won;
    $('#next-level').textContent = deal.campaignLevel === CAMPAIGN_LENGTH ? 'К уровням' : `Уровень ${(deal.campaignLevel ?? 0) + 1} →`;
    $('#result-home').hidden = deal.campaignLevel === CAMPAIGN_LENGTH;
    openDialog('#result');
  }
  async function execute(cmd: Command) {
    if (!alive || saving || screen !== 'game' || runtime.activity.isBlocked()) return false;
    let result: Result | undefined;
    let started = false, finished = false;
    try {
      await write(next => {
        result = dispatch(next, cmd, deal);
        Object.assign(next, result.next);
        if (result.accepted) {
          const t = next.attempt.telemetry ??= { started: false, finished: false, activeMs: 0 };
          t.activeMs = cmd.type === 'restart' ? 0 : telemetry.activeMs();
          if (['transfer', 'draw', 'recycle'].includes(cmd.type) && !t.started) { t.started = true; started = true; }
          if (next.attempt.board.phase !== 'playing' && !t.finished) { t.finished = true; finished = true; }
          if (result.events.some(e => e.type === 'win')) markCampaignWin(next, deal.id, deal.campaignLevel);
        }
      });
    } catch {
      message(store.needsRecovery ? 'Проверяем сохранение. Нажмите «Повторить сохранение».' : 'Не удалось сохранить ход. Попробуйте ещё раз.', true);
      scene?.cancel(); renderHud(); return false;
    }
    if (!result) return false;
    if (result.accepted) {
      if (started) telemetry.track('level_start');
      if (cmd.type === 'restart') telemetry.track('level_restart');
      if (cmd.type === 'hint' || cmd.type === 'undo') telemetry.track('helper_used', { helper: cmd.type });
      if (finished) telemetry.track(save.attempt.board.phase === 'won' ? 'level_win' : 'level_fail');
      for (const event of result.events) if (event.type === 'coins' || event.type === 'win') telemetry.track('reward_granted', { reason: event.type === 'coins' ? 'core_streak' : 'level_win', amount: event.amount ?? 0 });
      if (cmd.type !== 'hint') activeHint = undefined;
      scene?.clearHint();
      const boardCommand = ['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined;
      scene?.sync(result.events, cmd.type === 'restart', boardCommand);
      const major = result.events.find(e => e.type === 'win') ?? result.events.find(e => e.type === 'complete') ?? result.events.find(e => e.type === 'coins') ?? result.events[0];
      if (major) {
        runtime.play(major.type);
        if (['transfer', 'complete', 'coins', 'win', 'undo', 'hint'].includes(major.type)) runtime.pulse(major.type as 'transfer' | 'complete' | 'coins' | 'win' | 'undo' | 'hint');
      }
      if (result.events.some(e => e.type === 'coins')) coinBurst();
      if (cmd.type === 'restart') message('Перенесите категорию в свободный верхний слот');
      if (save.attempt.board.phase !== 'playing') {
        clearTimeout(outcomeTimer); outcomeTimer = setTimeout(outcome, save.attempt.board.phase === 'won' ? 650 : 100);
      }
    } else {
      scene?.cancel(); runtime.play('invalid'); runtime.pulse('invalid');
      telemetry.track('move_rejected', { reason: result.reason ?? 'unknown' }); message(result.reason ?? 'Сюда не подходит', true);
    }
    renderHud();
    if (result.accepted && save.attempt.board.phase === 'playing') showGuidance(cmd.type !== 'hint');
    return result.accepted;
  }
  async function rewarded(placement: RewardPlacement) {
    if (serviceBusy || saving) return;
    const requestAttempt = save.attempt.id;
    serviceBusy = true; closeDialogs(); renderHud();
    const result = await ads.show({ kind: 'rewarded', placement, attempt: requestAttempt, dealId: deal.id, mode: 'campaign' });
    // Dismissal itself grants nothing; receipt recovery independently commits an earned reward.
    serviceBusy = false; renderHud();
    if (!result.shown) message('Сейчас видео недоступно. Попробуйте позже.', true);
    if (save.attempt.board.phase === 'exhausted' && !runtime.activity.isBlocked()) outcome();
  }
  async function replay() {
    if (serviceBusy || saving) return;
    serviceBusy = true; closeDialogs();
    if (save.attempt.board.phase === 'won' && deal.campaignLevel !== undefined && interstitialEligible(save, deal.campaignLevel, 'campaign', Date.now(), launchedAt))
      await ads.show({ kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: deal.id, mode: 'campaign' });
    serviceBusy = false;
    if (!alive) return;
    // Dismissal and foreground are independent. Never continue behind a displayed ad.
    if (runtime.activity.isBlocked()) {
      const remove = runtime.activity.onBlockedChange(blocked => { if (!blocked) { remove(); if (alive) void execute({ type: 'restart', attemptId: crypto.randomUUID() }); } });
    } else await execute({ type: 'restart', attemptId: crypto.randomUUID() });
  }
  function renderHome() {
    const completed = completedLevels(save), unlocked = unlockedLevel(save), current = save.attempt.board.phase === 'playing';
    $('#campaign-progress').textContent = `${completed} / ${CAMPAIGN_LENGTH}`;
    $('#campaign-done').hidden = completed < CAMPAIGN_LENGTH;
    const label = current ? (deal.campaignLevel ? `${save.attempt.telemetry?.started ? 'Продолжить' : 'Играть'} · уровень ${deal.campaignLevel}` : 'Продолжить пробную раздачу')
      : !outcomeViewed ? (deal.campaignLevel ? `Результат · уровень ${deal.campaignLevel}` : 'Результат пробной раздачи') : completed === CAMPAIGN_LENGTH ? 'Выбрать уровень' : `Играть · уровень ${unlocked}`;
    $('#home-play').replaceChildren(document.createTextNode(label), Object.assign(document.createElement('span'), { textContent: '↗' }));
    $<HTMLButtonElement>('#home-play').disabled = !ready || saving || serviceBusy;
    $('#home-status').textContent = current && save.attempt.telemetry?.started ? 'Незаконченная раздача сохранена' : completed === 0 ? 'Начните с простых связей' : completed === CAMPAIGN_LENGTH ? 'Можно вернуться к любимым темам' : `Дальше — «${campaignDeals[unlocked - 1].title}»`;
    const grid = $('#level-grid');
    if (!grid.children.length) for (const level of campaignDeals) {
      const button = document.createElement('button'); button.className = 'level-button'; button.dataset.level = String(level.campaignLevel); button.id = `level-${level.campaignLevel}`; grid.append(button);
    }
    for (const button of grid.querySelectorAll<HTMLButtonElement>('button')) {
      const level = Number(button.dataset.level), item = campaignDeals[level - 1], done = save.platform?.completedCampaign.includes(item.id) ?? false;
      button.textContent = String(level); button.disabled = level > unlocked || !ready || saving || serviceBusy;
      button.dataset.completed = String(done); button.dataset.next = String(level === unlocked && !done);
      button.setAttribute('aria-label', `Уровень ${level}: ${item.title}${done ? ', пройден' : level > unlocked ? ', закрыт' : ''}`);
    }
  }
  function showGuidance(animate = true) {
    clearTimeout(guideTimer);
    const instruction = lesson(save, deal);
    message(instruction?.text ?? 'Собирайте карты одной категории вместе');
    if (animate && instruction?.action && !save.settings.reducedMotion) {
      const attemptId = save.attempt.id, revision = save.revision;
      guideTimer = setTimeout(() => {
        if (alive && screen === 'game' && !runtime.activity.isBlocked() && save.attempt.id === attemptId && save.revision === revision) {
          game?.loop.wake(); scene?.hint(instruction.action!);
        }
      }, 650);
    }
  }
  function showGame() {
    screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false;
    runtime.activity.setBlocked('screen', false); renderHud();
    resizeToRoot(); game?.loop.wake(); scene?.sync(); showGuidance();
    if (save.attempt.board.phase !== 'playing') outcome();
  }
  function goHome() {
    clearTimeout(outcomeTimer); clearTimeout(guideTimer); setInspect(false); closeDialogs();
    screen = 'home'; runtime.activity.setBlocked('screen', true); $('#play-screen').hidden = true; $('#home').hidden = false;
    renderHud(); renderHome(); updateBanner();
  }
  async function openLevel(level: number, confirmed = false) {
    if (!alive || !ready || saving || serviceBusy || level < 1 || level > unlockedLevel(save)) return;
    const target = campaignDeals[level - 1];
    if (target.id === deal.id && save.attempt.board.phase === 'playing') { closeDialogs(); showGame(); return; }
    if (!confirmed && save.attempt.board.phase === 'playing' && save.attempt.telemetry?.started) {
      requestedLevel = level; $('#switch-title').textContent = `Начать уровень ${level}?`; openDialog('#switch-level'); return;
    }
    closeDialogs(); serviceBusy = true; renderHome();
    // Only the deliberate transition from a won level can request an interstitial.
    if (screen === 'game' && save.attempt.board.phase === 'won' && deal.campaignLevel !== undefined && interstitialEligible(save, deal.campaignLevel, 'campaign', Date.now(), launchedAt))
      await ads.show({ kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: deal.id, mode: 'campaign' });
    const enter = async () => {
      removeForeground?.(); removeForeground = undefined;
      runtime.activity.setBlocked('level-transition', true);
      try {
        clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined;
        clearTimeout(outcomeTimer); clearTimeout(guideTimer); activeHint = undefined; setInspect(false);
        await write(next => beginDeal(next, target, crypto.randomUUID()));
        outcomeViewed = false; ready = false; $('#app').dataset.ready = 'false';
        screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false; runtime.activity.setBlocked('screen', false);
        scene?.setDeal(target); game?.loop.wake();
      } catch { message('Не удалось сохранить переход. Попробуйте ещё раз.', true); }
      finally { serviceBusy = false; if (ready) runtime.activity.setBlocked('level-transition', false); renderHud(); renderHome(); }
    };
    if (runtime.activity.getBlockReasons().some(r => r !== 'screen')) {
      removeForeground?.(); removeForeground = runtime.activity.onBlockReasonsChange(() => {
        if (runtime.activity.getBlockReasons().every(r => r === 'screen')) void enter();
      });
    } else await enter();
  }
  const root = $('#game-root');
  function size() {
    const measured = root.getBoundingClientRect(), rect = { width: measured.width || Math.min(innerWidth, 520) - 24, height: measured.height || Math.max(280, innerHeight - 260) }, ratio = getRenderPixelRatio(2);
    return { rect, backing: getBackingStoreSize(Math.max(1, rect.width), Math.max(1, rect.height), ratio) };
  }
  const initial = size();
  scene = new BoardScene({ deal, getSave: () => save, command: execute, sound: name => runtime.play(name),
    inspect(id) {
      const card = deal.cards[id];
      if (card.image) { message('Пояснения доступны карточкам со словами'); return; }
      setInspect(false);
      $('#word-title').textContent = card.text; $('#word-description').textContent = card.explanation;
      openDialog('#inspect-dialog');
    },
    ready(active) {
      scene = active;
      active.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        ready = true; resizeToRoot(); runtime.activity.setBlocked('level-transition', false); telemetry.ready(); setInput(); updateBanner(); renderHud(); renderHome(); $('#loading').hidden = true; $('#app').dataset.ready = 'true';
        if (screen === 'game') showGuidance();
        if (screen === 'game' && save.attempt.board.phase !== 'playing') outcome();
      });
    },
  });
  game = new Phaser.Game({ type: Phaser.AUTO, parent: root, width: initial.backing.width, height: initial.backing.height,
    transparent: true, banner: false, audio: { noAudio: true }, scene: [scene],
    scale: { mode: Phaser.Scale.NONE, zoom: initial.rect.width / initial.backing.width },
  });
  const renderer = game;
  function resizeToRoot() {
    if (!ready || screen !== 'game' || !game?.isBooted) return;
    const next = size(); game.loop.wake(); game.scale.setZoom(next.rect.width / next.backing.width); game.scale.resize(next.backing.width, next.backing.height);
  }
  const resize = new ResizeObserver(resizeToRoot);
  resize.observe(root);
  const unblock = runtime.activity.onBlockReasonsChange(() => {
    const blocked = runtime.activity.isBlocked();
    setInput(); updateBanner();
    if (screen === 'game' && runtime.activity.getBlockReasons().every(r => r === 'modal') && ready) {
      scene?.sync();
      if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs();
      if (!blocked) { void ads.refresh(); void ads.recover(); }
    }
    if (!renderer.isBooted) return;
    if (blocked && ready) { renderer.loop.sleep(); coins.forEach(c => { c.animation?.cancel(); c.busy = false; c.node.style.display = 'none'; }); }
    else renderer.loop.wake();
  });
  renderer.events.on(Phaser.Core.Events.POST_RENDER, () => {
    if (ready && (runtime.activity.isBlocked() || !scene?.hasMotion())) renderer.loop.sleep();
  });
  // Input and explicit UI changes wake the sleeping renderer before visual work.
  const wake = () => { if (!runtime.activity.isBlocked()) renderer.loop.wake(); };
  root.addEventListener('pointerdown', wake, domOptions); root.addEventListener('pointermove', wake, domOptions);
  document.addEventListener('pointerdown', wake, { ...domOptions, capture: true });
  window.addEventListener('pointercancel', () => scene?.cancel(), domOptions);
  window.addEventListener('blur', () => scene?.cancel(), domOptions);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { scene?.cancel(); setInspect(false); } }, domOptions);
  dialogs.forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialogs(); }, domOptions));
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', closeDialogs, domOptions));
  $('#home-play').addEventListener('click', () => {
    runtime.play('ui');
    if (save.attempt.board.phase === 'playing' || !outcomeViewed) showGame();
    else if (completedLevels(save) === CAMPAIGN_LENGTH) $('#level-grid').scrollIntoView({ block: 'nearest' });
    else void openLevel(unlockedLevel(save));
  }, domOptions);
  $('#level-grid').addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-level]');
    if (button && !button.disabled) void openLevel(Number(button.dataset.level));
  }, domOptions);
  $('#next-level').addEventListener('click', () => { if (deal.campaignLevel === CAMPAIGN_LENGTH) goHome(); else void openLevel((deal.campaignLevel ?? 0) + 1); }, domOptions);
  $('#result-home').addEventListener('click', goHome, domOptions);
  $('#levels-open').addEventListener('click', goHome, domOptions);
  $('#switch-confirm').addEventListener('click', () => { const level = requestedLevel; requestedLevel = undefined; if (level) void openLevel(level, true); }, domOptions);
  $('#menu').addEventListener('click', () => { runtime.play('ui'); openDialog('#settings'); }, domOptions);
  $('#undo').addEventListener('click', () => { if (!save.profile.undos) openDialog('#helpers'); else void execute({ type: 'undo' }); }, domOptions);
  $('#inspect').addEventListener('click', () => setInspect(!inspectMode), domOptions);
  $('#restart').addEventListener('click', () => { void replay(); }, domOptions);
  $('#replay').addEventListener('click', () => { void replay(); }, domOptions);
  $('#result-undo').addEventListener('click', () => { closeDialogs(); execute({ type: 'undo' }); }, domOptions);
  for (const [id, key] of [['sfx', 'sfx'], ['haptics', 'haptics'], ['reduced', 'reducedMotion']] as const) {
    $<HTMLInputElement>(`#${id}`).addEventListener('change', async event => {
      const value = (event.target as HTMLInputElement).checked;
      try { await write(next => { next.settings[key] = value; }); runtime.setMute(!save.settings.sfx); runtime.setHaptics(save.settings.haptics); } catch { message('Настройки не сохранились', true); }
      renderHud();
    }, domOptions);
  }
  $('#hint').addEventListener('click', () => {
    if (workerDeadline || saving || runtime.activity.isBlocked()) return;
    if (save.profile.hints === 0 && !freeHintDemo(save, deal) && activeHint?.key !== boardKey(save.attempt.board)) { openDialog('#helpers'); return; }
    if (activeHint?.key === boardKey(save.attempt.board)) {
      renderer.loop.wake(); scene?.hint(activeHint.action);
      message(activeHint.guaranteed ? 'Попробуйте так — карты перенесите сами' : 'Допустимый ход — продолжение не гарантировано');
      return;
    }
    scene?.cancel(); message('Ищем связь…');
    worker ??= new Worker(new URL('./game/hint.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (event: MessageEvent<{ revision: number; action?: BoardCommand; guaranteed: boolean }>) => {
      clearTimeout(workerDeadline); workerDeadline = undefined;
      const hint = event.data;
      if (hint.revision !== save.revision || !hint.action || runtime.activity.isBlocked()) { message('Сейчас подходящей подсказки нет'); renderHud(); return; }
      if (!await execute({ type: 'hint', revision: hint.revision, action: hint.action })) return;
      activeHint = { key: boardKey(save.attempt.board), action: hint.action, guaranteed: hint.guaranteed };
      renderHud();
      renderer.loop.wake(); scene?.hint(hint.action);
      message(hint.guaranteed ? 'Попробуйте так — карты перенесите сами' : 'Допустимый ход — продолжение не гарантировано');
    };
    worker.onerror = () => { clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined; message('Не удалось подготовить подсказку', true); renderHud(); };
    workerDeadline = setTimeout(() => { worker?.terminate(); worker = undefined; workerDeadline = undefined; message('Поиск занял слишком много времени. Подсказка не потрачена.', true); renderHud(); }, 5000);
    worker.postMessage({ revision: save.revision, board: save.attempt.board, deal }); renderHud();
  }, domOptions);
  $('#helpers-open').addEventListener('click', () => { runtime.pulse('button'); openDialog('#helpers'); }, domOptions);
  for (const helper of ['hint', 'undo'] as const) {
    $(`#buy-${helper}`).addEventListener('click', async () => {
      if (serviceBusy || saving) return;
      try {
        const bought = await write(next => purchaseHelper(next, helper));
        if (bought) { telemetry.track('helper_purchase', { helper, cost: BALANCE.helperPrices[helper] }); runtime.play('ui'); runtime.pulse('button'); }
      } catch { message('Не удалось сохранить покупку. Попробуйте ещё раз.', true); }
      renderHud();
    }, domOptions);
    $(`#video-${helper}`).addEventListener('click', () => { void rewarded(helper); }, domOptions);
  }
  $('#result-continue').addEventListener('click', async () => {
    if (serviceBusy || saving || save.attempt.continued) return;
    if (platformState(structuredClone(save)).continueCredits > 0) {
      try { await write(next => useContinue(next)); closeDialogs(); scene?.sync(); telemetry.sync(); }
      catch { message('Не удалось сохранить продолжение.', true); }
    } else void rewarded('continue');
  }, domOptions);
  $('#save-retry').addEventListener('click', async () => {
    try { await write(() => undefined); scene?.sync(); message('Сохранение проверено. Можно продолжать.'); }
    catch { message('Пока не удалось проверить сохранение. Попробуйте ещё раз.', true); }
    renderHud();
  }, domOptions);
  const checkpoint = setInterval(() => {
    if (!alive || saving || workerDeadline || store.needsRecovery || !save.attempt.telemetry?.started) return;
    const activeMs = telemetry.activeMs();
    if (activeMs - save.attempt.telemetry.activeMs < 1000) return;
    void store.mutate(next => { if (next.attempt.telemetry) next.attempt.telemetry.activeMs = activeMs; }).catch(() => undefined);
  }, 5000);
  const removeTouch = installTouchActivation($('#dock'), { resolveButton: target => target instanceof Element ? target.closest('button') : null });
  renderHud(); renderHome();
  const cleanup = () => {
    if (!alive) return; alive = false; clearTimeout(workerDeadline); clearTimeout(outcomeTimer); clearTimeout(messageTimer);
    telemetry.track('session_end'); clearInterval(checkpoint); clearTimeout(guideTimer); removeForeground?.(); banner?.destroy(); ads.destroy(); telemetry.destroy();
    abort.abort(); removeTouch(); coins.forEach(c => { c.animation?.cancel(); c.node.remove(); });
    worker?.terminate(); resize.disconnect(); unblock(); runtime.destroy(); destroyRenderer(renderer);
  };
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); }, domOptions);
  window.addEventListener('pageshow', () => { if (alive) renderer.loop.wake(); }, domOptions);
  import.meta.hot?.dispose(cleanup);
} catch (error) {
  runtime.destroy(); game && destroyRenderer(game);
  const alert = document.createElement('div'); alert.className = 'fatal'; alert.setAttribute('role', 'alert');
  const title = document.createElement('h2'); title.textContent = 'Не удалось открыть партию';
  const detail = document.createElement('p'); detail.textContent = error instanceof Error ? error.message : String(error);
  alert.append(title, detail); document.body.append(alert); console.error(error);
}

}
void start();
