import { authorizeLifeVideo, cancelLifeVideo, LIVES_PREVIEW, LIVES_RULES, matchesLifeVideo, mayStartCampaignAttempt, refillCampaignLife, refreshCampaignLives } from './domain/campaign-lives';
import { liveOpsDefinitions, liveOpsTitles, recordLiveOpsWin, type LiveOpsSource } from './domain/events/campaign-liveops';
import { availableEvents, claimMilestone, eventKey } from './domain/events/ledger';
import { createStorefront } from './platform/storefront';
import { claimShopProgress, PASS_GOAL, PIGGY_LIMIT, productLabels, recordStoreClear, showProductGoods, storefrontView, STOREFRONT_PREVIEW } from './domain/commerce/storefront';
import { CAMPAIGN_PRODUCTS } from './domain/commerce/catalog';
import { adFree, ADS_CONTROLS_PREVIEW, authorizeCoffee, cancelCoffee, eligibleAdBreak, matchesCoffee, recordAdRevenue } from './domain/campaign-advertising';
import { beginUnlimited, expireUnlimited, quotePurchasedUnlimited, RECOVERY_GAMEPLAY, RECOVERY_PREVIEW, restoreCampaignStock, restoreQuote, usePurchasedUnlimited } from './domain/campaign-recovery';
import { allowsRandomJoker, placeRandomJoker, proveRandomJoker, RANDOM_JOKER_PREVIEW, randomJokerColumn, settleRandomJoker } from './domain/random-joker';
import { equalityPreviewPolicy } from './content/campaign-v8-equality';
import { recordSourceContinue, SOURCE_DIFFICULTY_PREVIEW } from './domain/difficulty';
import Phaser from 'phaser';
import { getBackingStoreSize, getRenderPixelRatio } from '@danilah/mini-games-kit/core';
import { destroyRenderer } from '@danilah/mini-games-kit/phaser';
import { installTouchActivation } from '@danilah/mini-games-kit/feel';
import { campaignDeals, campaignRedeal, findDeal, isCurrentCampaignDeal, selectCampaignDeal } from './content/campaign';
import { CAMPAIGN_LENGTH, campaignId, completedLevels, unlockedLevel, helperUnlocked, freeHintDemo, freeJokerPractice, freeUndoPractice, markTutorial, seenTutorial } from './domain/progression';
import { beginDeal } from './domain/campaign';
import { canSwitchCardLanguage, localizedCampaignDeal, LOCALE_PREVIEW } from './content/campaign-v8-locale';
import { dailyForDay } from './content/daily';
import { switchMode } from './domain/sessions';
import { cosmeticUnlocked, currentDailyStreak, dailyRewardEligible, localDay } from './domain/meta';
import { WalletPresentation } from './app/wallet-presentation';
import { ContinueCheck } from './app/continue-check';
import { renderMeta, campaignAttempt, dailyAttempt } from './app/meta-ui';
import { coversPlayableWaste, lesson, recordLearning, ruleIntroduction, type RuleIntro } from './app/tutorial';
import { boardKey, boardRules, canReachTransfer, dispatch, freshSave, STREAK } from './domain/engine';
import { BALANCE } from './domain/balance';
import { frozenLayers } from './domain/frozen-cards';
import { isBoundCard } from './domain/bound-cards';
import { collectedGold, goldenRewardKey } from './domain/golden-cards';
import { TASKS_PREVIEW, acceptedTaskSignals, claimTask, claimTaskMilestone, currentTasks, recordTaskSignal, updatePreviewTasks, type TaskSignal } from './domain/events/daily-tasks';
import { PICTURE_PREVIEW, PICTURE_PRICES, PICTURE_TITLE, claimPicture, observePictureClock, openPictureEvent, pictureClosed, pictureTokens, recordPictureWin, revealPicturePart } from './domain/events/picture';
import { REWARD_OFFER_PREVIEW, isOfferPlacement, offerLabels, offerQuote, prepareRewardOffer, revealRelatedWord, type OfferPlacement, type WinOffer } from './domain/reward-offers';
import { canShuffle, commitShuffle, type ShuffleRequest } from './domain/proof-shuffle';
import { requiresContinueProof, verifiesContinue } from './domain/continuation';
import { bonusKinds, bonusOffer, bonusPlacements, pilesFor, purchaseBonusSlot } from './domain/bonus-slots';
import type { BoardCommand, BonusKind, Command, Deal } from './domain/types';
import { BOTTOM_DECK_MARGIN, CARD_H, boardFrame, layout } from './game/layout';
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
import { applyFullscreenShown, applyReceipt, buyContinue, purchaseHelper, interstitialEligible, useContinue, type RewardPlacement } from './domain/services';
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
let dismissDifficulty: (() => void) | undefined;
let alive = true;
let ready = false;
const abort = new AbortController();
const domOptions = { signal: abort.signal };
const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const runtime = createRuntime(() => { scene?.cancel(); }, () => {
  if (runtime.activity.getBlockReasons().some(r => r !== 'modal' && r !== 'screen')) return;
  if ($<HTMLDialogElement>('#learn-rule').open) { dismissRule?.(); return; }
  if ($<HTMLDialogElement>('#difficulty-entry').open) { dismissDifficulty?.(); return; }
  if (screen === 'game' && scene?.back()) return;
  if (dialogs.some(d => d.open)) closeDialogs();
  else if (inspectMode) setInspect(false);
  else openDialog('#settings');
});

