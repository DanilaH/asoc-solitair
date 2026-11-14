import Phaser from 'phaser';
import { getBackingStoreSize, getRenderPixelRatio } from '@danilah/mini-games-kit/core';
import { destroyRenderer } from '@danilah/mini-games-kit/phaser';
import { installTouchActivation } from '@danilah/mini-games-kit/feel';
import { campaignDeals, findDeal } from './content/campaign';
import { CAMPAIGN_LENGTH, completedLevels, unlockedLevel, helperUnlocked, freeHintDemo, markTutorial } from './domain/progression';
import { beginDeal } from './domain/campaign';
import { dailyForDay } from './content/daily';
import { switchMode } from './domain/sessions';
import { cosmeticUnlocked, currentDailyStreak, dailyRewardEligible, localDay } from './domain/meta';
import { renderMeta, campaignAttempt, dailyAttempt } from './app/meta-ui';
import { lesson, recordLearning, ruleIntroduction, type RuleIntro } from './app/tutorial';
import { boardKey, boardRules, dispatch, freshSave, STREAK } from './domain/engine';
import { BALANCE } from './domain/balance';
import type { BoardCommand, Command } from './domain/types';
import { WIDTH, boardFrame } from './game/layout';
import { cardArtwork } from './game/art';
import { categoryCaption } from './game/captions';
import { cardReader } from './game/card-reader';
import type { HintRequest, HintResponse } from './domain/hint';
import { BoardScene } from './game/BoardScene';
import { createRuntime } from './platform/runtime';
import { SaveStore, createStorage } from './platform/storage';
import { createTelemetry } from './platform/telemetry';
import { createAds } from './platform/ads';
import { NativeBanner } from './platform/banner';
import { applyReceipt, platformState, purchaseHelper, interstitialEligible, useContinue, type RewardPlacement } from './domain/services';
import type { Save, Result } from './domain/types';
import './style.css';
import './art.css';

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
let praiseAnimation: Animation | undefined;
let inspectMode = false;
let dismissRule: (() => void) | undefined;
let alive = true;
let ready = false;
const abort = new AbortController();
const domOptions = { signal: abort.signal };
const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const runtime = createRuntime(() => { scene?.cancel(); }, () => {
  if (runtime.activity.getBlockReasons().some(r => r !== 'modal' && r !== 'screen')) return;
  if ($<HTMLDialogElement>('#learn-rule').open) { dismissRule?.(); return; }
  if (screen === 'game' && scene?.back()) return;
  if (dialogs.some(d => d.open)) closeDialogs();
  else if (inspectMode) setInspect(false);
  else openDialog('#settings');
});

let coinPresentation = 0;
function cancelCoins() {
  coinPresentation++;
  $('#coin-layer').getAnimations({ subtree: true }).forEach(a => a.cancel());
}
function closeDialogs() {
  // Discard presentation before its top-layer owner closes. Never carry coins to another screen.
  cancelCoins();
  document.body.append($('#coin-layer')); dialogs.forEach(d => d.close()); runtime.activity.setBlocked('modal', false);
}
function openDialog(selector: string) { peekCard(null); clearPraise(); scene?.clearFeedback(); closeDialogs(); scene?.cancel(); runtime.activity.setBlocked('modal', true); $<HTMLDialogElement>(selector).showModal(); }
let peeked: string | null = null;
function peekCard(id: string | null) {
  if (peeked === id) return;
  peeked = id; const panel = $('#inspect-peek'); panel.hidden = !id;
  $('#inspect').dataset.peeking = String(Boolean(id));
  if (!id) return;
  const card = deal.cards[id], content = cardReader(card, deal), image = $<HTMLImageElement>('#peek-image');
  $('#peek-title').textContent = content.title; $('#peek-description').textContent = content.description ?? '';
  const artwork = cardArtwork(card, deal);
  $('#peek-description').hidden = !content.description; image.hidden = !artwork;
  if (artwork) { image.src = artwork; image.alt = card.text; } else image.removeAttribute('src');
  const zone = $('#inspect').getBoundingClientRect();
  panel.style.left = `${Math.max(10, Math.min(innerWidth - Math.min(280, innerWidth - 20) - 10, zone.right + 9))}px`;
  panel.style.top = `${Math.min(innerHeight - 230, Math.max(10, zone.bottom + 10))}px`;
}
function clearPraise() {
  if (praiseAnimation) { praiseAnimation.onfinish = null; praiseAnimation.cancel(); praiseAnimation = undefined; }
  $('#praise').hidden = true; $('#feedback-row').dataset.praising = 'false';
}
function showPraise(text: string) {
  clearPraise(); if (!text) return;
  $('#praise strong').textContent = text; $('#praise').hidden = false; $('#feedback-row').dataset.praising = 'true';
  const reduced = document.documentElement.dataset.reduced === 'true';
  praiseAnimation = $('#praise').animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
    { opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none', offset: .15 },
    { opacity: 1, offset: .78 }, { opacity: 0, transform: 'scale(.98)' },
  ], { duration: reduced ? 450 : 900, fill: 'both' });
  praiseAnimation.onfinish = clearPraise;
}
function positionDeckTools() {
  const rect = $('#game-root').getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const tools = $('.deck-tools'), app = $('#app');
  const frame = boardFrame(rect.width, rect.height, app.dataset.deckRow as 'top' | 'bottom', deal);
  const right = app.dataset.deckRow === 'bottom' || app.dataset.deckEdge === 'left';
  tools.style.transform = `scale(${frame.unit})`; tools.style.top = `${20 * frame.unit}px`;
  tools.style.left = right ? 'auto' : `${frame.offsetX}px`; tools.style.right = right ? `${rect.width - frame.offsetX - WIDTH * frame.unit}px` : 'auto';
}
function message(text: string, error = false) {
  if (error) clearPraise();
  clearTimeout(messageTimer); $('#message').textContent = text; $('#message').classList.toggle('error', error);
  if (text) messageTimer = setTimeout(() => message(''), error ? 2500 : 1800);
}
function setInspect(value: boolean) { inspectMode = value; $('#inspect').setAttribute('aria-pressed', String(value)); scene?.setInspect(value); message(''); }

