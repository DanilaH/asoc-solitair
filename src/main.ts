import Phaser from 'phaser';
import { getBackingStoreSize, getRenderPixelRatio } from '@danilah/mini-games-kit/core';
import { destroyRenderer } from '@danilah/mini-games-kit/phaser';
import { installTouchActivation } from '@danilah/mini-games-kit/feel';
import { campaignDeals, findDeal } from './content/campaign';
import { CAMPAIGN_LENGTH, completedLevels, unlockedLevel, helperUnlocked, freeHintDemo } from './domain/progression';
import { beginDeal } from './domain/campaign';
import { dailyForDay } from './content/daily';
import { switchMode } from './domain/sessions';
import { cosmeticUnlocked, dailyRewardEligible, localDay } from './domain/meta';
import { renderMeta, campaignAttempt, dailyAttempt } from './app/meta-ui';
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
import { applyReceipt, platformState, purchaseHelper, interstitialEligible, useContinue, type RewardPlacement } from './domain/services';
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
  function coinBurst(origin = $('#streak-reward')) {
    if (save.settings.reducedMotion || new URLSearchParams(location.search).get('fxCoins') === '0') return;
    const source = origin.getBoundingClientRect(), target = $('.coin-icon').getBoundingClientRect();
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
    $('#level-number').textContent = deal.daily ? `ЗАДАНИЕ · ${deal.daily.dayId}` : deal.campaignLevel ? `УРОВЕНЬ ${deal.campaignLevel}` : 'ПРОБНАЯ РАЗДАЧА';
    $('.level h1').textContent = deal.title;
    const hintUnlocked = helperUnlocked(save, 'hint', deal), undoUnlocked = helperUnlocked(save, 'undo', deal);
    $('#hint').hidden = !hintUnlocked; $('#undo').hidden = !undoUnlocked;
    $('#hint-offer').hidden = !hintUnlocked; $('#undo-offer').hidden = !undoUnlocked;
    const jokerUnlocked = helperUnlocked(save, 'joker', deal);
    $('#joker').hidden = !jokerUnlocked; $('#joker-offer').hidden = !jokerUnlocked;
    $('#joker-count').textContent = String(save.profile.jokers); $('#joker-stock').textContent = String(save.profile.jokers);
    $<HTMLButtonElement>('#joker').disabled = board.phase !== 'playing' || Boolean(save.attempt.jokerUsed) || saving;
    $<HTMLButtonElement>('#buy-joker').disabled = serviceBusy || saving || save.profile.coins < BALANCE.helperPrices.joker;
    $('#joker').classList.toggle('attention', lesson(save, deal)?.attention === 'joker');
    $('#helpers-open').hidden = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
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
    $('#streak-reward').firstChild!.textContent = save.attempt.daily && !dailyRewardEligible(save, localDay()) ? '— ' : `+${tier.coins} `;
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
    const daily = Boolean(save.attempt.daily), payout = save.attempt.payout;
    $('#result-copy').textContent = won ? daily ? payout?.length ? 'Задание дня выполнено. Награда уже на вашем счёте.' : 'Тренировка завершена. Награда за эту дату уже получена или её день закончился.' : (deal.campaignLevel === CAMPAIGN_LENGTH ? 'Все 26 уровней пройдены. Любую раздачу можно сыграть ещё раз.' : 'Все категории этой раздачи собраны.') : 'Undo или продолжение сохранят серию. Рестарт кампании начнёт её заново.';
    const rewards = $('#result-rewards'); rewards.replaceChildren();
    const row = (label: string, value: string) => { const r = document.createElement('div'); r.className = 'reward-line'; const a = document.createElement('span'), b = document.createElement('strong'); a.textContent = label; b.textContent = value; r.append(a, b); rewards.append(r); };
    if (won) {
      if (payout) for (const reward of payout) row(reward.label, `+${reward.coins}${reward.hints ? ` · +${reward.hints} подсказка` : ''}${reward.undos ? ` · +${reward.undos} отмена` : ''}`);
      else if (!daily) row('За победу и оставшиеся ходы', `+${BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (save.attempt.board.movesLeft ?? 0)}`);
      if (save.attempt.streak.coins) row('Серии за партию · уже получено', String(save.attempt.streak.coins));
    }
    $('#result-meta').textContent = daily ? `Серия дней: ${save.meta!.dailyStreak}` : `Следующий цикл · ${save.meta!.winCycle} / 5 новых побед`;
    $('#result-rewards').hidden = !won;
    $('#result-undo').hidden = won || !save.profile.undos || !save.attempt.undo.length;
    $('#next-level').hidden = !won;
    $('#next-level').textContent = daily ? 'К заданиям и уровням' : deal.campaignLevel === CAMPAIGN_LENGTH ? 'К уровням' : `Уровень ${(deal.campaignLevel ?? 0) + 1} →`;
    $('#result-home').hidden = daily || deal.campaignLevel === CAMPAIGN_LENGTH;
    openDialog('#result');
    if (won && payout?.some(r => r.coins > 0)) coinBurst($('.result-star'));
  }
  async function execute(cmd: Command) {
    if (!alive || saving || screen !== 'game' || runtime.activity.isBlocked()) return false;
    let result: Result | undefined;
    let started = false, finished = false;
    try {
      await write(next => {
        result = dispatch(next, cmd, deal, localDay());
        Object.assign(next, result.next);
        if (result.accepted) {
          const t = next.attempt.telemetry ??= { started: false, finished: false, activeMs: 0 };
          t.activeMs = cmd.type === 'restart' ? 0 : telemetry.activeMs();
          if (['transfer', 'draw', 'recycle'].includes(cmd.type) && !t.started) { t.started = true; started = true; }
          if (next.attempt.board.phase !== 'playing' && !t.finished) { t.finished = true; finished = true; }
        }
      });
    } catch {
      message(store.needsRecovery ? 'Проверяем сохранение. Нажмите «Повторить сохранение».' : 'Не удалось сохранить ход. Попробуйте ещё раз.', true);
      scene?.cancel(); renderHud(); return false;
    }
    if (!result) return false;
    if (result.accepted) {
      if (started) { telemetry.track('level_start'); if (save.attempt.daily) telemetry.track('daily_start'); }
      if (cmd.type === 'restart') telemetry.track('level_restart');
      if (cmd.type === 'hint' || cmd.type === 'undo' || cmd.type === 'place-joker') telemetry.track('helper_used', { helper: cmd.type === 'place-joker' ? 'joker' : cmd.type });
      if (finished) telemetry.track(save.attempt.board.phase === 'won' ? 'level_win' : 'level_fail');
      for (const event of result.events) if ((event.type === 'coins' || event.type === 'meta-reward' || event.type === 'win' && !save.attempt.daily) && event.amount) telemetry.track('reward_granted', { reason: event.type === 'coins' ? 'core_streak' : event.type === 'meta-reward' ? event.reason! : 'level_win', amount: event.amount });
      if (result.events.some(e => e.type === 'meta-reward' && e.reason === 'daily_completion')) telemetry.track('daily_completion');
      if (cmd.type !== 'hint') activeHint = undefined;
      scene?.clearHint();
      const boardCommand = ['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined;
      scene?.sync(result.events, cmd.type === 'restart', boardCommand);
      const major = result.events.find(e => e.type === 'win') ?? result.events.find(e => e.type === 'unlock') ?? result.events.find(e => e.type === 'complete') ?? result.events.find(e => e.type === 'key') ?? result.events.find(e => e.type === 'coins') ?? result.events[0];
      if (major) {
        runtime.play(major.type);
        if (major.type === 'key' || major.type === 'unlock' || major.type === 'joker') runtime.pulse(major.type === 'key' ? 'coins' : major.type === 'unlock' ? 'complete' : 'hint');
        if (['transfer', 'complete', 'coins', 'win', 'undo', 'hint'].includes(major.type)) runtime.pulse(major.type as 'transfer' | 'complete' | 'coins' | 'win' | 'undo' | 'hint');
      }
      if (result.events.some(e => e.type === 'coins') && !result.events.some(e => e.type === 'win')) coinBurst();
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
    const result = await ads.show({ kind: 'rewarded', placement, attempt: requestAttempt, dealId: deal.id, mode: save.attempt.daily ? 'daily' : 'campaign' });
    // Dismissal itself grants nothing; receipt recovery independently commits an earned reward.
    serviceBusy = false; renderHud();
    if (!result.shown) message('Сейчас видео недоступно. Попробуйте позже.', true);
    if (save.attempt.board.phase === 'exhausted' && !runtime.activity.isBlocked()) outcome();
  }
  async function replay() {
    if (serviceBusy || saving) return;
    serviceBusy = true; closeDialogs();
    if (save.attempt.board.phase === 'won' && deal.campaignLevel !== undefined && interstitialEligible(save, deal.campaignLevel, 'campaign', Date.now(), launchedAt))
      await ads.show({ kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: deal.id, mode: save.attempt.daily ? 'daily' : 'campaign' });
    serviceBusy = false;
    if (!alive) return;
    // Dismissal and foreground are independent. Never continue behind a displayed ad.
    if (runtime.activity.isBlocked()) {
      const remove = runtime.activity.onBlockedChange(blocked => { if (!blocked) { remove(); if (alive) void execute({ type: 'restart', attemptId: crypto.randomUUID() }); } });
    } else await execute({ type: 'restart', attemptId: crypto.randomUUID() });
  }
  function renderHome() {
    renderMeta(save, !ready || saving || serviceBusy);
    const completed = completedLevels(save), unlocked = unlockedLevel(save), campaign = campaignAttempt(save), campaignDeal = campaign && findDeal(campaign.dealId), current = campaign?.board.phase === 'playing';
    $('#campaign-progress').textContent = `${completed} / ${CAMPAIGN_LENGTH}`;
    $('#campaign-done').hidden = completed < CAMPAIGN_LENGTH;
    const label = current ? (campaignDeal?.campaignLevel ? `${campaign?.telemetry?.started ? 'Продолжить' : 'Играть'} · уровень ${campaignDeal.campaignLevel}` : 'Продолжить пробную раздачу')
      : campaign && (!outcomeViewed || save.attempt.daily) ? (campaignDeal?.campaignLevel ? `Результат · уровень ${campaignDeal.campaignLevel}` : 'Результат пробной раздачи') : completed === CAMPAIGN_LENGTH ? 'Выбрать уровень' : `Играть · уровень ${unlocked}`;
    $('#home-play').replaceChildren(document.createTextNode(label), Object.assign(document.createElement('span'), { textContent: '↗' }));
    $<HTMLButtonElement>('#home-play').disabled = !ready || saving || serviceBusy;
    $('#home-status').textContent = current && campaign?.telemetry?.started ? 'Незаконченная раздача сохранена' : completed === 0 ? 'Начните с простых связей' : completed === CAMPAIGN_LENGTH ? 'Можно вернуться к любимым темам' : `Дальше — «${campaignDeals[unlocked - 1].title}»`;
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
  async function activateMode(mode: 'campaign' | 'daily', oldDaily = false) {
    if (!ready || saving || serviceBusy) return;
    const target = mode === 'daily' ? oldDaily && dailyAttempt(save) ? findDeal(dailyAttempt(save)!.dealId)! : dailyForDay(localDay()) : campaignAttempt(save) ? findDeal(campaignAttempt(save)!.dealId)! : campaignDeals[0];
    if (save.attempt.dealId === target.id) { closeDialogs(); showGame(); return; }
    closeDialogs(); serviceBusy = true; runtime.activity.setBlocked('level-transition', true);
    try {
      clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined; activeHint = undefined;
      clearTimeout(outcomeTimer); clearTimeout(guideTimer); setInspect(false);
      await write(next => switchMode(next, mode, target, crypto.randomUUID()));
      outcomeViewed = false; ready = false; $('#app').dataset.ready = 'false'; screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false; runtime.activity.setBlocked('screen', false);
      scene?.setDeal(deal); game?.loop.wake();
    } catch { message('Не удалось сохранить переход. Попробуйте ещё раз.', true); }
    finally { serviceBusy = false; if (ready) runtime.activity.setBlocked('level-transition', false); renderHud(); renderHome(); }
  }
  async function openLevel(level: number, confirmed = false) {
    if (!alive || !ready || saving || serviceBusy || level < 1 || level > unlockedLevel(save)) return;
    const target = campaignDeals[level - 1];
    const campaign = campaignAttempt(save);
    if (save.attempt.daily && campaign?.dealId === target.id && campaign.board.phase === 'playing') { await activateMode('campaign'); return; }
    if (target.id === deal.id && save.attempt.board.phase === 'playing') { closeDialogs(); showGame(); return; }
    if (!confirmed && campaign?.board.phase === 'playing' && campaign.telemetry?.started) {
      requestedLevel = level; $('#switch-title').textContent = `Начать уровень ${level}?`; openDialog('#switch-level'); return;
    }
    closeDialogs(); serviceBusy = true; renderHome();
    // Only the deliberate transition from a won level can request an interstitial.
    if (screen === 'game' && save.attempt.board.phase === 'won' && deal.campaignLevel !== undefined && interstitialEligible(save, deal.campaignLevel, 'campaign', Date.now(), launchedAt))
      await ads.show({ kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: deal.id, mode: save.attempt.daily ? 'daily' : 'campaign' });
    const enter = async () => {
      removeForeground?.(); removeForeground = undefined;
      runtime.activity.setBlocked('level-transition', true);
      try {
        clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined;
        clearTimeout(outcomeTimer); clearTimeout(guideTimer); activeHint = undefined; setInspect(false);
        await write(next => { if (next.attempt.daily) switchMode(next, 'campaign', campaign ? findDeal(campaign.dealId)! : target, crypto.randomUUID()); beginDeal(next, target, crypto.randomUUID()); });
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
  scene = new BoardScene({ jokerMode: active => $('#joker').setAttribute('aria-pressed', String(active)), deal, getSave: () => save, command: execute, sound: name => runtime.play(name),
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
        ready = true; resizeToRoot(); runtime.activity.setBlocked('level-transition', false); telemetry.ready(); setInput(); updateBanner(); renderHud(); renderHome(); $('#loading').hidden = true; $('#app').dataset.ready = 'true'; $('#app').dataset.presentedDeal = deal.id;
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
    if (save.attempt.daily) { void activateMode('campaign'); return; }
    if (save.attempt.board.phase === 'playing' || !outcomeViewed) showGame();
    else if (completedLevels(save) === CAMPAIGN_LENGTH) $('#level-grid').scrollIntoView({ block: 'nearest' });
    else void openLevel(unlockedLevel(save));
  }, domOptions);
  $('#daily-play').addEventListener('click', () => { void activateMode('daily'); }, domOptions);
  $('#daily-resume-old').addEventListener('click', () => { void activateMode('daily', true); }, domOptions);
  for (const [button, dialog] of [['calendar-open', '#calendar'], ['appearance-open', '#appearance'], ['appearance-settings', '#appearance'], ['win-cycle-open', '#cycle-info']]) $(`#${button}`).addEventListener('click', () => { renderMeta(save, saving); openDialog(dialog); }, domOptions);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-palette], [data-card-back], [data-deck-side]')) button.addEventListener('click', async () => {
    const key = button.dataset.palette ? 'palette' : button.dataset.cardBack ? 'cardBack' : 'deckSide';
    if (saving || button.disabled) return;
    try { await write(next => {
      if (key === 'palette' && ['green', 'ink'].includes(button.dataset.palette!) && (button.dataset.palette === 'green' || cosmeticUnlocked(next, key))) next.settings.palette = button.dataset.palette as 'green' | 'ink';
      if (key === 'cardBack' && ['classic', 'diamonds'].includes(button.dataset.cardBack!) && (button.dataset.cardBack === 'classic' || cosmeticUnlocked(next, key))) next.settings.cardBack = button.dataset.cardBack as 'classic' | 'diamonds';
      if (key === 'deckSide' && ['left', 'right'].includes(button.dataset.deckSide!)) next.settings.deckSide = button.dataset.deckSide as 'left' | 'right';
    }); scene?.sync(); game?.loop.wake(); } catch { message('Оформление не сохранилось. Попробуйте ещё раз.', true); }
  }, domOptions);
  $('#level-grid').addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-level]');
    if (button && !button.disabled) void openLevel(Number(button.dataset.level));
  }, domOptions);
  $('#next-level').addEventListener('click', () => { if (save.attempt.daily || deal.campaignLevel === CAMPAIGN_LENGTH) goHome(); else void openLevel((deal.campaignLevel ?? 0) + 1); }, domOptions);
  $('#result-home').addEventListener('click', goHome, domOptions);
  $('#levels-open').addEventListener('click', goHome, domOptions);
  $('#switch-confirm').addEventListener('click', () => { const level = requestedLevel; requestedLevel = undefined; if (level) void openLevel(level, true); }, domOptions);
  $('#menu').addEventListener('click', () => { runtime.play('ui'); openDialog('#settings'); }, domOptions);
  $('#joker').addEventListener('click', () => {
    if (!save.profile.jokers) { openDialog('#helpers'); return; }
    const active = $('#joker').getAttribute('aria-pressed') !== 'true'; setInspect(false); scene?.setJoker(active);
    message(active ? 'Выберите непустой открытый столбец. Повторное нажатие отменит выбор.' : 'Выбор Джокера отменён — заряд сохранён');
  }, domOptions);
  $('#buy-joker').addEventListener('click', async () => {
    if (serviceBusy || saving || !helperUnlocked(save, 'joker', deal)) return;
    try { if (await write(next => purchaseHelper(next, 'joker'))) { telemetry.track('helper_purchase', { helper: 'joker', cost: BALANCE.helperPrices.joker }); runtime.play('ui'); } }
    catch { message('Не удалось сохранить покупку. Попробуйте ещё раз.', true); }
    renderHud();
  }, domOptions);
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
  const dayRefresh = setInterval(() => { if (alive && ready) { renderHome(); if (screen === 'game' && save.attempt.daily) renderHud(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderHome(); }, domOptions);
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
    telemetry.track('session_end'); clearInterval(checkpoint); clearInterval(dayRefresh); clearTimeout(guideTimer); removeForeground?.(); banner?.destroy(); ads.destroy(); telemetry.destroy();
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