let coinPresentation = 0;
let wallet: WalletPresentation | undefined;
function restoreWallet() { const button = $('#wallet-open'); button.style.position = ''; button.style.left = ''; button.style.top = ''; button.style.zIndex = ''; $('#wallet-anchor').append(button); $('#wallet-anchor').style.width = ''; }
function pinWallet() { const anchor = $('#wallet-anchor'), r = anchor.getBoundingClientRect(), button = $('#wallet-open'); anchor.style.width = `${r.width}px`; $('#result').append(button); Object.assign(button.style, { position: 'fixed', left: `${r.x}px`, top: `${r.y}px`, zIndex: '102' }); }
function cancelCoins(settle = true) {
  wallet?.cancel(settle);
  coinPresentation++;
  $('#coin-layer').getAnimations({ subtree: true }).forEach(a => a.cancel());
  $('#coin-layer').querySelectorAll<HTMLElement>('.flying-coin').forEach(n => { n.style.display = 'none'; });
}
function closeDialogs(preserveCoins = false) {
  // Discard presentation before its top-layer owner closes. Never carry coins to another screen.
  cancelCoins(!preserveCoins); restoreWallet();
  document.body.append($('#coin-layer')); dialogs.forEach(d => d.close()); runtime.activity.setBlocked('modal', false);
}
function openDialog(selector: string, preserveCoins = false) { peekCard(null); clearPraise(); scene?.clearFeedback(); closeDialogs(preserveCoins); scene?.cancel(); runtime.activity.setBlocked('modal', true); $<HTMLDialogElement>(selector).showModal(); }
let peeked: string | null = null;
function peekCard(id: string | null, previewOnly = false) {
  if (peeked === id) return;
  peeked = id; const panel = $('#inspect-peek'); panel.hidden = !id;
  $('#inspect').dataset.peeking = String(Boolean(id));
  if (!id) return;
  $('#peek-status').hidden = !previewOnly;
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
function positionDeckTools(save: Save) {
  const rect = $('#game-root').getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const tools = $('.deck-tools'), app = $('#app');
  const frame = boardFrame(rect.width, rect.height, app.dataset.deckRow as 'top' | 'bottom', deal);
  const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
  const bottom = app.dataset.deckRow === 'bottom' && hasDeck;
  const right = app.dataset.deckEdge === 'left' || (!hasDeck && app.dataset.deckRow === 'bottom');
  // The moves counter shares the deck row, on the side free of stock and the waste fan.
  // A full foundation row needs its entire width when the deck is at the bottom.
  const top = bottom ? rect.height - (CARD_H + BOTTOM_DECK_MARGIN) * frame.unit : 20 * frame.unit;
  tools.style.transformOrigin = right ? 'top right' : 'top left';
  tools.style.transform = `scale(${frame.unit})`;
  tools.style.top = `${top}px`;
  tools.style.left = right ? 'auto' : '0'; tools.style.right = right ? '0' : 'auto';
  const offers = deal.bonusSlots && ready && screen === 'game' && save.attempt.board.phase === 'playing'
    ? layout(save.attempt.board, deal, frame, save.settings.deckSide, save.settings.deckPosition).offers : [];
  for (const kind of bonusKinds) {
    const button = $(`#bonus-${kind}`), offer = offers.find(target => target.kind === kind);
    button.hidden = !offer;
    if (offer) {
      const slotWidth = offer.width * frame.unit;
      // Keep the bonus hit area inside the field; the gap to the preceding
      // slot leaves room for the minimum touch width on short screens.
      const touchWidth = Math.max(44, slotWidth);
      const left = frame.offsetX + (offer.x - offer.width / 2) * frame.unit;
      button.style.left = `${Math.min(left, rect.width - touchWidth)}px`;
      button.style.top = `${offer.y * frame.unit}px`;
      button.style.setProperty('--bonus-width', `${touchWidth}px`);
    }
  }
}
function message(text: string, error = false) {
  if (error) clearPraise();
  clearTimeout(messageTimer); $('#message').textContent = text; $('#message').classList.toggle('error', error);
  if (text) messageTimer = setTimeout(() => message(''), error ? 2500 : 1800);
}
function setInspect(value: boolean) { inspectMode = value; $('#inspect').setAttribute('aria-pressed', String(value)); scene?.setInspect(value); message(''); }

function difficultyLabel(item?: Deal): string {
  return item?.difficultyTier === 'superhard' ? 'Очень сложный' : item?.difficultyTier === 'hard' ? 'Сложный' : '';
}

function setDifficulty(element: HTMLElement, item?: Deal) {
  element.dataset.tier = item?.difficultyTier ?? 'normal';
  return difficultyLabel(item);
}

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
  let presentingCommand = false;
  wallet = new WalletPresentation(save.profile.coins, $('#coin-layer'), $('#coins'), $('#helper-wallet'), $('#wallet-open'), () => runtime.play('coins', 'ui'), () => save.settings.reducedMotion);
  deal = findDeal(save.attempt.dealId)!;
  let requestedLevel: number | undefined;
  let difficultyRequest: { level: number; returnTo: 'result' | 'picker' | undefined } | undefined;

  let activeRule: RuleIntro | undefined;
  let unlockChoice: 'palette' | 'cardBack' | undefined;
  let localeRestartAttempt: string | undefined;
  const dismissedRules = new Set<RuleIntro>();
  let outcomeViewed = false;
  let chapterPage = 0, chapterAttemptId = '';
  const training = () => Boolean(save.attempt.daily && save.attempt.board.phase !== 'won' && !dailyRewardEligible(save, localDay()));
  let removeForeground: (() => void) | undefined;
  let saving = false, serviceBusy = false;
  const continueCheck = new ContinueCheck(() => { if (alive) renderHud(); });
  let continueVideoFailed: string | undefined;
  let rewardedResultAttempt: string | undefined;
  let rewardOfferReturn: { attempt: string; selector: '#result'|'#helpers'|'#appearance' } | undefined;
  let definitionCardId: string | undefined;
  let pictureReturnToResult = false;
  let themeExpiry: ReturnType<typeof setTimeout> | undefined;
  // A backing-store resize clears the canvas even when the model is static.
  // Keep a bounded repaint tail instead of sleeping in that POST_RENDER turn.
  let repaintFrames = 0;
  let pendingWrites = 0;
  let prewarmedLiveOps = '';
  let blockedLifeLevel: number | undefined;
  let retryLifeRestart = false;
  const livesVideoApproved = () => ads.status.mode === 'live' && ads.status.livesApproved === true;
  let adBreakTimer: ReturnType<typeof setTimeout> | undefined;
  const campaignAdsApproved = () => ads.status.mode === 'live' && ads.status.campaignApproved === true;
  let recoveryClock: ReturnType<typeof setTimeout> | undefined;
  let banner: NativeBanner | undefined;
  const launchedAt = Date.now();
  const telemetry = createTelemetry(() => save, runtime.activity);
  const setInput = () => scene?.setEnabled(screen === 'game' && ready && !saving && !runtime.activity.isBlocked() && !store.needsRecovery);
  const updateBanner = () => banner?.setEligible(Boolean(screen === 'game' && ads.status.banner && !adFree(save, Date.now(), 'banner') && deal.campaignLevel !== undefined && deal.campaignLevel >= BALANCE.ads.bannerFromLevel), runtime.activity.isBlocked());
  store.onChange = value => { save = value; wallet?.sync(value.profile.coins, presentingCommand); deal = findDeal(value.attempt.dealId)!; telemetry.sync(); if (!pendingWrites) { renderHud(); renderHome(); } updateBanner(); scheduleRecoveryClock(); };
  function scheduleRecoveryClock() {
    clearTimeout(recoveryClock);
    const times = [save.attempt, save.parked?.campaign].flatMap(attempt =>
      attempt?.unlimited?.until !== undefined && !attempt.unlimited.expired ? [attempt.unlimited.until] : []);
    if (!times.length) return;
    recoveryClock = setTimeout(() => {
      if (!alive) return;
      void write(next => expireUnlimited(next, Date.now())).then(changed => {
        if (changed && alive) { scene?.sync(); if (screen === 'game' && save.attempt.board.phase === 'exhausted') outcome(); }
      }).catch(() => message('Не удалось восстановить лимит ходов.', true));
    }, Math.min(2_147_483_647, Math.max(0, Math.min(...times) - Date.now())));
  }
  async function write<T>(change: (next: Save) => T): Promise<T> {
    pendingWrites++; saving = true; setInput();
    try { return await store.mutate(change); }
    finally {
      saving = --pendingWrites > 0; setInput(); renderHud(); renderHome();
      if (!saving && ready && screen === 'game' && !runtime.activity.isBlocked()) showGuidance();
    }
  }
  const storefront = createStorefront(store);
  if (STOREFRONT_PREVIEW) void storefront.refresh().catch(() => undefined);
  const ads = createAds({
    activity: runtime.activity,
    async beforeShow(request) {
      await store.mutate(next => {
        if (request.placement === 'life-refill') {
          if (!LIVES_PREVIEW || !livesVideoApproved() || request.kind !== 'rewarded' || request.mode !== 'campaign' ||
              !matchesLifeVideo(next, request.attempt, request.dealId)) throw Error('Восстановление жизни недоступно');
          return;
        }
        if (isOfferPlacement(request.placement)) {
          const pending = next.rewardOffers?.pending.find(entry => entry.id === request.attempt);
          if (!REWARD_OFFER_PREVIEW || request.kind !== 'rewarded' || request.mode !== 'campaign' ||
            !pending || pending.dealId !== request.dealId || pending.kind !== request.placement) {
            throw Error('Предложение изменилось');
          }
          return;
        }
        const attempt = next.attempt;
        if (request.attempt !== attempt.id || request.dealId !== attempt.dealId ||
          request.mode !== (attempt.daily ? 'daily' : 'campaign')) throw Error('Партия изменилась');
        if (request.placement === 'coffee-break') {
          if (!campaignAdsApproved() || request.kind !== 'rewarded' || !matchesCoffee(next, request.attempt, request.dealId))
            throw Error('Кофе-пауза недоступна');
          return;
        }
        if (request.placement === 'ads-break') {
          if (!eligibleAdBreak(next, deal, Date.now(), launchedAt, campaignAdsApproved(), true)) throw Error('Пауза недоступна');
          return;
        }
        if (request.kind === 'interstitial') {
          const level = findDeal(request.dealId)?.campaignLevel;
          if (attempt.board.phase !== 'won' || level === undefined ||
            !interstitialEligible(next, level, request.mode, Date.now(), launchedAt)) throw Error('Показ недоступен');
        }
        if (request.kind === 'rewarded' && request.placement === 'continue' && requiresContinueProof(next.attempt)) {
          const proof = continueCheck.proof;
          if (!proof || request.attempt !== proof.attemptId || request.dealId !== proof.deal.id ||
            next.attempt.continued || !verifiesContinue(next.attempt, proof)) throw Error('Продолжение недоступно');
        }
      });
    },
    commitShown: shown => store.mutate(next => applyFullscreenShown(next, shown, findDeal(shown.dealId)?.campaignLevel)),
    async commit(receipt) {
      const placement = receipt.placement;
      let openedBonus = false, earnedContinue = false, grantedOfferCoins = 0;
      const result = await store.mutate(next => {
        const hadContinue = next.platform?.continuedAttempts.includes(receipt.attempt);
        const beforeCoins = next.profile.coins, hadExtra = next.attempt.continued;
        const applied = applyReceipt(next, receipt, {
          offerNow: Date.now(),
          deal: findDeal(receipt.dealId), onBonusUnlocked: () => { openedBonus = true; }, continueProof: continueCheck.proof,
        });
        grantedOfferCoins = next.profile.coins - beforeCoins;
        if (placement === 'continue' && !hadExtra && next.attempt.continued) logTaskAction(next, 'BuyExtraMoves', 'continue');
        earnedContinue = placement === 'continue' && !hadContinue && Boolean(next.platform?.continuedAttempts.includes(receipt.attempt));
        return applied;
      });
      const amount = placement === 'continue' ? Number(earnedContinue) * BALANCE.continueMoves : placement === 'hint' || placement === 'undo'
        ? BALANCE.rewardedCharges[placement] : isOfferPlacement(placement) || placement === 'coffee-break' ? grantedOfferCoins : Number(openedBonus);
      if (result === 'applied' && amount) telemetry.track('reward_granted', { attemptId: receipt.attempt, dealId: receipt.dealId, mode: receipt.mode, reason: `rewarded_${placement}`, amount });
      // Ack failure must not freeze spending/restart or replay the already durable grant.
      if (runtime.activity.getBlockReasons().every(r => r === 'modal')) { scene?.sync(); if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs(); }
      return result;
    },
    onStatus() { renderLives(); renderHud(); updateBanner(); if ((deal.campaignLevel ?? 0) > BALANCE.ads.interstitialAfterLevel) void ads.prepareInterstitial(); },
    onEvent(event) {
      telemetry.track('ad_event', { format: event.kind, phase: event.phase });
      if (event.phase === 'revenue' && campaignAdsApproved())
        void store.mutate(next => recordAdRevenue(next, event.revenue)).catch(() => undefined);
    },
  });
  if (ads.bridge) banner = new NativeBanner(ads.bridge, $('#banner-slot'));
  telemetry.track('session_start');
  if (save.attempt.telemetry?.started && save.attempt.board.phase === 'playing') telemetry.track('level_resume');
  let helperFocus: 'hint' | 'undo' | 'joker' | undefined;
  let bonusSelection: { kind: BonusKind; attemptId: string } | undefined;
  function selectedBonus() {
    if (!bonusSelection || bonusSelection.attemptId !== save.attempt.id || save.attempt.board.phase !== 'playing') return;
    const offer = bonusOffer(deal, bonusSelection.kind);
    if (offer && pilesFor(save.attempt.board, bonusSelection.kind).length === offer.index) return offer;
  }
  function renderBonusSheet() {
    const offer = selectedBonus();
    const busy = saving || serviceBusy || store.needsRecovery;
    const buy = $<HTMLButtonElement>('#bonus-buy'), video = $<HTMLButtonElement>('#bonus-video');
    buy.disabled = busy || !offer || save.profile.coins < offer.coins;
    video.hidden = !offer || !ads.status.rewarded;
    video.disabled = busy || video.hidden;
    if (!offer) return;
    buy.textContent = `Открыть за ${offer.coins} монет`;
    $('#bonus-balance').textContent = save.profile.coins < offer.coins
      ? `Не хватает ${offer.coins - save.profile.coins} монет.` : `В кошельке ${save.profile.coins} монет.`;
  }
  function openHelpers(focus?: typeof helperFocus) { helperFocus = focus; renderHud(); openDialog('#helpers'); }
  function helperBought(helper: NonNullable<typeof helperFocus>) {
    if (helperFocus !== helper || screen !== 'game') return;
    closeDialogs();
    if (save.attempt.board.phase === 'exhausted') outcome();
    else { const button = $(`#${helper}`); button.classList.remove('bump'); void button.offsetWidth; button.classList.add('bump'); }
  }
  let activeHint: { key: string; action: BoardCommand } | undefined;
  let lessonSave: Save | undefined;
  let instruction: ReturnType<typeof lesson>;
  const currentLesson = () => {
    if (save !== lessonSave) { lessonSave = save; instruction = lesson(save, deal); }
    return instruction;
  };
  const allowsLesson = (command: Command) => command.type === 'restart' || currentLesson()?.accepts?.(command) !== false;
  let pendingDealSound: string | undefined;
  function playDealSound() {
    if (pendingDealSound !== save.attempt.id || screen !== 'game' || runtime.activity.isBlocked() ||
      !runtime.native && navigator.userActivation?.hasBeenActive === false) return;
    if (runtime.play('deal') || !save.settings.sfx) pendingDealSound = undefined;
  }
  function announceDeal() {
    pendingDealSound = save.attempt.id;
    playDealSound();
    const attemptId = pendingDealSound;
    void runtime.soundReady.then(() => {
      playDealSound();
      if (runtime.native && pendingDealSound === attemptId && attemptId) setTimeout(() => {
        if (alive && pendingDealSound === attemptId) playDealSound();
      }, 90);
    });
  }
  window.addEventListener('pointerup', playDealSound, { ...domOptions, capture: true });
  window.addEventListener('keydown', playDealSound, domOptions);
  const repeatHint = () => activeHint?.key === boardKey(save.attempt.board) ? activeHint.action : save.attempt.lessonHint;
  let hintSequence = 0;
  let pendingHint: Pick<HintRequest, 'requestId' | 'revision' | 'attemptId'> & { dealId: string } | undefined;
  let cancelShuffle: (() => void) | undefined;

  runtime.setMute(!save.settings.sfx); runtime.setHaptics(save.settings.haptics);
  function coinBurst(origin = $('#streak-reward'), amount?: number) { wallet?.collect(origin, amount); }
  const hasTransfer = new WeakMap<Save['attempt']['board'], boolean>();
  function renderHud() {
    $('#campaign-store-open').hidden = !STOREFRONT_PREVIEW;
    $('#coffee-open').hidden = !(ADS_CONTROLS_PREVIEW || campaignAdsApproved()) || (deal.campaignLevel ?? 0) < 16 || save.attempt.board.phase !== 'playing';
    const restore = $<HTMLButtonElement>('#restore-stock'), price = restoreQuote(save.attempt, deal);
    restore.hidden = !RECOVERY_GAMEPLAY || price === undefined;
    restore.disabled = price === undefined || save.profile.coins < price || saving;
    restore.textContent = price ? `Восстановить колоду · ${price} монет` : 'Восстановить колоду · бесплатно';
    const unlimited = $('#unlimited-preview');
    const purchase = RECOVERY_GAMEPLAY && STOREFRONT_PREVIEW && quotePurchasedUnlimited(save, deal, storefront.accountId, Date.now());
    const trial = RECOVERY_PREVIEW && deal.recovery && save.attempt.board.phase === 'playing' && !save.attempt.unlimited;
    unlimited.hidden = !(purchase || trial);
    unlimited.textContent = purchase ? 'Применить купленные ходы без лимита' : 'Ходы без лимита · 2 мин';
    $('#random-joker-open').hidden = !(RANDOM_JOKER_PREVIEW && allowsRandomJoker(save.attempt, deal));
    $('#app').dataset.screen = screen;
    $('#game-surface').hidden = screen !== 'game';
    document.documentElement.dataset.reduced = String(save.settings.reducedMotion);
    const board = save.attempt.board;
    const shuffle = $<HTMLButtonElement>('#proof-shuffle');
    const shuffling = runtime.activity.getBlockReasons().includes('shuffle');
    shuffle.hidden = !deal.shufflePreview;
    shuffle.disabled = !canShuffle(save, deal) || saving || shuffling;
    shuffle.setAttribute('aria-busy', String(shuffling));
    $('#proof-shuffle-label').textContent = shuffling ? 'Ищу…' : save.attempt.shuffleUsed ? 'Использовано' : 'Перемешать';
    $('#game').dataset.exhausted = String(board.phase === 'exhausted');
    if (screen === 'game' && board.phase === 'playing' && !hasTransfer.has(board)) hasTransfer.set(board, canReachTransfer(board, deal));
    $('#no-transfer').hidden = screen !== 'game' || board.phase !== 'playing' || hasTransfer.get(board) !== false;
    $('#app').dataset.practice = String(training());
    $('#app').dataset.lesson = String(Boolean(deal.training || deal.frozen || deal.bound || deal.puzzle || deal.golden || deal.starter));
    $('#level-number').textContent = deal.daily ? `${training() ? 'ТРЕНИРОВКА' : 'ЗАДАНИЕ'} · ${deal.daily.dayId}` : deal.campaignLevel ? `УРОВЕНЬ ${deal.campaignLevel}` : 'ПРОБНАЯ РАЗДАЧА';
    $('.level h1').textContent = deal.title;
    const hintUnlocked = helperUnlocked(save, 'hint', deal), undoUnlocked = helperUnlocked(save, 'undo', deal);
    $('#hint').hidden = !hintUnlocked; $('#undo').hidden = !undoUnlocked;
    $('#hint-offer').hidden = !hintUnlocked || Boolean(helperFocus && helperFocus !== 'hint'); $('#undo-offer').hidden = !undoUnlocked || Boolean(helperFocus && helperFocus !== 'undo');
    const jokerUnlocked = helperUnlocked(save, 'joker', deal);
    $('#joker').hidden = !jokerUnlocked; $('#joker-offer').hidden = !jokerUnlocked || Boolean(helperFocus && helperFocus !== 'joker');
    $('#joker-count').textContent = String(save.profile.jokers); $('#joker-stock').textContent = String(save.profile.jokers);
    $<HTMLButtonElement>('#buy-joker').disabled = serviceBusy || saving || save.profile.coins < BALANCE.helperPrices.joker;
    $<HTMLButtonElement>('#wallet-open').disabled = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
    $('.wallet-plus').hidden = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
    $('#helpers-open').hidden = !hintUnlocked && !undoUnlocked && !jokerUnlocked;
    $('#helper-locked').hidden = hintUnlocked || undoUnlocked || jokerUnlocked;
    $('#restart').hidden = screen === 'home'; $('#levels-open').hidden = screen === 'home';
    $('#settings-done').textContent = screen === 'home' ? 'Готово' : 'Продолжить игру';
    $('#pause-title').textContent = screen === 'home' || $<HTMLDetailsElement>('#pause-options').open ? 'Настройки' : 'Пауза';
    $('#pause-level').textContent = screen === 'home' ? 'СОЛИТЁР АССОЦИАЦИЙ' : $('#level-number').textContent;
    const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
    $('#app').dataset.deckEdge = hasDeck ? save.settings.deckSide ?? 'right' : 'right';
    $('#app').dataset.deckRow = hasDeck ? save.settings.deckPosition ?? 'top' : 'top';
    positionDeckTools(save);
    if (deal.bonusSlots) renderBonusSheet();
    const instruction = screen === 'game' ? currentLesson() : undefined;
    const ice = screen === 'game' && board.phase === 'playing' &&
      Object.keys(deal.frozen?.layers ?? {}).some(id => frozenLayers(board, deal, id));
    const binding = screen === 'game' && board.phase === 'playing' &&
      Object.keys(deal.bound?.scissorsByCard ?? {}).some(id => isBoundCard(board, deal, id));
    const puzzle = screen === 'game' && board.phase === 'playing' &&
      deal.puzzle?.pairs.some(({ top }) => !board.collected.includes(top));
    const golden = screen === 'game' && board.phase === 'playing' ? deal.golden : undefined;
    const goldNote = golden && (save.profile.rewards.includes(goldenRewardKey(deal))
      ? 'Награда за золотые карты уже получена.'
      : `Золотые карты: ${collectedGold(board, deal)} из ${golden.ids.length}. Награда за победу.`);
    const nextBooster = screen === 'game' && board.phase === 'playing'
      ? Object.entries(deal.starter?.cards ?? {}).find(([id]) => !board.collected.includes(id) && !board.foundations.some(pile => pile.includes(id)))?.[1]
      : undefined;
    const boosterNote = nextBooster === 'magnet' ? 'Магнит в слоте темы подтянет карту из колоды.'
      : nextBooster === 'hammer' ? 'Молоток в слоте темы откроет карту в столбце.' : undefined;
    const note = instruction?.attention === 'joker' && $('#joker').getAttribute('aria-pressed') === 'true'
      ? 'Коснитесь отмеченного столбца, чтобы поставить Джокера.'
      : instruction?.copy ?? (binding ? 'Перенесите ножницы в верхний слот, чтобы разрезать связь.'
        : ice ? 'Соберите тему, чтобы снять один слой льда.'
        : puzzle ? 'Соедините половины в столбце и перенесите пару в слот темы.' : goldNote ?? boosterNote);
    if ($('#lesson-copy').textContent !== (note ?? '')) $('#lesson-copy').textContent = note ?? '';
    $('#lesson-note').hidden = !note;
    $<HTMLButtonElement>('#joker').disabled = board.phase !== 'playing' || Boolean(save.attempt.jokerUsed) || saving ||
      Boolean(instruction?.accepts && instruction.attention !== 'joker');
    $('#joker').classList.toggle('attention', instruction?.attention === 'joker');
    $('#hint').classList.toggle('attention', instruction?.attention === 'hint');
    $('#undo').classList.toggle('attention', instruction?.attention === 'undo');

    $('#wallet-open').setAttribute('aria-label', `${save.profile.coins} монет. Монеты и помощники`);
    $('#moves').textContent = board.movesLeft === null ? '∞' : String(board.movesLeft);
    $('.moves').dataset.urgency = board.movesLeft === 0 ? 'lost' : board.movesLeft !== null && board.movesLeft <= 5 ? board.movesLeft <= 2 ? 'critical' : 'low' : '';
    $('#move-fill').style.width = `${100 * (board.movesLeft ?? 1) / (deal.initial.movesLeft ?? 1)}%`;
    const replayHint = Boolean(repeatHint());
    const searching = Boolean(pendingHint);
    $('#hint-label').textContent = searching ? 'Ищу…' : replayHint ? 'Повторить' : 'Подсказка';
    $('#hint-count').hidden = replayHint;
    $('#hint').setAttribute('aria-busy', String(searching));
    $('#hint').setAttribute('aria-label', searching ? 'Ищу подсказку' : replayHint ? 'Повторить подсказку бесплатно' : 'Подсказка');
    $('#hint-count').textContent = String(save.profile.hints); $('#undo-count').textContent = String(save.profile.undos);
    $<HTMLButtonElement>('#hint').disabled = board.phase !== 'playing' || Boolean(workerDeadline) || saving || Boolean(instruction?.accepts && instruction.attention !== 'hint' && !replayHint);
    $<HTMLButtonElement>('#undo').disabled = board.phase === 'won' || !save.attempt.undo.length || saving || Boolean(instruction?.accepts && instruction.attention !== 'undo');
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
    $('#card-language-controls').hidden = !LOCALE_PREVIEW;
    if (LOCALE_PREVIEW) {
      $<HTMLSelectElement>('#card-language').value = save.settings.contentLanguage ?? 'ru';
      const target = canSwitchCardLanguage(deal) ? campaignDeals[80] : undefined;
      const restart = $<HTMLButtonElement>('#locale-restart');
      restart.hidden = !target || screen !== 'game' || localizedCampaignDeal(save, target).id === deal.id;
      restart.disabled = saving || serviceBusy;
    }
    $<HTMLInputElement>('#sfx').checked = save.settings.sfx;
    $<HTMLInputElement>('#reduced').checked = save.settings.reducedMotion;
    $<HTMLInputElement>('#haptics').checked = save.settings.haptics;
    $('#helper-title').textContent = helperFocus ? { hint: 'Подсказка', undo: 'Отмена', joker: 'Джокер' }[helperFocus] : 'Помощники';
    $('#helpers').dataset.focus = helperFocus ?? 'all';
    for (const helper of ['hint', 'undo', 'joker']) $(`#buy-${helper}`).className = helperFocus === helper ? 'primary' : 'secondary';
    $('#helper-return').textContent = screen === 'home' ? 'Готово' : 'К игре';
    $('#appearance-done').textContent = screen === 'home' ? 'Готово' : 'К игре';
    $('#joker-next-attempt').hidden = !save.attempt.jokerUsed || !jokerUnlocked || Boolean(helperFocus && helperFocus !== 'joker');

    $('#hint-stock').textContent = String(save.profile.hints); $('#undo-stock').textContent = String(save.profile.undos);
    for (const helper of ['hint', 'undo'] as const) {
      $<HTMLButtonElement>(`#buy-${helper}`).disabled = serviceBusy || saving || save.profile.coins < BALANCE.helperPrices[helper];
      $<HTMLButtonElement>(`#video-${helper}`).disabled = serviceBusy || !ads.status.rewarded;
      $(`#video-${helper}`).hidden = !ads.status.rewarded;
    }
    const credits = save.platform?.continueCredits ?? 0;
    const exhausted = board.phase === 'exhausted' && !save.attempt.continued;
    const requiresProof = requiresContinueProof(save.attempt);
    continueCheck.update(save.attempt, deal, ready && screen === 'game' && exhausted && requiresProof);
    const proofStatus = continueCheck.status;
    const canContinue = exhausted && (credits > 0 || ads.status.rewarded) && (!requiresProof || proofStatus === 'PROVEN_RECOVERABLE');
    const videoFailed = continueVideoFailed === save.attempt.id;
    const retryVideo = canContinue && !credits && videoFailed;
    const showCoinOffer = exhausted && requiresProof && proofStatus === 'PROVEN_RECOVERABLE' && credits === 0;
    const canBuyContinue = showCoinOffer && save.profile.coins >= BALANCE.continueCoinPrice;
    const continueBusy = saving || serviceBusy || store.needsRecovery;
    const coinButton = $<HTMLButtonElement>('#result-continue-coins');
    const recoveryLabel = RECOVERY_GAMEPLAY && deal.recovery ? 'Возродить партию' : 'Продолжить';
    coinButton.hidden = !showCoinOffer;
    coinButton.disabled = !canBuyContinue || continueBusy;
    coinButton.textContent = `+${BALANCE.continueMoves} ходов за ${BALANCE.continueCoinPrice} монет`;
    if (RECOVERY_GAMEPLAY && deal.recovery && !coinButton.hidden) coinButton.textContent = `${recoveryLabel} · +${BALANCE.continueMoves} ходов за ${BALANCE.continueCoinPrice}`;
    const continueButton = $<HTMLButtonElement>('#result-continue');
    continueButton.hidden = !canContinue;
    continueButton.disabled = !canContinue || continueBusy;
    continueButton.className = canBuyContinue || retryVideo || store.needsRecovery ? 'secondary' : 'primary';
    continueButton.textContent = credits > 0 ? '+10 ходов · использовать запас' : retryVideo ? 'Повторить запрос видео' : '+10 ходов · видео';
    $('#result').dataset.continueStatus = proofStatus ?? '';
    const continueNote = $('#result-continue-note');
    continueNote.hidden = !proofStatus;
    continueNote.textContent = proofStatus === 'CHECKING' ? 'Проверяем, хватит ли ещё 10 ходов.'
      : proofStatus === 'UNSOLVABLE' ? 'Из этой позиции за 10 ходов не выиграть.'
      : proofStatus === 'UNKNOWN' ? 'Путь к победе за 10 ходов не подтверждён.'
      : proofStatus === 'PROVEN_RECOVERABLE' ? videoFailed && !credits
        ? 'Видео сейчас недоступно.' : showCoinOffer && !canBuyContinue
          ? 'На +10 ходов не хватает монет.' : 'Из этой позиции можно выиграть за 10 ходов или меньше.'
      : '';
    const undoRecovery = board.phase === 'exhausted' && save.attempt.undo.length > 0 && (save.profile.undos > 0 || save.profile.coins >= BALANCE.helperPrices.undo || ads.status.rewarded);
    const resultRetry = $<HTMLButtonElement>('#result-save-retry');
    resultRetry.hidden = !store.needsRecovery;
    resultRetry.disabled = saving || serviceBusy;
    const alternate = campaignRedeal(save.attempt);
    const redeal = $<HTMLButtonElement>('#result-redeal');
    redeal.hidden = !alternate;
    redeal.disabled = saving || serviceBusy || store.needsRecovery;
    if (alternate) {
      $('#result-redeal small').textContent = `Лимит ${alternate.initial.movesLeft}`;
      $('#replay').textContent = 'Тот же расклад';
    }
    const hasContinueAction = (canContinue && !retryVideo) || canBuyContinue || !resultRetry.hidden;
    $('#result-undo').className = !hasContinueAction && undoRecovery ? 'primary' : 'secondary';
    $('#replay').className = board.phase === 'exhausted' && !hasContinueAction && !undoRecovery ? 'primary' : 'secondary';
    const applied = unlockChoice === 'palette' ? save.settings.palette === 'ink' : save.settings.cardBack === 'diamonds';
    $('#apply-unlock').textContent = applied ? 'Применено' : 'Примерить';
    $<HTMLButtonElement>('#apply-unlock').disabled = !unlockChoice || applied || saving || serviceBusy;
    $('#save-retry').hidden = !store.needsRecovery;
    if (REWARD_OFFER_PREVIEW) renderRewardOffers();
    if (PICTURE_PREVIEW || save.picture) renderPicture();
    if (TASKS_PREVIEW) renderTasks();
  }
  function outcome(collectionDeadline = Infinity) {
    if (save.attempt.board.phase === 'playing') return;
    // The final count gets its reading beat. A delayed frame may skip the
    // decorative tail, but it must never cancel a streak flight before contact.
    const holdingCategory = !save.settings.reducedMotion && scene?.holdingCollection && performance.now() < collectionDeadline;
    if (save.attempt.board.phase === 'won' && (holdingCategory || wallet?.settling)) {
      outcomeTimer = setTimeout(() => outcome(collectionDeadline), 32); return;
    }
    // A local result coin layer must join the dialog's top layer to stay visible.
    $('#result').dataset.won = String(save.attempt.board.phase === 'won');
    const won = save.attempt.board.phase === 'won';
    if (!store.needsRecovery) $('#result-continue-error').hidden = true;
    outcomeViewed = true;
    $('#result-title').textContent = won ? 'Всё сошлось!' : 'Ходы закончились';
    const daily = Boolean(save.attempt.daily), payout = save.attempt.payout;
    $('#result-copy').textContent = won ? daily ? payout?.length ? 'Задание дня выполнено. Награда уже на вашем счёте.' : 'Тренировка завершена. Награда за эту дату уже получена или её день закончился.' : (deal.campaignLevel === CAMPAIGN_LENGTH ? `Все ${CAMPAIGN_LENGTH} уровней пройдены. Любую раздачу можно сыграть ещё раз.` : '') : '';
    const goldenReward = won && payout?.find(reward => reward.reason === 'golden_cards');
    if (goldenReward) $('#result-copy').textContent = `За золотые карты начислено ${goldenReward.coins} монет.`;
    const cycleReward = payout?.find(r => r.reason === 'campaign_win_cycle');
    $('#result-bonus').hidden = !won || !cycleReward;
    $('#result-bonus-copy').textContent = cycleReward ? `Получено: +${cycleReward.coins} монет${cycleReward.hints ? ` и +${cycleReward.hints} подсказка` : ''}` : '';
    $('#result-meta').textContent = daily ? `Серия дней · ${currentDailyStreak(save, localDay())}` : `Новый цикл · ${save.meta!.winCycle} / 5`;
    $('#result-meta').hidden = !won || !daily && !payout?.some(r => r.reason === 'campaign_win_cycle');
    $('#replay').textContent = daily && won ? 'Сыграть как тренировку' : 'Ещё раз';
    const earned = (payout ? payout.reduce((sum, r) => sum + r.coins, 0) : !daily ? BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (save.attempt.board.movesLeft ?? 0) : 0);
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
    const next = daily ? undefined : campaignDeals[deal.campaignLevel ?? 0];
    const nextDifficulty = setDifficulty($('#next-level'), next);
    $('#next-level').textContent = daily ? 'К заданиям и уровням' : !next ? 'К уровням' :
      `${nextDifficulty ? nextDifficulty + ' уровень' : 'Уровень'} ${next.campaignLevel} →`;
    $('#result-home').hidden = daily || deal.campaignLevel === CAMPAIGN_LENGTH;
    openDialog('#result', true); pinWallet();
    if (won) wallet?.reveal($('#result-total'), earned);
    if (won && wallet?.pending) {
      $('#result').append($('#coin-layer'));
      const attemptId = save.attempt.id, presentation = coinPresentation;
      // Wait for the actual panel entrance, not a wall-clock guess: a transformed
      // dialog temporarily changes the fixed layer's coordinate system.
      void Promise.allSettled($('#result').getAnimations().map(a => a.finished)).then(() => {
        if (alive && presentation === coinPresentation && save.attempt.id === attemptId && $<HTMLDialogElement>('#result').open && !runtime.activity.getBlockReasons().some(r => r !== 'modal')) coinBurst($('#result-total'));
      });
    }
  }
  async function execute(cmd: Command) {
    if (!alive || saving || screen !== 'game' || runtime.activity.isBlocked()) return false;
    if (!allowsLesson(cmd)) {
      scene?.cancel();
      showGuidance();
      return false;
    }
    const progressBefore = save.attempt.streak.progress, movesBefore = save.attempt.board.movesLeft;
    let result: Result | undefined;
    let started = false, finished = false, coveredWaste = false, blockedLives = false;
    try {
      presentingCommand = true;
      await write(next => {
        expireUnlimited(next, Date.now());
        if (LIVES_PREVIEW && !next.attempt.daily && deal.campaignLevel &&
            (cmd.type === 'restart' ? !mayStartCampaignAttempt(next, next.attempt, Date.now()) : Boolean(next.attempt.lostLife && next.attempt.board.phase === 'exhausted'))) {
          blockedLives = true; return;
        }
        const beforeBoard = next.attempt.board;
        result = dispatch(next, cmd, deal, localDay());
        if (STOREFRONT_PREVIEW && result.accepted && !result.next.attempt.daily &&
            (result.next.platform?.completedCampaign.length ?? 0) > (next.platform?.completedCampaign.length ?? 0)) {
          recordStoreClear(result.next, Date.now());
        }
        if (LIVES_PREVIEW && result.accepted) recordLiveOpsWin(next, result.next, deal, Date.now());
        if (PICTURE_PREVIEW && result.accepted && result.next.attempt.board.phase === 'won') {
          recordPictureWin(next, result.next, deal, Date.now());
        }
        if (result.next.dailyTasks && result.accepted) {
          const now = Date.now();
          if (TASKS_PREVIEW) updatePreviewTasks(result.next, now);
          if (cmd.type === 'restart') result.next.attempt.verifiedTaskHints = 0;
          if (cmd.type === 'hint' && typeof next.attempt.verifiedTaskHints === 'number') {
            result.next.attempt.verifiedTaskHints = next.attempt.verifiedTaskHints + 1;
          }
          for (const signal of acceptedTaskSignals(next, result, cmd, deal)) recordTaskSignal(result.next, now, signal);
        }
        Object.assign(next, result.next);
        if (result.accepted) {
          if (cmd.type === 'transfer' || cmd.type === 'draw' || cmd.type === 'recycle') {
            recordLearning(next, beforeBoard, cmd, deal);
            if (!seenTutorial(next, 'learn:covered-waste') && coversPlayableWaste(beforeBoard, cmd, deal)) {
              coveredWaste = true;
              markTutorial(next, 'learn:covered-waste');
            }
          }
          const t = next.attempt.telemetry ??= { started: false, finished: false, activeMs: 0 };
          t.activeMs = cmd.type === 'restart' ? 0 : telemetry.activeMs();
          if (['transfer', 'draw', 'recycle'].includes(cmd.type) && !t.started) { t.started = true; started = true; }
          if (next.attempt.board.phase !== 'playing' && !t.finished) { t.finished = true; finished = true; }
        }
      });
    } catch {
      message(store.needsRecovery ? 'Проверяем сохранение. Нажмите «Повторить сохранение».' : 'Не удалось сохранить ход. Попробуйте ещё раз.', true);
      scene?.cancel(); renderHud(); return false;
    } finally { presentingCommand = false; }
    if (blockedLives) { retryLifeRestart = true; blockedLifeLevel = undefined; openLives(); return false; }
    if (!result) return false;
    if (result.accepted) {
      if (started) { telemetry.track('level_start'); if (save.attempt.daily) telemetry.track('daily_start'); }
      if (cmd.type === 'restart') { telemetry.track('level_restart'); announceDeal(); }
      if (cmd.type === 'hint' || cmd.type === 'undo' || cmd.type === 'place-joker') telemetry.track('helper_used', { helper: cmd.type === 'place-joker' ? 'joker' : cmd.type });
      if (finished) telemetry.track(save.attempt.board.phase === 'won' ? 'level_win' : 'level_fail');
      for (const event of result.events) if ((event.type === 'coins' || event.type === 'meta-reward' || event.type === 'win' && !save.attempt.daily) && event.amount) telemetry.track('reward_granted', { reason: event.type === 'coins' ? 'core_streak' : event.type === 'meta-reward' ? event.reason! : 'level_win', amount: event.amount });
      if (result.events.some(e => e.type === 'meta-reward' && e.reason === 'daily_completion')) telemetry.track('daily_completion');
      if (cmd.type !== 'hint') activeHint = undefined;
      scene?.clearHint();
      const boardCommand = ['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined;
      const major = result.events.find(e => e.type === 'win') ?? result.events.find(e => e.type === 'unlock') ?? result.events.find(e => e.type === 'complete') ?? result.events.find(e => e.type === 'key') ?? result.events.find(e => e.type === 'coins') ?? result.events[0];
      const coreCoins = result.events.filter(e => e.type === 'coins').reduce((n,e) => n + (e.amount ?? 0), 0);
      const hasCoinFlight = coreCoins > 0;
      const lost = save.attempt.board.phase === 'exhausted';
      // The save/grant is already durable. Only optional sound/haptics/coins
      // follow the visible contact and may be dropped when superseded.
      const present = () => {
        if (lost) { runtime.play('loss'); runtime.pulse('loss'); }
        else if (major) {
          runtime.play(major.type === 'coins' ? 'transfer' : major.type);
          if (major.type === 'key' || major.type === 'unlock' || major.type === 'joker') runtime.pulse(major.type === 'key' ? 'coins' : major.type === 'unlock' ? 'complete' : 'hint');
          if (['transfer', 'complete', 'coins', 'win', 'undo', 'hint'].includes(major.type)) runtime.pulse(major.type === 'coins' ? 'transfer' : major.type as 'transfer' | 'complete' | 'win' | 'undo' | 'hint');
        }
        if (hasCoinFlight) coinBurst($('#streak-reward'), coreCoins);
      };
      scene?.sync(result.events, cmd.type === 'restart', boardCommand, cmd.type === 'transfer' && major ? { kind: major.type, play: present } : undefined);
      if (cmd.type !== 'transfer') present();
      if (boardCommand && campaignAdsApproved()) {
        const attempt = save.attempt.id, revision = save.revision;
        clearTimeout(adBreakTimer);
        adBreakTimer = setTimeout(() => {
          if (!alive || saving || serviceBusy || screen !== 'game' || runtime.activity.isBlocked() ||
              save.attempt.id !== attempt || save.revision !== revision ||
              !eligibleAdBreak(save, deal, Date.now(), launchedAt, campaignAdsApproved(), Boolean(scene?.idleForAd()))) return;
          void ads.show({ kind: 'interstitial', placement: 'ads-break', mode: 'campaign', attempt, dealId: deal.id });
        }, 1800);
      }
      if (coveredWaste)
        message('Подходящая карта теперь под верхней картой сброса. Её можно вернуть на новом круге.');
      if (save.attempt.board.phase !== 'playing') {
        const delay = save.settings.reducedMotion ? 100 : save.attempt.board.phase === 'won' ? 0 : 465;
        const collectionDeadline = hasCoinFlight ? Infinity : performance.now() + 720;
        clearTimeout(outcomeTimer); outcomeTimer = setTimeout(() => outcome(collectionDeadline), delay);
      }
    } else {
      scene?.cancel(); scene?.reject(['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined);
      const broken = progressBefore > 0 && save.attempt.streak.progress === 0;
      runtime.play(broken ? 'streak-break' : 'invalid'); runtime.pulse(broken ? 'streak-break' : 'invalid');
      if (broken) {
        for (const cell of [...$('#streak').children].slice(0, progressBefore)) {
          cell.getAnimations().forEach(animation => animation.cancel());
          const fade = { background: '#e7a999', borderColor: '#ffd0b4' };
          cell.animate(save.settings.reducedMotion ? [fade, {}] : [fade, { ...fade, transform: 'translateY(2px) scale(.83)' }, {}], { duration: 240 });
        }
      }
      telemetry.track('move_rejected', { reason: result.reason ?? 'unknown' }); message(result.reason ?? 'Сюда не подходит', true);
    }
    renderHud();
    const moves = save.attempt.board.movesLeft;
    if (result.accepted && moves !== null && moves > 0 && moves <= 5 && movesBefore !== null && moves < movesBefore && !save.settings.reducedMotion) {
      const counter = $('#moves');
      counter.getAnimations().forEach(animation => animation.cancel());
      counter.animate([{ transform: 'none' }, { transform: 'translateX(-2px) scale(1.08)' },
        { transform: 'translateX(2px)' }, { transform: 'none' }], { duration: 230, easing: 'ease-out' });
    }
    if (save.attempt.board.phase === 'playing') showGuidance(cmd.type !== 'hint');
    return result.accepted;
  }
  function restoreRewardedResult() {
    if (!rewardedResultAttempt) return false;
    if (screen !== 'game' || save.attempt.id !== rewardedResultAttempt || save.attempt.board.phase !== 'exhausted') {
      rewardedResultAttempt = undefined;
      return false;
    }
    if (runtime.activity.isBlocked()) return false;
    rewardedResultAttempt = undefined;
    outcome();
    return true;
  }
  function logTaskAction(next: Save, kind: TaskSignal['kind'], channel: TaskSignal['channel']) {
    if (!next.dailyTasks) return;
    const now = Date.now();
    if (TASKS_PREVIEW) updatePreviewTasks(next, now);
    recordTaskSignal(next, now, { id: `game:${next.attempt.id}:${next.revision}:${kind}`, kind, channel, amount: 1 });
  }
  function logTaskContinue(next: Save, moved: boolean) {
    if (moved) logTaskAction(next, 'BuyExtraMoves', 'continue');
    return moved;
  }
  function buyTaskHelper(next: Save, helper: 'hint'|'undo'|'joker') {
    const bought = purchaseHelper(next, helper);
    if (bought) logTaskAction(next, 'BuyBoosters', 'wallet');
    return bought;
  }
  function renderTasks() {
    $('#daily-tasks-open').hidden = false;
    if (!$<HTMLDialogElement>('#daily-tasks-dialog').open) return;
    const current = currentTasks(save);
    if (!current) return;
    const taskNames: Record<string, string> = {
      DailyLogin: 'Зайти в игру', DrawCards: 'Взять карту из колоды', ExecuteMoves: 'Сделать 4 хода',
      CollectThemes: 'Собрать тему', CompleteLevels: 'Впервые пройти уровень',
    };
    const prizeNames: Record<string, string> = { Coins: 'монет', MoveHint: 'подсказка', Undo: 'отмена', Medals: 'мед.' };
    $('#daily-tasks-medals').textContent = `Медали недели · ${current.week.totalMedals}/5`;
    const list = $('#daily-tasks-list');
    list.replaceChildren(...current.day.tasks.map(task => {
      const row = document.createElement('section'), label = document.createElement('strong'), button = document.createElement('button');
      label.textContent = `${taskNames[task.kind] ?? task.kind} · ${task.progress}/${task.target}`;
      button.className = 'secondary';
      button.textContent = task.claimed ? 'Получено' : `Получить · ${task.prize.quantity} ${prizeNames[task.prize.kind] ?? ''}`;
      button.disabled = saving || Boolean(task.claimed) || task.progress < task.target;
      button.addEventListener('click', () => { void write(next => claimTask(next, current.day.utc, task.id)).catch(() => message('Не удалось сохранить награду.', true)); }, { once: true });
      row.append(label, button);
      return row;
    }));
    const weekly = $<HTMLButtonElement>('#daily-tasks-weekly');
    weekly.disabled = saving || current.week.totalMedals < 5 || current.week.claimedMilestones.includes('week');
  }

  const showPicture = () => PICTURE_PREVIEW || Boolean(save.picture);
  function renderPicture() {
    const picture = save.picture, tokens = pictureTokens(save), parts = picture?.parts ?? [];
    const gallery = Boolean(picture?.gallery), complete = parts.length === PICTURE_PRICES.length;
    const home = $('#picture-home'), result = $('#picture-result');
    home.hidden = !showPicture();
    home.textContent = parts.length ? `Альбом · ${parts.length}/${PICTURE_PRICES.length}` : 'Альбом';
    result.hidden = !showPicture() || save.attempt.board.phase !== 'won' || Boolean(save.attempt.daily);
    result.textContent = picture?.lastWinAttempt === save.attempt.id ? 'Альбом · +2 жетона и 3 монеты' : 'Альбом';
    if (!$<HTMLDialogElement>('#picture-dialog').open) return;
    $('#picture-title').textContent = PICTURE_TITLE;
    $('#picture-status').textContent = gallery ? 'Иллюстрация сохранена в альбоме.' : `Жетоны · ${tokens}  •  Открыто ${parts.length} из ${PICTURE_PRICES.length}`;
    $('#picture-prize').textContent = gallery ? '' : pictureClosed(save, Date.now())
      ? 'Событие завершилось. Заработанные жетоны можно потратить.'
      : 'За первую победу на каждом уровне — 2 жетона и 3 монеты.';
    const claim = $<HTMLButtonElement>('#picture-claim');
    claim.hidden = !complete || gallery;
    claim.disabled = saving || serviceBusy;
    for (const button of document.querySelectorAll<HTMLButtonElement>('#picture-grid button')) {
      const part = Number(button.dataset.part);
      const open = parts.includes(part);
      button.toggleAttribute('data-open', open);
      button.setAttribute('aria-label', open ? `Фрагмент ${part + 1} открыт` : `Открыть фрагмент ${part + 1} за ${PICTURE_PRICES[part]} жетона`);
      button.textContent = open ? '' : `${PICTURE_PRICES[part]} жет.`;
      button.disabled = open || saving || serviceBusy || tokens < PICTURE_PRICES[part];
    }
  }
  async function showPictureDialog() {
    if (!showPicture() || saving || serviceBusy) return;
    pictureReturnToResult = $<HTMLDialogElement>('#result').open;
    try {
      await write(next => {
        const now = Date.now();
        if (PICTURE_PREVIEW && !next.picture) openPictureEvent(next, now);
        else observePictureClock(next, now);
      });
      if (!save.picture || !alive) return;
      openDialog('#picture-dialog');
      renderPicture();
    } catch { message('Не удалось открыть альбом. Попробуйте ещё раз.', true); }
  }
  function renderRewardOffers() {
    const now = Date.now(), available = screen === 'game' && ads.status.mode === 'test' && ads.status.rewarded;
    const busy = saving || serviceBusy || store.needsRecovery;
    const kind = $<HTMLSelectElement>('#win-video-kind').value as WinOffer;
    const quote = offerQuote(save, deal, kind, now);
    $('#win-video-offers').hidden = !available || !quote;
    const win = $<HTMLButtonElement>('#win-video-claim');
    win.textContent = quote ? `Получить ещё ${quote.amount} монет` : '';
    win.disabled = busy;
    for (const [selector, placement] of [['#shop-video-claim', 'shop-free-coins'], ['#theme-video-claim', 'rewarded-theme']] as const) {
      const button = $<HTMLButtonElement>(selector);
      button.hidden = !available || !offerQuote(save, deal, placement, now);
      button.disabled = busy;
    }
    const expires = save.rewardOffers?.themeUntil ?? 0;
    $('#app').toggleAttribute('data-reward-theme', expires > now);
    clearTimeout(themeExpiry);
    if (expires > now) themeExpiry = setTimeout(renderRewardOffers, Math.min(expires - now, 86_400_000));
  }
  function restoreOfferDialog() {
    if (!rewardOfferReturn || runtime.activity.isBlocked()) return false;
    const { selector, attempt } = rewardOfferReturn;
    rewardOfferReturn = undefined;
    if (screen !== 'game' || save.attempt.id !== attempt) return false;
    if (selector === '#result') outcome();
    else openDialog(selector);
    return true;
  }
  async function requestRewardOffer(kind: OfferPlacement, selector: '#result'|'#helpers'|'#appearance') {
    if (!REWARD_OFFER_PREVIEW || saving || serviceBusy || screen !== 'game' || ads.status.mode !== 'test' || !ads.status.rewarded) return;
    const attempt = save.attempt.id;
    serviceBusy = true;
    try {
      const offer = await write(next => prepareRewardOffer(next, deal, kind, Date.now(), crypto.randomUUID()));
      if (!offer || !alive || save.attempt.id !== attempt) return;
      closeDialogs();
      const result = await ads.show({ kind: 'rewarded', placement: kind, attempt: offer.id, dealId: offer.dealId, mode: 'campaign' });
      if (!alive) return;
      rewardOfferReturn = { attempt, selector };
      if (!result.shown) message('Сейчас видео недоступно. Попробуйте позже.', true);
    } catch { message('Не удалось сохранить предложение. Попробуйте ещё раз.', true); }
    finally {
      serviceBusy = false;
      if (alive) { restoreOfferDialog(); renderHud(); }
    }
  }
  async function rewarded(placement: RewardPlacement) {
    if (serviceBusy || saving) return;
    const requestAttempt = save.attempt.id;
    const fromLoss = save.attempt.board.phase === 'exhausted';
    serviceBusy = true; closeDialogs(); renderHud();
    const result = await ads.show({ kind: 'rewarded', placement, attempt: requestAttempt, dealId: deal.id, mode: save.attempt.daily ? 'daily' : 'campaign' });
    if (!alive) return;
    // Dismissal itself grants nothing; receipt recovery independently commits an earned reward.
    if (placement === 'continue') continueVideoFailed = result.shown ? undefined : requestAttempt;
    if (fromLoss) rewardedResultAttempt = requestAttempt;
    serviceBusy = false; renderHud();
    if (!result.shown && (!fromLoss || placement !== 'continue' || !requiresContinueProof(save.attempt)))
      message('Сейчас видео недоступно. Попробуйте позже.', true);
    restoreRewardedResult();
  }
  async function replay() {
    if (serviceBusy || saving) return;
    serviceBusy = true; closeDialogs();
    if (save.attempt.board.phase === 'won' && deal.campaignLevel !== undefined && !adFree(save, Date.now()) && interstitialEligible(save, deal.campaignLevel, 'campaign', Date.now(), launchedAt))
      await ads.show({ kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: deal.id, mode: save.attempt.daily ? 'daily' : 'campaign' });
    serviceBusy = false;
    if (!alive) return;
    // Dismissal and foreground are independent. Never continue behind a displayed ad.
    if (runtime.activity.isBlocked()) {
      const remove = runtime.activity.onBlockedChange(blocked => { if (!blocked) { remove(); if (alive) void execute({ type: 'restart', attemptId: crypto.randomUUID() }); } });
    } else await execute({ type: 'restart', attemptId: crypto.randomUUID() });
  }
  function renderHome() {
    renderLives();
    if (LIVES_PREVIEW && unlockedLevel(save) >= 16) prewarmLiveOps();
    $('#app').dataset.palette = cosmeticUnlocked(save, 'palette') ? save.settings.palette ?? 'green' : 'green';
    $('#app').dataset.back = cosmeticUnlocked(save, 'cardBack') ? save.settings.cardBack ?? 'classic' : 'classic';
    if (screen !== 'home' && !['#appearance','#calendar','#level-picker'].some(id => $<HTMLDialogElement>(id).open)) return;
    renderMeta(save, !ready || saving || serviceBusy);
    const completed = completedLevels(save), unlocked = unlockedLevel(save), campaign = campaignAttempt(save), campaignDeal = campaign && findDeal(campaign.dealId), current = campaign?.board.phase === 'playing';
    $('#campaign-progress').textContent = `${completed} / ${CAMPAIGN_LENGTH}`;
    $('#home-progress').textContent = `Пройдено ${completed} из ${CAMPAIGN_LENGTH}`;
    $('#campaign-done').hidden = completed < CAMPAIGN_LENGTH;
    $('#campaign-done').textContent = `Все ${CAMPAIGN_LENGTH} уровней пройдены. Любую раздачу можно сыграть ещё раз.`;
    const label = current ? (campaignDeal?.campaignLevel ? `${campaign?.telemetry?.started ? 'Продолжить' : 'Играть'} · уровень ${campaignDeal.campaignLevel}` : 'Продолжить пробную раздачу')
      : campaign && (!outcomeViewed || save.attempt.daily) ? (campaignDeal?.campaignLevel ? `Результат · уровень ${campaignDeal.campaignLevel}` : 'Результат пробной раздачи') : completed === CAMPAIGN_LENGTH ? 'Выбрать уровень' : `Играть · уровень ${unlocked}`;
    const parts = label.split(' · ');
    const homeDeal = current || campaign && (!outcomeViewed || save.attempt.daily)
      ? campaignDeal : completed === CAMPAIGN_LENGTH ? undefined : campaignDeals[unlocked - 1];
    const homeDifficulty = setDifficulty($('#home-play'), homeDeal);
    $('#home-play').replaceChildren(document.createTextNode(parts[0]), Object.assign(document.createElement('small'),
      { textContent: (parts[1] ?? 'Кампания') + (homeDifficulty ? ' · ' + homeDifficulty : '') }));
    $<HTMLButtonElement>('#home-play').disabled = !ready || saving || serviceBusy;
    const focusId = campaign?.id ?? 'new';
    if (chapterAttemptId !== focusId) {
      chapterAttemptId = focusId;
      chapterPage = Math.min(Math.floor(((campaignDeal?.campaignLevel ?? unlocked) - 1) / 20), Math.ceil(CAMPAIGN_LENGTH / 20) - 1);
    }
    $('#chapter-label').textContent = `Уровни ${chapterPage * 20 + 1}–${Math.min(CAMPAIGN_LENGTH, chapterPage * 20 + 20)}`;
    $('#chapter-name').textContent = ['Первые связи', 'Правила и новые темы', 'По своим местам', 'Последние ключи', 'Новые мастерские'][chapterPage] ?? 'Продолжение кампании';
    $<HTMLButtonElement>('#chapter-prev').disabled = chapterPage === 0 || saving;
    $<HTMLButtonElement>('#chapter-next').disabled = chapterPage === Math.ceil(CAMPAIGN_LENGTH / 20) - 1 || saving;
    const grid = $('#level-grid');
    if (!grid.children.length) for (const level of campaignDeals) {
      const button = document.createElement('button'); button.className = 'level-button'; button.dataset.level = String(level.campaignLevel); button.id = `level-${level.campaignLevel}`; grid.append(button);
    }
    for (const button of grid.querySelectorAll<HTMLButtonElement>('button')) {
      const level = Number(button.dataset.level), item = campaignDeals[level - 1], done = save.platform?.completedCampaign.includes(campaignId(level)) ?? false;
      button.hidden = Math.floor((level - 1) / 20) !== chapterPage;
      const difficulty = setDifficulty(button, item);
      button.replaceChildren(document.createTextNode(String(level)));
      if (difficulty) button.append(Object.assign(document.createElement('span'), { className: 'tier-dot', textContent: item.difficultyTier === 'superhard' ? '!!' : '!' }));
      button.disabled = level > unlocked || !ready || saving || serviceBusy;
      const activeLevel = campaign?.board.phase === 'playing' && isCurrentCampaignDeal(campaign.dealId, item);
      button.dataset.active = String(activeLevel);
      button.setAttribute('aria-current', activeLevel ? 'step' : 'false');
      button.dataset.completed = String(done); button.dataset.next = String(level === unlocked && !done);
      button.setAttribute('aria-label', `Уровень ${level}: ${item.title}${difficulty ? ', ' + difficulty : ''}${done ? ', пройден' : level > unlocked ? ', закрыт' : ''}`);
    }
  }
  function maybeIntroduceRule(requested?: 'joker'): boolean {
    const intro = requested ?? ruleIntroduction(save, deal);
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
    const instruction = currentLesson();
    if (animate && instruction?.action && !inspectMode) {
      const attemptId = save.attempt.id, revision = save.revision;
      guideTimer = setTimeout(() => {
        if (alive && screen === 'game' && !runtime.activity.isBlocked() && save.attempt.id === attemptId && save.revision === revision) {
          game?.loop.wake(); scene?.teach(instruction.action!);
        }
      }, instruction.accepts ? 450 : idle ? 6000 : instruction.delay ?? 650);
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
      const animateEntry = !previousTarget || previousTarget.id !== save.attempt.id;
      outcomeViewed = false; ready = false; $('#app').dataset.ready = 'false'; screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false; runtime.activity.setBlocked('screen', false);
      scene?.setDeal(deal, animateEntry);
    } catch { message('Не удалось сохранить переход. Попробуйте ещё раз.', true); }
    finally { serviceBusy = false; if (ready) runtime.activity.setBlocked('level-transition', false); renderHud(); renderHome(); }
  }
  dismissDifficulty = () => {
    const from = difficultyRequest?.returnTo;
    difficultyRequest = undefined;
    if (from === 'result') outcome();
    else if (from === 'picker') openDialog('#level-picker');
    else closeDialogs();
  };
  $('#difficulty-cancel').addEventListener('click', () => dismissDifficulty?.(), domOptions);
  $('#difficulty-play').addEventListener('click', () => {
    const level = difficultyRequest?.level;
    difficultyRequest = undefined;
    if (level) void openLevel(level, true, false);
  }, domOptions);
  function presentLevelStart() {
    outcomeViewed = false; ready = false; $('#app').dataset.ready = 'false';
    screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false; runtime.activity.setBlocked('screen', false);
    scene?.setDeal(deal, true);
  }
  async function openLevel(level: number, confirmed = false, announce = true, redeal?: { attemptId: string; dealId: string }) {
    if (!alive || !ready || saving || serviceBusy || level < 1 || level > unlockedLevel(save)) return;
    if (redeal && (redeal.attemptId !== save.attempt.id || campaignRedeal(save.attempt)?.id !== redeal.dealId)) return;
    const target = campaignDeals[level - 1];
    const campaign = campaignAttempt(save);
    if (campaign?.board.phase === 'playing' && isCurrentCampaignDeal(campaign.dealId, target)) {
      if (save.attempt.daily) await activateMode('campaign');
      else { closeDialogs(); showGame(); }
      return;
    }
    if (!confirmed && campaign?.board.phase === 'playing' && (campaign.telemetry?.started || campaign.undo.length > 0)) {
      requestedLevel = level; $('#switch-title').textContent = `Начать уровень ${level}?`; openDialog('#switch-level'); return;
    }
    const tier = difficultyLabel(target);
    if (tier && announce) {
      difficultyRequest = { level, returnTo: $<HTMLDialogElement>('#result').open ? 'result' :
        $<HTMLDialogElement>('#level-picker').open ? 'picker' : undefined };
      $('#difficulty-level').textContent = `УРОВЕНЬ ${level}`;
      $('#difficulty-title').textContent = tier;
      setDifficulty($('#difficulty-entry'), target);
      openDialog('#difficulty-entry'); return;
    }
    closeDialogs(); serviceBusy = true; renderHome();
    // Only the deliberate transition from a won level can request an interstitial.
    if (screen === 'game' && save.attempt.board.phase === 'won' && deal.campaignLevel !== undefined && !adFree(save, Date.now()) && interstitialEligible(save, deal.campaignLevel, 'campaign', Date.now(), launchedAt))
      await ads.show({ kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: deal.id, mode: save.attempt.daily ? 'daily' : 'campaign' });
    const enter = async () => {
      removeForeground?.(); removeForeground = undefined;
      runtime.activity.setBlocked('level-transition', true);
      let started = false, failed = false, blockedLives = false;
      try {
        clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined;
        clearTimeout(outcomeTimer); clearTimeout(guideTimer); activeHint = undefined; setInspect(false);
        started = await write(next => {
          const previous = campaignAttempt(next);
          const previousDeal = previous && findDeal(previous.dealId);
          const selected = redeal ? campaignRedeal(next.attempt) : selectCampaignDeal(next, target, previous);
          if (!selected || (redeal && (next.attempt.id !== redeal.attemptId || selected.id !== redeal.dealId))) return false;
          if (LIVES_PREVIEW && !mayStartCampaignAttempt(next, previous, Date.now())) {
            blockedLives = true; return false;
          }
          if (next.attempt.daily) switchMode(next, 'campaign', previousDeal ?? selected, crypto.randomUUID());
          beginDeal(next, selected, crypto.randomUUID(), previousDeal, redeal ? undefined : equalityPreviewPolicy);
          return true;
        });
        if (started) {
          if (redeal) telemetry.track('level_restart');
          presentLevelStart();
        }
      } catch { failed = true; if (!redeal) message('Не удалось сохранить переход. Попробуйте ещё раз.', true); }
      finally { serviceBusy = false; if (ready) runtime.activity.setBlocked('level-transition', false); renderHud(); renderHome(); }
      if (blockedLives) { blockedLifeLevel = level; retryLifeRestart = false; openLives(); return; }
      if (redeal && !started) {
        if (save.attempt.board.phase === 'playing') showGame();
        else {
          outcome();
          if (failed) {
            const error = $('#result-continue-error');
            error.textContent = store.needsRecovery ? 'Проверьте, сохранился ли новый расклад.' : 'Не удалось сохранить новый расклад. Попробуйте ещё раз.';
            error.hidden = false;
          }
        }
      }
    };
    if (runtime.activity.getBlockReasons().some(r => r !== 'screen')) {
      removeForeground?.(); removeForeground = runtime.activity.onBlockReasonsChange(() => {
        if (runtime.activity.getBlockReasons().every(r => r === 'screen')) void enter();
      });
    } else await enter();
  }
  const root = $('#game-root');
  function size() {
    const rect = { width: innerWidth, height: innerHeight }, ratio = getRenderPixelRatio(1.5);
    return { rect, backing: getBackingStoreSize(Math.max(1, rect.width), Math.max(1, rect.height), ratio) };
  }
  const initial = size();
  scene = new BoardScene({ jokerMode: active => $('#joker').setAttribute('aria-pressed', String(active)), deal, getSave: () => save, command: execute, allows: allowsLesson, praise: showPraise, sound: name => runtime.play(name),
    inputRoot: () => root, readerZone: () => $('#inspect').getBoundingClientRect(), peek: peekCard,
    boardBounds() { const rect = root.getBoundingClientRect(), zoom = game?.scale.zoom ?? initial.rect.width / initial.backing.width;
      return { x: (rect.width ? rect.x : 12) / zoom, y: (rect.height ? rect.y : 76) / zoom,
        width: (rect.width || innerWidth - 24) / zoom, height: (rect.height || Math.max(280, innerHeight - 260)) / zoom }; },
    inspect(id) {
      const card = deal.cards[id];
      definitionCardId = id;
      const definition = $<HTMLButtonElement>('#definition-use');
      definition.hidden = !REWARD_OFFER_PREVIEW && !(STOREFRONT_PREVIEW && (save.rewardOffers?.definitions ?? 0));
      definition.disabled = (save.rewardOffers?.definitions ?? 1) === 0;
      definition.textContent = `Связанное слово · ${save.rewardOffers?.definitions ?? 1}`;
      $('#definition-related').hidden = true;
      setInspect(false);
      const image = $<HTMLImageElement>('#word-image'), artwork = cardArtwork(card, deal); image.hidden = !artwork;
      if (artwork) { image.src = artwork; image.alt = card.text; }
      else image.removeAttribute('src');
      const content = cardReader(card, deal);
      $('#word-description').hidden = content.description === undefined;
      $('#word-title').textContent = content.title; $('#word-description').textContent = content.description ?? '';
      openDialog('#inspect-dialog');
    },
    ready(active, newDeal) {
      scene = active;
      active.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        ready = true; resizeToRoot(); runtime.activity.setBlocked('level-transition', false); telemetry.ready(); setInput(); updateBanner(); renderHud(); renderHome(); $('#loading').hidden = true; $('#app').dataset.ready = 'true'; $('#app').dataset.presentedDeal = deal.id;
        if (firstLaunch) { firstLaunch = false; showGame(); active.presentDeal(); announceDeal(); }
        else if (screen === 'game') { if (newDeal) announceDeal(); showGuidance(); }
        if (screen === 'game' && save.attempt.board.phase !== 'playing') outcome();
      });
    },
  });
  game = new Phaser.Game({ type: Phaser.AUTO, parent: $('#game-surface'), width: initial.backing.width, height: initial.backing.height,
    transparent: true, antialiasGL: false, banner: false, audio: { noAudio: true }, scene: [scene],
    scale: { mode: Phaser.Scale.NONE, zoom: initial.rect.width / initial.backing.width },
  });
  const renderer = game;
  let boardSize = '';
  function resizeToRoot() {
    if (!ready || screen !== 'game' || !game?.isBooted) return;
    const next = size(); positionDeckTools(save);
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
  // Text reflow can move the result inside the same viewport. Optional coins
  // must not keep travelling through the old title/amount coordinates.
  const resultResize = new ResizeObserver(() => {
    if ($('#result').contains($('#coin-layer')) && wallet?.active) cancelCoins();
  });
  for (const selector of ['#result', '#result-title', '#result-total']) resultResize.observe($(selector));
  window.addEventListener('resize', resizeToRoot, domOptions);
  window.addEventListener('resize', () => { cancelCoins(); if ($<HTMLDialogElement>('#result').open) pinWallet(); }, domOptions);
  document.querySelectorAll('.sheet-body').forEach(body => body.addEventListener('scroll', () => cancelCoins(), domOptions));
  const unblock = runtime.activity.onBlockReasonsChange(() => {
    const blocked = runtime.activity.isBlocked();
    if (runtime.activity.getBlockReasons().some(reason => reason !== 'shuffle')) cancelShuffle?.();
    setInput(); updateBanner();
    if (screen === 'game' && runtime.activity.getBlockReasons().every(r => r === 'modal') && ready) {
      scene?.sync();
      if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs();
      if (!blocked) {
        void ads.refresh(); void ads.recover();
        if (restoreRewardedResult() || restoreOfferDialog()) return;
        playDealSound(); showGuidance();
      }
    }
    if (!renderer.isBooted) return;
    if (blocked && ready) { scene?.clearFeedback(); renderer.loop.sleep(); if (runtime.activity.getBlockReasons().some(r => r !== 'modal' && r !== 'screen')) cancelCoins(); }
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
  dialogs.forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialog.id === 'learn-rule') dismissRule?.(); else if (dialog.id === 'difficulty-entry') dismissDifficulty?.(); else closeDialogs(); }, domOptions));
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', () => closeDialogs(), domOptions));
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
  if (TASKS_PREVIEW) {
    $('#daily-tasks-open').addEventListener('click', async () => {
      if (saving || serviceBusy) return;
      try {
        await write(next => {
          const now = Date.now();
          updatePreviewTasks(next, now);
          logTaskAction(next, 'DailyLogin', 'login');
        });
        openDialog('#daily-tasks-dialog');
        renderTasks();
      } catch { message('Не удалось открыть задачи.', true); }
    }, domOptions);
    $('#daily-tasks-weekly').addEventListener('click', () => {
      const current = currentTasks(save);
      if (current && !saving) void write(next => claimTaskMilestone(next, current.week.startUtc, 'week')).catch(() => message('Не удалось сохранить награду.', true));
    }, domOptions);
  }
  if (showPicture()) {
    for (const [part] of PICTURE_PRICES.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.part = String(part);
      $('#picture-grid').append(button);
      button.addEventListener('click', () => {
        if (saving || serviceBusy) return;
        void write(next => revealPicturePart(next, part)).catch(() => message('Не удалось сохранить фрагмент.', true));
      }, domOptions);
    }
    for (const selector of ['#picture-home', '#picture-result']) $(selector).addEventListener('click', () => { void showPictureDialog(); }, domOptions);
    $('#picture-dialog').addEventListener('close', () => {
      if (!pictureReturnToResult) return;
      pictureReturnToResult = false;
      if (screen === 'game' && save.attempt.board.phase === 'won' && !dialogs.some(dialog => dialog.open)) outcome();
    }, domOptions);
    for (const selector of ['#picture-close', '#picture-done']) $(selector).addEventListener('click', () => closeDialogs(), domOptions);
    $('#picture-claim').addEventListener('click', () => {
      if (saving || serviceBusy) return;
      void write(next => claimPicture(next, Date.now())).catch(() => message('Не удалось сохранить награду.', true));
    }, domOptions);
  }
  if (REWARD_OFFER_PREVIEW) {
    const select = $<HTMLSelectElement>('#win-video-kind');
    for (const [kind, label] of Object.entries(offerLabels)) select.add(new Option(label, kind));
    select.addEventListener('change', renderRewardOffers, domOptions);
    $('#win-video-claim').addEventListener('click', () => { void requestRewardOffer(select.value as WinOffer, '#result'); }, domOptions);
    $('#shop-video-claim').addEventListener('click', () => { void requestRewardOffer('shop-free-coins', '#helpers'); }, domOptions);
    $('#theme-video-claim').addEventListener('click', () => { void requestRewardOffer('rewarded-theme', '#appearance'); }, domOptions);
    $('#definition-use').addEventListener('click', async () => {
      const id = definitionCardId;
      if (!id || saving || serviceBusy) return;
      try {
        const word = await write(next => {
          const related = revealRelatedWord(next, deal, id);
          if (related) logTaskAction(next, 'UseDefinitions', 'helper');
          return related;
        });
        if (definitionCardId !== id || !$<HTMLDialogElement>('#inspect-dialog').open) return;
        const hint = $('#definition-related');
        hint.textContent = word ? `Связанное слово · ${word}` : 'Откройте ещё одну карту этой темы.';
        hint.hidden = false;
        if (word) {
          const button = $<HTMLButtonElement>('#definition-use');
          button.textContent = `Связанное слово · ${save.rewardOffers?.definitions ?? 0}`;
          button.disabled = (save.rewardOffers?.definitions ?? 0) === 0;
        }
      } catch { message('Не удалось сохранить расход заряда.', true); }
    }, domOptions);
  }
  $('#result-home').addEventListener('click', goHome, domOptions);
  $('#levels-open').addEventListener('click', goHome, domOptions);
  $('#switch-confirm').addEventListener('click', () => { const level = requestedLevel; requestedLevel = undefined; if (level) void openLevel(level, true); }, domOptions);
  $('#menu').addEventListener('click', () => { $<HTMLDetailsElement>('#pause-options').open = screen === 'home'; openDialog('#settings'); }, domOptions);
  $('#pause-options').addEventListener('toggle', () => { const expanded = $<HTMLDetailsElement>('#pause-options').open;
    $('#pause-options summary').textContent = expanded && screen === 'game' ? 'Назад' : 'Настройки';
    $('#pause-title').textContent = expanded ? 'Настройки' : screen === 'home' ? 'Настройки' : 'Пауза';
  }, domOptions);
  $('#joker').addEventListener('click', () => {
    if (deal.training !== 'joker' && deal.campaignLevel !== undefined && !seenTutorial(save,'joker-used') && !seenTutorial(save,'intro:joker') && maybeIntroduceRule('joker')) return;
    if (!save.profile.jokers && !freeJokerPractice(save, deal)) { openHelpers('joker'); return; }
    const active = $('#joker').getAttribute('aria-pressed') !== 'true'; setInspect(false); scene?.setJoker(active); renderHud();
    message('');
  }, domOptions);
  $('#buy-joker').addEventListener('click', async () => {
    if (serviceBusy || saving || !helperUnlocked(save, 'joker', deal)) return;
    try { if (await write(next => buyTaskHelper(next, 'joker'))) { telemetry.track('helper_purchase', { helper: 'joker', cost: BALANCE.helperPrices.joker }); helperBought('joker'); } }
    catch { message('Не удалось сохранить покупку. Попробуйте ещё раз.', true); }
    renderHud();
  }, domOptions);
  $('#undo').addEventListener('click', () => { if (!save.profile.undos && !freeUndoPractice(save, deal)) openHelpers('undo'); else void execute({ type: 'undo' }); }, domOptions);
  $('#inspect').addEventListener('click', () => { setInspect(!inspectMode); if (!inspectMode) showGuidance(); }, domOptions);
  $('#restart').addEventListener('click', () => {
    localeRestartAttempt = undefined;
    const hasBonus = bonusKinds.some(kind => pilesFor(save.attempt.board, kind).length > pilesFor(deal.initial, kind).length);
    if (save.attempt.board.phase !== 'won' && (save.attempt.telemetry?.started || hasBonus)) {
      $('#restart-confirm-copy').textContent = `Карты вернутся на исходные места. Потраченные помощники не восстановятся.${hasBonus ? ' Дополнительные места закроются.' : ''}${save.attempt.daily ? '' : ' Текущие отметки пяти побед сбросятся.'}${boardRules(save.attempt.board) < boardRules(deal.initial) ? ' В новой партии тему сначала нужно перенести в верхний слот.' : ''}`;
      openDialog('#restart-confirm');
    }
    else void replay();
  }, domOptions);
  if (LOCALE_PREVIEW) {
    $('#card-language').addEventListener('change', event => {
      const language = (event.target as HTMLSelectElement).value;
      if (language !== 'ru' && language !== 'en' || saving || serviceBusy) return;
      void write(next => { next.settings.contentLanguage = language; }).catch(() => message('Не удалось сохранить язык.', true));
    }, domOptions);
    $('#locale-restart').addEventListener('click', () => {
      if (saving || serviceBusy || !canSwitchCardLanguage(deal)) return;
      localeRestartAttempt = save.attempt.id;
      $('#restart-confirm-copy').textContent = 'Начнётся новая раздача с выбранным языком. Поле и история ходов этой попытки будут заменены.';
      openDialog('#restart-confirm');
    }, domOptions);
    $('#restart-confirm').addEventListener('close', () => { localeRestartAttempt = undefined; }, domOptions);
  }
  $('#restart-confirm-yes').addEventListener('click', async () => {
    const expected = localeRestartAttempt;
    localeRestartAttempt = undefined;
    if (!expected) { void replay(); return; }
    if (!LOCALE_PREVIEW || saving || serviceBusy || expected !== save.attempt.id || !canSwitchCardLanguage(deal) || !campaignDeals[80]) return;
    const oldDeal = deal, target = campaignDeals[80];
    closeDialogs();
    serviceBusy = true;
    runtime.activity.setBlocked('level-transition', true);
    let started = false;
    try {
      started = await write(next => {
        if (next.attempt.id !== expected || next.attempt.dealId !== oldDeal.id) return false;
        const selected = localizedCampaignDeal(next, target);
        if (selected.id === oldDeal.id) return false;
        beginDeal(next, selected, crypto.randomUUID(), oldDeal);
        return true;
      });
      if (started) presentLevelStart();
    } catch { message('Не удалось сохранить новую раздачу.', true); }
    finally { serviceBusy = false; if (!started) runtime.activity.setBlocked('level-transition', false); }
  }, domOptions);
  $('#replace-daily-yes').addEventListener('click', () => { void activateMode('daily', false, true); }, domOptions);
  $('#replay').addEventListener('click', () => { void replay(); }, domOptions);
  $('#result-redeal').addEventListener('click', () => {
    const alternate = campaignRedeal(save.attempt);
    if (alternate?.campaignLevel !== undefined && !store.needsRecovery)
      void openLevel(alternate.campaignLevel, true, false, { attemptId: save.attempt.id, dealId: alternate.id });
  }, domOptions);
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
    const repeat = repeatHint();
    if (save.profile.hints === 0 && !freeHintDemo(save, deal) && !repeat) { openHelpers('hint'); return; }
    if (repeat) {
      renderer.loop.wake(); scene?.hint(repeat);
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
  $('#proof-shuffle').addEventListener('click', async () => {
    if (!ready || saving || serviceBusy || screen !== 'game' || runtime.activity.isBlocked() || !canShuffle(save, deal)) return;
    const request: ShuffleRequest = {
      attemptId: save.attempt.id, dealId: deal.id, revision: save.revision, board: save.attempt.board, deal,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    };
    runtime.activity.setBlocked('shuffle', true);
    renderHud();
    try {
      const proof = await new Promise<BoardCommand[] | null>(resolve => {
        const worker = new Worker(new URL('./game/shuffle.worker.ts', import.meta.url), { type: 'module' });
        const finish = (route: BoardCommand[] | null) => {
          clearTimeout(deadline); worker.terminate(); cancelShuffle = undefined; resolve(route);
        };
        const deadline = setTimeout(() => finish(null), 3500);
        cancelShuffle = () => finish(null);
        worker.onmessage = (event: MessageEvent<BoardCommand[] | null>) => finish(event.data);
        worker.onerror = () => finish(null);
        worker.postMessage(request);
      });
      if (!alive || screen !== 'game' || runtime.activity.getBlockReasons().some(reason => reason !== 'shuffle')) return;
      if (!proof) { message('Не удалось найти выигрышный порядок колоды.', true); return; }
      if (!await write(next => {
        const accepted = commitShuffle(next, deal, request, proof);
        if (accepted) logTaskAction(next, 'UseShuffles', 'helper');
        return accepted;
      })) return;
      scene?.sync();
      if (!runtime.activity.getBlockReasons().some(reason => reason !== 'shuffle')) {
        renderer.loop.wake();
        scene?.animateStockShuffle();
      }
    } catch { if (alive) message('Не удалось перемешать колоду.', true); }
    finally {
      cancelShuffle?.(); runtime.activity.setBlocked('shuffle', false);
      if (alive) renderHud();
    }
  }, domOptions);
  const bonusDialog = $<HTMLDialogElement>('#bonus-offer');
  let bonusPressedButton: HTMLButtonElement | null = null;
  const bonusControl = (event: Event) => (event.target as Element).closest<HTMLButtonElement>('button');
  bonusDialog.addEventListener('pointerdown', event => {
    if (event.isPrimary) bonusPressedButton = bonusControl(event);
  }, domOptions);
  bonusDialog.addEventListener('pointercancel', () => { bonusPressedButton = null; }, domOptions);
  bonusDialog.addEventListener('click', event => {
    const control = bonusControl(event);
    // The opener may be activated on pointerup for touch. Its compatibility
    // click can hit the newly opened modal without a press in that modal.
    if (event.detail > 0 && control && control !== bonusPressedButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    bonusPressedButton = null;
  }, { ...domOptions, capture: true });
  for (const kind of bonusKinds) {
    $(`#bonus-${kind}`).addEventListener('click', () => {
      if (!ready || saving || serviceBusy || store.needsRecovery || runtime.activity.isBlocked()) return;
      bonusSelection = { kind, attemptId: save.attempt.id };
      if (!selectedBonus()) return;
      $('#bonus-title').textContent = kind === 'foundation' ? 'Слот для темы' : 'Дополнительный столбец';
      $('#bonus-copy').textContent = kind === 'foundation'
        ? 'Соберите ещё одну тему одновременно. Слот открыт до конца этой попытки.'
        : 'Перекладывайте сюда карты и группы. Столбец открыт до конца этой попытки.';
      $('#bonus-error').hidden = true;
      renderBonusSheet();
      bonusPressedButton = null;
      openDialog('#bonus-offer');
    }, domOptions);
  }
  $('#bonus-buy').addEventListener('click', async () => {
    const selection = bonusSelection, offer = selectedBonus();
    if (!selection || !offer || saving || serviceBusy) return;
    try {
      if (await write(next => purchaseBonusSlot(next, deal, selection.attemptId, selection.kind))) {
        telemetry.track('helper_purchase', { helper: bonusPlacements[selection.kind], cost: offer.coins });
        closeDialogs(); scene?.sync(); game?.loop.wake(); showGuidance();
      }
    } catch {
      if (store.needsRecovery) { closeDialogs(); message('Проверяем сохранение покупки.', true); }
      else { $('#bonus-error').textContent = 'Покупка не сохранилась. Попробуйте ещё раз.'; $('#bonus-error').hidden = false; }
    }
  }, domOptions);
  $('#bonus-video').addEventListener('click', () => {
    if (bonusSelection && selectedBonus()) void rewarded(bonusPlacements[bonusSelection.kind]);
  }, domOptions);
  for (const helper of ['hint', 'undo'] as const) {
    $(`#buy-${helper}`).addEventListener('click', async () => {
      if (serviceBusy || saving) return;
      try {
        const bought = await write(next => buyTaskHelper(next, helper));
        if (bought) { telemetry.track('helper_purchase', { helper, cost: BALANCE.helperPrices[helper] }); runtime.pulse('button'); helperBought(helper); }
      } catch { message('Не удалось сохранить покупку. Попробуйте ещё раз.', true); }
      renderHud();
    }, domOptions);
    $(`#video-${helper}`).addEventListener('click', () => { void rewarded(helper); }, domOptions);
  }
  scheduleRecoveryClock();
  function renderLives() {
    const data = save.campaignLives;
    const count = data?.remaining ?? LIVES_RULES.max;
    const home = $('#campaign-lives-open');
    home.hidden = !LIVES_PREVIEW;
    $('#campaign-liveops-open').hidden = !LIVES_PREVIEW;
    home.textContent = `Жизни · ${count} из ${LIVES_RULES.max}`;
    $('#campaign-lives-status').textContent = count ? `Жизни · ${count} из ${LIVES_RULES.max}` : 'Для новой партии нужна жизнь.';
    const seconds = data?.refillAt !== undefined ? Math.max(0, Math.ceil((data.refillAt - Date.now()) / 1000)) : undefined;
    $('#campaign-lives-timer').textContent = seconds === undefined ? 'Жизни восстановлены' :
      `Следующая через ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $<HTMLButtonElement>('#campaign-life-coin').disabled = saving || serviceBusy || count >= LIVES_RULES.max || save.profile.coins < LIVES_RULES.coinPrice;
    const credit = $<HTMLButtonElement>('#campaign-life-credit');
    credit.hidden = !data?.earnedCredits;
    credit.disabled = count >= LIVES_RULES.max || saving || serviceBusy;
    $<HTMLButtonElement>('#campaign-life-video').disabled = !livesVideoApproved() || !ads.status.rewarded || count >= LIVES_RULES.max ||
      Boolean(data?.pending) || saving || serviceBusy || Boolean(save.attempt.daily);
    $('#campaign-life-retry').hidden = !count || (!retryLifeRestart && blockedLifeLevel === undefined);
  }
  function openLives() {
    if (!LIVES_PREVIEW) return;
    renderLives(); openDialog('#campaign-lives');
  }
  const lifeTick = LIVES_PREVIEW ? setInterval(() => {
    if (!alive) return;
    const at = save.campaignLives?.refillAt;
    if (!saving && at !== undefined && Date.now() >= at) {
      void write(next => refreshCampaignLives(next, Date.now())).catch(() => undefined);
    } else if ($<HTMLDialogElement>('#campaign-lives').open) renderLives();
  }, 1000) : undefined;
  $('#campaign-lives-open').addEventListener('click', openLives, domOptions);
  for (const [selector, method] of [['#campaign-life-coin', 'coins'], ['#campaign-life-credit', 'credit']] as const) {
    $(selector).addEventListener('click', async () => {
      if (!LIVES_PREVIEW || saving || serviceBusy) return;
      const revision = save.revision;
      try { await write(next => refillCampaignLife(next, { revision, method, now: Date.now() })); renderLives(); }
      catch { message('Не удалось сохранить жизнь.', true); }
    }, domOptions);
  }
  $('#campaign-life-retry').addEventListener('click', () => {
    if (!LIVES_PREVIEW || saving || serviceBusy) return;
    const level = blockedLifeLevel, restart = retryLifeRestart;
    blockedLifeLevel = undefined; retryLifeRestart = false;
    closeDialogs();
    if (restart) void replay(); else if (level !== undefined) void openLevel(level, true);
  }, domOptions);
  $('#campaign-life-video').addEventListener('click', async () => {
    if (!LIVES_PREVIEW || !livesVideoApproved() || saving || serviceBusy) return;
    const id = crypto.randomUUID(), source = deal.id;
    serviceBusy = true;
    try {
      if (!await write(next => authorizeLifeVideo(next, Date.now(), id, livesVideoApproved()))) return;
      closeDialogs();
      await ads.show({ kind: 'rewarded', mode: 'campaign', placement: 'life-refill', attempt: id, dealId: source });
      await ads.recover();
      await write(next => cancelLifeVideo(next, id));
    } catch { message('Не удалось подтвердить восстановление жизни.', true); }
    finally { serviceBusy = false; if (alive) openLives(); }
  }, domOptions);
  function paintLiveOps() {
    const progress = availableEvents(save), list = $('#campaign-liveops-list');
    list.replaceChildren();
    const definitions = new Map(liveOpsDefinitions(Date.now()).map(def => [eventKey(def), def]));
    for (const record of save.events?.events ?? []) {
      if (!Object.hasOwn(liveOpsTitles, record.definition.sourceFeatureId)) continue;
      const key = eventKey(record.definition);
      if (progress.some(item => item.key === key && item.ready.length)) definitions.set(key, record.definition);
    }
    for (const [key, def] of definitions) {
      const row = document.createElement('section'), title = document.createElement('h3'), detail = document.createElement('p');
      const state = progress.find(item => item.key === key);
      row.className = 'helper-offer'; row.dataset.event = def.sourceFeatureId;
      title.textContent = liveOpsTitles[def.sourceFeatureId as LiveOpsSource];
      detail.textContent = `${state?.progress ?? 0} / ${def.milestones.at(-1)!.threshold}`;
      row.append(title, detail);
      for (const target of state?.ready ?? []) {
        const claim = document.createElement('button'); claim.className = 'secondary';
        claim.dataset.claim = target.id; claim.dataset.eventKey = key;
        claim.textContent = `Забрать +${target.reward.coins} монет`; row.append(claim);
      }
      list.append(row);
    }
  }
  function prewarmLiveOps() {
    const now = Date.now();
    const occurrence = liveOpsDefinitions(now).find(def => def.schedule.start <= now && now < def.schedule.end)?.id;
    if (!occurrence || prewarmedLiveOps === occurrence) return;
    prewarmedLiveOps = occurrence;
    for (const path of ['art/generated/cycle.webp', 'art/generated/coin.webp']) {
      const image = new Image(); image.src = path;
    }
  }
  $('#campaign-liveops-open').addEventListener('click', () => {
    if (!LIVES_PREVIEW) return;
    prewarmLiveOps();
    paintLiveOps(); openDialog('#campaign-liveops');
  }, domOptions);
  $('#campaign-liveops-list').addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!LIVES_PREVIEW || !button?.dataset.claim || !button.dataset.eventKey || saving || serviceBusy) return;
    const { claim, eventKey: key } = button.dataset;
    try { await write(next => claimMilestone(next, key, claim)); paintLiveOps(); }
    catch { message('Не удалось сохранить награду события.', true); }
  }, domOptions);
  function renderCampaignShop() {
    const layout = storefrontView(save, Date.now(), storefront.accountId, storefront.context);
    const list = $('#campaign-shop-catalog');
    list.replaceChildren();
    $('#campaign-shop-status').textContent = storefront.accountId ? '' : 'Покупки пока недоступны.';
    $<HTMLButtonElement>('#campaign-shop-restore').disabled = !storefront.accountId;
    const addClaim = (parent: HTMLElement, track: 'free'|'premium'|'piggy', label: string, enabled: boolean) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'secondary'; button.textContent = label;
      button.disabled = !enabled; button.dataset.claim = track;
      parent.append(button);
    };
    for (const offer of layout.offers) {
      const group = document.createElement('details'), title = document.createElement('summary');
      group.dataset.family = offer.sourceId; group.className = 'helper-offer';
      title.textContent = productLabels[offer.sourceId]; group.append(title);
      if (offer.sourceId === 'hitapps-piggy-bank' || offer.sourceId === 'azur-play-pass') group.open = true;
      if (offer.sourceId === 'hitapps-piggy-bank') {
        const meter = document.createElement('p');
        meter.textContent = `${layout.data?.piggy ?? 0} / ${PIGGY_LIMIT} монет`;
        group.append(meter);
        addClaim(group, 'piggy', 'Забрать копилку', Boolean(layout.data?.piggy === PIGGY_LIMIT && !layout.data.piggyGrant && layout.active.some(x => x.good.type === 'piggy')));
      }
      if (offer.sourceId === 'azur-play-pass') {
        const progress = document.createElement('p');
        progress.textContent = `${layout.data?.clears ?? 0} / ${PASS_GOAL} первых побед`;
        group.append(progress);
        const ready = (layout.data?.clears ?? 0) >= PASS_GOAL;
        addClaim(group, 'free', 'Забрать бесплатную награду', ready && !layout.data?.freeClaimed);
        addClaim(group, 'premium', 'Забрать премиальную награду', ready && !layout.data?.premiumClaimed && layout.active.some(x => x.good.type === 'pass'));
      }
      if (offer.sourceId === 'unico-vip' && layout.active.some(x => x.good.type === 'vip')) {
        const state = document.createElement('p');
        state.textContent = 'VIP активен'; group.append(state);
      }
      const products = offer.sourceId === 'hitapps-piggy-bank' ? [CAMPAIGN_PRODUCTS[0]] :
        offer.sourceId === 'unico-vip' ? [CAMPAIGN_PRODUCTS[1]] : offer.products;
      for (const product of products) {
        const binding = storefront.bindingFor(product.sku), item = document.createElement('button');
        item.className = 'secondary'; item.type = 'button'; item.dataset.sku = product.sku;
        item.disabled = !binding || (!offer.eligible && offer.sourceId !== 'unico-vip' && offer.sourceId !== 'hitapps-piggy-bank') ||
          (product.benefits.some(good => good.type === 'unlimited') &&
            !(RECOVERY_GAMEPLAY && deal.recovery && save.attempt.board.phase === 'playing')) ||
          (offer.sourceId === 'hitapps-piggy-bank' && layout.data?.piggy !== PIGGY_LIMIT);
        item.textContent = showProductGoods(product.sku);
        if (binding) {
          const currency = new Intl.NumberFormat('ru', { style: 'currency', currency: binding.price.currency });
          const decimals = currency.resolvedOptions().maximumFractionDigits ?? 2;
          item.textContent += ' · ' + currency.format(binding.price.minorUnits / (10 ** decimals));
        }
        group.append(item);
      }
      list.append(group);
    }
  }
  $('#campaign-store-open').addEventListener('click', async () => {
    if (!STOREFRONT_PREVIEW || saving || serviceBusy) return;
    openDialog('#campaign-store');
    renderCampaignShop();
    await storefront.refresh().catch(() => undefined);
    if ($<HTMLDialogElement>('#campaign-store').open) renderCampaignShop();
  }, domOptions);
  $('#campaign-shop-catalog').addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!STOREFRONT_PREVIEW || !button || button.disabled || saving || serviceBusy) return;
    serviceBusy = true;
    try {
      const { sku, claim } = button.dataset;
      if (sku) await storefront.checkout(sku);
      if (claim === 'free' || claim === 'premium' || claim === 'piggy') await write(next => claimShopProgress(next, Date.now(), claim, storefront.accountId));
      renderCampaignShop();
    } catch { $('#campaign-shop-status').textContent = 'Не удалось подтвердить операцию. Попробуйте ещё раз.'; }
    finally { serviceBusy = false; }
  }, domOptions);
  $('#campaign-shop-restore').addEventListener('click', async () => {
    if (!STOREFRONT_PREVIEW || !storefront.accountId || serviceBusy || saving) return;
    serviceBusy = true;
    try { await storefront.restore(); renderCampaignShop(); }
    catch { $('#campaign-shop-status').textContent = 'Не удалось восстановить покупки.'; }
    finally { serviceBusy = false; }
  }, domOptions);
  $('#coffee-open').addEventListener('click', () => {
    if (!(ADS_CONTROLS_PREVIEW || campaignAdsApproved()) || saving || serviceBusy) return;
    $('#coffee-copy').textContent = campaignAdsApproved() ? 'Добровольное видео. После просмотра получите 10 монет.' : 'Показы для кофе-паузы ждут проверки рекламного SDK.';
    $<HTMLButtonElement>('#coffee-watch').disabled = !campaignAdsApproved() || !ads.status.rewarded || Boolean(save.attempt.coffeeRequested);
    openDialog('#coffee-break');
  }, domOptions);
  $('#coffee-watch').addEventListener('click', async () => {
    if (!campaignAdsApproved() || !ads.status.rewarded || saving || serviceBusy) return;
    const source = deal, attempt = save.attempt.id;
    serviceBusy = true;
    try {
      if (!await write(next => next.attempt.id === attempt && authorizeCoffee(next, source, campaignAdsApproved()))) return;
      closeDialogs();
      const result = await ads.show({ kind: 'rewarded', placement: 'coffee-break', mode: 'campaign', attempt, dealId: source.id });
      await ads.recover();
      await write(next => cancelCoffee(next, attempt, source.id));
      if (!result.shown) message('Сейчас видео недоступно.', true);
    } catch { message('Проверьте сохранение перед новым запросом.', true); }
    finally { serviceBusy = false; renderHud(); }
  }, domOptions);
  $('#restore-stock').addEventListener('click', async () => {
    if (!RECOVERY_GAMEPLAY || saving || serviceBusy) return;
    const source = deal, cost = restoreQuote(save.attempt, source);
    if (cost === undefined) return;
    const quote = { attemptId: save.attempt.id, revision: save.revision, cost };
    try {
      if (await write(next => restoreCampaignStock(next, source, quote))) {
        closeDialogs(); scene?.sync();
        if (save.attempt.board.phase === 'exhausted') outcome();
      }
    } catch { message('Не удалось сохранить восстановление колоды.', true); }
  }, domOptions);
  $('#unlimited-preview').addEventListener('click', async () => {
    if (!RECOVERY_GAMEPLAY || !deal.recovery || saving || serviceBusy) return;
    const source = deal, now = Date.now(), accountId = storefront.accountId;
    const purchase = STOREFRONT_PREVIEW && quotePurchasedUnlimited(save, source, accountId, now);
    if (!purchase && !RECOVERY_PREVIEW) return;
    const id = crypto.randomUUID(), attemptId = save.attempt.id;
    try {
      const applied = await write(next => {
        const at = Date.now();
        return purchase
          ? usePurchasedUnlimited(next, source, { ...purchase, id }, accountId, at)
          : beginUnlimited(next, source, { id, attemptId, until: at + 120_000 }, at);
      });
      if (applied) { closeDialogs(); scene?.sync(); }
    } catch { message('Не удалось сохранить ходы без лимита.', true); }
  }, domOptions);
  $('#random-joker-open').addEventListener('click', () => {
    if (RANDOM_JOKER_PREVIEW && !saving && !serviceBusy && allowsRandomJoker(save.attempt, deal)) openDialog('#random-joker-warning');
  }, domOptions);
  $('#random-joker-confirm').addEventListener('click', async () => {
    if (!RANDOM_JOKER_PREVIEW || saving || serviceBusy || !$<HTMLDialogElement>('#random-joker-warning').open) return;
    const source = deal, attemptId = save.attempt.id, revision = save.revision;
    const id = 'azj-' + crypto.randomUUID();
    const candidate = placeRandomJoker(save.attempt, source, randomJokerColumn, () => id);
    const path = candidate && proveRandomJoker(candidate, source, performance.now() + 220);
    if (!candidate?.joker || !path) {
      closeDialogs();
      message('В этом столбце нет проверенного продолжения. Джокер сохранён.', true);
      return;
    }
    try {
      const column = candidate.joker.column;
      if (await write(next => settleRandomJoker(next, source, { attemptId, revision, column, id, path }))) {
        closeDialogs(); scene?.sync();
      }
    } catch { message('Проверьте сохранение перед повторной попыткой.', true); }
  }, domOptions);
  $('#result-continue').addEventListener('click', async () => {
    const button = $<HTMLButtonElement>('#result-continue');
    if (button.hidden || button.disabled || serviceBusy || saving) return;
    const proof = continueCheck.proof;
    if (requiresContinueProof(save.attempt) && (!proof || !verifiesContinue(save.attempt, proof))) return;
    if ((save.platform?.continueCredits ?? 0) > 0) {
      await continueFromResult(next => logTaskContinue(next, useContinue(next, proof)));
    } else {
      try {
        if (SOURCE_DIFFICULTY_PREVIEW) await write(next => recordSourceContinue(next, deal));
        void rewarded('continue');
      } catch { message('Не удалось сохранить запрос продолжения.', true); }
    }
  }, domOptions);
  $('#result-continue-coins').addEventListener('click', async () => {
    const button = $<HTMLButtonElement>('#result-continue-coins'), proof = continueCheck.proof;
    if (button.hidden || button.disabled || saving || serviceBusy || !proof) return;
    await continueFromResult(next => logTaskContinue(next, buyContinue(next, proof)), BALANCE.continueCoinPrice);
  }, domOptions);
  async function continueFromResult(change: (next: Save) => boolean, cost = 0) {
    $('#result-continue-error').hidden = true;
    try {
      if (!await write(next => {
        recordSourceContinue(next, deal);
        return change(next);
      })) return;
      if (cost) telemetry.track('helper_purchase', { helper: 'continue-coins', cost });
      closeDialogs(); scene?.sync(); telemetry.sync();
    } catch {
      const error = $('#result-continue-error');
      error.textContent = store.needsRecovery ? 'Проверьте, сохранилось ли продолжение.' : 'Продолжение не сохранилось. Попробуйте ещё раз.';
      error.hidden = false;
    }
  }
  $('#result-save-retry').addEventListener('click', async () => {
    if (saving || serviceBusy) return;
    const error = $('#result-continue-error');
    try {
      await write(() => undefined);
      if (save.attempt.board.phase === 'playing') {
        closeDialogs();
        if ($('#app').dataset.presentedDeal !== deal.id) {
          runtime.activity.setBlocked('level-transition', true);
          presentLevelStart();
        } else { scene?.sync(); telemetry.sync(); }
      }
      error.hidden = true;
    } catch { error.textContent = 'Пока не удалось проверить сохранение.'; error.hidden = false; }
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
  const removeBonusTouch = installTouchActivation($('#game'), {
    resolveButton: target => target instanceof Element ? target.closest<HTMLButtonElement>('.board-bonus') : null,
  });
  renderHud(); renderHome();
  const cleanup = () => {
    if (!alive) return; clearPraise(); alive = false; clearTimeout(workerDeadline); clearTimeout(outcomeTimer); clearTimeout(messageTimer);
    telemetry.track('session_end'); clearInterval(checkpoint); clearInterval(dayRefresh); clearInterval(lifeTick); clearTimeout(guideTimer); clearTimeout(adBreakTimer); clearTimeout(recoveryClock); removeForeground?.(); banner?.destroy(); ads.destroy(); telemetry.destroy();
    abort.abort(); removeTouch(); removeBonusTouch(); wallet?.dispose();
    clearTimeout(themeExpiry); worker?.terminate(); cancelShuffle?.(); continueCheck.clear(); resize.disconnect(); resultResize.disconnect(); unblock(); runtime.destroy(); destroyRenderer(renderer);
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