async function start() {
try {
  runtime.activity.setBlocked('screen', true);
  let firstLaunch = false;
  const store = new SaveStore(createStorage(), findDeal, () => {
    firstLaunch = true;
    const initial = freshSave(deal, crypto.randomUUID());
    initial.settings.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return initial;
  });
  await document.fonts.load('800 20px Nunito').catch(() => []);
  let save = await store.open();
  let dealEntryPending = firstLaunch;
  deal = findDeal(save.attempt.dealId)!;
  let requestedLevel: number | undefined;
  let activeRule: RuleIntro | undefined;
  let unlockChoice: 'palette' | 'cardBack' | undefined;
  const dismissedRules = new Set<RuleIntro>();
  let outcomeViewed = false;
  let chapterPage = 0, chapterAttemptId = '';
  const training = () => Boolean(save.attempt.daily && save.attempt.board.phase !== 'won' && !dailyRewardEligible(save, localDay()));
  let removeForeground: (() => void) | undefined;
  let saving = false, serviceBusy = false;
  // A backing-store resize clears the canvas even when the model is static.
  // Keep a bounded repaint tail instead of sleeping in that POST_RENDER turn.
  let repaintFrames = 0;
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
    finally {
      saving = --pendingWrites > 0; setInput(); renderHud(); renderHome();
      if (!saving && ready && screen === 'game' && !runtime.activity.isBlocked()) showGuidance();
    }
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
  let helperFocus: 'hint' | 'undo' | 'joker' | undefined;
  function openHelpers(focus?: typeof helperFocus) { helperFocus = focus; renderHud(); openDialog('#helpers'); }
  function helperBought(helper: NonNullable<typeof helperFocus>) {
    if (helperFocus !== helper || screen !== 'game') return;
    closeDialogs();
    if (save.attempt.board.phase === 'exhausted') outcome();
    else { const button = $(`#${helper}`); button.classList.remove('bump'); void button.offsetWidth; button.classList.add('bump'); }
  }
  let activeHint: { key: string; action: BoardCommand } | undefined;
  let hintSequence = 0;
  let pendingHint: Pick<HintRequest, 'requestId' | 'revision' | 'attemptId'> & { dealId: string } | undefined;

  runtime.setMute(!save.settings.sfx); runtime.setHaptics(save.settings.haptics);
  const coins = Array.from({ length: 24 }, () => { const node = document.createElement('span'); node.className = 'flying-coin'; $('#coin-layer').append(node); return { node, busy: false, animation: null as Animation | null }; });
  function coinBurst(origin = $('#streak-reward'), destination = $('.coin-icon'), resultRoute = false) {
    if (save.settings.reducedMotion || new URLSearchParams(location.search).get('fxCoins') === '0') return;
    const source = origin.getBoundingClientRect(), target = destination.getBoundingClientRect();
    const lane = $('#result').getBoundingClientRect().right - 14;
    for (let i = 0; i < 8; i++) {
      const coin = coins.find(c => !c.busy); if (!coin) break;
      coin.busy = true; coin.node.style.display = 'block';
      // A short unlock result omits its decorative emblem. Start beside its
      // heading instead of using the hidden element's (0,0) rectangle.
      const sx = resultRoute && !source.width ? lane - 10 : source.x + source.width / 2 - 10;
      const sy = resultRoute && !source.width ? $('#result-title').getBoundingClientRect().bottom + 5 : source.y + source.height / 2 - 10;
      const tx = target.x + target.width / 2 - 10, ty = target.y + target.height / 2 - 10;
      // On the result, travel in the paper's right gutter, never through the title,
      // amount or CTA. The landing is beside the already-owned total, not on its digits.
      const frames = resultRoute ? [
        { transform: `translate(${sx}px,${sy}px) scale(.5)`, opacity: 0 },
        { transform: `translate(${lane - 10}px,${sy}px) scale(.8)`, opacity: 1, offset: .3 },
        { transform: `translate(${lane - 10}px,${ty}px) scale(.8)`, opacity: 1, offset: .85 },
        { transform: `translate(${lane - 10}px,${ty}px) scale(.35)`, opacity: 0 },
      ] : [{ transform: `translate(${sx}px,${sy}px) scale(.5)`, opacity: 0 },
        { transform: `translate(${sx + (i - 3.5) * 10}px,${sy - 35 - i % 3 * 8}px) scale(1)`, opacity: 1, offset: .27 },
        { transform: `translate(${tx}px,${ty}px) scale(.8)`, opacity: 1 }];
      coin.animation = coin.node.animate(frames, { duration: 550, delay: i * 23, easing: 'ease-in-out' });
      coin.animation.oncancel = () => { coin.busy = false; coin.node.style.display = 'none'; };
      coin.animation.onfinish = () => { coin.busy = false; coin.node.style.display = 'none'; const receiver = destination.closest('.wallet') ?? destination; receiver.classList.remove('bump'); void (receiver as HTMLElement).offsetWidth; receiver.classList.add('bump'); };
    }
  }
  function renderHud() {
    $('#app').dataset.screen = screen;
    $('#game-surface').hidden = screen !== 'game';
    document.documentElement.dataset.reduced = String(save.settings.reducedMotion);
    const board = save.attempt.board;
    $('#app').dataset.practice = String(training());
    $('#level-number').textContent = deal.daily ? `${training() ? 'ТРЕНИРОВКА' : 'ЗАДАНИЕ'} · ${deal.daily.dayId}` : deal.campaignLevel ? `УРОВЕНЬ ${deal.campaignLevel}` : 'ПРОБНАЯ РАЗДАЧА';
    $('.level h1').textContent = deal.title;
    const hintUnlocked = helperUnlocked(save, 'hint', deal), undoUnlocked = helperUnlocked(save, 'undo', deal);
    $('#hint').hidden = !hintUnlocked; $('#undo').hidden = !undoUnlocked;
    $('#hint-offer').hidden = !hintUnlocked || Boolean(helperFocus && helperFocus !== 'hint'); $('#undo-offer').hidden = !undoUnlocked || Boolean(helperFocus && helperFocus !== 'undo');
    const jokerUnlocked = helperUnlocked(save, 'joker', deal);
    $('#joker').hidden = !jokerUnlocked; $('#joker-offer').hidden = !jokerUnlocked || Boolean(helperFocus && helperFocus !== 'joker');
    $('#joker-count').textContent = String(save.profile.jokers); $('#joker-stock').textContent = String(save.profile.jokers);
    $<HTMLButtonElement>('#joker').disabled = board.phase !== 'playing' || Boolean(save.attempt.jokerUsed) || saving;
    $<HTMLButtonElement>('#buy-joker').disabled = serviceBusy || saving || save.profile.coins < BALANCE.helperPrices.joker;
    $('#joker').classList.toggle('attention', lesson(save, deal)?.attention === 'joker');
    $<HTMLButtonElement>('#wallet-open').disabled = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
    $('.wallet-plus').hidden = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
    $('#helpers-open').hidden = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
    $('#helper-locked').hidden = hintUnlocked || undoUnlocked || jokerUnlocked;
    $('#restart').hidden = screen === 'home'; $('#levels-open').hidden = screen === 'home';
    $('#settings-done').textContent = screen === 'home' ? 'Готово' : 'Продолжить';
    $('#pause-title').textContent = screen === 'home' || $<HTMLDetailsElement>('#pause-options').open ? 'Настройки' : 'Пауза';
    $('#pause-level').textContent = screen === 'home' ? 'СОЛИТЁР АССОЦИАЦИЙ' : $('#level-number').textContent;
    const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
    $('#app').dataset.deckEdge = hasDeck ? save.settings.deckSide ?? 'right' : 'right';
    $('#app').dataset.deckRow = hasDeck ? save.settings.deckPosition ?? 'top' : 'top';
    positionDeckTools();
    const instruction = lesson(save, deal);
    $('#hint').classList.toggle('attention', instruction?.attention === 'hint');
    $('#undo').classList.toggle('attention', instruction?.attention === 'undo');
    $('#coins').textContent = save.profile.coins < 100000 ? String(save.profile.coins) : new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(save.profile.coins);
    $('#wallet-open').setAttribute('aria-label', `${save.profile.coins} монет. Монеты и помощники`);
    $('#moves').textContent = board.movesLeft === null ? '∞' : String(board.movesLeft);
    $('#move-fill').style.width = `${100 * (board.movesLeft ?? 1) / (deal.initial.movesLeft ?? 1)}%`;
    const replayHint = activeHint?.key === boardKey(board);
    const searching = Boolean(pendingHint);
    $('#hint-label').textContent = searching ? 'Ищу…' : replayHint ? 'Повторить' : 'Подсказка';
    $('#hint-count').hidden = replayHint;
    $('#hint').setAttribute('aria-busy', String(searching));
    $('#hint').setAttribute('aria-label', searching ? 'Ищу подсказку' : replayHint ? 'Повторить подсказку бесплатно' : 'Подсказка');
    $('#hint-count').textContent = String(save.profile.hints); $('#undo-count').textContent = String(save.profile.undos);
    $<HTMLButtonElement>('#hint').disabled = board.phase !== 'playing' || Boolean(workerDeadline) || saving;
    $<HTMLButtonElement>('#undo').disabled = board.phase === 'won' || !save.attempt.undo.length || saving;
    const tier = STREAK[save.attempt.streak.tier];
    const streak = $('#streak');
    if (streak.children.length !== tier.count) streak.replaceChildren(...Array.from({ length: tier.count }, () => document.createElement('i')));
    [...streak.children].forEach((cell, index) => {
      const filled = index < save.attempt.streak.progress;
      if (filled && !cell.classList.contains('filled') && !save.settings.reducedMotion) cell.animate([{ transform: 'scale(.8)' }, { transform: 'translateY(-2px) scale(1.2)', offset: .55 }, { transform: 'translateY(-1px) scale(1)' }], { duration: 240 });
      cell.classList.toggle('filled', filled);
    });
    $('#streak').setAttribute('aria-label', `${save.attempt.streak.progress} из ${tier.count}`);
    $('#streak-reward').firstChild!.textContent = save.attempt.daily && !dailyRewardEligible(save, localDay()) ? '— ' : `+${tier.coins} `;
    $<HTMLInputElement>('#sfx').checked = save.settings.sfx;
    $<HTMLInputElement>('#reduced').checked = save.settings.reducedMotion;
    $<HTMLInputElement>('#haptics').checked = save.settings.haptics;
    $('#helper-title').textContent = helperFocus ? { hint: 'Подсказка', undo: 'Отмена', joker: 'Джокер' }[helperFocus] : 'Помощники';
    $('#helpers').dataset.focus = helperFocus ?? 'all';
    for (const helper of ['hint', 'undo', 'joker']) $(`#buy-${helper}`).className = helperFocus === helper ? 'primary' : 'secondary';
    $('#helper-return').textContent = screen === 'home' ? 'Готово' : 'К игре';
    $('#appearance-done').textContent = screen === 'home' ? 'Готово' : 'К игре';
    $('#joker-next-attempt').hidden = !save.attempt.jokerUsed || !jokerUnlocked || Boolean(helperFocus && helperFocus !== 'joker');
    $('#helper-wallet').textContent = `${save.profile.coins} монет`;
    $('#hint-stock').textContent = String(save.profile.hints); $('#undo-stock').textContent = String(save.profile.undos);
    for (const helper of ['hint', 'undo'] as const) {
      $<HTMLButtonElement>(`#buy-${helper}`).disabled = serviceBusy || saving || save.profile.coins < BALANCE.helperPrices[helper];
      $<HTMLButtonElement>(`#video-${helper}`).disabled = serviceBusy || !ads.status.rewarded;
      $(`#video-${helper}`).hidden = !ads.status.rewarded;
    }
    const canContinue = board.phase === 'exhausted' && !save.attempt.continued && (platformState(structuredClone(save)).continueCredits > 0 || ads.status.rewarded);
    $('#result-continue').hidden = !canContinue;
    const undoRecovery = board.phase === 'exhausted' && save.attempt.undo.length > 0 && (save.profile.undos > 0 || save.profile.coins >= BALANCE.helperPrices.undo || ads.status.rewarded);
    $('#result-continue').className = 'primary';
    $('#result-undo').className = !canContinue && undoRecovery ? 'primary' : 'secondary';
    $('#replay').className = board.phase === 'exhausted' && !canContinue && !undoRecovery ? 'primary' : 'secondary';
    $<HTMLButtonElement>('#result-continue').disabled = serviceBusy || (!platformState(structuredClone(save)).continueCredits && !ads.status.rewarded);
    $('#result-continue').textContent = platformState(structuredClone(save)).continueCredits > 0 ? '+10 ходов · использовать запас' : '+10 ходов · видео';
    const applied = unlockChoice === 'palette' ? save.settings.palette === 'ink' : save.settings.cardBack === 'diamonds';
    $('#apply-unlock').textContent = applied ? 'Применено' : 'Примерить';
    $<HTMLButtonElement>('#apply-unlock').disabled = !unlockChoice || applied || saving || serviceBusy;
    $('#save-retry').hidden = !store.needsRecovery;
  }
  function outcome() {
    if (save.attempt.board.phase === 'playing') return;
    // A local result coin layer must join the dialog's top layer to stay visible.
    $('#result').dataset.won = String(save.attempt.board.phase === 'won');
    const won = save.attempt.board.phase === 'won';
    outcomeViewed = true;
    $('#result-title').textContent = won ? 'Всё сошлось!' : 'Ходы закончились';
    const daily = Boolean(save.attempt.daily), payout = save.attempt.payout;
    $('#result-copy').textContent = won ? daily ? payout?.length ? 'Задание дня выполнено. Награда уже на вашем счёте.' : 'Тренировка завершена. Награда за эту дату уже получена или её день закончился.' : (deal.campaignLevel === CAMPAIGN_LENGTH ? `Все ${CAMPAIGN_LENGTH} уровней пройдены. Любую раздачу можно сыграть ещё раз.` : '') : '';
    const cycleReward = payout?.find(r => r.reason === 'campaign_win_cycle');
    $('#result-bonus').hidden = !won || !cycleReward;
    $('#result-bonus-copy').textContent = cycleReward ? `Получено: +${cycleReward.coins} монет${cycleReward.hints ? ` и +${cycleReward.hints} подсказка` : ''}` : '';
    $('#result-meta').textContent = daily ? `Серия дней · ${currentDailyStreak(save, localDay())}` : `Новый цикл · ${save.meta!.winCycle} / 5`;
    $('#result-meta').hidden = !won || !daily && !payout?.some(r => r.reason === 'campaign_win_cycle');
    $('#replay').textContent = daily && won ? 'Сыграть как тренировку' : 'Ещё раз';
    const earned = (payout ? payout.reduce((sum, r) => sum + r.coins, 0) : !daily ? BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (save.attempt.board.movesLeft ?? 0) : 0) + save.attempt.streak.coins;
    $('#result-total').textContent = `+${earned}`; $('#result-earnings').hidden = !won || earned === 0;
    unlockChoice = payout?.some(r => r.key === 'milestone:20') ? 'cardBack' : payout?.some(r => r.key === 'milestone:10') ? 'palette' : undefined;
    $('#unlock-reward').hidden = !won || !unlockChoice;
    $('#unlock-title').textContent = unlockChoice === 'palette' ? 'Открыт стол «Чернила»' : 'Открыта рубашка «Ромбы»';
    $('#unlock-preview').dataset.palette = unlockChoice === 'palette' ? 'ink' : save.settings.palette ?? 'green';
    $('#unlock-preview').dataset.back = unlockChoice === 'cardBack' ? 'diamonds' : save.settings.cardBack ?? 'classic';
    renderHud();
    $('#result-undo').hidden = won || !save.attempt.undo.length;
    $('#result-undo').textContent = save.profile.undos ? 'Отменить последний ход' : 'Получить отмену';
    $('#next-level').hidden = !won;
    $('#next-level').textContent = daily ? 'К заданиям и уровням' : deal.campaignLevel === CAMPAIGN_LENGTH ? 'К уровням' : `Уровень ${(deal.campaignLevel ?? 0) + 1} →`;
    $('#result-home').hidden = daily || deal.campaignLevel === CAMPAIGN_LENGTH;
    openDialog('#result');
    if (won && payout?.some(r => r.coins > 0)) {
      $('#result').append($('#coin-layer'));
      const attemptId = save.attempt.id, presentation = coinPresentation;
      // Wait for the actual panel entrance, not a wall-clock guess: a transformed
      // dialog temporarily changes the fixed layer's coordinate system.
      void Promise.allSettled($('#result').getAnimations().map(a => a.finished)).then(() => {
        if (alive && presentation === coinPresentation && save.attempt.id === attemptId && $<HTMLDialogElement>('#result').open && !runtime.activity.getBlockReasons().some(r => r !== 'modal')) coinBurst($('.result-star'), $('#result-total'), true);
      });
    }
  }
  async function execute(cmd: Command) {
    if (!alive || saving || screen !== 'game' || runtime.activity.isBlocked()) return false;
    let result: Result | undefined;
    let started = false, finished = false;
    try {
      await write(next => {
        const beforeBoard = next.attempt.board;
        result = dispatch(next, cmd, deal, localDay());
        Object.assign(next, result.next);
        if (result.accepted) {
          if (['transfer', 'draw', 'recycle'].includes(cmd.type)) recordLearning(next, beforeBoard, cmd as BoardCommand, deal);
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
      const major = result.events.find(e => e.type === 'win') ?? result.events.find(e => e.type === 'unlock') ?? result.events.find(e => e.type === 'complete') ?? result.events.find(e => e.type === 'key') ?? result.events.find(e => e.type === 'coins') ?? result.events[0];
      const hasCoinFlight = result.events.some(e => e.type === 'coins') && !result.events.some(e => e.type === 'win');
      // The save/grant is already durable. Only optional sound/haptics/coins
      // follow the visible contact and may be dropped when superseded.
      const present = () => {
        if (major) {
          runtime.play(major.type);
          if (major.type === 'key' || major.type === 'unlock' || major.type === 'joker') runtime.pulse(major.type === 'key' ? 'coins' : major.type === 'unlock' ? 'complete' : 'hint');
          if (['transfer', 'complete', 'coins', 'win', 'undo', 'hint'].includes(major.type)) runtime.pulse(major.type as 'transfer' | 'complete' | 'coins' | 'win' | 'undo' | 'hint');
        }
        if (hasCoinFlight) coinBurst();
      };
      scene?.sync(result.events, cmd.type === 'restart', boardCommand, cmd.type === 'transfer' && major ? { kind: major.type, play: present } : undefined);
      if (cmd.type !== 'transfer') present();
      if (save.attempt.board.phase !== 'playing') {
        clearTimeout(outcomeTimer); outcomeTimer = setTimeout(outcome, save.attempt.board.phase === 'won' ? 880 : save.settings.reducedMotion ? 100 : 380);
      }
    } else {
      scene?.cancel(); scene?.reject(['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined); runtime.play('invalid'); runtime.pulse('invalid');
      telemetry.track('move_rejected', { reason: result.reason ?? 'unknown' }); message(result.reason ?? 'Сюда не подходит', true);
    }
    renderHud();
    if (save.attempt.board.phase === 'playing') showGuidance(cmd.type !== 'hint');
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
    const parts = label.split(' · ');
    $('#home-play').replaceChildren(document.createTextNode(parts[0]), Object.assign(document.createElement('small'), { textContent: parts[1] ?? 'Кампания' }));
    $<HTMLButtonElement>('#home-play').disabled = !ready || saving || serviceBusy;
    const focusId = campaign?.id ?? 'new';
    if (chapterAttemptId !== focusId) { chapterAttemptId = focusId; chapterPage = Math.floor(((campaignDeal?.campaignLevel ?? unlocked) - 1) / 20); }
    $('#chapter-label').textContent = `Уровни ${chapterPage * 20 + 1}–${Math.min(CAMPAIGN_LENGTH, chapterPage * 20 + 20)}`;
    $('#chapter-name').textContent = ['Первые связи', 'Правила и новые темы', 'По своим местам', 'Последние ключи'][chapterPage];
    $<HTMLButtonElement>('#chapter-prev').disabled = chapterPage === 0 || saving;
    $<HTMLButtonElement>('#chapter-next').disabled = chapterPage === Math.ceil(CAMPAIGN_LENGTH / 20) - 1 || saving;
    const grid = $('#level-grid');
    if (!grid.children.length) for (const level of campaignDeals) {
      const button = document.createElement('button'); button.className = 'level-button'; button.dataset.level = String(level.campaignLevel); button.id = `level-${level.campaignLevel}`; grid.append(button);
    }
    for (const button of grid.querySelectorAll<HTMLButtonElement>('button')) {
      const level = Number(button.dataset.level), item = campaignDeals[level - 1], done = save.platform?.completedCampaign.includes(item.id) ?? false;
      button.hidden = Math.floor((level - 1) / 20) !== chapterPage;
      button.textContent = String(level); button.disabled = level > unlocked || !ready || saving || serviceBusy;
      button.dataset.active = String(current && campaign?.dealId === item.id);
      button.setAttribute('aria-current', current && campaign?.dealId === item.id ? 'step' : 'false');
      button.dataset.completed = String(done); button.dataset.next = String(level === unlocked && !done);
      button.setAttribute('aria-label', `Уровень ${level}: ${item.title}${done ? ', пройден' : level > unlocked ? ', закрыт' : ''}`);
    }
  }
  function maybeIntroduceRule(): boolean {
    const intro = ruleIntroduction(save, deal);
    if (!intro || dismissedRules.has(intro) || activeRule || !ready || saving || inspectMode || screen !== 'game' || runtime.activity.isBlocked()) return false;
    activeRule = intro;
    $('#learn-rule').dataset.rule = intro;
    $('#learn-title').textContent = { joker: 'Джокер', ordered: 'По порядку', keys: 'Три ключа' }[intro];
    $('#learn-copy').textContent = {
      joker: 'Временное место для одной группы. Один раз за раздачу. Можно пройти и без Джокера.',
      ordered: 'Соединяйте соседние номера без пропусков. К категории добавляйте по порядку, начиная с первого.',
      keys: 'Открывайте карты с ключами. Три найденных ключа снимут замок со столбца.',
    }[intro];
    openDialog('#learn-rule'); return true;
  }
  dismissRule = () => { void (async () => {
    const intro = activeRule; if (!intro) return;
    activeRule = undefined; dismissedRules.add(intro);
    try { await write(next => markTutorial(next, `intro:${intro}`)); } catch { /* Presentation can be dismissed; SaveStore keeps recovery ownership. */ }
    closeDialogs(); showGuidance();
  })(); };
  document.querySelectorAll('[data-lesson-close]').forEach(button => button.addEventListener('click', () => dismissRule?.(), domOptions));
  function showGuidance(animate = true, idle = false) {
    clearTimeout(guideTimer);
    if (maybeIntroduceRule()) return;
    const instruction = lesson(save, deal);
    if (animate && instruction?.action && !inspectMode) {
      const attemptId = save.attempt.id, revision = save.revision;
      guideTimer = setTimeout(() => {
        if (alive && screen === 'game' && !runtime.activity.isBlocked() && save.attempt.id === attemptId && save.revision === revision) {
          game?.loop.wake(); scene?.teach(instruction.action!);
        }
      }, idle ? 6000 : instruction.delay ?? 650);
    }
  }
  function showGame() {
    clearPraise(); message(''); screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false;
    runtime.activity.setBlocked('screen', false); renderHud();
    repaintFrames = Math.max(repaintFrames, 2); resizeToRoot(); game?.loop.wake(); scene?.sync(); showGuidance();
    if (save.attempt.board.phase !== 'playing') outcome();
  }
  function goHome() {
    clearPraise(); clearTimeout(outcomeTimer); clearTimeout(guideTimer); setInspect(false); closeDialogs();
    screen = 'home'; runtime.activity.setBlocked('screen', true); $('#play-screen').hidden = true; $('#home').hidden = false;
    renderHud(); renderHome(); updateBanner();
  }
  async function activateMode(mode: 'campaign' | 'daily', oldDaily = false, replaceConfirmed = false) {
    if (!ready || saving || serviceBusy) return;
    const target = mode === 'daily' ? oldDaily && dailyAttempt(save) ? findDeal(dailyAttempt(save)!.dealId)! : dailyForDay(localDay()) : campaignAttempt(save) ? findDeal(campaignAttempt(save)!.dealId)! : campaignDeals[0];
    const previousDaily = dailyAttempt(save);
    const previousTarget = mode === 'daily' ? previousDaily : campaignAttempt(save);
    if (mode === 'daily' && !oldDaily && !replaceConfirmed && previousDaily?.daily?.dayId !== target.daily?.dayId && previousDaily?.board.phase === 'playing' && previousDaily.telemetry?.started) { openDialog('#replace-daily'); return; }
    if (save.attempt.dealId === target.id) { closeDialogs(); showGame(); return; }
    closeDialogs(); serviceBusy = true; runtime.activity.setBlocked('level-transition', true);
    try {
      clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined; activeHint = undefined;
      clearTimeout(outcomeTimer); clearTimeout(guideTimer); setInspect(false);
      await write(next => switchMode(next, mode, target, crypto.randomUUID()));
      dealEntryPending = !previousTarget || previousTarget.id !== save.attempt.id;
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
        dealEntryPending = true;
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
    const rect = { width: innerWidth, height: innerHeight }, ratio = getRenderPixelRatio(2);
    return { rect, backing: getBackingStoreSize(Math.max(1, rect.width), Math.max(1, rect.height), ratio) };
  }
  const initial = size();
  scene = new BoardScene({ jokerMode: active => $('#joker').setAttribute('aria-pressed', String(active)), deal, getSave: () => save, command: execute, praise: showPraise, sound: name => runtime.play(name),
    inputRoot: () => root, readerZone: () => $('#inspect').getBoundingClientRect(), peek: peekCard,
    boardBounds() { const rect = root.getBoundingClientRect(), zoom = game?.scale.zoom ?? initial.rect.width / initial.backing.width;
      return { x: (rect.width ? rect.x : Math.max(0, (innerWidth - 520) / 2) + 12) / zoom, y: (rect.height ? rect.y : 76) / zoom,
        width: (rect.width || Math.min(innerWidth, 520) - 24) / zoom, height: (rect.height || Math.max(280, innerHeight - 260)) / zoom }; },
    inspect(id) {
      const card = deal.cards[id];
      setInspect(false);
      const image = $<HTMLImageElement>('#word-image'), artwork = cardArtwork(card, deal); image.hidden = !artwork;
      if (artwork) { image.src = artwork; image.alt = card.text; }
      else image.removeAttribute('src');
      const content = cardReader(card, deal);
      $('#word-description').hidden = content.description === undefined;
      $('#word-title').textContent = content.title; $('#word-description').textContent = content.description ?? '';
      openDialog('#inspect-dialog');
    },
    ready(active) {
      scene = active;
      active.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        ready = true; resizeToRoot(); runtime.activity.setBlocked('level-transition', false); telemetry.ready(); setInput(); updateBanner(); renderHud(); renderHome(); $('#loading').hidden = true; $('#app').dataset.ready = 'true'; $('#app').dataset.presentedDeal = deal.id;
        if (firstLaunch) { firstLaunch = false; showGame(); }
        else if (screen === 'game') showGuidance();
        if (screen === 'game' && dealEntryPending) { dealEntryPending = false; active.presentDeal(); }
        if (screen === 'game' && save.attempt.board.phase !== 'playing') outcome();
      });
    },
  });
  game = new Phaser.Game({ type: Phaser.AUTO, parent: $('#game-surface'), width: initial.backing.width, height: initial.backing.height,
    transparent: true, banner: false, audio: { noAudio: true }, scene: [scene],
    scale: { mode: Phaser.Scale.NONE, zoom: initial.rect.width / initial.backing.width },
  });
  const renderer = game;
  let boardSize = '';
  function resizeToRoot() {
    if (!ready || screen !== 'game' || !game?.isBooted) return;
    const next = size(); positionDeckTools();
    // ResizeObserver can report an unchanged rounded backing size. Emitting a
    // scene resize for that notification would cancel a perfectly valid drag.
    const rect = root.getBoundingClientRect(), key = [rect.x, rect.y, rect.width, rect.height].join(':');
    const resized = game.scale.width !== next.backing.width || game.scale.height !== next.backing.height || game.scale.zoom !== next.rect.width / next.backing.width;
    if (!resized && key === boardSize) return;
    boardSize = key;
    repaintFrames = Math.max(repaintFrames, 2);
    if (resized) { game.scale.setZoom(next.rect.width / next.backing.width); game.scale.resize(next.backing.width, next.backing.height); }
    else { scene?.cancel(); scene?.sync(); }
    game.loop.wake();
    if (ready && screen === 'game') showGuidance();
  }
  const resize = new ResizeObserver(resizeToRoot);
  resize.observe(root);
  window.addEventListener('resize', resizeToRoot, domOptions);
  window.addEventListener('resize', cancelCoins, domOptions);
  document.querySelectorAll('.sheet-body').forEach(body => body.addEventListener('scroll', cancelCoins, domOptions));
  const unblock = runtime.activity.onBlockReasonsChange(() => {
    const blocked = runtime.activity.isBlocked();
    setInput(); updateBanner();
    if (screen === 'game' && runtime.activity.getBlockReasons().every(r => r === 'modal') && ready) {
      scene?.sync();
      if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs();
      if (!blocked) { void ads.refresh(); void ads.recover(); showGuidance(); }
    }
    if (!renderer.isBooted) return;
    if (blocked && ready) { scene?.clearFeedback(); renderer.loop.sleep(); cancelCoins(); coins.forEach(c => { c.animation?.cancel(); c.busy = false; c.node.style.display = 'none'; }); }
    else renderer.loop.wake();
  });
  renderer.events.on(Phaser.Core.Events.POST_RENDER, () => {
    if (repaintFrames > 0) {
      repaintFrames--;
      if (!runtime.activity.isBlocked()) return;
    }
    if (ready && (runtime.activity.isBlocked() || !scene?.hasMotion())) renderer.loop.sleep();
  });
  // Input and explicit UI changes wake the sleeping renderer before visual work.
  const wake = () => { if (save.attempt.daily && $('#app').dataset.practice !== String(training())) renderHud(); if (!runtime.activity.isBlocked()) renderer.loop.wake(); };
  root.addEventListener('pointerdown', () => { wake(); if (!runtime.activity.isBlocked()) showGuidance(true, true); }, domOptions); root.addEventListener('pointermove', wake, domOptions);
  document.addEventListener('pointerdown', wake, { ...domOptions, capture: true });
  window.addEventListener('pointercancel', () => scene?.cancel(), domOptions);
  window.addEventListener('blur', () => scene?.cancel(), domOptions);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { scene?.cancel(); setInspect(false); } }, domOptions);
  dialogs.forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialog.id === 'learn-rule') dismissRule?.(); else closeDialogs(); }, domOptions));
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', closeDialogs, domOptions));
  $('#home-play').addEventListener('click', () => {
    if (save.attempt.daily) { void activateMode('campaign'); return; }
    if (save.attempt.board.phase === 'playing' || !outcomeViewed) showGame();
    else if (completedLevels(save) === CAMPAIGN_LENGTH) openDialog('#level-picker');
    else void openLevel(unlockedLevel(save));
  }, domOptions);
  $('#daily-play').addEventListener('click', () => { void activateMode('daily'); }, domOptions);
  $('#daily-resume-old').addEventListener('click', () => { void activateMode('daily', true); }, domOptions);
  for (const [button, dialog] of [['calendar-open', '#calendar'], ['appearance-open', '#appearance'], ['appearance-settings', '#appearance'], ['win-cycle-open', '#cycle-info'], ['looks-open', '#appearance'], ['level-picker-open', '#level-picker'], ['wallet-open', '#helpers']]) $(`#${button}`).addEventListener('click', () => { renderMeta(save, saving); if (dialog === '#helpers') openHelpers(); else openDialog(dialog); }, domOptions);
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-palette], button[data-card-back], button[data-deck-side], button[data-deck-position]')) button.addEventListener('click', async () => {
    const key = button.dataset.palette ? 'palette' : button.dataset.cardBack ? 'cardBack' : button.dataset.deckSide ? 'deckSide' : 'deckPosition';
    if (saving || button.disabled) return;
    try { await write(next => {
      if (key === 'palette' && ['green', 'ink'].includes(button.dataset.palette!) && (button.dataset.palette === 'green' || cosmeticUnlocked(next, key))) next.settings.palette = button.dataset.palette as 'green' | 'ink';
      if (key === 'cardBack' && ['classic', 'diamonds'].includes(button.dataset.cardBack!) && (button.dataset.cardBack === 'classic' || cosmeticUnlocked(next, key))) next.settings.cardBack = button.dataset.cardBack as 'classic' | 'diamonds';
      if (key === 'deckSide' && ['left', 'right'].includes(button.dataset.deckSide!)) next.settings.deckSide = button.dataset.deckSide as 'left' | 'right';
      if (key === 'deckPosition' && ['top', 'bottom'].includes(button.dataset.deckPosition!)) next.settings.deckPosition = button.dataset.deckPosition as 'top' | 'bottom';
    }); scene?.sync(); game?.loop.wake(); } catch { message('Оформление не сохранилось. Попробуйте ещё раз.', true); }
  }, domOptions);
  $('#apply-unlock').addEventListener('click', async () => {
    const choice = unlockChoice; if (!choice || saving || !cosmeticUnlocked(save, choice)) return;
    try { await write(next => { if (choice === 'palette') next.settings.palette = 'ink'; else next.settings.cardBack = 'diamonds'; }); scene?.sync(); game?.loop.wake(); }
    catch { message('Оформление не сохранилось. Попробуйте ещё раз.', true); }
  }, domOptions);
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button,summary');
    if (button && !button.disabled) runtime.play('ui');
  }, domOptions);
  $('#chapter-prev').addEventListener('click', () => { if (chapterPage > 0) { chapterPage--; renderHome(); } }, domOptions);
  $('#chapter-next').addEventListener('click', () => { if (chapterPage < Math.ceil(CAMPAIGN_LENGTH / 20) - 1) { chapterPage++; renderHome(); } }, domOptions);
  $('#level-grid').addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-level]');
    if (button && !button.disabled) void openLevel(Number(button.dataset.level));
  }, domOptions);
  $('#next-level').addEventListener('click', () => { if (save.attempt.daily || deal.campaignLevel === CAMPAIGN_LENGTH) goHome(); else void openLevel((deal.campaignLevel ?? 0) + 1); }, domOptions);
  $('#result-home').addEventListener('click', goHome, domOptions);
  $('#levels-open').addEventListener('click', goHome, domOptions);
  $('#switch-confirm').addEventListener('click', () => { const level = requestedLevel; requestedLevel = undefined; if (level) void openLevel(level, true); }, domOptions);
  $('#menu').addEventListener('click', () => { $<HTMLDetailsElement>('#pause-options').open = screen === 'home'; openDialog('#settings'); }, domOptions);
  $('#pause-options').addEventListener('toggle', () => { const expanded = $<HTMLDetailsElement>('#pause-options').open;
    $('#pause-options summary').textContent = expanded && screen === 'game' ? 'Назад' : 'Настройки';
    $('#pause-title').textContent = expanded ? 'Настройки' : screen === 'home' ? 'Настройки' : 'Пауза';
  }, domOptions);
  $('#joker').addEventListener('click', () => {
    if (!save.profile.jokers) { openHelpers('joker'); return; }
    const active = $('#joker').getAttribute('aria-pressed') !== 'true'; setInspect(false); scene?.setJoker(active);
    message('');
  }, domOptions);
  $('#buy-joker').addEventListener('click', async () => {
    if (serviceBusy || saving || !helperUnlocked(save, 'joker', deal)) return;
    try { if (await write(next => purchaseHelper(next, 'joker'))) { telemetry.track('helper_purchase', { helper: 'joker', cost: BALANCE.helperPrices.joker }); helperBought('joker'); } }
    catch { message('Не удалось сохранить покупку. Попробуйте ещё раз.', true); }
    renderHud();
  }, domOptions);
  $('#undo').addEventListener('click', () => { if (!save.profile.undos) openHelpers('undo'); else void execute({ type: 'undo' }); }, domOptions);
  $('#inspect').addEventListener('click', () => { setInspect(!inspectMode); if (!inspectMode) showGuidance(); }, domOptions);
  $('#restart').addEventListener('click', () => {
    if (save.attempt.board.phase !== 'won' && save.attempt.telemetry?.started) { $('#restart-confirm-copy').textContent = `Карты вернутся на исходные места. Потраченные помощники не восстановятся.${save.attempt.daily ? '' : ' Текущие отметки пяти побед сбросятся.'}${boardRules(save.attempt.board) < boardRules(deal.initial) ? ' В новой партии тему сначала нужно перенести в верхний слот.' : ''}`; openDialog('#restart-confirm'); }
    else void replay();
  }, domOptions);
  $('#restart-confirm-yes').addEventListener('click', () => { void replay(); }, domOptions);
  $('#replace-daily-yes').addEventListener('click', () => { void activateMode('daily', false, true); }, domOptions);
  $('#replay').addEventListener('click', () => { void replay(); }, domOptions);
  $('#result-undo').addEventListener('click', () => { if (!save.profile.undos) openHelpers('undo'); else { closeDialogs(); execute({ type: 'undo' }); } }, domOptions);
  for (const [id, key] of [['sfx', 'sfx'], ['haptics', 'haptics'], ['reduced', 'reducedMotion']] as const) {
    $<HTMLInputElement>(`#${id}`).addEventListener('change', async event => {
      const value = (event.target as HTMLInputElement).checked;
      try { await write(next => { next.settings[key] = value; }); runtime.setMute(!save.settings.sfx); runtime.setHaptics(save.settings.haptics); } catch { message('Настройки не сохранились', true); }
      renderHud();
    }, domOptions);
  }
  $('#hint').addEventListener('click', () => {
    if (workerDeadline || saving || runtime.activity.isBlocked()) return;
    if (inspectMode) setInspect(false);
    if (save.profile.hints === 0 && !freeHintDemo(save, deal) && activeHint?.key !== boardKey(save.attempt.board)) { openHelpers('hint'); return; }
    if (activeHint?.key === boardKey(save.attempt.board)) {
      renderer.loop.wake(); scene?.hint(activeHint.action);
      message('');
      return;
    }
    scene?.cancel(); message('');
    const hintWorker = worker ??= new Worker(new URL('./game/hint.worker.ts', import.meta.url), { type: 'module' });
    const requestId = ++hintSequence;
    hintWorker.onmessage = async (event: MessageEvent<HintResponse>) => {
      const hint = event.data;
      if (!alive || !pendingHint || hint.requestId !== pendingHint.requestId || hint.attemptId !== pendingHint.attemptId || hint.dealId !== pendingHint.dealId || hint.revision !== pendingHint.revision) return;
      clearTimeout(workerDeadline); workerDeadline = undefined; pendingHint = undefined;
      if (hint.revision !== save.revision || hint.attemptId !== save.attempt.id || hint.dealId !== deal.id || runtime.activity.isBlocked()) { renderHud(); return; }
      if (hint.status !== 'SOLVED') {
        const recovery = save.attempt.undo.length && save.profile.undos > 0 ? ' Можно отменить предыдущий ход.' : '';
        message(hint.status === 'UNSOLVABLE' ? 'Решения без помощников нет. Подсказка не потрачена.' + recovery
          : hint.status === 'UNKNOWN' ? 'Не удалось найти продолжение. Подсказка не потрачена.' : 'Сейчас подходящей подсказки нет');
        renderHud(); return;
      }
      if (!await execute({ type: 'hint', revision: hint.revision, action: hint.action })) return;
      activeHint = { key: boardKey(save.attempt.board), action: hint.action };
      renderHud();
      renderer.loop.wake(); scene?.hint(hint.action);
      message('');
    };
    hintWorker.onerror = () => { if (!alive || worker !== hintWorker) return; clearTimeout(workerDeadline); workerDeadline = undefined; pendingHint = undefined; hintWorker.terminate(); worker = undefined; message('Не удалось подготовить подсказку', true); renderHud(); };
    workerDeadline = setTimeout(() => { if (!alive || worker !== hintWorker || pendingHint?.requestId !== requestId) return; hintWorker.terminate(); worker = undefined; workerDeadline = undefined; pendingHint = undefined; message('Поиск занял слишком много времени. Подсказка не потрачена.', true); renderHud(); }, 5000);
    pendingHint = { requestId, revision: save.revision, attemptId: save.attempt.id, dealId: deal.id };
    const request: HintRequest = { ...pendingHint, board: save.attempt.board, deal };
    hintWorker.postMessage(request); renderHud();
  }, domOptions);
  $('#helpers-open').addEventListener('click', () => { runtime.pulse('button'); openHelpers(); }, domOptions);
  for (const helper of ['hint', 'undo'] as const) {
    $(`#buy-${helper}`).addEventListener('click', async () => {
      if (serviceBusy || saving) return;
      try {
        const bought = await write(next => purchaseHelper(next, helper));
        if (bought) { telemetry.track('helper_purchase', { helper, cost: BALANCE.helperPrices[helper] }); runtime.pulse('button'); helperBought(helper); }
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
    if (!alive) return; clearPraise(); alive = false; clearTimeout(workerDeadline); clearTimeout(outcomeTimer); clearTimeout(messageTimer);
    telemetry.track('session_end'); clearInterval(checkpoint); clearInterval(dayRefresh); clearTimeout(guideTimer); removeForeground?.(); banner?.destroy(); ads.destroy(); telemetry.destroy();
    abort.abort(); removeTouch(); coins.forEach(c => { c.animation?.cancel(); c.node.remove(); });
    worker?.terminate(); resize.disconnect(); unblock(); runtime.destroy(); destroyRenderer(renderer);
  };
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); }, domOptions);
  window.addEventListener('pageshow', () => { if (alive) renderer.loop.wake(); }, domOptions);
  import.meta.hot?.dispose(cleanup);
} catch (error) {
  runtime.destroy(); game && destroyRenderer(game);
  $('#app').hidden = true; $('#app').inert = true; $('#game-surface').hidden = true;
  const alert = document.createElement('div'); alert.className = 'fatal'; alert.setAttribute('role', 'alert');
  const title = document.createElement('h2'); title.textContent = 'Не удалось открыть партию';
  const copy = document.createElement('p'); copy.textContent = 'Попробуйте загрузить игру ещё раз. Сохранение остаётся на устройстве.';
  const retry = document.createElement('button'); retry.id = 'startup-retry'; retry.className = 'primary'; retry.textContent = 'Повторить загрузку';
  retry.addEventListener('click', () => { retry.disabled = true; retry.textContent = 'Загружаем…'; alert.setAttribute('aria-busy', 'true'); location.reload(); }, { once: true });
  const details = document.createElement('details'), summary = document.createElement('summary'), detail = document.createElement('p');
  summary.textContent = 'Технические сведения'; detail.textContent = error instanceof Error ? error.message : String(error);
  details.append(summary, detail); alert.append(title, copy, retry, details); document.body.append(alert); retry.focus(); console.error(error);
}

}
void start();
