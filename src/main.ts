import { CAMPAIGN_META } from './config/campaign-meta';
import { claimWinStreak, stagedStreak, streakStatus } from './domain/events/win-streak';
import { E4_M1, M1, M1_ID } from './config/economy';
import { ordinaryProgress } from './domain/ordinary-progress';
import { createProductOfferAdapter, noUsefulMoveFact, startOfferSession, type ContextFact } from './domain/commerce/product-offers';
import { OfferTrigger } from './domain/commerce/offer-campaigns';
import { createRecoveryClock } from './platform/recovery-clock';
import { COMBO_STAGES } from './domain/events/combo';
import { claimDailyBonus, dailyBonusState, openDailyBonusRound, revealDailyBonusCard } from './domain/events/daily-bonus';
import { grantShuffleIntro, hasFutureShuffleUse, SHUFFLE_LEVELS } from './domain/shuffle-progression';
import { commitAdaptiveRetry, quoteAdaptiveRetry, quoteLayoutRetry } from './app/campaign-retry';
import { releaseProfile } from './config/profile';
import { CAMPAIGN_CORE_STAGE1, HITAPPS_FIXTURE_UI, campaignCoreDealId } from './config/hitapps-r4';
import { OFFER_CAMPAIGNS_PREVIEW } from './domain/commerce/offer-campaigns';
import { mountOfferCampaignPreview } from './app/offer-campaign-preview';
import { authorizeLifeVideo, cancelLifeVideo, LIVEOPS_PREVIEW, LIVES_PREVIEW, LIVES_RULES, matchesLifeVideo, mayStartCampaignAttempt, refillCampaignLife, refreshCampaignLives } from './domain/campaign-lives';
import { claimLegacyLiveOpsReward, legacyLiveOpsRewards, liveOpsDefinitions, liveOpsTitles, recordLiveOpsWin, recordSourceGoldRush, type LiveOpsSource } from './domain/events/campaign-liveops';
import { availableEvents, claimMilestone, eventKey, type EventReward } from './domain/events/ledger';
import { createStorefront } from './platform/storefront';
import { claimShopProgress, freeCampaignBonusState, PASS_GOAL, PIGGY_LIMIT, productLabels, recordFreeCampaignClear, recordStoreClear, settleFreeCampaignBonus, showProductGoods, storefrontView, STOREFRONT_PREVIEW, type FreeCampaignBonusGrant } from './domain/commerce/storefront';
import { CAMPAIGN_PRODUCTS } from './domain/commerce/catalog';
import { AD_BREAK_GAP_MS, adBreakBlocker, adFree, coffeeBlocker, coffeeEligibleAt, releaseAdCadence, releasePlacementEligible, type CampaignInterstitialPlacement, ADS_CONTROLS_PREVIEW, authorizeCoffee, cancelCoffee, eligibleAdBreak, matchesCoffee } from './domain/campaign-advertising';
import { beginUnlimited, buyUnlimitedAccess, canBuyUnlimitedAccess, expireUnlimited, quotePurchasedUnlimited, quoteUnlimitedAccess, RECOVERY_GAMEPLAY, RECOVERY_PREVIEW, requiresNativeRecoveryClock, restoreCampaignStock, restoreQuote, supportsUnlimited, unlimitedRemaining, usePurchasedUnlimited, useUnlimitedAccess } from './domain/campaign-recovery';
import { allowsRandomJoker, buyRandomJokerAccess, placeRandomJoker, randomJokerCount, randomJokerReady, proveRandomJoker, RANDOM_JOKER_PREVIEW, randomJokerColumn, settleRandomJoker } from './domain/random-joker';
import { loadEqualityPreviewPolicy } from './content/campaign-v8-equality';
import { GENERATION_PREVIEW, recordSourceContinue, SOURCE_DIFFICULTY_PREVIEW } from './domain/difficulty';
import Phaser from 'phaser';
import { getBackingStoreSize, getRenderPixelRatio } from '@danilah/mini-games-kit/core';
import { destroyRenderer } from '@danilah/mini-games-kit/phaser';
import { installTouchActivation } from '@danilah/mini-games-kit/feel';
import { campaignIssuance, campaignDeals, campaignLevelPreview, campaignRedeal, findDeal, hitappsR4Deals, isCurrentCampaignDeal, selectCampaignDeal } from './content/campaign';
import { CAMPAIGN_LENGTH, HELPER_UNLOCK, RELEASE_UNLOCK, dailyTasksAvailable, dailyModeAvailable, campaignId, completedLevels, unlockedLevel, helperUnlocked, freeHintDemo, freeJokerPractice, freeUndoPractice, markTutorial, seenTutorial } from './domain/progression';
import { beginDeal } from './domain/campaign';
import { canSwitchCardLanguage, localizedCampaignDeal, LOCALE_PREVIEW } from './content/campaign-v8-locale';
import { dailyForDay } from './content/daily';
import { switchMode } from './domain/sessions';
import { cosmeticUnlocked, currentDailyStreak, dailyRewardEligible, localDay } from './domain/meta';
import { WalletPresentation } from './app/wallet-presentation';
import { unlockTrack, unlockedBetween } from './app/unlock-track';
import { ContinueCheck } from './app/continue-check';
import { renderMeta, campaignAttempt, dailyAttempt } from './app/meta-ui';
import { activelyTeaching, firstBonusOffer, recordTeachingAction, teachingProtected } from './app/teaching-protection';
import { lessonMarker, recordReleaseLearning } from './app/c8-tutorial';
import { coversPlayableWaste, lesson, recordLearning, ruleIntroduction, ruleIntroMarker, specialRuleNote, type RuleIntro } from './app/tutorial';
import { boardKey, boardRules, canReachTransfer, dispatch, freshSave, legalCommands, placeJoker, STREAK } from './domain/engine';
import { BALANCE } from './domain/balance';
import { AZUR_VICTORY_DEFAULTS, AZUR_VICTORY_QA, AZUR_VICTORY_SAVE_KEY, quoteVictoryReward, victoryDifficulty } from './domain/azur-victory-reward';
import { frozenLayers } from './domain/frozen-cards';
import { isBoundCard } from './domain/bound-cards';
import { collectedGold, goldenRewardKey } from './domain/golden-cards';
import { TASKS_PREVIEW, acceptedTaskSignals, claimTask, claimTaskMilestone, openWeeklyChest, taskRewardState, recordTaskSignal, releaseTasks, shouldScheduleTasks, updatePreviewTasks, type TaskSignal } from './domain/events/daily-tasks';
import { PICTURE_PREVIEW, PICTURE_PRICES, PICTURE_TITLE, claimPicture, observePictureClock, openPictureEvent, pictureClosed, pictureTokens, recordPictureWin, revealPicturePart } from './domain/events/picture';
import { SHOP_FREE_COINS, SHOP_VIDEO_COINS, REWARD_OFFER_PREVIEW, COIN_WALLET_LEVEL, canClaimShopCoins, claimShopCoins, definitionCount, isOfferPlacement, offerLabels, offerQuote, offerShowContext, prepareRewardOffer, retireUnrewardedOffer, selectedWinMultiplier, revealRelatedWord, type OfferPlacement, type WinOffer } from './domain/reward-offers';
import { openingShuffleProof } from './domain/shuffle-intro-proof';
import { canShuffle, commitShuffle, prepareShuffleBoard, type ShuffleRequest } from './domain/proof-shuffle';
import { requiresContinueProof, verifiesContinue } from './domain/continuation';
import { bonusKinds, bonusOffer, bonusPlacements, openBonusSlot, pilesFor, purchaseBonusSlot } from './domain/bonus-slots';
import type { BoardCommand, BonusKind, Command, Deal } from './domain/types';
import { CARD_H, GRID_GAP, boardFrame, layout } from './game/layout';
import { cardArtwork } from './game/art';
import { categoryCaption } from './game/captions';
import { cardReader } from './game/card-reader';
import type { HintRequest, HintResponse } from './domain/hint';
import { BoardScene } from './game/BoardScene';
import { createRuntime } from './platform/runtime';
import { SaveStore, createStorage } from './platform/storage';
import { validEvent } from './platform/analytics';
import { createTelemetry } from './platform/telemetry';
import { createAds } from './platform/ads';
import { NativeBanner } from './platform/banner';
import { applyFullscreenShown, applyReceipt, buyContinue, cancelContinueVideo, canShowContinueVideo, hasVideoContinueCredit, purchaseHelper, interstitialEligible, quoteContinueVideo, useContinue, useVideoContinue, type RewardPlacement } from './domain/services';
import type { Save, Result } from './domain/types';
import './style.css';
import './art.css';
import './casual.css';
import { finishStartup, showStartupFailure } from './app/startup';
import { casualIcon, configureCasualDialogs, configureCasualHome, prizeIcon, prizeToken, progressTrack, taskProgressBaseline, videoGlyph, winStamps } from './app/casual-ui';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const azurInteractionFeedback = releaseProfile?.capabilities.drawInvalidCoinFeedback === 'active' ||
  import.meta.env.VITE_AZUR_FEEL_QA === '1';
const victoryPolicy = AZUR_VICTORY_QA ? AZUR_VICTORY_DEFAULTS : undefined;
const integratedOffers = releaseProfile?.capabilities.rewardOffers === 'sdk-acceptance-gated';
const rewardOffersEnabled = (REWARD_OFFER_PREVIEW || integratedOffers) && !AZUR_VICTORY_QA;
const casual = Boolean(releaseProfile);
const qaLevelPicker = HITAPPS_FIXTURE_UI;
const sequentialCampaign = CAMPAIGN_CORE_STAGE1 && !qaLevelPicker;
if (casual) {
  document.documentElement.dataset.casual = 'true';
  $('#app').dataset.casual = 'true';
  configureCasualHome(qaLevelPicker);
  if (sequentialCampaign) $('#level-picker-open').hidden = true;
  configureCasualDialogs();
  if (E4_M1) $('#app').dataset.economy = 'm1';
  for (const [selector, icon] of [['#restart', 'cycle'], ['#levels-open', 'link']] as const)
    $(selector).prepend(casualIcon(icon));
  $('.result-star').replaceChildren(Object.assign(new Image(), { src: 'art/ui/reward-emblem.webp', alt: '' }));
  $('#result-earnings span').replaceChildren(casualIcon('coin'));
  for (const icon of ['hint', 'undo', 'joker'] as const) {
    $(`#${icon}-offer h3`).prepend(casualIcon(icon));
  }
  for (const selector of ['#video-hint', '#video-undo', '#bonus-video', '#theme-video-claim']) $(selector).prepend(videoGlyph());
}
const freeSeasonalTrack = releaseProfile?.capabilities.freeSeasonalTrack === 'active';
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
const actionFeedback = new Map<HTMLElement, Animation>();

function animateActionFeedback(element: HTMLElement, id: string, frames: Keyframe[], duration: number) {
  actionFeedback.get(element)?.cancel();
  const animation = element.animate(frames, { duration, easing: 'ease-out' });
  animation.id = id;
  actionFeedback.set(element, animation);
  const forget = () => { if (actionFeedback.get(element) === animation) actionFeedback.delete(element); };
  void animation.finished.then(forget, forget);
}

function clearActionFeedback() {
  for (const animation of actionFeedback.values()) animation.cancel();
  actionFeedback.clear();
}
let inspectMode = false;
let dismissRule: (() => void) | undefined;
let dismissDifficulty: (() => void) | undefined;
let returnToDialog: (() => void) | undefined;
let alive = true;
let ready = false;
const abort = new AbortController();
const domOptions = { signal: abort.signal };
const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const runtime = createRuntime(() => { scene?.cancel(); }, () => {
  if (runtime.activity.getBlockReasons().some(r => r !== 'modal' && r !== 'screen')) return;
  const dialog = dialogs.find(d => d.open);
  if (dialog) { dismissDialog(dialog); return; }
  if (screen === 'game' && scene?.back()) return;
  if (inspectMode) setInspect(false);
  else openDialog('#settings');
});

let coinPresentation = 0;
let wallet: WalletPresentation | undefined;
function restoreWallet() { const button = $('#wallet-open'); button.removeAttribute('aria-disabled'); button.style.position = ''; button.style.left = ''; button.style.top = ''; button.style.zIndex = ''; $('#wallet-anchor').append(button); $('#wallet-anchor').style.width = ''; }
function mountSheetWallet(selector: '#lives-wallet-anchor' | '#coins-wallet-anchor') {
  const anchor = $('#wallet-anchor'), button = $('#wallet-open');
  anchor.style.width = `${anchor.getBoundingClientRect().width}px`;
  $(selector).append(button);
  button.setAttribute('aria-disabled', String(selector === '#coins-wallet-anchor'));
}
function pinWallet() { const anchor = $('#wallet-anchor'), r = anchor.getBoundingClientRect(), button = $('#wallet-open'); anchor.style.width = `${r.width}px`; $('#result').append(button); Object.assign(button.style, { position: 'fixed', left: `${r.x}px`, top: `${r.y}px`, zIndex: '102' }); }
function cancelCoins(settle = true) {
  wallet?.cancel(settle);
  coinPresentation++;
  $('#coin-layer').getAnimations({ subtree: true }).forEach(a => a.cancel());
  $('#coin-layer').querySelectorAll<HTMLElement>('.flying-coin').forEach(n => { n.style.display = 'none'; });
}
function clearDialogs(preserveCoins = false) {
  // Discard presentation before its top-layer owner closes.
  cancelCoins(!preserveCoins); wallet?.clearDebit(); clearActionFeedback(); restoreWallet();
  document.body.append($('#coin-layer'));
  dialogs.forEach(d => { d.close(); d.querySelector('.reward-counts')?.remove(); });
  returnToDialog = undefined;
}
function closeDialogs() {
  clearDialogs();
  runtime.activity.setBlocked('modal', false);
}
function openDialog(selector: string, preserveCoins = false, back?: () => void) {
  if (sequentialCampaign && selector === '#level-picker') return;
  const entering = !dialogs.some(d => d.open);
  peekCard(null); clearPraise(); scene?.clearFeedback(); clearDialogs(preserveCoins); scene?.cancel();
  const dialog = $<HTMLDialogElement>(selector);
  dialog.toggleAttribute('data-backdrop-enter', entering);
  const done = selector === '#helpers' ? '#helper-return' : selector === '#appearance' ? '#appearance-done' : undefined;
  if (done) $(done).textContent = back ? 'Назад' : screen === 'home' ? 'Готово' : 'К игре';
  returnToDialog = back;
  if (casual && selector === '#campaign-lives') mountSheetWallet('#lives-wallet-anchor');
  if (casual && selector === '#coins-dialog') {
    mountSheetWallet('#coins-wallet-anchor');
    $('#coins-return').textContent = back ? 'Назад' : 'Готово';
  }
  dialog.showModal();
  runtime.activity.setBlocked('modal', true);
}
function openChildDialog(selector: string, parent: string, opener: HTMLElement) {
  const ancestor = returnToDialog;
  const body = $<HTMLDialogElement>(parent).querySelector<HTMLElement>('.sheet-body, #pause-options');
  const scroll = body?.scrollTop ?? 0;
  openDialog(selector, false, () => {
    openDialog(parent, false, ancestor);
    if (body) body.scrollTop = scroll;
    opener.focus({ preventScroll: true });
  });
}
function dismissDialog(dialog: HTMLDialogElement) {
  if (dialog.id === 'learn-rule') dismissRule?.();
  else if (dialog.id === 'difficulty-entry') dismissDifficulty?.();
  else if (returnToDialog) returnToDialog();
  else closeDialogs();
}
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
  panel.style.top = `${Math.max(10, zone.top - panel.offsetHeight - 9)}px`;
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
function positionBonusSlots(save: Save) {
  const rect = $('#game-root').getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, deal);
  const offers = deal.bonusSlots && ready && screen === 'game' && save.attempt.board.phase === 'playing'
    ? layout(save.attempt.board, deal, frame, save.settings.deckSide, save.settings.deckPosition).offers : [];
  for (const kind of bonusKinds) {
    const button = $(`#bonus-${kind}`), offer = offers.find(target => target.kind === kind);
    button.hidden = !offer;
    if (offer) {
      const face = button.querySelector('.board-bonus-face')!;
      if (casual && !campaignCoreDealId(deal.id) && !face.querySelector('.video-glyph')) face.prepend(videoGlyph());
      if (campaignCoreDealId(deal.id)) face.querySelector('.video-glyph')?.remove();
      const width = offer.width * frame.unit;
      const touchWidth = Math.min(Math.max(44, width), width + GRID_GAP * frame.unit);
      const faceLeft = frame.offsetX + (offer.x - offer.width / 2) * frame.unit;
      const left = Math.max(0, Math.min(faceLeft, rect.width - touchWidth));
      button.style.left = `${left}px`;
      button.style.top = `${(offer.y - CARD_H / 2) * frame.unit}px`;
      button.style.width = `${touchWidth}px`;
      button.style.setProperty('--bonus-width', `${width}px`);
      button.style.setProperty('--bonus-face-left', `${faceLeft - left}px`);
      button.style.height = `${CARD_H * frame.unit}px`;
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

function difficultyBadge(item?: Deal) {
  const span = document.createElement('span'), label = setDifficulty(span, item);
  span.className = 'difficulty-chip';
  span.hidden = !label;
  if (label) span.append(casualIcon('milestone'), document.createTextNode(label));
  return span;
}

async function start() {
  const equalityPreviewPolicy = await loadEqualityPreviewPolicy();
try {
  runtime.activity.setBlocked('screen', true);
  let firstLaunch = false;
  const store = new SaveStore(createStorage(), findDeal, () => {
    firstLaunch = true;
    const fresh = freshSave(campaignDeals[0], crypto.randomUUID());
    if (!CAMPAIGN_CORE_STAGE1) return fresh;
    const opening = selectCampaignDeal(fresh, campaignDeals[0]);
    const issued = freshSave(opening, fresh.attempt.id);
    issued.attempt.issuance = campaignIssuance(issued, campaignDeals[0], opening, fresh.attempt);
    return issued;
  }, AZUR_VICTORY_QA ? AZUR_VICTORY_SAVE_KEY : undefined);
  await document.fonts.load('800 20px Nunito').catch(() => []);
  const recoveryTime = createRecoveryClock();
  let save = await store.open();
  const expireRecovery = (next: Save) => expireUnlimited(next, Date.now(), recoveryTime.read());
  await recoveryTime.refresh();
  if (recoveryWait(save) !== undefined || requiresNativeRecoveryClock(save, recoveryTime.read())) {
    await store.mutate(expireRecovery);
    save = store.state;
  }
  function recoveryWait(state: Save) {
    const now = Date.now(), reading = recoveryTime.read();
    const waits = [state.attempt, state.parked?.campaign].flatMap(attempt => {
      const timed = attempt?.unlimited, access = attempt?.unlimitedAccess;
      const remaining = timed && unlimitedRemaining(timed, now, reading);
      const unspent = access && !access.consumed ? unlimitedRemaining(access, now, reading) : undefined;
      return [
        ...(remaining !== undefined ? [remaining] : []),
        ...(unspent !== undefined ? [unspent] : []),
      ];
    });
    return waits.length ? Math.min(...waits) : undefined;
  }
  const productOfferEnabled = releaseProfile?.capabilities.contextOffers === 'active';
  if (productOfferEnabled) {
    await store.mutate(next => startOfferSession(next, Date.now()));
    save = store.state;
  }
  const dispatchContext = productOfferEnabled ? createProductOfferAdapter(store) : undefined;
  function offerFact(fact: ContextFact) {
    if (!dispatchContext || !alive) return;
    void dispatchContext(save, deal, fact, Date.now())?.catch(() => undefined);
  }
  const sourceDailyTasks = import.meta.env.VITE_CONTENT8_DAILY_TASKS === 'source';
  const dailyBonusEnabled = releaseTasks || sourceDailyTasks;
  if (!casual) for (const id of ['shop-claim-status', 'shop-free-claim', 'shop-video-claim', 'shop-video-status']) {
    $('#helpers .sheet-body').append($(`#${id}`));
  }
  type MonthlyConfirmation = { state: Save; grants: FreeCampaignBonusGrant[] };
  let deferredMonthlyConfirmation: MonthlyConfirmation | undefined;
  function confirmMonthlyBonuses(grants: FreeCampaignBonusGrant[]) {
    if (!grants.length) return;
    const copy = grants.map(grant => `Бонус за ${grant.season.slice(5)}.${grant.season.slice(0, 4)} · +${grant.coins} монет получено`).join('\n');
    for (const node of document.querySelectorAll<HTMLElement>('[data-monthly-confirmation]')) {
      node.textContent = copy;
      node.hidden = false;
    }
  }
  function syncRetention(next: Save, now: number) {
    if (!(releaseTasks || sourceDailyTasks)) return;
    if (dailyTasksAvailable(next)) {
      updatePreviewTasks(next, now);
      recordTaskSignal(next, now, { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 });
    }
    if (releaseTasks) grantShuffleIntro(next);
  }
  if (freeSeasonalTrack || dailyBonusEnabled && unlockedLevel(save) >= 2) {
    const grant = await store.mutate(next => {
      const now = Date.now(), grant = freeSeasonalTrack ? settleFreeCampaignBonus(next, now) : undefined;
      syncRetention(next, now);
      return grant;
    });
    save = store.state;
    if (grant) confirmMonthlyBonuses([grant]);
  }
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => systemMotion.matches || save.settings.reducedMotion;
  let presentingCommand = false;
  wallet = new WalletPresentation(save.profile.coins, $('#coin-layer'), $('#coins'), $('#helper-wallet-amount'), $('#wallet-open'), animated => {
    runtime.play('coins', 'ui');
    if (azurInteractionFeedback && animated) runtime.pulse('coin-land');
  }, reducedMotion);
  function syncMotionPreference() {
    const reduced = reducedMotion(), root = document.documentElement;
    if (root.dataset.reduced === String(reduced)) return;
    root.dataset.reduced = String(reduced);
    if (reduced) {
      clearPraise();
      cancelCoins();
      finishRewardClaim();
      clearActionFeedback();
      document.querySelectorAll('#streak i').forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
      scene?.settleMotion();
    }
  }
  systemMotion.addEventListener('change', syncMotionPreference, domOptions);
  deal = findDeal(save.attempt.dealId)!;
  let requestedLevel: number | undefined;
  let requestedSourceDeal: string | undefined;
  let difficultyRequest: { level: number; returnTo: 'result' | 'picker' | undefined } | undefined;

  let activeRule: RuleIntro | undefined;
  let unlockChoice: 'palette' | 'cardBack' | undefined;
  let localeRestartAttempt: string | undefined;
  const dismissedRules = new Set<string>();
  let outcomeViewed = false;
  let freshFeelWin: string | undefined;
  let victoryBeatUntil = 0;
  const victoryParticles = document.createElement('span');
  victoryParticles.className = 'victory-particles'; victoryParticles.hidden = true;
  victoryParticles.setAttribute('aria-hidden', 'true');
  $('#app').append(victoryParticles);
  let demonstratedWin: string | undefined;
  let lastWinningAction: BoardCommand | undefined;
  function celebrateBoard(from: BoardCommand | undefined) {
    if (!casual || reducedMotion() || screen !== 'game' || runtime.activity.isBlocked() ||
        demonstratedWin === save.attempt.id) return;
    demonstratedWin = save.attempt.id;
    const target = from?.type === 'transfer' ? scene?.geometry().targets.find(
      item => item.location.kind === from.to.kind && item.location.index === from.to.index) : undefined;
    const origin = $('#game-root').getBoundingClientRect();
    const frame = boardFrame(origin.width, origin.height, save.settings.deckPosition, deal);
    const x = origin.x + (target ? frame.offsetX + target.x * frame.unit : origin.width * .5);
    const y = origin.y + (target ? target.y * frame.unit : origin.height * .4);
    victoryParticles.style.left = x + 'px'; victoryParticles.style.top = y + 'px';
    const burst = Array.from({ length: 18 }, (_, i) => {
      const particle = document.createElement('i'), angle = 2 * Math.PI * i / 18;
      particle.style.setProperty('--dx', Math.cos(angle) * (57 + i % 3 * 24) + 'px');
      particle.style.setProperty('--dy', Math.sin(angle) * (48 + i % 3 * 21) + 'px');
      particle.style.setProperty('--turn', (i * 41) + 'deg');
      return particle;
    });
    victoryParticles.replaceChildren(...burst);
    victoryParticles.hidden = false;
    animateActionFeedback(victoryParticles, 'victory-board', [{ opacity: .6 }, { opacity: 1, offset: .18 }, { opacity: .94, offset: .5 }, { opacity: 0 }], 540);
    victoryBeatUntil = performance.now() + 460;
    const animation = actionFeedback.get(victoryParticles);
    const hide = () => { if (!actionFeedback.has(victoryParticles) || actionFeedback.get(victoryParticles) === animation) victoryParticles.hidden = true; };
    void animation?.finished.then(hide, hide);
  }
  let rewardClaim: { attemptId: string; nextLabel: string; flying: boolean } | undefined;
  let rewardClaimTimer: ReturnType<typeof setTimeout> | undefined;
  let unlockVictory: { attempt: string; features: ReturnType<typeof unlockedBetween>; previous: ReturnType<typeof unlockTrack> } | undefined;
  function renderUnlockTrack(element: HTMLElement, features = unlockTrack(save).features, justUnlocked = false) {
    const { progress, goal } = unlockTrack(save);
    element.hidden = false;
    const title = Object.assign(document.createElement('small'), {
      textContent: justUnlocked ? 'Открыто' : features.length ? 'Следующее открытие' : 'Все возможности открыты',
    });
    const names = Object.assign(document.createElement('strong'), { textContent: features.map(feature => feature.name).join(' · ') });
    const copy = document.createElement('span');
    copy.append(title);
    if (features.length) copy.append(names);
    if (!justUnlocked && goal > 0) copy.append(progressTrack(progress, goal));
    element.replaceChildren(casualIcon(features[0]?.icon ?? 'medal'), copy);
    if (!justUnlocked && goal > 0) element.append(Object.assign(document.createElement('b'), { textContent: progress + '/' + goal }));
    element.dataset.unlocked = String(justUnlocked);
  }
  if (E4_M1) {
    $('#cycle-info p').textContent = `За пять впервые пройденных уровней кампании начисляются ${BALANCE.meta.cycleCoins} монет и подсказка.`;
    $('#calendar-reward-copy').textContent = `За день — ${BALANCE.meta.dailyCoins} монет. На 3-м дне серии — ещё ${BALANCE.meta.day3Coins}. На 7-м и каждых следующих семи — ${BALANCE.meta.day7Coins} и отмена. Пропуск сбрасывает серию.`;
  }
  const nextLevelButton = $<HTMLButtonElement>('#next-level');
  const nextCampaignLevel = () => sequentialCampaign
    ? completedLevels(save) < CAMPAIGN_LENGTH ? unlockedLevel(save) : undefined
    : deal.campaignLevel && deal.campaignLevel < CAMPAIGN_LENGTH ? deal.campaignLevel + 1 : undefined;
  const nextCampaignDeal = () => {
    const level = nextCampaignLevel();
    return save.attempt.daily || level === undefined ? undefined : campaignLevelPreview(campaignDeals[level - 1]);
  };
  function setNextLevelText(text: string) {
    nextLevelButton.textContent = text;
    const target = nextCampaignDeal();
    if (!casual || !difficultyLabel(target)) return;
    const line = document.createElement('small');
    line.append(document.createTextNode('Уровень ' + target!.campaignLevel), difficultyBadge(target));
    nextLevelButton.append(line);
  }
  function finishRewardClaim() {
    const claim = rewardClaim;
    if (!claim) return;
    rewardClaim = undefined;
    clearTimeout(rewardClaimTimer);
    nextLevelButton.removeAttribute('aria-busy');
    nextLevelButton.disabled = false;
    if (save.attempt.id === claim.attemptId) {
      setNextLevelText(claim.nextLabel);
      if (casual) {
        $('#result').dataset.rewardPhase = 'claimed';
        renderRewardOffers();
      }
    }
  }
  function startRewardClaim() {
    const claim = rewardClaim;
    if (!claim || claim.attemptId !== save.attempt.id) return false;
    if (claim.flying && casual) {
      cancelCoins(); finishRewardClaim(); return false;
    }
    if (!claim.flying) {
      claim.flying = true;
      nextLevelButton.disabled = !casual;
      if (casual) {
        setNextLevelText(claim.nextLabel);
        $('#result').dataset.rewardPhase = 'claimed';
      }
      nextLevelButton.setAttribute('aria-busy', 'true');
      rewardClaimTimer = setTimeout(() => { cancelCoins(); finishRewardClaim(); }, 1300);
      const layer = $('#coin-layer'), origin = $('#result-total');
      $('#result').append(layer);
      const gift = casual ? save.attempt.payout?.find(reward => reward.reason === 'campaign_win_cycle') : undefined;
      const giftOrigin = $('#result-bonus');
      if (gift && giftOrigin.getClientRects().length) {
        const marker = $('#result-meta .win-stamps .casual-icon');
        const rect = giftOrigin.getBoundingClientRect();
        animateRewardProgress(giftOrigin);
        if (marker) playPrizeFlight(rect, marker, casualIcon('gift'));
        if (gift.hints) {
          const before = { ...save, profile: { ...save.profile, hints: save.profile.hints - gift.hints } };
          presentRewardDeltas('#result', rect, before);
        }
        const cycleCoins = Math.min(wallet?.pending ?? 0, gift.coins);
        wallet?.collect(origin, (wallet?.pending ?? 0) - cycleCoins);
        wallet?.collect(giftOrigin, cycleCoins, finishRewardClaim);
      } else wallet?.collect(origin, undefined, finishRewardClaim);
    }
    return true;
  }
  let pendingRewardProgress: string | undefined;
  function animateRewardProgress(element: HTMLElement) {
    if (reducedMotion() || runtime.activity.getBlockReasons().some(reason => reason !== 'modal' && reason !== 'screen')) return;
    animateActionFeedback(element, 'reward-progress', [
      { boxShadow: '0 0 0 0 #d5aa56aa' },
      { boxShadow: '0 0 0 3px #d5aa5670', offset: .35 },
      { boxShadow: '0 0 0 7px #d5aa5600' },
    ], 460);
  }
  let chapterPage = 0, chapterAttemptId = '';
  const training = () => Boolean(save.attempt.daily && save.attempt.board.phase !== 'won' && !dailyRewardEligible(save, localDay()));
  let removeForeground: (() => void) | undefined;
  let saving = false, serviceBusy = false;
  const continueCheck = new ContinueCheck(() => { if (alive) renderHud(); });
  let continueVideoFailed: string | undefined;
  let rewardedResultAttempt: string | undefined;
  let rewardOfferReturn: { attempt: string; selector: '#result'|'#helpers'|'#appearance'|'#coins-dialog'; back?: () => void } | undefined;
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
  const testSdk = () => ads.status.mode === 'test';
  const approvedOffers = () => testSdk() || (ads.status.mode === 'live' && ads.status.offersApproved === true);
  const livesVideoApproved = () => releaseProfile && testSdk() || (ads.status.mode === 'live' && ads.status.livesApproved === true);
  let adBreakTimer: ReturnType<typeof setTimeout> | undefined;
  let adBreakAttempt: string | undefined;
  const AD_BREAK_IDLE_MS = casual ? 130 : 1800;
  let transitionAd: { level: number; placement: CampaignInterstitialPlacement } | undefined;
  type PauseOpportunity = {
    attempt: string; dealId: string; revision: number; trigger: string;
    acceptedAt: number; boardKey: string; moves: number | null; stage: 'settling' | 'notice' | 'request';
  };
  let pauseOpportunity: PauseOpportunity | undefined;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  let pausePaint = 0;
  let freshEndAttempt: string | undefined;
  let fullscreenRetryAt = 0;
  const coffeeLabel = Object.assign(document.createElement('aside'), { className: 'coffee-pause-label', hidden: true });
  let overlayExit: ReturnType<typeof setTimeout> | undefined;
  let requireLoadAfter: number | undefined;
  let pauseRearming = false;
  const cup = Object.assign(document.createElement('img'), { src: '/art/generated/cup.webp', alt: '', decoding: 'async' });
  const noticeTitle = Object.assign(document.createElement('strong'), { textContent: 'Рекламная пауза' });
  if (E4_M1) {
    coffeeLabel.classList.add('coffee-fullscreen');
    const card = document.createElement('div');
    card.className = 'coffee-card';
    card.append(cup, noticeTitle);
    coffeeLabel.append(card);
  } else coffeeLabel.append(cup, noticeTitle);
  coffeeLabel.setAttribute('role', 'status');
  $('#app').append(coffeeLabel);
  let adBreakHold = 0, adBreakRetryAt = 0;
  let lastAdBreakReason = '';
  const activePointers = new Set<number>();
  const campaignAdsApproved = () => releaseProfile && testSdk() || (ads.status.mode === 'live' && ads.status.campaignApproved === true);
  const coffeePreview = () => !releaseProfile && (ADS_CONTROLS_PREVIEW || campaignAdsApproved());
  let recoveryClock: ReturnType<typeof setTimeout> | undefined;
  let recoveryRetryDelay = 1000, recoverySyncing = false;
  let recoveryTimerAt: number | undefined;
  let recoveryWriteRetryAt = 0, recoveryWriteDelay = 1000;
  let unlimitedError: { attemptId: string; text: string } | undefined;
  function recoveryClockBlocked() {
    const attempt = save.attempt;
    return screen === 'game' && !attempt.daily && attempt.board.phase === 'playing' && attempt.board.movesLeft === null &&
      attempt.unlimited?.until !== undefined && !attempt.unlimited.expired && requiresNativeRecoveryClock(save, recoveryTime.read());
  }
  function updateRecoveryBlock() {
    const blocked = recoveryClockBlocked();
    runtime.activity.setBlocked('recovery-time', blocked);
    $('#app').dataset.recoveryClock = String(blocked);
    $('#recovery-clock-status').hidden = !blocked;
  }
  let banner: NativeBanner | undefined;
  const launchedAt = Date.now();
  function setAdBreakReason(reason: string) {
    if (lastAdBreakReason === reason) return;
    lastAdBreakReason = reason;
    telemetry.track('ad_event', { format: 'interstitial', placement: 'ads-break', phase: reason });
  }
  function tracePause(phase: string, opportunity?: PauseOpportunity, reason?: string) {
    if (!testSdk()) return;
    const now = Date.now(), lastShown = save.platform?.lastFullscreenAt ?? 0;
    const detail = { phase, reason, now, launchedAt, lastShown, elapsed: now - Math.max(launchedAt, lastShown),
      eligibleAt: coffeeEligibleAt(save, launchedAt), attempt: opportunity?.attempt, dealId: opportunity?.dealId,
      actionRevision: opportunity?.revision, trigger: opportunity?.trigger, stage: opportunity?.stage };
    document.dispatchEvent(new CustomEvent('solitaire:coffee', { detail }));
    if (runtime.native) console.info('coffee', JSON.stringify(detail));
  }
  function backoffPause() {
    fullscreenRetryAt = Math.max(fullscreenRetryAt, performance.now() + 30_000);
    requireLoadAfter = ads.interstitialEpoch;
    pauseRearming = true;
    void ads.discardInterstitial().finally(() => {
      pauseRearming = false;
      if (alive) void ads.prepareInterstitial();
    });
  }
  function cancelPause(reason: string) {
    const previous = pauseOpportunity;
    if (!previous) return;
    pauseOpportunity = undefined;
    clearTimeout(pauseTimer);
    cancelAnimationFrame(pausePaint);
    if (E4_M1 && previous.stage === 'notice' && reason !== 'dispose') backoffPause();
    if (E4_M1 && !coffeeLabel.hidden && reason !== 'dispose' && !reducedMotion()) {
      coffeeLabel.classList.add('leaving');
      clearTimeout(overlayExit);
      overlayExit = setTimeout(() => { coffeeLabel.hidden = true; updateBanner(); }, 220);
    } else coffeeLabel.hidden = true;
    runtime.activity.setBlocked('coffee-notice', false);
    tracePause('cancel', previous, reason);
  }
  function pauseContext(next: Save, opportunity: PauseOpportunity, ownBlock?: string) {
    return alive && ready && screen === 'game' && document.visibilityState === 'visible' && document.hasFocus() &&
      !saving && !serviceBusy && !store.needsRecovery && !inspectMode && !activePointers.size &&
      next.attempt.id === opportunity.attempt && next.attempt.board.movesLeft === opportunity.moves &&
      boardKey(next.attempt.board) === opportunity.boardKey &&
      next.attempt.dealId === opportunity.dealId && !training() &&
      runtime.activity.getBlockReasons().every(reason => reason === ownBlock) &&
      !teachingProtected(next, deal) && !noOrdinaryMoves(next.attempt.board);
  }
  function pauseReady() {
    return ads.status.interstitial && ads.status.interstitialLoaded === true && (!E4_M1 ||
      !pauseRearming && (requireLoadAfter === undefined || ads.interstitialEpoch > requireLoadAfter));
  }
  function pauseFieldSettled() {
    return Boolean(scene?.idleForAd()) && !$('#coin-layer').getAnimations({ subtree: true }).some(a => a.playState === 'running');
  }
  function offerPause(trigger: string, protectedAction: boolean) {
    const next: PauseOpportunity = { attempt: save.attempt.id, dealId: deal.id, revision: save.revision,
      trigger, acceptedAt: performance.now(), boardKey: boardKey(save.attempt.board),
      moves: save.attempt.board.movesLeft, stage: 'settling' };
    const reason = protectedAction ? 'tutorial' :
      coffeeBlocker(save, deal, Date.now(), launchedAt, campaignAdsApproved(), true);
    if (reason || performance.now() < fullscreenRetryAt || !pauseContext(save, next) || ads.showing || !pauseReady()) {
      tracePause('ineligible', next, reason ?? (!pauseReady() ? 'not-ready' : 'context'));
      if (!pauseReady()) void ads.prepareInterstitial();
      return false;
    }
    pauseOpportunity = next;
    tracePause('accepted', next);
    const settle = () => {
      if (pauseOpportunity !== next) return;
      if (!pauseContext(save, next) || !pauseReady() || performance.now() - next.acceptedAt > releaseAdCadence.coffee.settleTimeoutMs) {
        cancelPause('before-settled'); return;
      }
      if (!pauseFieldSettled()) { pauseTimer = setTimeout(settle, 34); return; }
      tracePause('settled', next);
      next.stage = 'notice';
      clearTimeout(overlayExit);
      coffeeLabel.classList.remove('leaving');
      coffeeLabel.hidden = false;
      runtime.activity.setBlocked('coffee-notice', true);
      pausePaint = requestAnimationFrame(() => {
        pausePaint = requestAnimationFrame(() => {
          if (pauseOpportunity !== next) return;
          tracePause('notice-painted', next);
          pauseTimer = setTimeout(async () => {
            if (pauseOpportunity !== next) return;
            // The board settled before the notice. Suspension can queue cosmetic
            // tweens, but input and the accepted board are still guarded.
            const blocker = !pauseContext(save, next, 'coffee-notice') ? 'context' : !pauseReady() ? 'not-ready' :
              coffeeBlocker(save, deal, Date.now(), launchedAt, campaignAdsApproved(), E4_M1 || pauseFieldSettled());
            if (blocker) {
              tracePause('request-blocked', next, blocker);
              cancelPause('before-request'); return;
            }
            next.stage = 'request';
            runtime.activity.setBlocked('coffee-notice', false);
            tracePause('request', next);
            const outcome = await ads.show({ kind: 'interstitial', placement: 'ads-break',
              mode: save.attempt.daily ? 'daily' : 'campaign', attempt: next.attempt, dealId: next.dealId });
            if (!outcome.shown && E4_M1) backoffPause();
            else if (!outcome.shown) fullscreenRetryAt = performance.now() + 30_000;
            tracePause('return', next, outcome.outcome);
            cancelPause('finished');
            if (!pauseRearming) void ads.prepareInterstitial();
          }, releaseAdCadence.coffee.noticeMs);
        });
      });
    };
    settle();
    return true;
  }
  function scheduleAdBreak(delay = 0) {
    if (casual || !alive || adBreakTimer !== undefined || screen !== 'game' || runtime.activity.isBlocked() ||
      !adBreakAttempt || save.attempt.id !== adBreakAttempt) return;
    adBreakTimer = setTimeout(() => {
      adBreakTimer = undefined;
      if (!alive || screen !== 'game' || runtime.activity.isBlocked() || save.attempt.id !== adBreakAttempt) return;
      const now = Date.now(), remainingIdle = Math.max(adBreakHold, adBreakRetryAt) - performance.now();
      const idle = !saving && !serviceBusy && !store.needsRecovery && !inspectMode && !activePointers.size && remainingIdle <= 0 &&
        !teachingProtected(save, deal, activelyTeaching(save, deal, currentLesson())) && Boolean(scene?.idleForAd());
      const blocker = adBreakBlocker(save, deal, now, launchedAt, campaignAdsApproved(), idle);
      if (blocker) {
        setAdBreakReason(blocker);
        if (blocker === 'cadence') {
          const untilOpen = Math.max(launchedAt, save.platform?.lastFullscreenAt ?? 0) + AD_BREAK_GAP_MS - now;
          if (untilOpen <= BALANCE.ads.fullscreenGapMs) void ads.prepareInterstitial();
          scheduleAdBreak(untilOpen > BALANCE.ads.fullscreenGapMs ? untilOpen - BALANCE.ads.fullscreenGapMs : untilOpen);
        } else if (blocker === 'busy') scheduleAdBreak(Math.max(250, remainingIdle));
        return;
      }
      if (!document.hasFocus()) { setAdBreakReason('focus'); return; }
      if (!ads.status.interstitial || ads.status.interstitialLoaded === false) {
        setAdBreakReason('waiting-load');
        void ads.prepareInterstitial();
        scheduleAdBreak(15_000);
        return;
      }
      setAdBreakReason('eligible');
      const attempt = adBreakAttempt!;
      adBreakRetryAt = performance.now() + 30_000;
      void ads.show({ kind: 'interstitial', placement: 'ads-break', mode: 'campaign', attempt, dealId: deal.id }).then(result => {
        if (adBreakAttempt !== attempt) return;
        if (result.shown) { adBreakAttempt = undefined; lastAdBreakReason = ''; }
        else scheduleAdBreak(30_000);
      });
    }, delay);
  }
  const telemetry = createTelemetry(() => save, runtime.activity, AZUR_VICTORY_QA ? {
    track(event, params) {
      if (validEvent(event, params)) document.dispatchEvent(new CustomEvent('solitaire:qa-analytics', { detail: { event, params } }));
    },
    destroy() {},
  } : undefined);
  let transitionPresentation: { resumeId?: string } | undefined;
  let sceneGeneration = 0;
  const setInput = () => scene?.setEnabled(screen === 'game' && ready && $('#app').dataset.presentedDeal === save.attempt.dealId &&
    !saving && !runtime.activity.isBlocked() && !store.needsRecovery);
  function updateBanner() {
    const eligible = ads.status.banner && !adFree(save, Date.now(), 'banner') &&
      (releaseProfile ? unlockedLevel(save) >= releaseAdCadence.banner.minimumLevel :
        screen === 'game' && (deal.campaignLevel ?? 0) >= BALANCE.ads.bannerFromLevel);
    const blocked = runtime.activity.getBlockReasons().some(reason => reason !== 'screen' && reason !== 'level-transition');
    const teaching = screen === 'game' && teachingProtected(save, deal, activelyTeaching(save, deal, currentLesson()));
    const result = screen === 'game' && save.attempt.board.phase !== 'playing';
    banner?.setEligible(eligible, blocked || teaching || result || (E4_M1 && !coffeeLabel.hidden));
  }
  store.onChange = value => {
    // A previously ambiguous write can become confirmed during a later recovery.
    // Keep only its transient presentation; SaveStore still owns every reward.
    if (deferredMonthlyConfirmation?.state === value) {
      confirmMonthlyBonuses(deferredMonthlyConfirmation.grants);
      deferredMonthlyConfirmation = undefined;
    }
    const changedDeal = value.attempt.dealId !== save.attempt.dealId;
    const changedAttempt = value.attempt.id !== save.attempt.id;
    if (changedAttempt) {
      clearTimeout(adBreakTimer); adBreakTimer = undefined; adBreakAttempt = undefined;
      cancelPause('attempt-changed');
    }
    save = value; deal = findDeal(value.attempt.dealId)!;
    if (scene && (changedDeal || (changedAttempt && transitionPresentation))) {
      const animate = transitionPresentation?.resumeId !== value.attempt.id;
      transitionPresentation = undefined;
      presentLevelStart(animate);
    }
    wallet?.sync(value.profile.coins, presentingCommand);
    telemetry.sync();
    if (!pendingWrites) { renderHud(); renderHome(); }
    setInput(); updateBanner(); scheduleRecoveryClock();
  };
  function clearRecoveryClock() {
    clearTimeout(recoveryClock); recoveryClock = undefined; recoveryTimerAt = undefined;
  }
  function scheduleRecoveryClock() {
    updateRecoveryBlock();
    if (recoverySyncing) { clearRecoveryClock(); return; }
    const unknown = requiresNativeRecoveryClock(save, recoveryTime.read()), remaining = recoveryWait(save);
    if (!unknown && remaining === undefined) {
      clearRecoveryClock(); recoveryRetryDelay = 1000; recoveryWriteRetryAt = 0; recoveryWriteDelay = 1000; return;
    }
    const rawDelay = unknown ? Math.min(recoveryRetryDelay, remaining ?? Infinity) : remaining!;
    const now = performance.now(), delay = Math.min(2_147_483_647, Math.max(0, rawDelay, recoveryWriteRetryAt - now));
    const due = now + delay;
    // Unrelated SaveStore commits must not move an already scheduled native sample later.
    if (recoveryClock !== undefined && recoveryTimerAt !== undefined && recoveryTimerAt <= due) return;
    clearRecoveryClock(); recoveryTimerAt = due;
    recoveryClock = setTimeout(() => {
      recoveryClock = undefined; recoveryTimerAt = undefined;
      if (!alive) return;
      void syncRecoveryTime().catch(() => message('Не удалось восстановить лимит ходов.', true));
    }, delay);
  }
  async function syncRecoveryTime() {
    if (recoverySyncing || !alive) return;
    if (recoveryWait(save) === undefined && !requiresNativeRecoveryClock(save, recoveryTime.read())) { updateRecoveryBlock(); return; }
    recoverySyncing = true;
    try {
      if (requiresNativeRecoveryClock(save, recoveryTime.read())) {
        const refreshed = await recoveryTime.refresh();
        recoveryRetryDelay = refreshed ? 1000 : Math.min(60_000, recoveryRetryDelay * 2);
        // While the native clock is unavailable, a parked right need not interrupt
        // the active finite game just to write an unchanged snapshot.
        if (!refreshed && recoveryWait(save) === undefined) return;
      }
      if (!alive) return;
      const changed = await write(expireRecovery);
      recoveryWriteRetryAt = 0; recoveryWriteDelay = 1000;
      if (changed) { scene?.sync(); if (screen === 'game' && save.attempt.board.phase === 'exhausted') outcome(); }
    } catch (error) {
      recoveryWriteRetryAt = performance.now() + recoveryWriteDelay;
      recoveryWriteDelay = Math.min(60_000, recoveryWriteDelay * 2);
      throw error;
    } finally {
      recoverySyncing = false;
      if (alive) { scheduleRecoveryClock(); renderHud(); }
    }
  }
  async function write<T>(change: (next: Save, monthlyGrants: FreeCampaignBonusGrant[], now: number) => T): Promise<T> {
    pendingWrites++; saving = true; setInput();
    let confirmation: MonthlyConfirmation | undefined;
    try {
      const result = await store.mutate(next => {
        const now = Date.now(), grant = freeSeasonalTrack ? settleFreeCampaignBonus(next, now) : undefined;
        const grants = grant ? [grant] : [];
        const value = change(next, grants, now);
        confirmation = { state: next, grants };
        return value;
      });
      if (confirmation) confirmMonthlyBonuses(confirmation.grants);
      return result;
    } catch (error) {
      if (store.needsRecovery && confirmation?.grants.length) deferredMonthlyConfirmation = confirmation;
      throw error;
    }
    finally {
      if (!store.needsRecovery) {
        deferredMonthlyConfirmation = undefined;
        if (pendingWrites === 1) transitionPresentation = undefined;
      }
      saving = --pendingWrites > 0; setInput(); renderHud(); renderHome();
      if (!saving && ready && screen === 'game' && !runtime.activity.isBlocked()) showGuidance();
    }
  }
  const storefront = createStorefront(store);
  if (STOREFRONT_PREVIEW) void storefront.refresh().catch(() => undefined);
  let lifeVideoInFlight: string | undefined;
  const ads = createAds({
    pendingLife: () => lifeVideoInFlight ? undefined : save.campaignLives?.pending,
    pendingOffer: () => save.rewardOffers?.pending.find(offer => offer.attemptId !== undefined)?.id,
    async retireOffer(id) { await store.mutate(next => retireUnrewardedOffer(next, id)); },
    async retireLife(request) {
      if (lifeVideoInFlight || !matchesLifeVideo(save, request.id, request.dealId)) return;
      await store.mutate(next => {
        if (!lifeVideoInFlight && matchesLifeVideo(next, request.id, request.dealId)) cancelLifeVideo(next, request.id);
      });
    },
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
          if (!rewardOffersEnabled || !approvedOffers() || request.kind !== 'rewarded' || request.mode !== 'campaign' ||
            !pending || offerShowContext(next, request)?.attemptId !== next.attempt.id) {
            throw Error('Предложение изменилось');
          }
          return;
        }
        const attempt = next.attempt;
        if (request.attempt !== attempt.id || request.dealId !== attempt.dealId ||
          request.mode !== (attempt.daily ? 'daily' : 'campaign')) throw Error('Партия изменилась');
        if (request.placement === 'coffee-break') {
          if (!coffeePreview() || !campaignAdsApproved() || request.kind !== 'rewarded' || !matchesCoffee(next, request.attempt, request.dealId))
            throw Error('Кофе-пауза недоступна');
          return;
        }
        if (request.placement === 'ads-break') {
          if (casual ? !pauseOpportunity || pauseOpportunity.stage !== 'request' ||
              !pauseContext(next, pauseOpportunity, 'ad') || !pauseReady() ||
              coffeeBlocker(next, deal, Date.now(), launchedAt, campaignAdsApproved(), E4_M1 || pauseFieldSettled()) !== undefined
            : !eligibleAdBreak(next, deal, Date.now(), launchedAt, campaignAdsApproved(), true)) throw Error('Пауза недоступна');
          return;
        }
        if (request.kind === 'interstitial') {
          const level = findDeal(request.dealId)?.campaignLevel;
          const permitted = casual ? campaignAdsApproved() && transitionAd !== undefined &&
            transitionAd.placement === request.placement && !teachingProtected(next, deal) &&
            releasePlacementEligible(next, transitionAd.level, transitionAd.placement, Date.now(), launchedAt) :
            attempt.board.phase === 'won' && level !== undefined &&
            interstitialEligible(next, level, request.mode, Date.now(), launchedAt);
          if (!permitted) throw Error('Показ недоступен');
        }
        if (request.kind === 'rewarded' && request.placement === 'continue' && casual) {
          if (!canShowContinueVideo(next, request)) throw Error('Продолжение недоступно');
        } else if (request.kind === 'rewarded' && request.placement === 'continue' && requiresContinueProof(next.attempt)) {
          const proof = continueCheck.proof;
          if (!proof || request.attempt !== proof.attemptId || request.dealId !== proof.deal.id ||
            next.attempt.continued || !verifiesContinue(next.attempt, proof)) throw Error('Продолжение недоступно');
        }
      });
    },
    commitShown: shown => store.mutate(next => {
      const shownDeal = findDeal(shown.dealId);
      return applyFullscreenShown(next, shown, shownDeal?.campaignLevel, casual ? shownDeal : undefined);
    }),
    async commit(receipt) {
      const placement = receipt.placement;
      let openedBonus = false, earnedContinue = false, grantedOfferCoins = 0;
      const result = await store.mutate(next => {
        const hadContinue = next.platform?.continuedAttempts.includes(receipt.attempt);
        const beforeCoins = next.profile.coins, hadExtra = next.attempt.continued;
        const applied = applyReceipt(next, receipt, {
          offerNow: Date.now(),
          deal: findDeal(receipt.dealId), onBonusUnlocked: () => { openedBonus = true; }, continueProof: continueCheck.proof, unrestrictedVideo: casual,
        });
        grantedOfferCoins = next.profile.coins - beforeCoins;
        if (applied === 'applied' && grantedOfferCoins > 0)
          logTaskAction(next, 'EarnCoins', 'wallet', grantedOfferCoins, `rewarded:${receipt.id}`);
        if (placement === 'continue' && !hadExtra && next.attempt.continued) logTaskAction(next, 'BuyExtraMoves', 'continue');
        earnedContinue = placement === 'continue' && !hadContinue && Boolean(next.platform?.continuedAttempts.includes(receipt.attempt));
        return applied;
      });
      const amount = placement === 'continue' ? Number(earnedContinue) * BALANCE.continueMoves : placement === 'hint' || placement === 'undo'
        ? BALANCE.rewardedCharges[placement] : isOfferPlacement(placement) || placement === 'coffee-break' ? grantedOfferCoins : Number(openedBonus);
      if (result === 'applied' && amount) telemetry.track('reward_granted', { attemptId: receipt.attempt, dealId: receipt.dealId, mode: receipt.mode, reason: `rewarded_${placement}`, amount });
      // Ack failure must not freeze spending/restart or replay the already durable grant.
      if (runtime.activity.getBlockReasons().every(r => r === 'modal')) { scene?.sync(); if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs(); }
      if (E4_M1 && result === 'applied' && placement.startsWith('win-')) finishVideoWin();
      return result;
    },
    onStatus() {
      renderLives(); renderHud(); updateBanner();
      const level = casual ? unlockedLevel(save) : deal.campaignLevel ?? 0;
      if (level >= (casual ? releaseAdCadence.interstitial.minimumLevel - 1 : BALANCE.ads.interstitialAfterLevel + 1)) void ads.prepareInterstitial();
      scheduleAdBreak();
    },
    onEvent(event) {
      const placement = event.placement ?? (event.kind === 'banner' ? 'campaign-banner' :
        event.kind === 'interstitial' ? 'shared-preload' : 'unspecified');
      telemetry.track('ad_event', { format: event.kind, phase: event.phase, placement });
      if (event.kind === 'interstitial' && event.placement === 'ads-break' && pauseOpportunity)
        tracePause('sdk-' + event.phase, pauseOpportunity);
      if (!casual && event.kind === 'interstitial' && event.phase === 'loaded' && adBreakAttempt) {
        clearTimeout(adBreakTimer); adBreakTimer = undefined; scheduleAdBreak(250);
      }
      if (event.kind === 'banner' && event.phase === 'load_error') banner?.retryAfterLoadError();
    },
  });
  if (ads.bridge) banner = new NativeBanner(ads.bridge, $('#banner-slot'));
  telemetry.track('session_start');
  if (save.attempt.telemetry?.started && save.attempt.board.phase === 'playing') telemetry.track('level_resume');
  let helperFocus: 'hint' | 'undo' | 'joker' | undefined;
  let helperResource: 'definition' | undefined;
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
  function openHelpers(focus?: typeof helperFocus, fromSettings = false, resource?: typeof helperResource) {
    helperFocus = focus; helperResource = resource;
    renderHud();
    if (fromSettings) openChildDialog('#helpers', '#settings', $('#helpers-open'));
    else openDialog('#helpers');
    if (resource) $('#helpers .sheet-body').scrollTop = 0;
  }
  function helperBought(helper: NonNullable<typeof helperFocus>) {
    if (helperFocus !== helper || screen !== 'game') return;
    closeDialogs();
    if (save.attempt.board.phase === 'exhausted') outcome();
    else { const button = $(`#${helper}`); button.classList.remove('bump'); void button.offsetWidth; button.classList.add('bump'); }
  }
  let activeHint: { key: string; action: BoardCommand } | undefined;
  let lessonSave: Save | undefined;
  let instruction: ReturnType<typeof lesson>;
  let lessonNote: { copy?: string; action?: BoardCommand } = {};
  let pendingGuide: (() => void) | undefined;
  function syncLessonNote() {
    const { copy, action } = lessonNote;
    const visible = Boolean(copy && (!action || (ready && screen === 'game' &&
      $('#app').dataset.presentedDeal === save.attempt.dealId && !runtime.activity.isBlocked() && scene?.guidanceReady(action))));
    const text = visible ? copy! : '';
    if ($('#lesson-copy').textContent !== text) $('#lesson-copy').textContent = text;
    $('#lesson-note').hidden = !visible;
    const actionKind = visible && action ? action.type : undefined;
    if (actionKind) $('#lesson-note').dataset.action = actionKind;
    else delete $('#lesson-note').dataset.action;
  }
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
  const stuckBoards = new WeakMap<Save['attempt']['board'], boolean>();
  const progressSearch = new WeakMap<Save['attempt']['board'], ReturnType<typeof ordinaryProgress>>();
  let deadEndPaint = 0, dismissedDeadEnd: string | undefined;
  const progressAt = (board: Save['attempt']['board']) => {
    if (!progressSearch.has(board)) progressSearch.set(board, ordinaryProgress(board, deal));
    return progressSearch.get(board)!;
  };
  if (E4_M1) $('#dead-end-dismiss').addEventListener('click', () => {
    dismissedDeadEnd = save.attempt.id;
    renderDeadEnd();
  }, domOptions);
  function noOrdinaryMoves(board: Save['attempt']['board']) {
    if (E4_M1) return board.phase === 'playing' && progressAt(board) === 'stuck';
    if (board.phase !== 'playing' || board.stock.length || board.waste.length && board.recyclesLeft !== 0 ||
        hasTransfer.get(board) === true) return false;
    if (!stuckBoards.has(board)) stuckBoards.set(board, legalCommands(board, deal).length === 0);
    return stuckBoards.get(board)!;
  }
  function renderDeadEnd() {
    cancelAnimationFrame(deadEndPaint);
    const panel = $('#dead-end'), { attempt, profile } = save;
    const stuck = noOrdinaryMoves(attempt.board);
    if (E4_M1 && !stuck && attempt.board.phase === 'playing' && progressAt(attempt.board) === 'reachable') dismissedDeadEnd = undefined;
    const applicable = (dismissedDeadEnd !== attempt.id) && ready && screen === 'game' && !saving && !serviceBusy && !store.needsRecovery &&
      !recoveryClockBlocked() && !inspectMode && !runtime.activity.isBlocked() &&
      !currentLesson()?.accepts && stuck;
    panel.hidden = !applicable || !pauseFieldSettled();
    if (panel.hidden) {
      if (applicable) deadEndPaint = requestAnimationFrame(renderDeadEnd);
      return;
    }
    $('#dead-end-dismiss').hidden = !E4_M1;
    $('#dead-end-copy').hidden = !E4_M1;
    const canAct = (board: Save['attempt']['board']) => E4_M1 ? progressAt(board) === 'reachable' : legalCommands(board, deal).length > 0;
    const previous = attempt.undo.at(-1);
    $('#dead-end-undo').hidden = !(profile.undos > 0 && helperUnlocked(save, 'undo', deal) && previous && canAct(previous));
    $('#dead-end-joker').hidden = !(profile.jokers > 0 && !attempt.jokerUsed && helperUnlocked(save, 'joker', deal) &&
      attempt.board.tableau.some((_, index) => {
        const candidate = placeJoker(attempt.board, index, deal);
        return typeof candidate !== 'string' && canAct(candidate);
      }));
    const restore = restoreQuote(attempt, deal);
    $('#dead-end-restore').hidden = !recoveryEnabled() || restore === undefined || profile.coins < restore;
    $('#dead-end-shuffle').hidden = !canShuffle(save, deal) || ![0, 1].some(seed => {
      const candidate = prepareShuffleBoard(attempt.board, deal, seed);
      return candidate && canAct(candidate);
    });
    for (const kind of bonusKinds) {
      const offer = bonusOffer(deal, kind);
      const preview = offer && profile.coins >= offer.coins ? { ...attempt, undo: [], board: structuredClone(attempt.board) } : undefined;
      $(`#dead-end-${kind}`).hidden = !preview || !openBonusSlot(preview, deal, kind) || !canAct(preview.board);
    }
  }
  function renderUnlimitedTime() {
    const timed = save.attempt.unlimited;
    const left = timed && save.attempt.board.phase === 'playing'
      ? unlimitedRemaining(timed, Date.now(), recoveryTime.read()) : undefined;
    const countdown = $('#unlimited-countdown');
    countdown.hidden = left === undefined || save.attempt.board.movesLeft !== null || recoveryClockBlocked();
    if (countdown.hidden || left === undefined) return;
    const seconds = Math.ceil(left / 1000);
    const value = countdown.querySelector('strong')!;
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (value.textContent !== time) value.textContent = time;
  }
  function renderHud() {
    updateRecoveryBlock();
    renderUnlimitedTime();
    $('#campaign-store-open').hidden = !STOREFRONT_PREVIEW;
    $('#coffee-open').hidden = !coffeePreview() || (deal.campaignLevel ?? 0) < 16 || save.attempt.board.phase !== 'playing';
    const restore = $<HTMLButtonElement>('#restore-stock'), price = restoreQuote(save.attempt, deal);
    restore.hidden = !recoveryEnabled() || price === undefined;
    restore.disabled = price === undefined || save.profile.coins < price || saving;
    restore.textContent = price ? `Восстановить колоду · ${price} монет` : 'Восстановить колоду · бесплатно';
    const stockRecovery = $<HTMLButtonElement>('#stock-recovery-button');
    $('#stock-recovery').hidden = screen !== 'game' || save.attempt.board.phase !== 'playing' ||
      save.attempt.board.recyclesLeft !== 0 || save.attempt.board.stock.length > 0 || save.attempt.board.waste.length === 0;
    stockRecovery.hidden = restore.hidden;
    stockRecovery.disabled = restore.disabled || serviceBusy || store.needsRecovery || recoveryClockBlocked();
    stockRecovery.textContent = price ? `Восстановить · ${price} монет` : 'Восстановить бесплатно';
    const unlimited = $<HTMLButtonElement>('#unlimited-preview');
    unlimited.disabled = saving || serviceBusy || store.needsRecovery;
    const purchase = recoveryEnabled() && quotePurchasedUnlimited(save, deal, unlimitedAccount(), Date.now());
    const earned = quoteUnlimitedAccess(save, deal, Date.now(), recoveryTime.read());
    const trial = RECOVERY_PREVIEW && deal.recovery && save.attempt.board.phase === 'playing' && !save.attempt.unlimited;
    const buyUnlimited = canBuyUnlimitedAccess(save, deal);
    const clockPending = requiresNativeRecoveryClock(save, recoveryTime.read()) && Boolean(save.attempt.unlimited || save.attempt.unlimitedAccess);
    unlimited.hidden = !(purchase || earned || trial || buyUnlimited || clockPending);
    const unlimitedStatus = $('#unlimited-status');
    unlimitedStatus.hidden = !(clockPending || unlimitedError?.attemptId === save.attempt.id);
    unlimitedStatus.textContent = unlimitedError?.attemptId === save.attempt.id ? unlimitedError.text : clockPending ? 'Проверяем время. Заряд сохранён; исходный срок действия не меняется.' : '';
    unlimited.textContent = clockPending ? 'Проверить время ходов без лимита' : earned ? 'Активировать ходы без лимита' : purchase ? 'Применить купленные ходы без лимита' :
      buyUnlimited ? `Без лимита · ${deal.extraHelpers!.unlimitedMs / 1000} с · ${deal.extraHelpers!.unlimitedCoins} монет` : 'Ходы без лимита · 2 мин';
    const joker = $<HTMLButtonElement>('#random-joker-open');
    const jokerPrice = deal.extraHelpers?.randomJokerCoins;
    const canBuy = jokerPrice !== undefined && randomJokerCount(save) === 0 && allowsRandomJoker(save.attempt, deal);
    joker.hidden = !(canRequestRandomJoker() || canBuy);
    joker.disabled = saving || recoveryClockBlocked() || (canBuy && save.profile.coins < jokerPrice);
    joker.textContent = canBuy ? `Заряд случайного Джокера · ${jokerPrice} монет` : 'Случайный Джокер · 1';
    $('#app').dataset.screen = screen;
    $('#game-surface').hidden = screen !== 'game';
    syncMotionPreference();
    const board = save.attempt.board;
    const shuffle = $<HTMLButtonElement>('#proof-shuffle');
    const shuffling = runtime.activity.getBlockReasons().includes('shuffle');
    shuffle.hidden = !deal.shufflePreview && !deal.shufflePolicy;
    shuffle.disabled = !canShuffle(save, deal) || saving || shuffling || recoveryClockBlocked();
    shuffle.setAttribute('aria-busy', String(shuffling));
    $('#proof-shuffle-label').textContent = shuffling ? 'Ищу…' : save.attempt.shuffleUsed ? 'Использовано' : 'Перемешать';
    const shuffleCount = $('#proof-shuffle-count');
    shuffleCount.hidden = !deal.shuffleCost || save.attempt.shuffleUsed === true;
    shuffleCount.textContent = String(save.dailyTasks?.inventory.shuffles ?? 0);
    if (shuffleCount.hidden) shuffle.removeAttribute('aria-describedby');
    else shuffle.setAttribute('aria-describedby', shuffleCount.id);
    $('#game').dataset.exhausted = String(board.phase === 'exhausted');
    if (screen === 'game' && board.phase === 'playing' && !hasTransfer.has(board)) {
      if (!E4_M1) hasTransfer.set(board, canReachTransfer(board, deal));
      else if (progressAt(board) !== 'unknown') hasTransfer.set(board, progressAt(board) === 'reachable');
    }
    $('#no-transfer').hidden = screen !== 'game' || board.phase !== 'playing' || hasTransfer.get(board) !== false || noOrdinaryMoves(board);
    renderDeadEnd();
    $('#app').dataset.practice = String(training());
    $('#app').dataset.lesson = String(Boolean(deal.training || deal.frozen || deal.bound || deal.puzzle || deal.golden || deal.starter));
    $('#level-number').textContent = deal.daily ? `${training() ? 'ТРЕНИРОВКА' : 'ДЕНЬ'} · ${deal.daily.dayId}` : deal.campaignLevel ? `УРОВЕНЬ ${deal.campaignLevel}` : 'ПРОБНАЯ РАЗДАЧА';
    $('.level h1').textContent = deal.daily ? 'Ежедневный уровень' : deal.title;
    const hintUnlocked = helperUnlocked(save, 'hint', deal), undoUnlocked = helperUnlocked(save, 'undo', deal);
    $('#hint').hidden = !hintUnlocked; $('#undo').hidden = !undoUnlocked;
    $('#hint-offer').hidden = !hintUnlocked || Boolean(helperFocus && helperFocus !== 'hint'); $('#undo-offer').hidden = !undoUnlocked || Boolean(helperFocus && helperFocus !== 'undo');
    const hasContextOffers = productOfferEnabled && !save.attempt.daily && (deal.campaignLevel ?? 0) >= 3;
    const jokerUnlocked = helperUnlocked(save, 'joker', deal);
    $('#joker').hidden = !jokerUnlocked; $('#joker-offer').hidden = !jokerUnlocked || Boolean(helperFocus && helperFocus !== 'joker');
    $('#buy-joker').textContent = '+1 за ' + BALANCE.helperPrices.joker + ' монет';
    $('#joker-count').textContent = String(save.profile.jokers); $('#joker-stock').textContent = String(save.profile.jokers);
    $<HTMLButtonElement>('#buy-joker').disabled = serviceBusy || saving || (!hasContextOffers && save.profile.coins < BALANCE.helperPrices.joker);
    const canInspectInventory = unlockedLevel(save) >= 2 || hintUnlocked || undoUnlocked || jokerUnlocked;
    $<HTMLButtonElement>('#wallet-open').disabled = !casual && !canInspectInventory;
    $('.wallet-plus').hidden = casual ? $<HTMLDialogElement>('#coins-dialog').open : !canInspectInventory;
    $('#helpers-coins-open').hidden = !casual;
    $('#helpers-open').hidden = !canInspectInventory;
    renderHelperInventory();
    $('#helper-locked').hidden = hintUnlocked || undoUnlocked || jokerUnlocked;
    $('#restart').hidden = screen === 'home'; $('#levels-open').hidden = screen === 'home';
    const done = $('#settings-done');
    done.replaceChildren(document.createTextNode(screen === 'home' ? 'Готово' : 'Продолжить игру'));
    if (casual) done.prepend(casualIcon('dailyDeal'));
    $('#pause-title').textContent = screen === 'home' || $<HTMLDetailsElement>('#pause-options').open ? 'Настройки' : 'Пауза';
    const difficulty = $('#field-difficulty');
    difficulty.hidden = !casual || !difficultyLabel(deal);
    if (!difficulty.hidden) difficulty.replaceChildren(difficultyBadge(deal));
    $('#pause-level').textContent = screen === 'home' ? 'СОЛИТЁР АССОЦИАЦИЙ' : $('#level-number').textContent;
    const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
    $('#app').dataset.deckEdge = hasDeck ? save.settings.deckSide ?? 'right' : 'right';
    $('#app').dataset.deckRow = hasDeck ? save.settings.deckPosition ?? 'top' : 'top';
    positionBonusSlots(save);
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
    const source = screen === 'game' && board.phase === 'playing' ? board.hitapps : undefined;
    const sourceGlyphs = source ? Object.values(source.cards) : [];
    const sourceActions = $('#source-special-actions');
    const choices = sourceGlyphs.some(card => card.scissors || card.bound === 1)
      ? legalCommands(board, deal).filter((action): action is Extract<BoardCommand, {type:'transfer'}> =>
        action.type === 'transfer' && (action.scissors === 'unbind' || action.scissors === 'discard')) : [];
    sourceActions.hidden = !choices.length;
    sourceActions.replaceChildren(...choices.slice(0, 2).map(action => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'secondary';
      const title = action.scissors === 'discard' ? 'Убрать ножницы' : 'Снять связь';
      button.textContent = title;
      button.setAttribute('aria-label', `${title} · ${action.from.kind === 'waste' ? 'сброс' : `столбец ${action.from.index + 1}`}`);
      button.addEventListener('click', () => { void execute(action); });
      return button;
    }));
    const sourceNote = sourceGlyphs.some(card => card.scissors || card.bound === 2) ? 'Перенесите ножницы на связанную карту.'
      : choices.length ? 'Связь можно снять.' : sourceGlyphs.some(card => card.ice) ? 'Подходящий перенос снимает слой льда.'
      : deal.hitapps?.assemblies.some(pair => !source?.spent.includes(pair.halves[0])) && source ? 'Соедините две половины в столбце.'
      : deal.hitapps?.gold && source ? `Активировано золотых карт: ${collectedGold(board, deal)}.` : undefined;
    const boosterNote = nextBooster === 'magnet' ? 'Магнит в слоте темы подтянет карту из колоды.'
      : nextBooster === 'hammer' ? 'Молоток в слоте темы откроет карту в столбце.' : undefined;
    const note = instruction?.attention === 'joker' && $('#joker').getAttribute('aria-pressed') === 'true'
      ? (instruction.jokerColumn === undefined ? 'Коснитесь отмеченного столбца, чтобы поставить Джокера.'
        : 'Для примера коснитесь выделенного столбца с камнем.')
      : instruction?.copy ?? sourceNote ?? (casual && screen === 'game' ? (firstBonusOffer(save, deal) === 'foundation'
        ? (campaignCoreDealId(deal.id) ? 'Доп. место для темы освобождает верхний ряд.' : 'Дополнительный слот можно открыть за монеты или видео.')
        : firstBonusOffer(save, deal) === 'tableau'
          ? (campaignCoreDealId(deal.id) ? 'Доп. столбец даёт место для сортировки карт.' : 'Дополнительный столбец можно открыть за монеты или видео.') : specialRuleNote(save, deal)?.copy) : binding ? 'Перенесите ножницы в верхний слот, чтобы разрезать связь.'
        : ice ? 'Соберите тему, чтобы снять один слой льда.'
        : puzzle ? 'Соедините половины в столбце и перенесите пару в слот темы.' : goldNote ?? boosterNote);
    lessonNote = { copy: note, action: instruction?.copy ? instruction.action : undefined };
    syncLessonNote();
    $<HTMLButtonElement>('#joker').disabled = recoveryClockBlocked() || board.phase !== 'playing' || Boolean(save.attempt.jokerUsed) || saving ||
      Boolean(instruction?.accepts && instruction.attention !== 'joker');
    $('#joker').classList.toggle('attention', instruction?.attention === 'joker');
    $('#hint').classList.toggle('attention', instruction?.attention === 'hint');
    $('#undo').classList.toggle('attention', instruction?.attention === 'undo');

    $('#wallet-open').setAttribute('aria-label', `${save.profile.coins} монет. Кошелёк`);
    $('#moves').textContent = recoveryClockBlocked() ? '…' : board.movesLeft === null ? '∞' : String(board.movesLeft);
    $('.moves').dataset.urgency = board.movesLeft === 0 ? 'lost' : board.movesLeft !== null && board.movesLeft <= 5 ? board.movesLeft <= 2 ? 'critical' : 'low' : '';
    $('#move-fill').style.width = `${100 * (board.movesLeft ?? 1) / (deal.initial.movesLeft ?? 1)}%`;
    const replayHint = Boolean(repeatHint());
    const searching = Boolean(pendingHint);
    $('#hint-label').textContent = searching ? 'Ищу…' : replayHint ? 'Повторить' : 'Подсказка';
    $('#hint-count').hidden = replayHint;
    $('#hint').setAttribute('aria-busy', String(searching));
    $('#hint').setAttribute('aria-label', searching ? 'Ищу подсказку' : replayHint ? 'Повторить подсказку бесплатно' : 'Подсказка');
    $('#hint-count').textContent = String(save.profile.hints); $('#undo-count').textContent = String(save.profile.undos);
    $<HTMLButtonElement>('#hint').disabled = recoveryClockBlocked() || board.phase !== 'playing' || Boolean(workerDeadline) || saving || Boolean(instruction?.accepts && instruction.attention !== 'hint' && !replayHint);
    $<HTMLButtonElement>('#undo').disabled = recoveryClockBlocked() || board.phase === 'won' || !save.attempt.undo.length || saving || Boolean(instruction?.accepts && instruction.attention !== 'undo');
    const combo = save.attempt.combo;
    const bank = $('#streak-bank');
    bank.hidden = !E4_M1 || combo?.policy !== 'azur-combo-deferred-r2' || !combo.pending;
    if (!bank.hidden) bank.textContent = '+' + combo!.pending + ' к победе';
    const tier = E4_M1 && !combo ? { count: 0, coins: 0 } : combo ? COMBO_STAGES[combo.stage] ?? { count: 0, coins: 0 } : STREAK[save.attempt.streak.tier];
    const progress = combo?.progress ?? save.attempt.streak.progress;
    const streak = $('#streak');
    if (streak.children.length !== tier.count) streak.replaceChildren(...Array.from({ length: tier.count }, () => document.createElement('i')));
    [...streak.children].forEach((cell, index) => {
      const filled = index < progress;
      if (filled && !cell.classList.contains('filled') && !reducedMotion()) cell.animate([{ transform: 'scale(.8)' }, { transform: 'translateY(-2px) scale(1.2)', offset: .55 }, { transform: 'translateY(-1px) scale(1)' }], { duration: 240 });
      cell.classList.toggle('filled', filled);
    });
    $('#streak').setAttribute('aria-label', tier.count ? `${progress} из ${tier.count}` : 'Серия завершена');
    $('#streak-reward').firstChild!.textContent = !tier.count || (save.attempt.daily && !dailyRewardEligible(save, localDay())) ? '— ' : `+${tier.coins} `;
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
    $('#joker-next-attempt').hidden = !save.attempt.jokerUsed || !jokerUnlocked || Boolean(helperFocus && helperFocus !== 'joker');

    $('#hint-stock').textContent = String(save.profile.hints); $('#undo-stock').textContent = String(save.profile.undos);
    for (const helper of ['hint', 'undo'] as const) {
      $(`#buy-${helper}`).textContent = '+1 за ' + BALANCE.helperPrices[helper] + ' монет';
      $<HTMLButtonElement>(`#buy-${helper}`).disabled = serviceBusy || saving ||
        (!hasContextOffers && save.profile.coins < BALANCE.helperPrices[helper]);
      $<HTMLButtonElement>(`#video-${helper}`).disabled = serviceBusy || !ads.status.rewarded;
      $(`#video-${helper}`).hidden = !ads.status.rewarded;
    }
    const credits = casual ? Number(hasVideoContinueCredit(save)) : (save.platform?.continueCredits ?? 0);
    const exhausted = board.phase === 'exhausted' && board.movesLeft === 0 && !save.attempt.continued && !save.attempt.lostLife;
    const requiresProof = requiresContinueProof(save.attempt);
    continueCheck.update(save.attempt, deal, ready && screen === 'game' && exhausted && requiresProof);
    const proofStatus = continueCheck.status;
    const canContinue = exhausted && (credits > 0 || ads.status.rewarded) && (casual || !requiresProof || proofStatus === 'PROVEN_RECOVERABLE');
    const videoFailed = continueVideoFailed === save.attempt.id;
    const retryVideo = canContinue && !credits && videoFailed;
    const showCoinOffer = exhausted && requiresProof && proofStatus === 'PROVEN_RECOVERABLE' && credits === 0;
    const canBuyContinue = showCoinOffer && save.profile.coins >= BALANCE.continueCoinPrice;
    const continueBusy = saving || serviceBusy || store.needsRecovery;
    const coinButton = $<HTMLButtonElement>('#result-continue-coins');
    const recoveryLabel = recoveryEnabled() && deal.recovery ? 'Возродить партию' : 'Продолжить';
    coinButton.hidden = !showCoinOffer;
    coinButton.disabled = !canBuyContinue || continueBusy;
    coinButton.textContent = `+${BALANCE.continueMoves} ходов за ${BALANCE.continueCoinPrice} монет`;
    if (recoveryEnabled() && deal.recovery && !coinButton.hidden) coinButton.textContent = `${recoveryLabel} · +${BALANCE.continueMoves} ходов за ${BALANCE.continueCoinPrice}`;
    const continueButton = $<HTMLButtonElement>('#result-continue');
    continueButton.hidden = !canContinue;
    continueButton.disabled = !canContinue || continueBusy;
    continueButton.className = canBuyContinue || retryVideo || store.needsRecovery ? 'secondary' : 'primary';
    continueButton.textContent = credits > 0 ? '+10 ходов · использовать запас' : retryVideo ? 'Повторить запрос видео' : '+10 ходов · видео';
    $('#result').dataset.continueStatus = proofStatus ?? '';
    if (casual) coinButton.className = canBuyContinue ? 'primary' : 'secondary';
    const continueNote = $('#result-continue-note');
    continueNote.hidden = casual ? !videoFailed : !proofStatus;
    continueNote.textContent = casual ? videoFailed ? 'Видео сейчас недоступно.' : '' : proofStatus === 'CHECKING' ? 'Проверяем, хватит ли ещё 10 ходов.'
      : proofStatus === 'UNSOLVABLE' ? 'Из этой позиции за 10 ходов не выиграть.'
      : proofStatus === 'UNKNOWN' ? 'Путь к победе за 10 ходов не подтверждён.'
      : proofStatus === 'PROVEN_RECOVERABLE' ? videoFailed && !credits
        ? 'Видео сейчас недоступно.' : showCoinOffer && !canBuyContinue
          ? 'На +10 ходов не хватает монет.' : casual ? '' : 'Из этой позиции можно выиграть за 10 ходов или меньше.'
      : '';
    const undoRecovery = board.phase === 'exhausted' && !save.attempt.lostLife && save.attempt.undo.length > 0 && (save.profile.undos > 0 || save.profile.coins >= BALANCE.helperPrices.undo || ads.status.rewarded);
    const resultRetry = $<HTMLButtonElement>('#result-save-retry');
    resultRetry.hidden = !store.needsRecovery;
    resultRetry.disabled = saving || serviceBusy;
    const alternate = campaignRedeal(save.attempt);
    const adaptive = casual ? quoteLayoutRetry(save) : quoteAdaptiveRetry(save), adaptiveButton = $<HTMLButtonElement>('#result-new-attempt');
    adaptiveButton.hidden = casual || !adaptive;
    adaptiveButton.disabled = saving || serviceBusy || store.needsRecovery;
    if (adaptive) $('#result-new-attempt small').textContent = (adaptive.changesLayout ? 'Новый расклад' : 'Больше ходов') + ' · лимит ' + adaptive.selected.initial.movesLeft;
    const lifeNote = $('#result-life-note');
    lifeNote.hidden = !LIVES_PREVIEW || Boolean(save.attempt.daily) || board.phase !== 'exhausted';
    lifeNote.textContent = save.attempt.lostLife ? 'Жизнь за это поражение уже учтена.' : 'При повторе или новой попытке спишется одна жизнь за это поражение.';
    const redeal = $<HTMLButtonElement>('#result-redeal');
    redeal.hidden = casual ? !qaLevelPicker : !alternate;
    if (casual && redeal.textContent !== 'Тот же расклад') redeal.textContent = 'Тот же расклад';
    redeal.disabled = saving || serviceBusy || store.needsRecovery;
    if (casual) {
      $('#replay').textContent = 'Заново';
      $('#replay').setAttribute('aria-description', adaptive ? 'Новая раздача этого уровня' :
        save.attempt.daily ? 'Раздача этого дня' : 'Повтор текущей раздачи');
    } else if (alternate) {
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
    if (rewardOffersEnabled) renderRewardOffers();
    if (PICTURE_PREVIEW || save.picture) renderPicture();
    if (TASKS_PREVIEW) renderTasks();
    if (dailyBonusEnabled) renderDailyBonus();
    if (productOfferEnabled) renderProductContext();
  }
  function showCountdown(element: HTMLElement, at: number | undefined, label: string) {
    if (at === undefined) {
      delete element.dataset.countdownAt; delete element.dataset.countdownLabel;
      if (element.getAttribute('role') === 'timer') element.removeAttribute('role');
      element.textContent = label; return;
    }
    element.dataset.countdownAt = String(at); element.dataset.countdownLabel = label;
    renderCountdown(element, Date.now());
  }
  function renderCountdown(element: HTMLElement, now: number) {
    const seconds = Math.max(0, Math.ceil((Number(element.dataset.countdownAt) - now) / 1000));
    const digits = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map(n => String(n).padStart(2, '0')).join(':');
    const value = seconds >= 86400 ? `${Math.floor(seconds / 86400)} д. ${Math.floor(seconds / 3600) % 24} ч.` : digits;
    const label = element.dataset.countdownLabel ?? '';
    let time = element.querySelector('time');
    if (!time || element.firstChild?.textContent !== label + ' ') {
      time = document.createElement('time');
      element.replaceChildren(document.createTextNode(label + ' '), time);
      element.setAttribute('role', 'timer');
    }
    if (time.textContent !== value) time.textContent = value;
  }
  function resetText(at: number | undefined) {
    if (at === undefined) return '';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(at);
  }
  function bonusStatusText() {
    const state = dailyBonusState(save, Date.now());
    if (state.phase === 'ready') return 'Забрать приз';
    if (state.phase === 'playing') return 'Продолжить · открыто ' + state.revealedCount + '/12';
    if (state.phase === 'claimed') return casual ? 'Получено' : 'Получено · следующий ' + resetText(state.nextResetAt);
    if (state.phase === 'future') return casual ? 'Бонус пока закрыт' : 'Доступно ' + resetText(state.availableAt);
    if (state.phase === 'locked') return 'Откроется на уровне 2';
    if (state.phase === 'unavailable') return 'Проверьте дату устройства';
    return 'Доступен';
  }
  function renderHelperInventory() {
    const visible = unlockedLevel(save) >= 2;
    $('#helper-inventory').hidden = !visible || Boolean(helperFocus || helperResource);
    if (!visible) return;
    const playing = save.attempt.board.phase === 'playing';
    const rows = [
      { icon: 'hint', name: 'Подсказки', count: save.profile.hints, source: 'Награды и монеты', usable: playing && helperUnlocked(save, 'hint', deal),
        condition: helperUnlocked(save, 'hint', deal) ? 'Показывают ход на поле' : `С уровня ${HELPER_UNLOCK.hint}` },
      { icon: 'undo', name: 'Отмены', count: save.profile.undos, source: 'Награды и монеты', usable: playing && helperUnlocked(save, 'undo', deal) && Boolean(save.attempt.undo.length),
        condition: !helperUnlocked(save, 'undo', deal) ? `С уровня ${HELPER_UNLOCK.undo}` : 'После первого хода' },
      { icon: 'joker', name: 'Ручные Джокеры', count: save.profile.jokers, source: 'Награды и монеты', usable: playing && helperUnlocked(save, 'joker', deal) && !save.attempt.jokerUsed,
        condition: helperUnlocked(save, 'joker', deal) ? 'Один на раздачу' : `С уровня ${HELPER_UNLOCK.joker}` },
      { icon: 'book', name: 'Объяснения', count: definitionCount(save), source: 'Бонус дня и задания', usable: playing,
        condition: 'В просмотре слова через Aa' },
      { icon: 'cycle', name: 'Перемешивания', count: save.dailyTasks?.inventory.shuffles ?? 0, source: 'Награды', usable: playing && canShuffle(save, deal),
        condition: CAMPAIGN_CORE_STAGE1 ? 'Когда на доске можно перемешать скрытые карты' : 'Уровни ' + SHUFFLE_LEVELS.join(', ') },
      { icon: 'joker', name: 'Случайные Джокеры', count: randomJokerCount(save), source: 'Монеты за отдельный заряд', usable: playing && canRequestRandomJoker(),
        condition: CAMPAIGN_CORE_STAGE1 ? 'Один на подходящую раздачу кампании' : 'На уровне 16, один на раздачу' },
    ] as const;
    function renderRows(group: string, list: string, usable: boolean) {
      const entries = rows.filter(row => (row.usable && row.count > 0) === usable);
      $(group).hidden = !entries.length;
      $(list).replaceChildren(...entries.map(({ icon, name, count, source, condition }) => {
        const row = document.createElement('div'), title = document.createElement('dt');
        const detail = document.createElement('dd'), quantity = document.createElement('span');
        title.textContent = name; quantity.textContent = String(count); title.append(quantity);
        if (casual) {
          const label = document.createElement('b');
          label.textContent = name;
          title.replaceChildren(casualIcon(icon), quantity, label);
          detail.textContent = condition;
        } else detail.textContent = condition + ' · ' + source;
        row.append(title, detail); return row;
      }));
    }
    renderRows('#helper-inventory-now', '#helper-inventory-list', true);
    renderRows('#helper-inventory-future', '#helper-inventory-later', false);
    const count = save.dailyTasks?.inventory.shuffles ?? 0, shuffleNote = $('#shuffle-stock-note');
    shuffleNote.hidden = !count && (CAMPAIGN_CORE_STAGE1 ? !dailyTasksAvailable(save) : unlockedLevel(save) < SHUFFLE_LEVELS[0]);
    shuffleNote.textContent = CAMPAIGN_CORE_STAGE1
      ? count ? `В запасе ${count}. ${canShuffle(save, deal) ? 'Перемешать можно на этой доске.' : 'Заряды сохранены для подходящего поля.'}`
        : hasFutureShuffleUse(save) ? 'Заряд может выпасть в бонусе дня.' : ''
      : count ? 'В запасе ' + count + ' перемешиваний. ' +
      (canShuffle(save, deal) ? 'Кнопка «Перемешать» доступна на доске.' : hasFutureShuffleUse(save)
        ? 'Применяются на уровнях ' + SHUFFLE_LEVELS.join(', ') + '.' : 'Можно использовать при повторной игре на уровнях ' + SHUFFLE_LEVELS.join(', ') + '.')
      : 'Перемешивания закончились. ' + (hasFutureShuffleUse(save) ? 'Новый заряд может выпасть в бонусе дня.' : 'Поддерживаемые уровни уже пройдены.');
  }
  function renderProductContext() {
    const pending = save.productOffers?.reservation;
    const context = pending?.attemptId === save.attempt.id ? pending : undefined;
    const helpersText = $('#product-offer-helpers'), resultText = $('#product-offer-result');
    const forHelpers = !save.attempt.daily && Boolean(helperResource || context && context.surface !== 'result');
    const resource = helperResource ?? context?.resource;
    const forResult = Boolean(context?.surface === 'result' && save.attempt.board.phase !== 'playing');
    helpersText.hidden = !forHelpers;
    resultText.hidden = !forResult;
    const bonus = dailyBonusState(save, Date.now());
    $('#context-bonus-open').hidden = !forHelpers || !dailyBonusEnabled || !bonus.canOpen;
    $('#context-bonus-open').textContent = bonus.phase === 'ready' ? 'Забрать приз бонуса дня' : bonus.phase === 'playing' ? 'Продолжить бонус дня' : 'Открыть бонус дня';
    if (forHelpers) {
      const now = Date.now();
      const bonusCopy = bonus.phase === 'ready' ? 'Сохранённый приз можно забрать в бонусе дня.'
        : bonus.phase === 'claimed' ? 'Бонус дня получен. Следующий — ' + resetText(bonus.nextResetAt) + '.'
        : bonus.phase === 'future' ? 'Бонус будет доступен ' + resetText(bonus.availableAt) + '.'
        : bonus.phase === 'playing' ? 'Можно продолжить бонус дня. Приз случайный.' : 'Приз бонуса дня случайный.';
      helpersText.textContent = resource === 'definition'
        ? 'Объяснения могут выпасть в бонусе дня; нужный приз не гарантирован. ' + bonusCopy
        : canClaimShopCoins(save, deal, now) ? 'Доступны бесплатные монеты.'
          : approvedOffers() && ads.status.rewarded && offerQuote(save, deal, 'shop-free-coins', now, integratedOffers)
            ? 'Можно пополнить монеты за видео.' : context?.eventId.startsWith('short-')
              ? 'Не хватает монет. ' + bonusCopy : 'Помощников можно пополнить за монеты или из наград. ' + bonusCopy;
    }
    if (forResult) {
      resultText.textContent = save.attempt.board.phase === 'won'
        ? (casual ? '' : 'Награду можно забрать без видео.') : (casual ? '' : 'Попробуйте отмену, доступное продолжение или начните заново.');
    }
  }
  function recordedVictoryReward() {
    const victory = save.attempt.victory;
    if (victory?.policy === M1_ID) return { base: victory.tierBase, bonus: victory.movesBonus,
      total: victory.tierBase + victory.movesBonus, difficulty: victory.tier };
    if (!victoryPolicy || save.attempt.daily || deal.campaignLevel === undefined || save.attempt.board.phase !== 'won') return;
    const difficulty = victoryDifficulty(deal);
    const grant = save.attempt.payout?.find(reward => reward.key === `win:${save.attempt.id}` && reward.reason === 'win');
    if (!grant) return;
    const quote = quoteVictoryReward(victoryPolicy, difficulty, save.attempt.board.movesLeft);
    if (quote.total === grant.coins) return { ...quote, difficulty };
  }
  function outcome(collectionDeadline = Infinity) {
    if (save.attempt.board.phase === 'playing') return;
    // The final count gets its reading beat. A delayed frame may skip the
    // decorative tail, but it must never cancel a streak flight before contact.
    const holdingCategory = !reducedMotion() && scene?.holdingCollection && performance.now() < collectionDeadline;
    if (save.attempt.board.phase === 'won' && (holdingCategory || wallet?.settling || !reducedMotion() && performance.now() < victoryBeatUntil)) {
      outcomeTimer = setTimeout(() => outcome(collectionDeadline), 32); return;
    }
    if (save.attempt.board.phase === 'won' && freshFeelWin === save.attempt.id && !reducedMotion() &&
        demonstratedWin !== save.attempt.id && !runtime.activity.isBlocked()) {
      celebrateBoard(lastWinningAction);
      if (performance.now() < victoryBeatUntil) {
        outcomeTimer = setTimeout(() => outcome(collectionDeadline), 32);
        return;
      }
    }
    if (casual && !releaseAdCadence.interstitial.levelStart && freshEndAttempt === save.attempt.id &&
        screen === 'game' && !runtime.activity.isBlocked()) {
      freshEndAttempt = undefined;
      const attempt = save.attempt.id;
      void showTransitionAd(deal.campaignLevel, 'level-end').then(() => {
        if (alive && screen === 'game' && attempt === save.attempt.id) outcome(collectionDeadline);
      });
      return;
    }
    // A local result coin layer must join the dialog's top layer to stay visible.
    $('#result').dataset.won = String(save.attempt.board.phase === 'won');
    const won = save.attempt.board.phase === 'won';
    if (!store.needsRecovery) $('#result-continue-error').hidden = true;
    outcomeViewed = true;
    $('#result-title').textContent = won ? 'Всё сошлось!' : 'Ходы закончились';
    const daily = Boolean(save.attempt.daily), payout = save.attempt.payout;
    const freshResult = freshFeelWin === save.attempt.id;
    $('#result').dataset.rewardPhase = casual && !E4_M1 && won && freshResult ? 'claim' : 'claimed';
    $('#result-copy').textContent = won ? daily ? payout?.length ? 'Ежедневный уровень пройден. Награда уже на вашем счёте.' : 'Тренировка завершена. Награда за эту дату уже получена или её день закончился.' : (deal.campaignLevel === CAMPAIGN_LENGTH ? `Все ${CAMPAIGN_LENGTH} уровней пройдены. Любую раздачу можно сыграть ещё раз.` : '') : '';
    if (casual && won) {
      $('#result-copy').textContent = daily ? payout?.length ? 'Ежедневная раздача пройдена' : 'Тренировка завершена'
        : deal.campaignLevel === CAMPAIGN_LENGTH ? 'Последняя раздача пройдена' : '';
      const emblem = $('.result-star img') as HTMLImageElement;
      emblem.src = 'art/ui/reward-emblem.webp';
    } else if (casual) ($('.result-star img') as HTMLImageElement).src = 'art/ui/heart.webp';
    const goldenReward = won && payout?.find(reward => reward.reason === 'golden_cards');
    if (goldenReward) $('#result-copy').textContent = `За золотые карты начислено ${goldenReward.coins} монет.`;
    const cycleReward = payout?.find(r => r.reason === 'campaign_win_cycle');
    $('#result-bonus').hidden = !won || !cycleReward;
    $('#result-bonus-copy').textContent = cycleReward ? `Получено: +${cycleReward.coins} монет${cycleReward.hints ? ` и +${cycleReward.hints} подсказка` : ''}` : '';
    const cycle = save.meta!.winCycle, progress = $('#result-meta'), staged = !daily && !cycleReward && stagedStreak(save);
    progress.hidden = !won || !daily && (completedLevels(save) >= CAMPAIGN_LENGTH || !cycleReward && (!deal.campaignLevel || cycle === 0));
    progress.textContent = daily ? `Серия дней · ${currentDailyStreak(save, localDay())}`
      : cycleReward ? 'Новый цикл · 0 / 5' : `Пять побед · ${cycle} / 5`;
    let pulseTarget = cycleReward ? $('#result-bonus') : progress;
    if (casual && won && cycleReward) {
      progress.hidden = false;
      $('#result-bonus').querySelector('strong')!.textContent = 'Подарок за 5 побед';
      $('#result-bonus-copy').replaceChildren(prizeToken({ kind: 'Coins', quantity: cycleReward.coins }));
      if (cycleReward.hints) $('#result-bonus-copy').append(prizeToken({ kind: 'MoveHint', quantity: cycleReward.hints }));
    }
    if (won && staged && deal.campaignLevel && save.meta?.winStreak) {
      const streak = streakStatus(save);
      progress.hidden = false;
      progress.textContent = streak.ready ? `Серия побед · наград готово ${streak.ready}` : `Серия побед · ${streak.progress}/${streak.goal}`;
      progress.setAttribute('aria-label', progress.textContent);
    } else if (casual && !progress.hidden && !daily) {
      const count = cycleReward ? 5 : cycle;
      const stamps = winStamps(count);
      progress.replaceChildren(stamps, Object.assign(document.createElement('span'), { textContent: count + '/5' }));
      progress.setAttribute('aria-label', 'Пять побед: ' + count + ' из 5');
      pulseTarget = cycleReward ? $('#result-bonus') : stamps;
      if (freshResult && count > 0) stamps.children.item(count - 1)?.classList.add('new');
    } else if (!progress.hidden && !daily && !cycleReward) {
      const pips = document.createElement('span');
      pips.className = 'result-cycle-pips';
      pips.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 5; i++) {
        const pip = document.createElement('i');
        pip.classList.toggle('lit', i < cycle);
        pips.append(pip);
      }
      pulseTarget = pips.children.item(cycle - 1) as HTMLElement;
      progress.append(pips);
    }
    $('#replay').hidden = casual && won;
    $('#replay').textContent = daily && won ? 'Сыграть как тренировку' : daily ? 'Ещё раз' : 'Тот же расклад';
    const earned = (payout ? payout.reduce((sum, r) => sum + r.coins, 0) : !daily ? BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (save.attempt.board.movesLeft ?? 0) : 0);
    const displayedEarned = casual ? Math.max(0, earned - (cycleReward?.coins ?? 0)) : earned;
    $('#result-total').textContent = `+${displayedEarned}`; $('#result-earnings').hidden = !won || earned === 0;
    const sourceReward = recordedVictoryReward();
    $('#result-source-breakdown').hidden = !sourceReward;
    if (sourceReward) {
      $('#result-source-base').textContent = `+${sourceReward.base}`;
      $('#result-source-moves').textContent = `+${sourceReward.bonus}`;
      const extras = earned - sourceReward.total;
      $('#result-source-extras').hidden = extras <= 0;
      $('#result-source-extra-amount').textContent = `+${extras}`;
    }
    unlockChoice = payout?.some(r => r.key === 'milestone:20') ? 'cardBack' : payout?.some(r => r.key === 'milestone:10') ? 'palette' : undefined;
    $('#unlock-reward').hidden = !won || !unlockChoice;
    $('#unlock-title').textContent = unlockChoice === 'palette' ? 'Открыт стол «Чернила»' : 'Открыта рубашка «Ромбы»';
    $('#unlock-preview').dataset.palette = unlockChoice === 'palette' ? 'ink' : save.settings.palette ?? 'green';
    $('#unlock-preview').dataset.back = unlockChoice === 'cardBack' ? 'diamonds' : save.settings.cardBack ?? 'classic';
    renderHud();
    $('#result-undo').hidden = won || Boolean(save.attempt.lostLife) || !save.attempt.undo.length;
    $('#result-undo').textContent = save.profile.undos ? 'Отменить последний ход' : 'Получить отмену';
    finishRewardClaim();
    nextLevelButton.hidden = !won;
    const next = nextCampaignDeal();
    const nextDifficulty = setDifficulty(nextLevelButton, next);
    const nextLabel = casual ? (daily || !next ? 'На главную' : 'Дальше') : daily ? 'На главную' : !next ? 'К уровням' :
      `${nextDifficulty ? nextDifficulty + ' уровень' : 'Уровень'} ${next.campaignLevel} →`;
    setNextLevelText(nextLabel);
    $('#result-home').hidden = casual && won || daily || deal.campaignLevel === CAMPAIGN_LENGTH;
    openDialog('#result', true); pinWallet();
    const unlock = $('#result-unlock-track');
    unlock.hidden = true;
    if (casual && won && !daily) {
      const opened = freshResult && unlockVictory?.attempt === save.attempt.id ? unlockVictory : undefined;
      renderUnlockTrack(unlock, opened?.features.length ? opened.features : undefined, Boolean(opened?.features.length));
      if (opened && !reducedMotion()) {
        const fill = unlock.querySelector<HTMLElement>('.casual-track i');
        if (fill && opened.previous.goal > 0)
          animateActionFeedback(fill, 'feature-track', [{ width: opened.previous.progress / opened.previous.goal * 100 + '%' }, { width: fill.style.width }], 500);
        if (opened.features.length) animateActionFeedback(unlock, 'feature-open',
          [{ opacity: .65, transform: 'scale(.95)' }, { opacity: 1, transform: 'scale(1)' }], 340);
      }
    }
    if (pendingRewardProgress === save.attempt.id) {
      pendingRewardProgress = undefined;
      if (won && (cycleReward || !progress.hidden)) animateRewardProgress(pulseTarget);
    }
    if (casual && won && freshResult && !reducedMotion()) animateActionFeedback($('.result-star'), 'victory-emblem',
      [{ transform: 'translateY(12px) scale(.66)', opacity: .3 }, { transform: 'translateY(-5px) scale(1.09)', opacity: 1, offset: .64 }, { transform: 'none', opacity: 1 }], 410);
    if (won && (!casual || freshResult)) wallet?.reveal($('#result-total'), displayedEarned);
    if (freshFeelWin === save.attempt.id) {
      freshFeelWin = undefined;
      if (!E4_M1 && won && (casual ? earned > 0 : wallet?.pending && !reducedMotion())) {
        rewardClaim = { attemptId: save.attempt.id, nextLabel, flying: false };
        setNextLevelText('Забрать');
        return;
      }
    }
    if (casual && won) { $('#result').dataset.rewardPhase = 'claimed'; renderRewardOffers(); }
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
    if (!alive || saving || screen !== 'game' || (runtime.activity.isBlocked() && !(cmd.type === 'restart' && runtime.activity.getBlockReasons().every(reason => reason === 'recovery-time')))) return false;
    cancelPause('new-command');
    if (!allowsLesson(cmd)) {
      scene?.cancel();
      showGuidance();
      return false;
    }
    const before = save.attempt.board, metaBefore = save.meta, saveBefore = save;
    const ordinary = cmd.type === 'transfer' || cmd.type === 'draw' || cmd.type === 'recycle';
    const wasTeaching = casual && activelyTeaching(save, deal, currentLesson());
    const protectedAction = casual && teachingProtected(save, deal, wasTeaching);
    const firstSlot = casual && ordinary ? firstBonusOffer(save, deal) : undefined;
    const progressBefore = save.attempt.combo?.progress ?? save.attempt.streak.progress, movesBefore = before.movesLeft;
    const helper = cmd.type === 'hint' ? 'hints' : cmd.type === 'undo' ? 'undos' : undefined;
    const helperBefore = helper ? save.profile[helper] : 0;
    let result: Result | undefined;
    let started = false, finished = false, coveredWaste = false, blockedLives = false;
    try {
      presentingCommand = true;
      await write((next, monthlyGrants, now) => {
        expireRecovery(next);
        if (LIVES_PREVIEW && !next.attempt.daily && deal.campaignLevel &&
            (cmd.type === 'restart' ? !mayStartCampaignAttempt(next, next.attempt, Date.now()) : Boolean(next.attempt.lostLife && next.attempt.board.phase === 'exhausted'))) {
          blockedLives = true; return;
        }
        const beforeBoard = next.attempt.board;
        result = dispatch(next, cmd, deal, localDay(), victoryPolicy);
        if ((STOREFRONT_PREVIEW || freeSeasonalTrack) && result.accepted && !result.next.attempt.daily &&
            (result.next.platform?.completedCampaign.length ?? 0) > (next.platform?.completedCampaign.length ?? 0)) {
          if (freeSeasonalTrack && !STOREFRONT_PREVIEW) monthlyGrants.push(...recordFreeCampaignClear(result.next, now).grants);
          else recordStoreClear(result.next, now);
        }
        if (LIVEOPS_PREVIEW && result.accepted) recordLiveOpsWin(next, result.next, deal, Date.now());
        if (deal.hitapps?.gold && result.accepted) recordSourceGoldRush(next, result.next, deal, now);
        if (PICTURE_PREVIEW && result.accepted && result.next.attempt.board.phase === 'won') {
          recordPictureWin(next, result.next, deal, Date.now());
        }
        if (result.accepted && (TASKS_PREVIEW || result.next.dailyTasks)) {
          syncRetention(result.next, now);
          if (result.next.dailyTasks) {
            if (TASKS_PREVIEW && dailyTasksAvailable(result.next)) updatePreviewTasks(result.next, now);
            for (const signal of acceptedTaskSignals(next, result, cmd, deal)) recordTaskSignal(result.next, now, signal);
          }
        }
        Object.assign(next, result.next);
        if (result.accepted) {
          if (releaseProfile) recordReleaseLearning(next, beforeBoard, cmd, deal, result.events);
          if (cmd.type === 'transfer' || cmd.type === 'draw' || cmd.type === 'recycle') {
            recordLearning(next, beforeBoard, cmd, deal, result.events);
            if (firstSlot) markTutorial(next, 'intro:bonus-' + firstSlot);
            if (!seenTutorial(next, 'learn:covered-waste') && coversPlayableWaste(beforeBoard, cmd, deal)) {
              coveredWaste = true;
              markTutorial(next, 'learn:covered-waste');
            }
          }
          if (casual && cmd.type !== 'restart') recordTeachingAction(next, deal, wasTeaching, ordinary);
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
      if (started) {
        telemetry.track('level_start');
        if (save.attempt.daily) telemetry.track('daily_start', { dayId: save.attempt.daily.dayId });
        offerFact({ trigger: OfferTrigger.LevelStarted, key: 'start' });
      }
      if (finished && deal.campaignLevel !== undefined && save.attempt.board.phase === 'won') {
        if (casual && completedLevels(save) > completedLevels(saveBefore))
          unlockVictory = { attempt: save.attempt.id, features: unlockedBetween(saveBefore, save), previous: unlockTrack(saveBefore) };
        offerFact({ trigger: OfferTrigger.LevelCompleted, completedLevel: deal.campaignLevel, key: 'win' });
      } else if (finished && save.attempt.board.phase === 'exhausted') {
        offerFact({ trigger: OfferTrigger.LevelFailed, key: 'failure' });
      } else if (productOfferEnabled && (cmd.type === 'transfer' || cmd.type === 'draw' || cmd.type === 'recycle') &&
          !save.offerCampaigns?.accounts.some(account => account.accountId === 'local-c8-profile' &&
            account.events.some(item => item.id === `no-valid-moves:${save.attempt.id}`))) {
        const fact = noUsefulMoveFact(save, deal, board => E4_M1 ? progressAt(board) !== 'stuck' : hasTransfer.get(board) ?? canReachTransfer(board, deal));
        if (fact) offerFact(fact);
      }
      if (cmd.type === 'undo' && result.events[0]?.amount)
        message(`Возврат за колоду · +${result.events[0].amount} монет`);
      if (cmd.type === 'restart') { telemetry.track('level_restart'); announceDeal(); }
      if (cmd.type === 'hint' || cmd.type === 'undo' || cmd.type === 'place-joker') telemetry.track('helper_used', { helper: cmd.type === 'place-joker' ? 'joker' : cmd.type });
      if (finished) telemetry.track(save.attempt.board.phase === 'won' ? 'level_win' : 'level_fail');
      for (const event of result.events) if ((event.type === 'coins' || event.type === 'meta-reward' || event.type === 'win' && !save.attempt.daily) && event.amount) telemetry.track('reward_granted', { reason: event.type === 'coins' ? 'core_streak' : event.type === 'meta-reward' ? event.reason! : 'level_win', amount: event.amount });
      if (save.attempt.daily && result.events.some(e => e.type === 'meta-reward' && e.reason === 'daily_completion')) telemetry.track('daily_completion', { dayId: save.attempt.daily.dayId });
      const sourceReward = recordedVictoryReward();
      if (victoryPolicy && sourceReward && result.events.some(event => event.type === 'win')) {
        telemetry.track('azur_victory_qa', {
          policy: victoryPolicy.id, sourceBuild: victoryPolicy.sourceBuild, provenance: victoryPolicy.provenance,
          difficulty: sourceReward.difficulty, base: sourceReward.base, bonus: sourceReward.bonus, amount: sourceReward.total,
        });
      }
      if (cmd.type !== 'hint') activeHint = undefined;
      scene?.clearHint();
      const boardCommand = ['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined;
      const major = result.events.find(e => e.type === 'win') ?? result.events.find(e => e.type === 'unlock') ?? result.events.find(e => e.type === 'complete') ?? result.events.find(e => e.type === 'key') ?? result.events.find(e => e.type === 'coins') ?? result.events[0];
      const coreCoins = result.events.filter(e => e.type === 'coins').reduce((n,e) => n + (e.amount ?? 0), 0);
      const freshWin = before.phase === 'playing' && save.attempt.board.phase === 'won' &&
        (casual || azurInteractionFeedback && !reducedMotion() && !save.attempt.daily && deal.campaignLevel !== undefined);
      if (freshWin) { freshFeelWin = save.attempt.id; lastWinningAction = boardCommand; }
      const movesBonus = freshWin && !casual
        ? sourceReward?.bonus ?? BALANCE.coinsPerRemainingMove * (save.attempt.board.movesLeft ?? 0)
        : 0;
      const hasCoinFlight = coreCoins > 0 || movesBonus > 0;
      const lost = save.attempt.board.phase === 'exhausted';
      // The save/grant is already durable. Only optional sound/haptics/coins
      // follow the visible contact and may be dropped when superseded.
      const present = () => {
        if (freshWin) celebrateBoard(boardCommand);
        if (lost) { runtime.play('loss'); runtime.pulse('loss'); }
        else if (major) {
          runtime.play(major.type === 'coins' ? 'transfer' : major.type);
          if (major.type === 'key' || major.type === 'unlock' || major.type === 'joker') runtime.pulse(major.type === 'key' ? 'coins' : major.type === 'unlock' ? 'complete' : 'hint');
          if (azurInteractionFeedback && major.type === 'draw') runtime.pulse('draw');
          if (['transfer', 'complete', 'coins', 'win', 'undo', 'hint'].includes(major.type)) runtime.pulse(major.type === 'coins' ? 'transfer' : major.type as 'transfer' | 'complete' | 'win' | 'undo' | 'hint');
        }
        if (coreCoins) coinBurst($('#streak-reward'), coreCoins);
        if (movesBonus) coinBurst($('#moves'), movesBonus);
      };
      scene?.sync(result.events, cmd.type === 'restart', boardCommand, cmd.type === 'transfer' && major ? { kind: major.type, before, play: present } : undefined);
      if (cmd.type !== 'transfer') present();
      const trigger = releaseAdCadence.coffee;
      const category = result.events.some(event => event.type === 'complete');
      const pauseTrigger = boardCommand && !(boardCommand.type === 'transfer' && boardCommand.scissors) && (category && trigger.triggerCategory ? 'category' :
        boardCommand.type === 'recycle' ? trigger.triggerRecycle && 'recycle' : trigger.triggerMove && boardCommand.type);
      const paused = casual && pauseTrigger ? offerPause(pauseTrigger, protectedAction) : false;
      if (casual && !paused && category && !save.attempt.daily && save.attempt.board.phase === 'playing' &&
          !protectedAction && releaseAdCadence.interstitial.theme && pauseFieldSettled())
        void showTransitionAd(deal.campaignLevel, 'theme');
      if (!casual && boardCommand && campaignAdsApproved() && (deal.campaignLevel ?? 0) >= 16) {
        if (adBreakAttempt !== save.attempt.id) { lastAdBreakReason = ''; adBreakRetryAt = 0; }
        adBreakAttempt = save.attempt.id;
        adBreakHold = performance.now() + AD_BREAK_IDLE_MS;
        scheduleAdBreak(AD_BREAK_IDLE_MS);
      }
      if (coveredWaste)
        message('Подходящая карта теперь под верхней картой сброса. Её можно вернуть на новом круге.');
      if (before.phase === 'playing' && save.attempt.board.phase === 'won' &&
          (save.meta!.winCycle !== metaBefore?.winCycle || save.meta!.cycles !== metaBefore?.cycles ||
           save.meta!.dailyStreak !== metaBefore?.dailyStreak)) pendingRewardProgress = save.attempt.id;
      if (save.attempt.board.phase !== 'playing') {
        if (before.phase === 'playing') freshEndAttempt = save.attempt.id;
        const delay = reducedMotion() ? 100 : save.attempt.board.phase === 'won' ? 0 : 465;
        const collectionDeadline = hasCoinFlight ? Infinity : performance.now() + 720;
        clearTimeout(outcomeTimer); outcomeTimer = setTimeout(() => outcome(collectionDeadline), delay);
      }
    } else {
      scene?.cancel(); scene?.reject(['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined);
      const broken = progressBefore > 0 && (save.attempt.combo?.progress ?? save.attempt.streak.progress) === 0;
      runtime.play(broken ? 'streak-break' : 'invalid');
      runtime.pulse(azurInteractionFeedback && cmd.type === 'transfer' ? 'invalid-heavy' : broken ? 'streak-break' : 'invalid');
      if (broken) {
        for (const cell of [...$('#streak').children].slice(0, progressBefore)) {
          cell.getAnimations().forEach(animation => animation.cancel());
          const fade = { background: '#e7a999', borderColor: '#ffd0b4' };
          cell.animate(reducedMotion() ? [fade, {}] : [fade, { ...fade, transform: 'translateY(2px) scale(.83)' }, {}], { duration: 240 });
        }
      }
      telemetry.track('move_rejected', { reason: result.reason ?? 'unknown' }); message(result.reason ?? 'Сюда не подходит', true);
    }
    renderHud();
    if (result.accepted && !reducedMotion() && !runtime.activity.isBlocked()) {
      const moves = save.attempt.board.movesLeft;
      if (cmd.type === 'restart') clearActionFeedback();
      else if (moves !== null && movesBefore !== null && moves !== movesBefore) {
        animateActionFeedback($('#moves'), 'move-count', [
          { transform: `translateY(${moves < movesBefore ? 3 : -3}px)`, opacity: .74 },
          { transform: 'none', opacity: 1 },
        ], 145);
      }
      if (helper && save.profile[helper] < helperBefore) {
        animateActionFeedback($(`#${cmd.type} .helper-icon`), 'helper-spend', [
          { transform: 'none' }, { transform: 'scale(.9)', offset: .34 }, { transform: 'none' },
        ], 190);
      }
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
  function logTaskAction(next: Save, kind: TaskSignal['kind'], channel: TaskSignal['channel'], amount = 1,
    id = `game:${next.attempt.id}:${next.revision}:${kind}`) {
    const now = Date.now();
    syncRetention(next, now);
    if (!next.dailyTasks) return;
    if (TASKS_PREVIEW) updatePreviewTasks(next, now);
    recordTaskSignal(next, now, { id, kind, channel, amount });
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
  let tasksEntering = false;
  function playPrizeFlight(from: DOMRect, target: HTMLElement, image: HTMLImageElement, landed?: () => void) {
    const owner = target.closest<HTMLDialogElement>('dialog[open]');
    const to = target.getBoundingClientRect();
    const viewport = owner?.getBoundingClientRect();
    const visible = viewport && to.width && to.height &&
      to.top >= viewport.top && to.bottom <= viewport.bottom && to.top >= 0 && to.bottom <= innerHeight &&
      (from.width || from.height);
    if (!casual || !owner || !target.isConnected || !visible || reducedMotion()) { landed?.(); return; }
    image.classList.add('casual-flight');
    image.style.left = (from.x + from.width / 2 - 14) + 'px';
    image.style.top = (from.y + from.height / 2 - 14) + 'px';
    owner.append(image);
    const dx = (to.x + to.width / 2) - (from.x + from.width / 2), dy = (to.y + to.height / 2) - (from.y + from.height / 2);
    animateActionFeedback(image, 'prize-flight', [
      { transform: 'scale(.72)', opacity: .6 },
      { transform: `translate(${dx * .34}px,${dy * .25 - 18}px) scale(1.24)`, opacity: 1, offset: .38 },
      { transform: `translate(${dx}px,${dy}px) scale(.75)`, opacity: .5 },
    ], 440);
    const complete = () => { image.remove(); landed?.(); };
    void actionFeedback.get(image)?.finished.then(() => { complete(); if (owner.open) animateRewardProgress(target); }, complete);
  }
  function rewardBalances(state: Save) {
    return {
      Coins: state.profile.coins, MoveHint: state.profile.hints, Undo: state.profile.undos, Joker: state.profile.jokers,
      Definition: state.dailyTasks?.inventory.definitions ?? 0, Shuffle: state.dailyTasks?.inventory.shuffles ?? 0,
    };
  }
  function presentRewardDeltas(selector: string, from: DOMRect, before: Save) {
    if (!casual) return;
    const owner = $<HTMLDialogElement>(selector);
    if (!owner.open) return;
    const host = owner.querySelector('.sheet-heading') ?? owner;
    let counters = host.querySelector<HTMLElement>('.reward-counts');
    if (!counters) {
      counters = document.createElement('div');
      counters.className = 'reward-counts';
      counters.setAttribute('role', 'status');
      host.append(counters);
    }
    const previous = rewardBalances(before), current = rewardBalances(save);
    for (const [kind, total] of Object.entries(current)) {
      const delta = total - previous[kind as keyof typeof previous];
      if (delta <= 0) continue;
      const counter = document.createElement('span');
      counter.dataset.rewardCounter = kind;
      counter.setAttribute('aria-label', prizeLabel({ kind, quantity: total }) + ', получено ' + delta);
      const count = document.createElement('strong');
      count.textContent = total.toLocaleString('ru-RU');
      counter.append(prizeIcon(kind), count);
      const existing = counters.querySelector(`[data-reward-counter="${kind}"]`);
      if (existing) existing.replaceWith(counter); else counters.append(counter);
      if (!reducedMotion()) {
        count.textContent = (total - delta).toLocaleString('ru-RU');
        playPrizeFlight(from, counter, prizeIcon(kind), () => { count.textContent = total.toLocaleString('ru-RU'); });
      }
    }
  }
  function renderTasks() {
    const now = Date.now(), state = taskRewardState(save, now), busy = saving || serviceBusy || store.needsRecovery;
    $('#daily-tasks-open').hidden = !TASKS_PREVIEW || (releaseTasks || sourceDailyTasks) && !dailyTasksAvailable(save);
    $('#daily-tasks-open').dataset.rewardReady = String(state.readyCount > 0);
    $('#daily-tasks-home-status').textContent = state.readyCount ? 'Забрать награды · ' + state.readyCount
      : state.clock === 'future' ? 'Задания пока закрыты'
        : state.todayTotal ? 'Выполнено ' + state.todayCompleted + '/' + state.todayTotal : 'Задания дня';
    if (!$<HTMLDialogElement>('#daily-tasks-dialog').open) return;
    const taskNames: Record<string, string> = {
      DailyLogin: 'Зайти в игру', DrawCards: 'Взять карты из колоды', ExecuteMoves: 'Сделать ходы',
      CollectThemes: 'Собрать темы', CompleteLevels: 'Впервые пройти уровни', WinNoHints: 'Впервые пройти раздачу без подсказок',
      UseHints: 'Использовать подсказки', CollectDailyBonuses: 'Забрать бонус дня',
      UseDefinitions: 'Открыть объяснения', UseJokers: 'Применить Джокеры', UseRollbacks: 'Отменить ходы',
      UseShuffles: 'Перемешать колоду', EarnCoins: 'Заработать монеты', BuyExtraMoves: 'Продолжить игру',
      BuyBoosters: 'Пополнить помощников', MakePurchase: 'Покупка',
    };
    showCountdown($('#daily-tasks-day-status'), state.clock === 'future' ? state.availableAt : state.nextDayAt,
      state.clock === 'future' ? 'До открытия заданий' : 'До новых заданий');
    const firstClear = $('#daily-tasks-first-clear');
    firstClear.hidden = !state.today?.tasks.some(task => task.progress < task.target &&
      (task.kind === 'CompleteLevels' || task.kind === 'WinNoHints'));
    firstClear.textContent = firstClear.hidden ? ''
      : 'В заданиях на первое прохождение повторы не засчитываются. Условия действуют до обновления заданий.';
    const medals = $('#daily-tasks-medals'), week = state.week;
    const legacyWeek = !sourceDailyTasks && week?.catalog === 'azur-compiled-r1';
    const legacyNote = $('#daily-tasks-legacy-week');
    $('#daily-tasks-week-title').textContent = legacyWeek ? 'Неделя прежней версии' : 'Бонус недели';
    legacyNote.hidden = !legacyWeek;
    legacyNote.textContent = legacyWeek
      ? 'Здесь сохранены прежние пороги. С обычными заданиями этой недели часть наград может быть недоступна. Обычный недельный бонус начнётся ' + resetText(state.nextWeekAt) + '.'
      : '';
    const cap = Math.max(0, ...(week?.milestones.map(entry => entry.medals) ?? []));
    medals.textContent = week ? 'Медали недели · ' + (legacyWeek ? week.totalMedals : Math.min(week.totalMedals, cap) + '/' + cap)
      : 'Новая неделя — ' + resetText(state.nextWeekAt);
    if (casual && week) {
      const track = progressTrack(week.totalMedals, cap);
      if (tasksEntering) {
        const previous = taskProgressBaseline('week:' + week.startUtc + ':' + week.catalog, week.totalMedals);
        if (previous < week.totalMedals && cap > 0 && !reducedMotion()) {
          animateActionFeedback(track.firstElementChild as HTMLElement, 'weekly-progress',
            [{ width: Math.min(100, previous / cap * 100) + '%' }, { width: Math.min(100, week.totalMedals / cap * 100) + '%' }], 440);
        }
      }
      medals.setAttribute('aria-label', medals.textContent ?? '');
      const value = document.createElement('span'); value.textContent = legacyWeek ? String(week.totalMedals) : Math.min(week.totalMedals, cap) + '/' + cap;
      value.append(track);
      medals.replaceChildren(casualIcon('medal'), value, casualIcon('gift'));
    }
    $('#daily-tasks-list').replaceChildren(...(state.today?.tasks ?? []).map(task => {
      const row = document.createElement('section'), label = document.createElement('strong'), button = document.createElement('button');
      const utc = state.today!.utc, weekStart = week!.startUtc, before = week!.totalMedals;
      row.dataset.task = task.id;
      label.textContent = (taskNames[task.kind] ?? task.kind) + ' · ' + task.progress + '/' + task.target;
      button.className = 'secondary';
      button.textContent = task.claimed ? 'Получено' : 'Получить · ' + [task.prize, ...(task.bonus ? [task.bonus] : [])].map(prizeLabel).join(' + ');
      button.disabled = busy || Boolean(task.claimed) || task.progress < task.target;
      const readyPrize = !task.claimed && task.progress >= task.target;
      if (casual) {
        row.className = 'task-card'; row.dataset.ready = String(readyPrize);
        if (!task.claimed) {
          button.setAttribute('aria-label', button.textContent ?? '');
          button.replaceChildren(prizeToken(task.prize));
          if (task.bonus) button.append(prizeToken(task.bonus));
          if (readyPrize) button.append(Object.assign(document.createElement('small'), { textContent: 'Забрать' }));
        }
      }
      button.addEventListener('click', async () => {
        if (saving || serviceBusy) return;
        try {
          const origin = button.getBoundingClientRect(), previousSave = save;
          if (!await write(next => claimTask(next, utc, task.id))) return;
          const recorded = save.dailyTasks?.weeks.find(item => item.startUtc === weekStart);
          if (!$<HTMLDialogElement>('#daily-tasks-dialog').open) return;
          if (recorded && recorded.totalMedals > before) {
            if (casual) taskProgressBaseline('week:' + recorded.startUtc + ':' + recorded.catalog, recorded.totalMedals);
            playPrizeFlight(origin, medals, prizeIcon('Medals'));
          }
          presentRewardDeltas('#daily-tasks-dialog', origin, previousSave);
        } catch { message('Не удалось сохранить награду.', true); }
      });
      if (casual) {
        const progress = progressTrack(task.progress, task.target);
        const kindIcon = task.kind === 'DrawCards' ? 'draw' : task.kind === 'ExecuteMoves' ? 'dailyDeal' :
          task.kind === 'CollectThemes' ? 'link' : task.kind === 'EarnCoins' ? 'coin' :
          task.kind === 'UseHints' ? 'hint' : task.kind === 'UseRollbacks' ? 'undo' : 'task';
        const previous = tasksEntering || task.claimed
          ? taskProgressBaseline(utc + ':' + task.id + ':' + task.target, task.progress) : task.progress;
        if (tasksEntering && previous < task.progress && !reducedMotion()) {
          const fill = progress.firstElementChild as HTMLElement;
          animateActionFeedback(fill, 'task-progress', [{ width: previous / task.target * 100 + '%' }, { width: Math.min(100, task.progress / task.target * 100) + '%' }], 420);
        }
        const copy = document.createElement('span'); copy.append(label, progress);
        row.append(casualIcon(kindIcon), copy, button);
      } else row.append(label, button);
      return row;
    }));
    const weekly = $<HTMLButtonElement>('#daily-tasks-weekly');
    weekly.hidden = !week || week.milestones.length !== 1;
    const single = week?.milestones.find(entry => entry.id === 'week');
    const weeklyClaimed = Boolean(week?.claimedMilestones.includes('week'));
    if (casual) {
      const heading = $('#daily-tasks-dialog .sheet-heading');
      const readyRow = $('#daily-tasks-ready');
      const ready = !weekly.hidden && Boolean(single && week && week.totalMedals >= single.medals && !weeklyClaimed);
      readyRow.hidden = !ready;
      if (ready) {
        if (!readyRow.contains(weekly)) readyRow.append(medals, weekly);
        if (readyRow.parentElement !== heading) heading.append(readyRow);
      } else if (readyRow.contains(weekly)) {
        $('#daily-tasks-week-title').after(medals);
        $('#daily-tasks-milestones').after(weekly);
      }
    }
    weekly.disabled = busy || !week || !single || week.totalMedals < single.medals || weeklyClaimed;
    const weekTimer = $('#daily-tasks-week-reset');
    weekTimer.hidden = !weeklyClaimed;
    showCountdown(weekTimer, weeklyClaimed ? state.nextWeekAt : undefined, 'До нового бонуса недели');
    weekly.textContent = weeklyClaimed ? 'Бонус недели получен'
      : single ? 'Получить бонус недели · ' + [single.prize, ...(single.bundle ?? [])].map(prizeLabel).join(' + ') : 'Бонус недели';
    const milestones = $('#daily-tasks-milestones');
    const multiWeek = Boolean(week && week.milestones.length > 1);
    const chest = $<HTMLButtonElement>('#task-chest-open');
    const chestCount = Object.keys(save.dailyTasks?.inventory.weeklyChests ?? {}).length;
    chest.hidden = chestCount === 0;
    chest.disabled = busy;
    chest.textContent = chestCount > 1 ? `Открыть сундук · ${chestCount}` : 'Открыть сундук';
    if (casual && week && multiWeek && week.milestones.some(item =>
      item.medals <= week.totalMedals && !week.claimedMilestones.includes(item.id))) {
      $('#daily-tasks-ready').hidden = false;
      $('#daily-tasks-ready').append(medals, milestones);
    } else if (milestones.parentElement?.id === 'daily-tasks-ready') {
      $('#daily-tasks-legacy-week').after(medals, milestones);
    }
    milestones.replaceChildren(...(week && multiWeek ? week.milestones.map(entry => {
      const claim = document.createElement('button'); claim.type = 'button'; claim.className = 'secondary';
      const claimed = week.claimedMilestones.includes(entry.id);
      claim.textContent = entry.medals + ' мед. · ' + (claimed ? 'Получено' : [entry.prize, ...(entry.bundle ?? [])].map(prizeLabel).join(' + ') + (entry.chest ? ' + сундук' : ''));
      claim.disabled = busy || claimed || week.totalMedals < entry.medals;
      claim.addEventListener('click', () => {
        if (saving || serviceBusy) return;
        const origin = claim.getBoundingClientRect(), previousSave = save;
        void write(next => claimTaskMilestone(next, week.startUtc, entry.id))
          .then(granted => { if (granted) presentRewardDeltas('#daily-tasks-dialog', origin, previousSave); })
          .catch(() => message('Не удалось сохранить награду.', true));
      });
      return claim;
    }) : []));
    const archive = $<HTMLDetailsElement>('#daily-tasks-previous');
    archive.hidden = !state.previous.length;
    if (!state.previous.length) archive.open = false;
    $('#daily-tasks-archive-toggle').textContent = 'Архив наград · ' + state.previous.length;
    $('#daily-tasks-previous-list').replaceChildren(...state.previous.map(reward => {
      const row = document.createElement('section'), title = document.createElement('strong'), claim = document.createElement('button');
      row.dataset.rewardKey = reward.key;
      title.textContent = reward.kind === 'task' ? reward.utc + ' · ' + (taskNames[reward.task.kind] ?? reward.task.kind) : 'Неделя ' + reward.weekStart;
      claim.type = 'button'; claim.className = 'secondary'; claim.disabled = busy;
      claim.textContent = 'Получить · ' + reward.prizes.map(prizeLabel).join(' + ');
      claim.addEventListener('click', () => {
        if (saving || serviceBusy) return;
        const origin = claim.getBoundingClientRect(), previousSave = save;
        void write(next => reward.kind === 'task' ? claimTask(next, reward.utc, reward.id) : claimTaskMilestone(next, reward.weekStart, reward.id))
          .then(granted => { if (granted) presentRewardDeltas('#daily-tasks-dialog', origin, previousSave); })
          .catch(() => message('Не удалось сохранить награду.', true));
      });
      row.append(title, claim); return row;
    }));
  }
  function prizeLabel(prize: { kind: string; quantity: number }) {
    const labels: Record<string, string> = { Coins: 'монет', MoveHint: 'подсказок', Undo: 'отмен', Medals: 'мед.',
      Joker: 'Джокер', Definition: 'объяснений', Shuffle: 'перемешиваний', CardBack: 'рубашка', RandomBoostersChest: 'сундук' };
    return prize.quantity + ' ' + (labels[prize.kind] ?? '');
  }
  function bonusClaimMessage(prize: { kind: string; quantity: number }) {
    const helper = ({ MoveHint: 'hint', Undo: 'undo', Joker: 'joker' } as const)[prize.kind as 'MoveHint'|'Undo'|'Joker'];
    const locked = helper && !helperUnlocked(save, helper, deal);
    return 'Получено: ' + prizeLabel(prize) + (locked ? '. В запасе: ' + save.profile[{ hint: 'hints', undo: 'undos', joker: 'jokers' }[helper] as 'hints'|'undos'|'jokers'] + '. Откроется на уровне ' + HELPER_UNLOCK[helper] + '.'
      : prize.kind === 'Coins' ? '. Монеты в кошельке.' : '. Заряд в запасе помощников.');
  }
  function renderDailyBonus() {
    const state = dailyBonusState(save, Date.now());
    const entry = $('#daily-bonus-open');
    entry.hidden = !dailyBonusEnabled || unlockedLevel(save) < RELEASE_UNLOCK.bonus;
    entry.dataset.rewardReady = String(state.canClaim);
    $('#daily-bonus-home-status').textContent = bonusStatusText();
    if (!$<HTMLDialogElement>('#daily-bonus-dialog').open) return;

    const round = save.dailyBonus, counts = new Map<number, number>();
    for (const index of round?.revealed ?? []) {
      const column = round!.slots[index];
      counts.set(column, (counts.get(column) ?? 0) + 1);
    }
    const status = $('#daily-bonus-status'), best = Math.max(0, ...counts.values());
    status.textContent = state.phase === 'playing'
      ? (casual ? 'Найди 3 одинаковых приза' : 'Открывайте карточки, пока не соберёте три одинаковых приза.') + (best ? ` · ${best}/3` : '')
      : state.phase === 'ready' && state.prize ? '3/3 · Ваш приз — ' + prizeLabel(state.prize)
        : state.phase === 'expired' ? 'День закончился. Можно открыть новый бонус.'
          : state.canStartRound && round?.claimed ? 'Бонус получен. Доступен новый бонус дня.' : bonusStatusText();
    if (casual && (state.phase === 'claimed' || state.phase === 'future')) {
      showCountdown(status, state.phase === 'future' ? state.availableAt : state.nextResetAt, 'До бонуса дня');
    } else { delete status.dataset.countdownAt; delete status.dataset.countdownLabel; }
    const claim = $<HTMLButtonElement>('#daily-bonus-claim'), next = $<HTMLButtonElement>('#daily-bonus-new');
    const pending = saving || serviceBusy || store.needsRecovery;
    claim.hidden = !state.canClaim; claim.disabled = pending;
    next.hidden = !state.canStartRound; next.disabled = pending;
    const grid = $('#daily-bonus-cards'), roundId = round?.roundId ?? '';
    if (grid.dataset.roundId !== roundId) {
      grid.dataset.roundId = roundId;
      $('#daily-bonus-error').hidden = true;
      grid.replaceChildren(...(round?.slots ?? []).map((_, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'daily-bonus-card'; button.dataset.revealed = 'false';
        button.addEventListener('click', async () => {
          if (saving || serviceBusy || store.needsRecovery || button.disabled) return;
          const error = $('#daily-bonus-error');
          error.hidden = true;
          try {
            const accepted = await write(next => revealDailyBonusCard(next, roundId, index, Date.now()));
            if (!accepted || !button.isConnected || !$<HTMLDialogElement>('#daily-bonus-dialog').open) return;
            if (!reducedMotion()) {
              animateActionFeedback(button, 'bonus-flip', [{ transform: 'scaleX(.14)' }, { transform: 'scaleX(1.06)', offset: .76 }, { transform: 'none' }], 230);
              if (save.dailyBonus?.won !== undefined) {
                animateActionFeedback(grid, 'bonus-match', [{ filter: 'brightness(1)' }, { filter: 'brightness(1.15)', offset: .45 }, { filter: 'brightness(1)' }], 450);
                runtime.play('complete'); runtime.pulse('complete');
              }
            }
            if (save.dailyBonus?.won !== undefined) claim.focus({ preventScroll: true });
            else if (document.activeElement === button || document.activeElement === document.body) {
              grid.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
            }
          } catch {
            error.textContent = 'Не удалось сохранить открытие карты. Повторите попытку.';
            error.hidden = false;
          }
        });
        return button;
      }));
    }
    for (const [index, child] of Array.from(grid.children).entries()) {
      const button = child as HTMLButtonElement, column = round!.slots[index];
      const revealed = round!.revealed.includes(index);
      const label = revealed ? prizeLabel(round!.columns[column]) : 'Открыть карту ' + (index + 1);
      button.disabled = revealed || !state.canReveal;
      button.setAttribute('aria-disabled', String(button.disabled || pending));
      button.setAttribute('aria-label', revealed ? label + ` · ${counts.get(column)}/3` : label);
      button.dataset.revealed = String(revealed);
      button.dataset.matched = String(revealed && (counts.get(column) ?? 0) > 1);
      button.dataset.won = String(revealed && column === round!.won);
      if (revealed) {
        const title = document.createElement('strong'), progress = document.createElement('small');
        title.textContent = label; progress.textContent = `${counts.get(column)}/3`;
        if (casual) button.replaceChildren(prizeToken(round!.columns[column]), progress);
        else button.replaceChildren(title, progress);
      }
    }
  }

  const showPicture = () => PICTURE_PREVIEW || Boolean(save.picture);
  function renderPicture() {
    const picture = save.picture, tokens = pictureTokens(save), parts = picture?.parts ?? [];
    const gallery = Boolean(picture?.gallery), complete = parts.length === PICTURE_PRICES.length;
    const home = $('#picture-home'), result = $('#picture-result');
    home.hidden = !showPicture();
    home.textContent = parts.length ? `Альбом · ${parts.length}/${PICTURE_PRICES.length}` : 'Альбом';
    if (casual) home.prepend(casualIcon('album'));
    result.hidden = !showPicture() || save.attempt.board.phase !== 'won' || Boolean(save.attempt.daily);
    result.textContent = picture?.lastWinAttempt === save.attempt.id ? 'Альбом · +2 жетона и 3 монеты' : 'Альбом';
    if (!$<HTMLDialogElement>('#picture-dialog').open) return;
    $('#picture-title').textContent = PICTURE_TITLE;
    $('#picture-status').textContent = gallery ? 'Иллюстрация сохранена в альбоме.' : `Жетоны · ${tokens}  •  Открыто ${parts.length} из ${PICTURE_PRICES.length}`;
    $('#picture-prize').textContent = gallery ? '' : PICTURE_PREVIEW && !pictureClosed(save, Date.now())
      ? 'За первую победу на каждом уровне — 2 жетона и 3 монеты.'
      : 'Открывайте фрагменты за сохранённые жетоны. Соберите все части, чтобы забрать иллюстрацию.';
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
    const now = Date.now(), sdkAvailable = approvedOffers() && ads.status.rewarded;
    const available = screen === 'game' && sdkAvailable;
    const busy = saving || serviceBusy || store.needsRecovery;
    const select = $<HTMLSelectElement>('#win-video-kind');
    select.hidden = integratedOffers;
    const kind = integratedOffers ? selectedWinMultiplier(save, deal) : select.value as WinOffer;
    const quote = kind ? offerQuote(save, deal, kind, now, integratedOffers) : undefined;
    $('#win-video-offers').hidden = !available || !quote || (!E4_M1 && casual && ($('#result').dataset.rewardPhase !== 'claimed' || rewardClaim?.flying === true));
    $('#win-video-label').hidden = E4_M1;
    const win = $<HTMLButtonElement>('#win-video-claim');
    win.textContent = quote && kind ? 'Получить ещё ' + quote.amount + ' монет' : '';
    if (E4_M1 && quote && kind) {
      const total = (save.attempt.payout ?? []).reduce((sum, grant) => sum + grant.coins, 0) + quote.amount;
      const factor = kind === 'win-fivefold' ? 5 : 3;
      win.replaceChildren(videoGlyph(), document.createTextNode(`Видео · ${total} монет`),
        Object.assign(document.createElement('small'), { textContent: `×${factor} к базовой награде` }));
      win.setAttribute('aria-label', `Видео · всего ${total} монет, ×${factor} к базовой награде`);
    } else if (casual && quote && kind) {
      win.replaceChildren(videoGlyph(), prizeToken({ kind: 'Coins', quantity: quote.amount }));
      win.setAttribute('aria-label', 'Реклама: получить +' + quote.amount + ' монет');
    }
    win.disabled = busy;
    const shopContext = integratedOffers && (casual ? unlockedLevel(save) >= COIN_WALLET_LEVEL :
      !save.attempt.daily && (deal.campaignLevel ?? 0) >= 16 && save.attempt.board.phase === 'playing');
    const shopAvailable = casual ? sdkAvailable && !save.attempt.daily : available;
    const contextNote = $('#shop-context-note');
    contextNote.hidden = shopContext;
    contextNote.textContent = `Монеты дают за победы и бонус дня. Пополнение в кошельке откроется на уровне ${COIN_WALLET_LEVEL}.`;
    const day = Math.floor(now / 86_400_000), shop = save.rewardOffers?.shop;
    const future = (shop?.freeDay ?? -1) > day;
    const free = $<HTMLButtonElement>('#shop-free-claim'), freeReady = canClaimShopCoins(save, deal, now, casual);
    free.hidden = !shopContext || casual && !freeReady;
    free.disabled = busy || !freeReady;
    free.textContent = freeReady ? `Забрать ${SHOP_FREE_COINS} монет` : future ? 'Бесплатные монеты пока недоступны' : 'Монеты получены';
    const freeStatus = $('#shop-claim-status');
    freeStatus.hidden = !shopContext || casual && freeReady;
    showCountdown(freeStatus, !shopContext || freeReady ? undefined : ((future ? shop!.freeDay : day) + 1) * 86_400_000,
      freeReady ? 'Бесплатные монеты на сегодня' : 'До бесплатных монет');
    const video = $<HTMLButtonElement>('#shop-video-claim');
    const videoQuote = offerQuote(save, deal, 'shop-free-coins', now, integratedOffers);
    video.hidden = casual ? !shopContext || !shopAvailable || !videoQuote :
      integratedOffers ? !shopContext : !available || !videoQuote;
    video.disabled = busy || !shopAvailable || !videoQuote;
    video.textContent = shop?.earnedDay === day ? 'Монеты за видео получены' : `${SHOP_VIDEO_COINS} монет за видео`;
    const videoStatus = $('#shop-video-status');
    videoStatus.hidden = !shopContext;
    const after = save.rewardOffers?.freeAfter ?? 0;
    videoStatus.textContent = store.needsRecovery ? 'Проверьте сохранение награды перед новым запросом.'
      : serviceBusy ? 'Запрос видео. Монеты начисляются после подтверждения просмотра.'
        : future ? 'Предложение сохранено для другой даты.'
          : shop?.earnedDay === day ? 'Награда за видео получена. Следующая — ' + resetText(Math.max(after, (day + 1) * 86_400_000)) + '.'
            : shop?.freeDay !== day ? `Сначала заберите бесплатные ${SHOP_FREE_COINS} монет.`
              : after > now ? 'Следующее видео — ' + resetText(after) + '.'
                : save.attempt.daily ? 'Видео доступно в кампании.'
                  : !shopAvailable ? 'Видео сейчас недоступно.' : `+${SHOP_VIDEO_COINS} монет за подтверждённый просмотр.`;
    if (shopContext && casual && !serviceBusy && !store.needsRecovery && (after > now || shop?.earnedDay === day) && !future)
      showCountdown(videoStatus, Math.max(after, (day + 1) * 86_400_000), 'До следующих монет за видео');
    else { delete videoStatus.dataset.countdownAt; delete videoStatus.dataset.countdownLabel; }
    const theme = $<HTMLButtonElement>('#theme-video-claim');
    theme.hidden = !available || !offerQuote(save, deal, 'rewarded-theme', now, integratedOffers);
    theme.disabled = busy;
    const expires = save.rewardOffers?.themeUntil ?? 0;
    $('#app').toggleAttribute('data-reward-theme', expires > now);
    clearTimeout(themeExpiry);
    if (expires > now) themeExpiry = setTimeout(renderRewardOffers, Math.min(expires - now, 86_400_000));
  }
  function restoreOfferDialog() {
    if (!rewardOfferReturn || runtime.activity.getBlockReasons().some(reason => reason !== 'screen')) return false;
    const { selector, attempt, back } = rewardOfferReturn;
    rewardOfferReturn = undefined;
    if (save.attempt.id !== attempt || screen !== 'game' && selector !== '#coins-dialog') return false;
    if (selector === '#result') outcome();
    else openDialog(selector, false, back);
    return true;
  }
  let videoWin: { id: string; attempt: string; key: string; until?: number } | undefined;
  function finishVideoWin() {
    const win = videoWin;
    if (!win || !win.until || !alive || serviceBusy || saving || runtime.activity.getBlockReasons().some(reason => reason !== 'modal') ||
        save.attempt.id !== win.attempt || !$<HTMLDialogElement>('#result').open) return;
    if (Date.now() > win.until) { videoWin = undefined; return; }
    if (!save.rewardOffers?.settledWins.includes(win.key)) return;
    videoWin = undefined;
    $('#result').append($('#coin-layer'));
    const next = () => { if (save.attempt.id === win.attempt && $<HTMLDialogElement>('#result').open) advanceResult(true); };
    if (!wallet?.pending || reducedMotion()) next();
    else {
      wallet.collect($('#result-total'), undefined, next);
      setTimeout(next, 950);
    }
  }
  async function requestRewardOffer(kind: OfferPlacement, selector: '#result'|'#helpers'|'#appearance'|'#coins-dialog') {
    const fromWallet = casual && selector === '#coins-dialog' && kind === 'shop-free-coins';
    if (!rewardOffersEnabled || saving || serviceBusy || screen !== 'game' && !fromWallet || !approvedOffers() || !ads.status.rewarded) return;
    const attempt = save.attempt.id, back = returnToDialog;
    serviceBusy = true;
    try {
      if (E4_M1 && !await ads.canAuthorizeOffer()) {
        message('Проверяем предыдущий запрос. Можно продолжить игру.', true);
        return;
      }
      const offer = await write(next => prepareRewardOffer(next, deal, kind, Date.now(), crypto.randomUUID(), integratedOffers, integratedOffers));
      if (!offer || !alive || save.attempt.id !== attempt) return;
      if (E4_M1 && selector === '#result') {
        videoWin = { id: offer.id, attempt, key: offer.key };
        $('#win-video-status').hidden = true;
      }
      closeDialogs();
      if (fromWallet && screen === 'home') runtime.activity.setBlocked('screen', false);
      const result = await ads.show({ kind: 'rewarded', placement: kind, attempt: offer.id, dealId: offer.dealId, mode: 'campaign' });
      if (!alive) return;
      rewardOfferReturn = { attempt, selector, back };
      if (E4_M1 && (result.terminalNoReward || !result.shown && result.outcome === 'unavailable')) {
        await write(next => retireUnrewardedOffer(next, offer.id));
      }
      if (videoWin && videoWin.id === offer.id) {
        if (result.shown) videoWin.until = Date.now() + 2000;
        else {
          videoWin = undefined;
          $('#win-video-status').hidden = false;
          $('#win-video-status').textContent = 'Видео недоступно. Можно перейти дальше.';
        }
      }
      if (!result.shown) message('Сейчас видео недоступно. Попробуйте позже.', true);
    } catch { message('Не удалось сохранить предложение. Попробуйте ещё раз.', true); }
    finally {
      if (fromWallet && screen === 'home') runtime.activity.setBlocked('screen', true);
      serviceBusy = false;
      if (alive) { restoreOfferDialog(); renderHud(); finishVideoWin(); }
    }
  }
  async function rewarded(placement: RewardPlacement) {
    if (serviceBusy || saving) return;
    const requestAttempt = save.attempt.id;
    const fromLoss = save.attempt.board.phase === 'exhausted';
    const request = { kind: 'rewarded' as const, placement, attempt: requestAttempt, dealId: deal.id,
      mode: save.attempt.daily ? 'daily' as const : 'campaign' as const };
    serviceBusy = true;
    try {
      if (placement === 'continue' && casual) {
        await ads.recover();
        if (!await write(next => next.attempt.id === requestAttempt && quoteContinueVideo(next))) return;
      }
    } catch { message('Не удалось сохранить запрос продолжения.', true); return; }
    finally { serviceBusy = false; }
    serviceBusy = true; closeDialogs(); renderHud();
    const result = await ads.show(request);
    if (!alive) return;
    if (placement === 'continue' && casual && !result.shown && result.outcome !== 'error') {
      try { await write(next => cancelContinueVideo(next, request)); } catch { /* Preserve the journal for recovery. */ }
    }
    // Dismissal itself grants nothing; receipt recovery independently commits an earned reward.
    if (placement === 'continue') continueVideoFailed = result.shown ? undefined : requestAttempt;
    if (fromLoss) rewardedResultAttempt = requestAttempt;
    serviceBusy = false; renderHud();
    if (!result.shown && (!fromLoss || placement !== 'continue' || !requiresContinueProof(save.attempt)))
      message('Сейчас видео недоступно. Попробуйте позже.', true);
    restoreRewardedResult();
  }
  function targetTeaches(level: number) {
    const base = campaignDeals[level - 1];
    if (!base) return false;
    const target = selectCampaignDeal(save, base, campaignAttempt(save));
    return teachingProtected({ ...save, attempt: freshSave(target, 'teaching-preview').attempt }, target);
  }
  async function showTransitionAd(target?: number, placement: CampaignInterstitialPlacement = 'level-start') {
    const now = Date.now(), level = deal.campaignLevel;
    if (casual ? target === undefined || !campaignAdsApproved() || pauseOpportunity ||
      teachingProtected(save, deal) ||
      placement === 'level-start' && target !== deal.campaignLevel && targetTeaches(target) ||
      !releasePlacementEligible(save, target, placement, now, launchedAt) :
      screen !== 'game' || save.attempt.board.phase !== 'won' || level === undefined ||
      adFree(save, now) || !interstitialEligible(save, level, 'campaign', now, launchedAt)) return;
    if (!ads.status.interstitial || !document.hasFocus() || store.needsRecovery ||
        performance.now() < fullscreenRetryAt) return;
    if (ads.status.interstitialLoaded === false) { void ads.prepareInterstitial(); return; }
    if (screen === 'home' && runtime.activity.getBlockReasons().every(reason => reason === 'screen')) {
      runtime.activity.setBlocked('screen', false);
    }
    try {
      if (target !== undefined) transitionAd = { level: target, placement };
      const result = await ads.show({ kind: 'interstitial', placement: casual ? placement : 'continue', attempt: save.attempt.id, dealId: deal.id, mode: 'campaign' });
      if (!result.shown) fullscreenRetryAt = performance.now() + 30_000;
    } finally {
      transitionAd = undefined;
      if (screen === 'home') runtime.activity.setBlocked('screen', true);
    }
  }
  async function replay(sameLayout = false) {
    if (serviceBusy || saving || store.needsRecovery) return;
    const expected = save.attempt.id;
    const quote = casual && !sameLayout ? quoteLayoutRetry(save) : undefined;
    const stuck = noOrdinaryMoves(save.attempt.board);
    serviceBusy = true; closeDialogs();
    if (!stuck) await showTransitionAd(deal.campaignLevel);
    serviceBusy = false;
    const restart = async () => {
      if (!alive || save.attempt.id !== expected) return;
      if (quote) await startLayoutRetry(quote, true);
      else await execute({ type: 'restart', attemptId: crypto.randomUUID() });
    };
    // Dismissal and foreground are independent. Never continue behind a displayed ad.
    if (runtime.activity.getBlockReasons().some(reason => reason !== 'recovery-time')) {
      const remove = runtime.activity.onBlockedChange(blocked => { if (!blocked) { remove(); void restart(); } });
    } else await restart();
  }
  function renderHome() {
    renderLives();
    const monthly = freeCampaignBonusState(save, Date.now());
    const monthlyText = $('#campaign-monthly-bonus');
    const monthlyCoins = monthly.season === save.storeProgress?.season ? save.storeProgress?.freeCoins ?? 10 : E4_M1 ? M1.monthly : 10;
    monthlyText.hidden = !freeSeasonalTrack || !monthly.visible;
    monthlyText.textContent = monthly.phase === 'claimed' ? `Бонус месяца · +${monthlyCoins} монет получено`
      : monthly.phase === 'ready' ? `Бонус месяца · ${monthlyCoins} монет ожидают сохранения`
        : 'Бонус месяца · ' + Math.min(monthly.clears, monthly.goal) + '/' + monthly.goal + ' новых уровней · +' + monthlyCoins + ' монет';
    if (casual && !monthlyText.hidden) {
      const accessible = monthlyText.textContent ?? '';
      monthlyText.setAttribute('aria-label', accessible);
      const value = document.createElement('span');
      value.textContent = monthly.phase === 'claimed' ? 'Получено' : monthly.phase === 'ready' ? 'Готово' :
        Math.min(monthly.clears, monthly.goal) + '/' + monthly.goal;
      monthlyText.replaceChildren(casualIcon('gift'), value, progressTrack(monthly.clears, monthly.goal),
        prizeToken({ kind: 'Coins', quantity: monthlyCoins }));
    }
    if (LIVEOPS_PREVIEW && unlockedLevel(save) >= 16) prewarmLiveOps();
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
    const homeDifficulty = setDifficulty($('#home-play'), current ? homeDeal : campaignLevelPreview(homeDeal));
    const finished = casual && !current && completed === CAMPAIGN_LENGTH;
    const campaignClosed = sequentialCampaign && finished && (!campaign || outcomeViewed);
    const level = Object.assign(document.createElement('small'), { textContent: campaignClosed ? `Все ${CAMPAIGN_LENGTH} уровней` : parts[1] ?? (completed === CAMPAIGN_LENGTH ? 'Кампания пройдена' : 'Кампания') });
    if (homeDifficulty) {
      if (casual) level.append(difficultyBadge(homeDeal));
      else level.textContent += ' · ' + homeDifficulty;
    }
    if (casual) renderUnlockTrack($('#home-unlock-track'));
    $('#home-play').replaceChildren(document.createTextNode(campaignClosed ? 'Кампания пройдена' : finished && !outcomeViewed ? 'Итоги' : parts[0]), level);
    $<HTMLButtonElement>('#home-play').disabled = !ready || saving || serviceBusy || campaignClosed;
    if (sequentialCampaign) return;
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
      if (difficulty) button.append(casual ? difficultyBadge(item) :
        Object.assign(document.createElement('span'), { className: 'tier-dot', textContent: item.difficultyTier === 'superhard' ? '!!' : '!' }));
      button.disabled = level > unlocked || !ready || saving || serviceBusy;
      const activeLevel = campaign?.board.phase === 'playing' && isCurrentCampaignDeal(campaign.dealId, item);
      button.dataset.active = String(activeLevel);
      button.setAttribute('aria-current', activeLevel ? 'step' : 'false');
      button.dataset.completed = String(done); button.dataset.next = String(level === unlocked && !done);
      button.setAttribute('aria-label', `Уровень ${level}: ${item.title}${difficulty ? ', ' + difficulty : ''}${done ? ', пройден' : level > unlocked ? ', закрыт' : ''}`);
    }
    if (HITAPPS_FIXTURE_UI) {
      const container = $('#source-deal-list');
      const fixtures = [...hitappsR4Deals()].filter(row => row.record.use === 'feature-check' && row.penalty === 0 &&
        Math.floor((row.deal.campaignLevel! - 1) / 20) === chapterPage);
      container.hidden = !fixtures.length;
      container.replaceChildren(...fixtures.map(({ deal: fixture }) => {
        const card = Object.values(fixture.initial.hitapps!.cards);
        const name = fixture.hitapps?.gold ? 'Золотые карты' : fixture.hitapps?.assemblies.length ? 'Половинки'
          : card.some(item => item.bound) ? 'Связки и ножницы' : card.some(item => item.lock) ? 'Замок и ключи'
          : card.some(item => item.ice) ? 'Лёд' : card.some(item => item.kind === 5) ? 'Магнит'
          : card.some(item => item.kind === 6) ? 'Молоток' : 'Порядок';
        const button = document.createElement('button');
        button.className = 'secondary'; button.textContent = `${fixture.campaignLevel} · ${name}`;
        button.disabled = fixture.campaignLevel! > unlocked || !ready || saving || serviceBusy;
        button.addEventListener('click', () => { void openLevel(fixture.campaignLevel!, false, false, undefined, fixture.id); });
        return button;
      }));
    }
  }
  function maybeIntroduceRule(requested?: 'joker'): boolean {
    const intro = requested ?? ruleIntroduction(save, deal);
    if (!intro || dismissedRules.has(ruleIntroMarker(intro, deal)) || activeRule || !ready || saving || inspectMode || screen !== 'game' || runtime.activity.isBlocked()) return false;
    activeRule = intro;
    $('#learn-rule').dataset.rule = intro;
    const keyCount = deal.lock?.requiredKeys.length ?? 0;
    if (intro === 'keys') {
      $('#lesson-keys').replaceChildren(...Array.from({ length: keyCount }, () => {
        const key = new Image();
        key.src = 'art/generated/key.webp';
        key.alt = '';
        return key;
      }));
    }
    $('#learn-title').textContent = {
      joker: 'Джокер', ordered: 'По порядку',
      keys: keyCount === 1 ? 'Один ключ' : keyCount === 3 ? 'Три ключа' : 'Замок с ключами',
    }[intro];
    $('#learn-copy').textContent = {
      joker: 'Временное место для одной группы. Один раз за раздачу. Можно пройти и без Джокера.',
      ordered: 'Соединяйте соседние номера без пропусков. К категории добавляйте по порядку, начиная с первого.',
      keys: keyCount === 1 ? 'Откройте карту с ключом, чтобы снять замок со столбца.'
        : `Открывайте карты с ключами. Когда счётчик дойдёт до ${keyCount}, замок со столбца снимется.`,
    }[intro];
    openDialog('#learn-rule'); return true;
  }
  dismissRule = () => { void (async () => {
    const intro = activeRule; if (!intro) return;
    const marker = ruleIntroMarker(intro, deal);
    activeRule = undefined; dismissedRules.add(marker);
    try {
      await write(next => {
        markTutorial(next, marker);
        if (casual) recordTeachingAction(next, deal, true, false);
      });
    } catch { /* Presentation can be dismissed; SaveStore keeps recovery ownership. */ }
    closeDialogs(); showGuidance();
  })(); };
  document.querySelectorAll('[data-lesson-close]').forEach(button => button.addEventListener('click', () => dismissRule?.(), domOptions));
  function showGuidance(animate = true, idle = false) {
    clearTimeout(guideTimer); pendingGuide = undefined;
    updateBanner();
    if (maybeIntroduceRule()) return;
    const instruction = currentLesson();
    if (animate && instruction?.action && !inspectMode) {
      const attemptId = save.attempt.id, revision = save.revision;
      const demonstrate = () => {
        if (!alive || screen !== 'game' || runtime.activity.isBlocked() || save.attempt.id !== attemptId || save.revision !== revision || inspectMode) {
          pendingGuide = undefined;
          return;
        }
        if (scene?.guidanceReady(instruction.action!)) {
          pendingGuide = undefined;
          repaintFrames = Math.max(repaintFrames, 2);
          scene.teach(instruction.action!);
        }
      };
      guideTimer = setTimeout(() => {
        pendingGuide = demonstrate;
        game?.loop.wake();
      }, instruction.accepts ? 450 : idle ? 6000 : instruction.delay ?? 650);
    }
  }
  function showGame() {
    clearPraise(); message(''); screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false;
    runtime.activity.setBlocked('screen', false); renderHud();
    repaintFrames = Math.max(repaintFrames, 2); resizeToRoot(); game?.loop.wake(); scene?.sync(); showGuidance(); scheduleAdBreak();
    if (save.attempt.board.phase !== 'playing') outcome();
  }
  function goHome() {
    clearPraise(); clearTimeout(outcomeTimer); clearTimeout(guideTimer); setInspect(false); closeDialogs();
    screen = 'home'; runtime.activity.setBlocked('screen', true); $('#play-screen').hidden = true; $('#home').hidden = false;
    renderHud(); renderHome(); updateBanner();
  }
  async function activateMode(mode: 'campaign' | 'daily', oldDaily = false, replaceConfirmed = false) {
    if (!ready || saving || serviceBusy || store.needsRecovery) return;
    const previousDaily = dailyAttempt(save);
    const today = localDay();
    const target = mode === 'daily'
      ? previousDaily && (oldDaily || (previousDaily.daily?.dayId ?? '') >= today) ? findDeal(previousDaily.dealId)! : dailyForDay(today)
      : campaignAttempt(save) ? findDeal(campaignAttempt(save)!.dealId)! : campaignDeals[0];
    const previousTarget = mode === 'daily' ? previousDaily : campaignAttempt(save);
    if (mode === 'daily' && !oldDaily && !replaceConfirmed && previousDaily?.daily?.dayId !== target.daily?.dayId && previousDaily?.board.phase === 'playing' && previousDaily.telemetry?.started) { openDialog('#replace-daily'); return; }
    if (save.attempt.dealId === target.id) { closeDialogs(); showGame(); return; }
    closeDialogs(); serviceBusy = true; runtime.activity.setBlocked('level-transition', true);
    try {
      clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined; activeHint = undefined;
      clearTimeout(outcomeTimer); clearTimeout(guideTimer); setInspect(false);
      transitionPresentation = { resumeId: previousTarget?.id };
      await write(next => switchMode(next, mode, target, crypto.randomUUID()));
    } catch { message('Не удалось сохранить переход. Попробуйте ещё раз.', true); }
    finally {
      if (!store.needsRecovery) transitionPresentation = undefined;
      serviceBusy = false; if (ready) runtime.activity.setBlocked('level-transition', false); renderHud(); renderHome();
    }
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
  function presentLevelStart(animate: boolean) {
    sceneGeneration++;
    outcomeViewed = false; ready = false; $('#app').dataset.ready = 'false';
    runtime.activity.setBlocked('level-transition', true);
    closeDialogs();
    screen = 'game'; $('#home').hidden = true; $('#play-screen').hidden = false; runtime.activity.setBlocked('screen', false);
    setInput(); scene?.setDeal(deal, animate);
  }
  async function openLevel(level: number, confirmed = false, announce = true, redeal?: { attemptId: string; dealId: string }, sourceDealId?: string, skipAd = false) {
    if (!alive || !ready || saving || serviceBusy || store.needsRecovery || level < 1 || level > unlockedLevel(save) ||
      (sequentialCampaign && (level !== unlockedLevel(save) || completedLevels(save) === CAMPAIGN_LENGTH))) return;
    const exact = sourceDealId && HITAPPS_FIXTURE_UI ? findDeal(sourceDealId) : undefined;
    if (sourceDealId && (!exact?.hitapps || exact.campaignLevel !== level)) return;
    if (redeal && (redeal.attemptId !== save.attempt.id || campaignRedeal(save.attempt)?.id !== redeal.dealId)) return;
    const target = campaignDeals[level - 1];
    const campaign = campaignAttempt(save);
    if (campaign?.board.phase === 'playing' && (exact ? campaign.dealId === exact.id : isCurrentCampaignDeal(campaign.dealId, target))) {
      if (save.attempt.daily) await activateMode('campaign');
      else { closeDialogs(); showGame(); }
      return;
    }
    if (!confirmed && campaign?.board.phase === 'playing' && (campaign.telemetry?.started || campaign.undo.length > 0)) {
      requestedLevel = level; requestedSourceDeal = exact?.id; $('#switch-title').textContent = `Начать уровень ${level}?`; openDialog('#switch-level'); return;
    }
    const tier = difficultyLabel(target);
    if (!casual && tier && announce) {
      difficultyRequest = { level, returnTo: $<HTMLDialogElement>('#result').open ? 'result' :
        $<HTMLDialogElement>('#level-picker').open ? 'picker' : undefined };
      $('#difficulty-level').textContent = `УРОВЕНЬ ${level}`;
      $('#difficulty-title').textContent = tier;
      setDifficulty($('#difficulty-entry'), target);
      openDialog('#difficulty-entry'); return;
    }
    closeDialogs(); serviceBusy = true; renderHome();
    if (!exact && !skipAd) await showTransitionAd(level);
    const enter = async () => {
      removeForeground?.(); removeForeground = undefined;
      runtime.activity.setBlocked('level-transition', true);
      let started = false, failed = false, blockedLives = false;
      try {
        clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined;
        clearTimeout(outcomeTimer); clearTimeout(guideTimer); activeHint = undefined; setInspect(false);
        transitionPresentation = {};
        started = await write(next => {
          const previous = campaignAttempt(next);
          const previousDeal = previous && findDeal(previous.dealId);
          const selected = exact ?? (redeal ? campaignRedeal(next.attempt) : selectCampaignDeal(next, target, previous));
          if (!selected || (redeal && (next.attempt.id !== redeal.attemptId || selected.id !== redeal.dealId))) return false;
          if (LIVES_PREVIEW && !mayStartCampaignAttempt(next, previous, Date.now())) {
            blockedLives = true; return false;
          }
          if (next.attempt.daily) switchMode(next, 'campaign', previousDeal ?? selected, crypto.randomUUID());
          const equalityBase = GENERATION_PREVIEW && selected.adaptive?.baseId === target.id ? target : selected;
          beginDeal(next, selected, crypto.randomUUID(), previousDeal, redeal ? undefined : equalityPreviewPolicy, equalityBase);
          const issuance = campaignIssuance(next, target, findDeal(next.attempt.dealId) ?? selected, previous);
          if (issuance) next.attempt.issuance = issuance;
          return true;
        });
        if (started) {
          if (redeal) telemetry.track('level_restart');
          offerFact({ trigger: OfferTrigger.LevelStarted, key: 'start' });
        }
      } catch { failed = true; if (!redeal) message('Не удалось сохранить переход. Попробуйте ещё раз.', true); }
      finally {
        if (!store.needsRecovery) transitionPresentation = undefined;
        serviceBusy = false; if (ready) runtime.activity.setBlocked('level-transition', false); renderHud(); renderHome();
      }
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
  scene = new BoardScene({ jokerMode: active => $('#joker').setAttribute('aria-pressed', String(active)), deal, getSave: () => save, reducedMotion, command: execute, allows: allowsLesson, praise: showPraise, sound: name => runtime.play(name),
    inputRoot: () => root, readerZone: () => $('#inspect').getBoundingClientRect(), peek: peekCard,
    boardBounds() { const rect = root.getBoundingClientRect(), zoom = game?.scale.zoom ?? initial.rect.width / initial.backing.width;
      return { x: (rect.width ? rect.x : 12) / zoom, y: (rect.height ? rect.y : 76) / zoom,
        width: (rect.width || innerWidth - 24) / zoom, height: (rect.height || Math.max(280, innerHeight - 260)) / zoom }; },
    inspect(id) {
      const card = deal.cards[id];
      definitionCardId = id;
      const definition = $<HTMLButtonElement>('#definition-use');
      definition.hidden = !rewardOffersEnabled && !(STOREFRONT_PREVIEW && definitionCount(save));
      definition.disabled = definitionCount(save) === 0;
      $('#definition-refill').hidden = !productOfferEnabled || !definition.disabled || Boolean(save.attempt.daily);
      definition.textContent = `Связанное слово · ${definitionCount(save)}`;
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
    ready(active, newDeal, renderedDealId) {
      scene = active;
      const generation = sceneGeneration;
      active.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        if (generation !== sceneGeneration || renderedDealId !== save.attempt.dealId) return;
        $('#app').dataset.presentedDeal = renderedDealId;
        ready = true; resizeToRoot(); runtime.activity.setBlocked('level-transition', false); telemetry.ready(); setInput(); updateBanner(); renderHud(); renderHome(); $('#loading').hidden = true; $('#app').dataset.ready = 'true'; finishStartup();
        const level = casual ? unlockedLevel(save) : deal.campaignLevel ?? 0;
      if (level >= (casual ? releaseAdCadence.interstitial.minimumLevel - 1 : BALANCE.ads.interstitialAfterLevel + 1)) void ads.prepareInterstitial();
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
    const next = size(); positionBonusSlots(save);
    // ResizeObserver can report an unchanged rounded backing size. Emitting a
    // scene resize for that notification would cancel a perfectly valid drag.
    const rect = root.getBoundingClientRect(), key = [rect.x, rect.y, rect.width, rect.height].join(':');
    const resized = game.scale.width !== next.backing.width || game.scale.height !== next.backing.height || game.scale.zoom !== next.rect.width / next.backing.width;
    if (!resized && key === boardSize) return;
    boardSize = key;
    repaintFrames = Math.max(repaintFrames, 2);
    if (resized) { game.scale.setZoom(next.rect.width / next.backing.width); game.scale.resize(next.backing.width, next.backing.height); }
    else scene?.settleMotion();
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
  let wasBackground = runtime.activity.getBlockReasons().some(reason => reason === 'visibility' || reason === 'native-background');
  const unblock = runtime.activity.onBlockReasonsChange(() => {
    const background = runtime.activity.getBlockReasons().some(reason => reason === 'visibility' || reason === 'native-background');
    const resumed = wasBackground && !background;
    wasBackground = background;
    if (resumed) {
      if (!saving && (dailyBonusEnabled || freeSeasonalTrack)) void write(next => syncRetention(next, Date.now())).catch(() => undefined);
      if (dailyBonusEnabled) renderDailyBonus();
      if (TASKS_PREVIEW) renderTasks();
      if (rewardOffersEnabled) renderRewardOffers();
      renderHome();
      void recoveryTime.refresh().then(syncRecoveryTime)
        .catch(() => message('Не удалось восстановить лимит ходов.', true));

    }
    const blocked = runtime.activity.isBlocked();
    if (pauseOpportunity?.stage !== 'request' && runtime.activity.getBlockReasons().some(reason => reason !== 'coffee-notice' && reason !== 'ad'))
      cancelPause('activity');
    if (blocked) {
      clearTimeout(adBreakTimer); adBreakTimer = undefined;
      activePointers.clear();
    } else scheduleAdBreak();
    if (runtime.activity.getBlockReasons().some(reason => reason !== 'shuffle')) cancelShuffle?.();
    setInput(); updateBanner(); renderDeadEnd();
    if (E4_M1) finishVideoWin();
    if (screen === 'game' && runtime.activity.getBlockReasons().every(r => r === 'modal') && ready) {
      scene?.sync();
      if (save.attempt.board.phase === 'playing' && $<HTMLDialogElement>('#result').open) closeDialogs();
      if (!blocked) {
        void ads.refresh(); void ads.recover();
        if (restoreRewardedResult() || restoreOfferDialog()) return;
        playDealSound(); showGuidance();
      }
    }
    if (runtime.activity.getBlockReasons().some(reason => reason !== 'modal' && reason !== 'screen')) {
      wallet?.clearDebit(true);
      if (rewardClaim) { cancelCoins(); finishRewardClaim(); }
    }
    if (!$<HTMLDialogElement>('#result').open) finishRewardClaim();
    if (!renderer.isBooted) return;
    if (blocked) clearActionFeedback();
    if (blocked && ready) { scene?.clearFeedback(); renderer.loop.sleep(); if (runtime.activity.getBlockReasons().some(r => r !== 'modal' && r !== 'screen')) cancelCoins(); }
    else renderer.loop.wake();
  });
  renderer.events.on(Phaser.Core.Events.POST_RENDER, () => {
    if (lessonNote.action) syncLessonNote();
    pendingGuide?.();
    if (repaintFrames > 0) {
      repaintFrames--;
      if (!runtime.activity.isBlocked()) return;
    }
    if (ready && (runtime.activity.isBlocked() || !scene?.hasMotion())) renderer.loop.sleep();
  });
  // Input and explicit UI changes wake the sleeping renderer before visual work.
  const wake = () => { if (save.attempt.daily && $('#app').dataset.practice !== String(training())) renderHud(); if (!runtime.activity.isBlocked()) renderer.loop.wake(); };
  root.addEventListener('pointerdown', () => { wake(); if (!runtime.activity.isBlocked()) showGuidance(true, true); }, domOptions); root.addEventListener('pointermove', wake, domOptions);
  document.addEventListener('pointerdown', event => {
    if (pauseOpportunity?.stage !== 'request') cancelPause('pointer-down');
    activePointers.add(event.pointerId);
    wake();
  }, { ...domOptions, capture: true });
  const releaseAdPointer = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    adBreakHold = performance.now() + AD_BREAK_IDLE_MS;
    scheduleAdBreak(AD_BREAK_IDLE_MS);
  };
  document.addEventListener('pointerup', releaseAdPointer, { ...domOptions, capture: true });
  document.addEventListener('pointercancel', releaseAdPointer, { ...domOptions, capture: true });
  window.addEventListener('focus', () => scheduleAdBreak(), domOptions);
  window.addEventListener('pointercancel', () => scene?.cancel(), domOptions);
  window.addEventListener('blur', () => { if (pauseOpportunity?.stage !== 'request') cancelPause('blur'); activePointers.clear(); scene?.cancel(); }, domOptions);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { scene?.cancel(); setInspect(false); } }, domOptions);
  dialogs.forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); dismissDialog(dialog); }, domOptions));
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', () => {
    const dialog = button.closest('dialog');
    if (dialog?.open) dismissDialog(dialog);
  }, domOptions));
  $('#home-play').addEventListener('click', () => {
    if (save.attempt.daily) { void activateMode('campaign'); return; }
    if (save.attempt.board.phase === 'playing' || !outcomeViewed) showGame();
    else if (completedLevels(save) === CAMPAIGN_LENGTH) { if (!sequentialCampaign) openDialog('#level-picker'); }
    else void openLevel(unlockedLevel(save));
  }, domOptions);
  $('#daily-play').addEventListener('click', () => { if (dailyModeAvailable(save)) void activateMode('daily'); }, domOptions);
  $('#daily-resume-old').addEventListener('click', () => { void activateMode('daily', true); }, domOptions);
  for (const [button, dialog] of [['calendar-open', '#calendar'], ['appearance-open', '#appearance'], ['win-cycle-open', '#cycle-info'], ['level-picker-open', '#level-picker']])
    $(`#${button}`).addEventListener('click', () => { renderMeta(save, saving); openDialog(dialog); }, domOptions);
  function openWallet(back?: () => void) {
    if (!casual) { openHelpers(); return; }
    renderRewardOffers();
    openDialog('#coins-dialog', false, back);
  }
  $('#wallet-open').addEventListener('click', () => {
    if ($<HTMLDialogElement>('#coins-dialog').open) return;
    if ($<HTMLDialogElement>('#campaign-lives').open) openWallet(openLives);
    else if ($<HTMLDialogElement>('#result').open) openWallet(() => outcome());
    else openWallet();
  }, domOptions);
  $('#helpers-coins-open').addEventListener('click', () => openWallet(() => openHelpers(helperFocus, false, helperResource)), domOptions);
  $('#appearance-settings').addEventListener('click', () => {
    renderMeta(save, saving);
    openChildDialog('#appearance', '#settings', $('#appearance-settings'));
  }, domOptions);
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
    if (!sequentialCampaign && button && !button.disabled) void openLevel(Number(button.dataset.level));
  }, domOptions);
  function advanceResult(skipAd = false) {
    if (saving || serviceBusy || store.needsRecovery || save.attempt.board.phase !== 'won') return;
    const level = nextCampaignLevel();
    if (save.attempt.daily || level === undefined) goHome();
    else void openLevel(level, false, true, undefined, undefined, skipAd);
  }
  nextLevelButton.addEventListener('click', () => {
    if (!startRewardClaim()) advanceResult();
  }, domOptions);
  if (dailyBonusEnabled) {
    async function showDailyBonus(fromHelpers = false) {
      if (saving || serviceBusy) return;
      try {
        const round = await write(next => {
          const now = Date.now();
          syncRetention(next, now);
          return openDailyBonusRound(next, now, crypto.randomUUID(), randomJokerColumn, E4_M1 || sourceDailyTasks ? 'azur-compiled-r1' : 'offline-r1');
        });
        if (round || save.dailyBonus) {
          if (fromHelpers) openChildDialog('#daily-bonus-dialog', '#helpers', $('#context-bonus-open'));
          else openDialog('#daily-bonus-dialog');
          renderDailyBonus();
        }
      } catch { message('Не удалось открыть ежедневный бонус.', true); }
    }
    $('#daily-bonus-open').addEventListener('click', () => { void showDailyBonus(); }, domOptions);
    $('#context-bonus-open').addEventListener('click', () => { void showDailyBonus(true); }, domOptions);
    $('#daily-bonus-new').addEventListener('click', async () => {
      if (saving || serviceBusy || !dailyBonusState(save, Date.now()).canStartRound) return;
      try {
        await write(next => openDailyBonusRound(next, Date.now(), crypto.randomUUID(), randomJokerColumn, E4_M1 || sourceDailyTasks ? 'azur-compiled-r1' : 'offline-r1'));
      } catch { message('Не удалось открыть бонус дня.', true); }
    }, domOptions);
    $('#daily-bonus-claim').addEventListener('click', async () => {
      if (saving || !save.dailyBonus) return;
      const id = save.dailyBonus.roundId, origin = $('#daily-bonus-claim').getBoundingClientRect(), previousSave = save;
      try {
        const granted = await write(next => {
          const now = Date.now();
          syncRetention(next, now);
          const prize = claimDailyBonus(next, id, now);
          if (!prize) return;
          recordTaskSignal(next, now, { id: `bonus:${id}`, kind: 'CollectDailyBonuses', channel: 'daily-bonus', amount: 1 });
          if (prize.kind === 'Coins') recordTaskSignal(next, now, { id: `bonus-coins:${id}`, kind: 'EarnCoins', channel: 'wallet', amount: prize.quantity });
          return prize;
        });
        if (granted) {
          $('#daily-bonus-status').textContent = casual ? 'Приз получен' : bonusClaimMessage(granted);
          if (casual) presentRewardDeltas('#daily-bonus-dialog', origin, previousSave);
          else message(bonusClaimMessage(granted));
        }
      } catch {
        const error = $('#daily-bonus-error');
        error.textContent = 'Не удалось сохранить награду.'; error.hidden = false;
      }
    }, domOptions);
  }
  if (CAMPAIGN_META) {
    $('#cycle-claim').addEventListener('click', () => {
      if (saving || serviceBusy) return;
      const expected = save.meta?.winStreak?.claimed ?? 0;
      const origin = $('#cycle-claim').getBoundingClientRect(), earlier = save;
      void write(next => claimWinStreak(next, expected)).then(granted => {
        if (granted) presentRewardDeltas('#cycle-info', origin, earlier);
      }).catch(() => message('Не удалось сохранить награду.', true));
    }, domOptions);
    $('#task-chest-open').addEventListener('click', () => {
      const key = Object.keys(save.dailyTasks?.inventory.weeklyChests ?? {})[0];
      if (!key || saving || serviceBusy) return;
      const origin = $('#task-chest-open').getBoundingClientRect(), earlier = save;
      void write(next => openWeeklyChest(next, key)).then(prize => {
        if (!prize) return;
        $('#task-chest-prize').hidden = false;
        $('#task-chest-prize').textContent = 'В сундуке · ' + prizeLabel(prize);
        presentRewardDeltas('#daily-tasks-dialog', origin, earlier);
      }).catch(() => message('Не удалось открыть сундук.', true));
    }, domOptions);
  }
  if (TASKS_PREVIEW) {
    $('#daily-tasks-open').addEventListener('click', async () => {
      if (saving || serviceBusy || !dailyTasksAvailable(save)) return;
      try {
        await write(next => {
          const now = Date.now();
          updatePreviewTasks(next, now);
          logTaskAction(next, 'DailyLogin', 'login');
        });
        openDialog('#daily-tasks-dialog');
        tasksEntering = true;
        try { renderTasks(); } finally { tasksEntering = false; }
      } catch { message('Не удалось открыть задачи.', true); }
    }, domOptions);
    $('#daily-tasks-weekly').addEventListener('click', () => {
      const week = taskRewardState(save, Date.now()).week;
      if (week && !saving && !serviceBusy) {
        const origin = $('#daily-tasks-weekly').getBoundingClientRect(), previousSave = save;
        void write(next => claimTaskMilestone(next, week.startUtc, 'week')).then(granted => {
          if (granted) presentRewardDeltas('#daily-tasks-dialog', origin, previousSave);
        }).catch(() => message('Не удалось сохранить награду.', true));
      }
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
        void write(next => revealPicturePart(next, part)).then(opened => {
          if (!casual || !opened || reducedMotion() || !$<HTMLDialogElement>('#picture-dialog').open) return;
          animateActionFeedback(button, 'album-reveal', [
            { background: '#eecf83', opacity: 1 },
            { background: '#f5e3a6', opacity: .3, transform: 'scale(.9)', offset: .66 },
            { background: 'transparent', opacity: 1, transform: 'none' },
          ], 370);
        }).catch(() => message('Не удалось сохранить фрагмент.', true));
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
      const origin = $('#picture-claim').getBoundingClientRect(), previousSave = save;
      void write(next => claimPicture(next, Date.now()))
        .then(granted => { if (granted) presentRewardDeltas('#picture-dialog', origin, previousSave); })
        .catch(() => message('Не удалось сохранить награду.', true));
    }, domOptions);
  }
  if (rewardOffersEnabled) {
    const select = $<HTMLSelectElement>('#win-video-kind');
    for (const [kind, label] of Object.entries(offerLabels)) select.add(new Option(label, kind));
    select.addEventListener('change', renderRewardOffers, domOptions);
    $('#win-video-claim').addEventListener('click', () => {
      const kind = integratedOffers ? selectedWinMultiplier(save, deal) : select.value as WinOffer;
      if (kind) void requestRewardOffer(kind, '#result');
    }, domOptions);
    $('#shop-free-claim').addEventListener('click', async () => {
      if (!integratedOffers || saving || serviceBusy) return;
      const origin = $('#shop-free-claim').getBoundingClientRect();
      try {
        const claimed = await write(next => {
          const before = next.profile.coins;
          if (!claimShopCoins(next, deal, Date.now(), casual)) return false;
          logTaskAction(next, 'EarnCoins', 'wallet', next.profile.coins - before);
          return true;
        });
        if (casual && claimed) playPrizeFlight(origin, $('#wallet-open'), prizeIcon('Coins'));
      }
      catch { message('Не удалось сохранить выдачу монет.', true); }
    }, domOptions);
    $('#shop-video-claim').addEventListener('click', () => { void requestRewardOffer('shop-free-coins', casual ? '#coins-dialog' : '#helpers'); }, domOptions);
    $('#theme-video-claim').addEventListener('click', () => { void requestRewardOffer('rewarded-theme', '#appearance'); }, domOptions);
    $('#definition-refill').addEventListener('click', () => {
      if (!productOfferEnabled || saving || serviceBusy || definitionCount(save) !== 0) return;
      offerFact({ trigger: OfferTrigger.OutOfBooster, booster: 'definition', resource: 'definition', key: 'definition-empty' });
      openHelpers(undefined, false, 'definition');
    }, domOptions);
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
          button.textContent = `Связанное слово · ${definitionCount(save)}`;
          button.disabled = definitionCount(save) === 0;
          $('#definition-refill').hidden = !productOfferEnabled || !button.disabled || Boolean(save.attempt.daily);
        }
      } catch { message('Не удалось сохранить расход заряда.', true); }
    }, domOptions);
  }
  $('#result-home').addEventListener('click', goHome, domOptions);
  $('#levels-open').addEventListener('click', async () => {
    if (!casual) { goHome(); return; }
    if (screen !== 'game' || saving || serviceBusy || store.needsRecovery) return;
    const level = deal.campaignLevel;
    serviceBusy = true;
    goHome();
    try { await showTransitionAd(level, 'menu'); }
    finally { serviceBusy = false; if (alive) renderHome(); }
  }, domOptions);
  $('#switch-confirm').addEventListener('click', () => {
    const level = requestedLevel, exact = requestedSourceDeal;
    requestedLevel = undefined; requestedSourceDeal = undefined;
    if (level) void openLevel(level, true, !exact, undefined, exact);
  }, domOptions);
  $('#menu').addEventListener('click', () => { $<HTMLDetailsElement>('#pause-options').open = screen === 'home'; openDialog('#settings'); }, domOptions);
  $('#pause-options').addEventListener('toggle', () => { const expanded = $<HTMLDetailsElement>('#pause-options').open;
    $('#pause-options summary').textContent = expanded && screen === 'game' ? 'Назад' : 'Настройки';
    $('#pause-title').textContent = expanded ? 'Настройки' : screen === 'home' ? 'Настройки' : 'Пауза';
  }, domOptions);
  $('#joker').addEventListener('click', () => {
    if (deal.training !== 'joker' && deal.campaignLevel !== undefined && !seenTutorial(save,'joker-used') && !seenTutorial(save,'intro:joker') && maybeIntroduceRule('joker')) return;
    if (!save.profile.jokers && !freeJokerPractice(save, deal)) { openHelpers('joker'); return; }
    const active = $('#joker').getAttribute('aria-pressed') !== 'true'; setInspect(false); scene?.setJoker(active, currentLesson()?.jokerColumn); renderHud();
    message('');
  }, domOptions);
  $('#buy-joker').addEventListener('click', async () => {
    if (serviceBusy || saving || !helperUnlocked(save, 'joker', deal)) return;
    try {
      if (await write(next => buyTaskHelper(next, 'joker'))) {
        telemetry.track('helper_purchase', { helper: 'joker', cost: BALANCE.helperPrices.joker });
        helperBought('joker');
      } else if (save.profile.coins < BALANCE.helperPrices.joker) {
        offerFact({ trigger: OfferTrigger.OutOfCoins, resource: 'joker', key: `short-joker-${save.profile.coins}` });
      }
    }
    catch { message('Не удалось сохранить покупку. Попробуйте ещё раз.', true); }
    renderHud();
  }, domOptions);
  $('#undo').addEventListener('click', () => { if (!save.profile.undos && !freeUndoPractice(save, deal)) openHelpers('undo'); else void execute({ type: 'undo' }); }, domOptions);
  $('#inspect').addEventListener('click', () => { setInspect(!inspectMode); if (!inspectMode) showGuidance(); }, domOptions);
  function requestRestart(confirm = false) {
    localeRestartAttempt = undefined;
    const hasBonus = bonusKinds.some(kind => pilesFor(save.attempt.board, kind).length > pilesFor(deal.initial, kind).length);
    const changedLayout = quoteLayoutRetry(save);
    if (save.attempt.board.phase !== 'won' && (confirm || save.attempt.telemetry?.started || hasBonus || changedLayout)) {
      const start = changedLayout ? 'Начнётся новый расклад этого уровня.' : 'Карты вернутся на исходные места.';
      $('#restart-confirm-copy').textContent = `${start} Потраченные помощники не восстановятся.${hasBonus ? ' Дополнительные места закроются.' : ''}${save.attempt.daily ? '' : stagedStreak(save) ? save.attempt.board.phase === 'exhausted' && streakStatus(save).progress ? ' Текущая ступень серии обнулится. Готовые награды сохранятся.' : '' : ' Текущие отметки пяти побед сбросятся.'}${boardRules(save.attempt.board) < boardRules(deal.initial) ? ' В новой партии тему сначала нужно перенести в верхний слот.' : ''}`;
      openDialog('#restart-confirm');
    }
    else void replay();
  }
  $('#restart').addEventListener('click', () => requestRestart(), domOptions);
  $('#dead-end-restart').addEventListener('click', () => requestRestart(true), domOptions);
  for (const [action, button] of [['undo', 'undo'], ['joker', 'joker'], ['restore', 'stock-recovery-button'],
    ['shuffle', 'proof-shuffle'], ['foundation', 'bonus-foundation'], ['tableau', 'bonus-tableau']]) {
    $(`#dead-end-${action}`).addEventListener('click', () => {
      if (!$(`#dead-end-${action}`).hidden && !$('#dead-end').hidden) $<HTMLButtonElement>(`#${button}`).click();
    }, domOptions);
  }
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
    try {
      transitionPresentation = {};
      await write(next => {
        if (next.attempt.id !== expected || next.attempt.dealId !== oldDeal.id) return false;
        const selected = localizedCampaignDeal(next, target);
        if (selected.id === oldDeal.id) return false;
        beginDeal(next, selected, crypto.randomUUID(), oldDeal);
        return true;
      });
    } catch { message('Не удалось сохранить новую раздачу.', true); }
    finally {
      if (!store.needsRecovery) transitionPresentation = undefined;
      serviceBusy = false;
      if (ready) runtime.activity.setBlocked('level-transition', false);
    }
  }, domOptions);
  $('#replace-daily-yes').addEventListener('click', () => { void activateMode('daily', false, true); }, domOptions);
  $('#replay').addEventListener('click', () => { void replay(); }, domOptions);
  async function startLayoutRetry(quote: NonNullable<ReturnType<typeof quoteAdaptiveRetry>>, ordinary: boolean) {
    if (!alive || !ready || saving || serviceBusy || store.needsRecovery) return;
    serviceBusy = true; closeDialogs(); runtime.activity.setBlocked('level-transition', true);
    try {
      transitionPresentation = {};
      const status = await write(next => commitAdaptiveRetry(next, quote, crypto.randomUUID(), Date.now(), ordinary ? quoteLayoutRetry : quoteAdaptiveRetry));
      if (status === 'started') {
        clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined;
        clearTimeout(outcomeTimer); clearTimeout(guideTimer); activeHint = undefined; setInspect(false);
        telemetry.track('level_restart');
        offerFact({ trigger: OfferTrigger.LevelStarted, key: 'start' });
      } else if (status === 'lives') {
        blockedLifeLevel = ordinary ? undefined : quote.level; retryLifeRestart = ordinary; openLives();
      } else if (save.attempt.board.phase === 'playing') showGame();
      else outcome();
    } catch {
      if (save.attempt.board.phase === 'playing') {
        showGame(); message('Не удалось сохранить новый расклад. Попробуйте ещё раз.', true); return;
      }
      outcome();
      $('#result-continue-error').textContent = store.needsRecovery ? 'Проверьте, сохранилась ли новая попытка.' : 'Не удалось сохранить новую попытку. Попробуйте ещё раз.';
      $('#result-continue-error').hidden = false;
    } finally {
      if (!store.needsRecovery) transitionPresentation = undefined;
      serviceBusy = false;
      if (ready) runtime.activity.setBlocked('level-transition', false);
      if (alive) { renderHud(); renderHome(); }
    }
  }
  $('#result-new-attempt').addEventListener('click', () => {
    const quote = quoteAdaptiveRetry(save);
    if (quote) void startLayoutRetry(quote, false);
  }, domOptions);
  $('#result-redeal').addEventListener('click', () => {
    if (casual) { void replay(true); return; }
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
    if (save.profile.hints === 0 && !freeHintDemo(save, deal) && !repeat) {
      offerFact({ trigger: OfferTrigger.OutOfBooster, booster: 'hint', resource: 'hint', key: 'hint-empty' });
      openHelpers('hint'); return;
    }
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
  $('#helpers-open').addEventListener('click', () => {
    runtime.pulse('button'); offerFact({ trigger: OfferTrigger.Manual, key: 'manual-wallet' }); openHelpers(undefined, true);
  }, domOptions);
  $('#proof-shuffle').addEventListener('click', () => {
    if (!canShuffle(save, deal) || saving || serviceBusy) return;
    if (deal.shufflePolicy) openDialog('#shuffle-warning');
    else void requestShuffle();
  }, domOptions);
  $('#shuffle-confirm').addEventListener('click', () => {
    if (!deal.shufflePolicy || !$<HTMLDialogElement>('#shuffle-warning').open) return;
    closeDialogs();
    void requestShuffle();
  }, domOptions);
  async function requestShuffle() {
    if (!ready || saving || serviceBusy || screen !== 'game' || runtime.activity.isBlocked() || !canShuffle(save, deal)) return;
    const preset = releaseProfile && !seenTutorial(save, lessonMarker('shuffle-used'))
      ? openingShuffleProof(save.attempt.board, deal) : undefined;
    const request: ShuffleRequest = {
      attemptId: save.attempt.id, dealId: deal.id, revision: save.revision, board: save.attempt.board, deal,
      seed: preset?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0],
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
        if (accepted) {
          logTaskAction(next, 'UseShuffles', 'helper');
          if (releaseProfile) {
            markTutorial(next, lessonMarker('shuffle-used'));
            if (preset) recordTeachingAction(next, deal, true, false);
          }
        }
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
  }
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
        if (!bought && save.profile.coins < BALANCE.helperPrices[helper])
          offerFact({ trigger: OfferTrigger.OutOfCoins, resource: helper, key: `short-${helper}-${save.profile.coins}` });
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
    const legacy = legacyLiveOpsRewards(save);
    $('#campaign-liveops-open').hidden = !LIVEOPS_PREVIEW && !legacy.length;
    const eventEntry = $('#campaign-liveops-open');
    eventEntry.textContent = LIVEOPS_PREVIEW ? 'События кампании' : 'Награды прошлых событий · ' + legacy.length;
    if (casual) {
      eventEntry.setAttribute('aria-label', eventEntry.textContent);
      eventEntry.replaceChildren(casualIcon('medal'), document.createTextNode('События · ' + legacy.length));
    }
    if (casual) {
      home.replaceChildren(casualIcon('heart'), Object.assign(document.createElement('strong'), { textContent: String(count) }),
        Object.assign(document.createElement('span'), { textContent: '+' }));
      home.setAttribute('aria-label', `Жизни: ${count} из ${LIVES_RULES.max}. Пополнить`);
    } else home.textContent = `Жизни · ${count} из ${LIVES_RULES.max}`;
    $('#campaign-lives-status').textContent = count ? `Жизни · ${count} из ${LIVES_RULES.max}` : 'Для новой партии нужна жизнь.';
    const seconds = data?.refillAt !== undefined ? Math.max(0, Math.ceil((data.refillAt - Date.now()) / 1000)) : undefined;
    showCountdown($('#campaign-lives-timer'), data?.refillAt, 'Следующая жизнь');
    if (casual) {
      const secondsText = seconds === undefined ? '' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      if (secondsText) home.append(Object.assign(document.createElement('small'), { textContent: secondsText }));
      $('#campaign-lives-timer').hidden = seconds === undefined;
      $('#campaign-lives-status').replaceChildren(...Array.from({ length: LIVES_RULES.max }, (_, index) =>
        casualIcon('heart', index < count ? 'life-pip' : 'life-pip spent')));
      $('#campaign-lives-status').setAttribute('aria-label', count ? `Жизни: ${count} из ${LIVES_RULES.max}` : 'Для новой партии нужна жизнь');
      $('#campaign-lives-title').textContent = 'Жизни';
      $('#campaign-life-coin').replaceChildren(document.createTextNode('+1 жизнь · '), casualIcon('coin'), document.createTextNode(String(LIVES_RULES.coinPrice)));
      $('#campaign-life-coin').setAttribute('aria-label', '+1 жизнь за ' + LIVES_RULES.coinPrice + ' монет');
      $('#campaign-life-video').replaceChildren(videoGlyph(), document.createTextNode(' +1 жизнь'));
      $('#campaign-life-video').setAttribute('aria-label', 'Реклама: +1 жизнь');
    }

    $<HTMLButtonElement>('#campaign-life-coin').disabled = saving || serviceBusy || count >= LIVES_RULES.max || save.profile.coins < LIVES_RULES.coinPrice;
    const credit = $<HTMLButtonElement>('#campaign-life-credit');
    credit.hidden = !data?.earnedCredits;
    credit.disabled = count >= LIVES_RULES.max || saving || serviceBusy;
    $<HTMLButtonElement>('#campaign-life-video').disabled = !livesVideoApproved() || !ads.status.rewarded || count >= LIVES_RULES.max ||
      Boolean(data?.pending) || saving || serviceBusy || Boolean(save.attempt.daily);
    $('#campaign-life-recovery').hidden = !data?.pending;
    $('#campaign-life-retry').hidden = !count || (!retryLifeRestart && blockedLifeLevel === undefined);
  }
  function openLives() {
    if (!LIVES_PREVIEW) return;
    renderLives(); openDialog('#campaign-lives');
    if (save.campaignLives?.pending && !lifeVideoInFlight) void ads.recover();
  }
  const recoveryHudTick = LIVES_PREVIEW || RECOVERY_GAMEPLAY ? setInterval(() => {
    if (!alive) return;
    if (screen === 'game' && save.attempt.unlimited && !save.attempt.unlimited.expired) renderUnlimitedTime();
    if (!LIVES_PREVIEW) return;
    const at = save.campaignLives?.refillAt;
    if (!saving && at !== undefined && Date.now() >= at) {
      void write(next => refreshCampaignLives(next, Date.now())).catch(() => undefined);
    } else if (casual && screen === 'home' || $<HTMLDialogElement>('#campaign-lives').open) renderLives();
  }, 1000) : undefined;
  $('#campaign-lives-open').addEventListener('click', openLives, domOptions);
  for (const [selector, method] of [['#campaign-life-coin', 'coins'], ['#campaign-life-credit', 'credit']] as const) {
    $(selector).addEventListener('click', async () => {
      if (!LIVES_PREVIEW || saving || serviceBusy) return;
      const revision = save.revision, origin = $(selector).getBoundingClientRect();
      try {
        const refilled = await write(next => refillCampaignLife(next, { revision, method, now: Date.now() }));
        renderLives();
        if (casual && refilled) {
          const heart = [...$('#campaign-lives-status').querySelectorAll<HTMLElement>('.life-pip:not(.spent)')].at(-1);
          if (heart) playPrizeFlight(origin, heart, casualIcon('heart'));
        }
      }
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
    serviceBusy = true; lifeVideoInFlight = id;
    try {
      if (!await write(next => authorizeLifeVideo(next, Date.now(), id, livesVideoApproved()))) return;
      closeDialogs();
      await ads.show({ kind: 'rewarded', mode: 'campaign', placement: 'life-refill', attempt: id, dealId: source });
      await ads.recover();
    } catch { message('Не удалось подтвердить восстановление жизни.', true); }
    finally {
      lifeVideoInFlight = undefined;
      if (save.campaignLives?.pending?.id === id) await ads.recover();
      serviceBusy = false; if (alive) openLives();
    }
  }, domOptions);
  function eventRewardLabel(reward: EventReward) {
    return (['coins', 'hints', 'undos', 'jokers'] as const).filter(key => (reward[key] ?? 0) > 0)
      .map(key => '+' + reward[key] + ' ' + ({ coins: 'монет', hints: 'подсказок', undos: 'отмен', jokers: 'Джокеров' }[key])).join(' · ');
  }
  function paintLiveOps() {
    if (!LIVEOPS_PREVIEW) {
      const rewards = legacyLiveOpsRewards(save);
      $('#campaign-liveops-list').replaceChildren(...rewards.map(reward => {
        const row = document.createElement('section'), title = document.createElement('h3'), detail = document.createElement('p'), claim = document.createElement('button');
        row.className = 'helper-offer'; row.dataset.event = reward.source;
        title.textContent = reward.title;
        detail.textContent = 'Награда сохранена · ' + reward.progress + '/' + reward.threshold;
        claim.type = 'button'; claim.className = 'secondary'; claim.dataset.claim = reward.id; claim.dataset.eventKey = reward.eventKey;
        claim.textContent = 'Забрать ' + eventRewardLabel(reward.reward);
        claim.disabled = saving || serviceBusy || store.needsRecovery;
        row.append(title, detail, claim); return row;
      }));
      if (!rewards.length) $('#campaign-liveops-list').textContent = 'Все сохранённые награды получены.';
      return;
    }
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
        claim.textContent = 'Забрать ' + eventRewardLabel(target.reward); row.append(claim);
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
    if (!LIVEOPS_PREVIEW && !legacyLiveOpsRewards(save).length) return;
    if (LIVEOPS_PREVIEW) prewarmLiveOps();
    paintLiveOps(); openDialog('#campaign-liveops');
  }, domOptions);
  $('#campaign-liveops-list').addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button?.dataset.claim || !button.dataset.eventKey || saving || serviceBusy) return;
    const { claim, eventKey: key } = button.dataset;
    const origin = button.getBoundingClientRect(), previousSave = save;
    try {
      const granted = await write(next => LIVEOPS_PREVIEW ? claimMilestone(next, key, claim) : claimLegacyLiveOpsReward(next, key, claim));
      paintLiveOps();
      if (granted) presentRewardDeltas('#campaign-liveops', origin, previousSave);
    }
    catch { message('Не удалось сохранить награду события.', true); }
  }, domOptions);
  function renderCampaignShop() {
    const layout = storefrontView(save, Date.now(), storefront.accountId, storefront.context);
    const list = $('#campaign-shop-catalog');
    list.replaceChildren();
    $('#campaign-shop-status').textContent = STOREFRONT_PREVIEW && !storefront.accountId ? 'Покупки пока недоступны.' : '';
    $('#campaign-shop-restore').hidden = !STOREFRONT_PREVIEW;
    $<HTMLButtonElement>('#campaign-shop-restore').disabled = !storefront.accountId;
    const addClaim = (parent: HTMLElement, track: 'free'|'premium'|'piggy', label: string, enabled: boolean) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'secondary'; button.textContent = label;
      button.disabled = !enabled; button.dataset.claim = track;
      parent.append(button);
    };
    for (const offer of layout.offers) {
      if (!STOREFRONT_PREVIEW && offer.sourceId !== 'azur-play-pass') continue;
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
        if (STOREFRONT_PREVIEW) addClaim(group, 'premium', 'Забрать премиальную награду', ready && !layout.data?.premiumClaimed && layout.active.some(x => x.good.type === 'pass'));
      }
      if (offer.sourceId === 'unico-vip' && layout.active.some(x => x.good.type === 'vip')) {
        const state = document.createElement('p');
        state.textContent = 'VIP активен'; group.append(state);
      }
      if (!STOREFRONT_PREVIEW) { list.append(group); continue; }
      const products = offer.sourceId === 'hitapps-piggy-bank' ? [CAMPAIGN_PRODUCTS[0]] :
        offer.sourceId === 'unico-vip' ? [CAMPAIGN_PRODUCTS[1]] : offer.products;
      for (const product of products) {
        const binding = storefront.bindingFor(product.sku), item = document.createElement('button');
        item.className = 'secondary'; item.type = 'button'; item.dataset.sku = product.sku;
        item.disabled = !binding || (!offer.eligible && offer.sourceId !== 'unico-vip' && offer.sourceId !== 'hitapps-piggy-bank') ||
          (product.benefits.some(good => good.type === 'unlimited') &&
            !(recoveryEnabled() && deal.recovery && save.attempt.board.phase === 'playing')) ||
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
  if (OFFER_CAMPAIGNS_PREVIEW) mountOfferCampaignPreview(store, openDialog, () => deal.campaignLevel ?? 0, domOptions.signal);
  $('#campaign-store-open').addEventListener('click', async () => {
    if (!STOREFRONT_PREVIEW || saving || serviceBusy) return;
    openChildDialog('#campaign-store', '#helpers', $('#campaign-store-open'));
    renderCampaignShop();
    if (STOREFRONT_PREVIEW) await storefront.refresh().catch(() => undefined);
    if ($<HTMLDialogElement>('#campaign-store').open) renderCampaignShop();
  }, domOptions);
  $('#campaign-shop-catalog').addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled || saving || serviceBusy || !STOREFRONT_PREVIEW) return;
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
    if (!coffeePreview() || saving || serviceBusy) return;
    $('#coffee-copy').textContent = campaignAdsApproved() ? 'Добровольное видео. После просмотра получите 10 монет.' : 'Показы для кофе-паузы ждут проверки рекламного SDK.';
    $<HTMLButtonElement>('#coffee-watch').disabled = !campaignAdsApproved() || !ads.status.rewarded || Boolean(save.attempt.coffeeRequested);
    openDialog('#coffee-break');
  }, domOptions);
  $('#coffee-watch').addEventListener('click', async () => {
    if (!coffeePreview() || !campaignAdsApproved() || !ads.status.rewarded || saving || serviceBusy) return;
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
  async function restoreStock() {
    if (!recoveryEnabled() || saving || serviceBusy || store.needsRecovery || recoveryClockBlocked()) return;
    const source = deal, cost = restoreQuote(save.attempt, source);
    if (cost === undefined) return;
    const quote = { attemptId: save.attempt.id, revision: save.revision, cost };
    try {
      if (await write(next => restoreCampaignStock(next, source, quote))) {
        closeDialogs(); scene?.sync();
        if (save.attempt.board.phase === 'exhausted') outcome();
      }
    } catch { message('Не удалось сохранить восстановление колоды.', true); }
  }
  for (const selector of ['#restore-stock', '#stock-recovery-button']) {
    $(selector).addEventListener('click', () => { void restoreStock(); }, domOptions);
  }
  $('#unlimited-preview').addEventListener('click', async () => {
    if (!recoveryEnabled() || !supportsUnlimited(deal) || saving || serviceBusy) return;
    const source = deal, attemptId = save.attempt.id, accountId = unlimitedAccount();
    unlimitedError = undefined; serviceBusy = true; renderHud();
    try {
      const reading = await recoveryTime.acquire();
      if (!reading) { unlimitedError = { attemptId, text: 'Не удалось проверить время. Монеты не списаны, заряд сохранён. Попробуйте ещё раз.' }; return; }
      const now = Date.now();
      if (!alive || save.attempt.id !== attemptId || deal.id !== source.id) return;
      const purchase = quotePurchasedUnlimited(save, source, accountId, now);
      const earned = quoteUnlimitedAccess(save, source, now, reading);
      const buy = canBuyUnlimitedAccess(save, source);
      if (!purchase && !earned && !buy && !RECOVERY_PREVIEW) return;
      const id = crypto.randomUUID();
      const applied = await write(next => {
        const at = Date.now(), currentClock = recoveryTime.read();
        if (next.attempt.id !== attemptId || next.attempt.dealId !== source.id) return false;
        expireRecovery(next);
        const applied = earned ? useUnlimitedAccess(next, source, earned.id, at, currentClock) : purchase
          ? usePurchasedUnlimited(next, source, { ...purchase, id }, accountId, at, currentClock)
          : buy ? buyUnlimitedAccess(next, source, id, at, currentClock)
            : beginUnlimited(next, source, { id, attemptId, until: at + 120_000 }, at, currentClock);
        if (applied) expireRecovery(next);
        return applied;
      });
      if (applied) { closeDialogs(); scene?.sync(); }
    } catch { unlimitedError = { attemptId, text: 'Не удалось сохранить ходы без лимита. Проверьте сохранение перед повтором.' }; }
    finally { serviceBusy = false; if (alive) { scheduleRecoveryClock(); renderHud(); } }
  }, domOptions);
  function canRequestRandomJoker() {
    return !recoveryClockBlocked() && (RANDOM_JOKER_PREVIEW || deal.randomJokerPreview === 1) &&
      randomJokerReady(save, deal);
  }
  function recoveryEnabled() {
    return RECOVERY_GAMEPLAY || Boolean(deal.recovery);
  }
  function unlimitedAccount() {
    if (STOREFRONT_PREVIEW) return storefront.accountId;
    return (releaseProfile?.capabilities.earnedUnlimited === 'active' || deal.recovery) ? save.commerceAccount ?? '' : '';
  }
  let randomJokerIntent: { attemptId: string; dealId: string; buy: boolean; cost?: number } | undefined;
  $('#random-joker-open').addEventListener('click', () => {
    if (saving || serviceBusy || recoveryClockBlocked()) return;
    const buy = !canRequestRandomJoker(), cost = deal.extraHelpers?.randomJokerCoins;
    if (buy && (cost === undefined || randomJokerCount(save) > 0 || !allowsRandomJoker(save.attempt, deal))) return;
    randomJokerIntent = { attemptId: save.attempt.id, dealId: deal.id, buy, cost };
    $('#random-joker-copy').textContent = buy
      ? 'Отдельный заряд стоит ' + cost + ' монет и применяется на уровне 16. До применения он сохраняется после перезапуска и смены уровня. Ручные Джокеры остаются в отдельном запасе. Размещение — отдельное действие.'
      : 'Джокер попадёт в случайный подходящий столбец. Успешное размещение потратит заряд и очистит историю отмен. Если путь к победе не подтверждён, заряд сохранится.';
    $('#random-joker-confirm').textContent = buy ? 'Купить заряд · ' + cost + ' монет' : deal.randomJokerCost ? 'Потратить 1 Джокера' : 'Разместить';
    openDialog('#random-joker-warning');
  }, domOptions);
  $('#random-joker-confirm').addEventListener('click', async () => {
    const intent = randomJokerIntent;
    if (!intent || saving || serviceBusy || recoveryClockBlocked() || !$<HTMLDialogElement>('#random-joker-warning').open ||
        intent.attemptId !== save.attempt.id || intent.dealId !== deal.id) return;
    const source = deal, attemptId = save.attempt.id, revision = save.revision;
    if (intent.buy) {
      try {
        if (await write(next => next.attempt.id === attemptId && next.attempt.dealId === source.id &&
            source.extraHelpers?.randomJokerCoins === intent.cost && buyRandomJokerAccess(next, source, crypto.randomUUID(), Date.now()))) {
          randomJokerIntent = undefined; closeDialogs();
          message('Заряд сохранён в запасе. Примените его на уровне 16, когда понадобится.');
        }
      } catch { message('Не удалось сохранить заряд.', true); }
      return;
    }
    if (!canRequestRandomJoker()) return;
    const id = 'azj-' + crypto.randomUUID();
    const candidate = placeRandomJoker(save.attempt, source, randomJokerColumn, () => id);
    const path = candidate && proveRandomJoker(candidate, source, performance.now() + 220);
    if (!candidate?.joker || !path) {
      randomJokerIntent = undefined; closeDialogs();
      message('В этом столбце нет проверенного продолжения. Джокер сохранён.', true);
      return;
    }
    try {
      const column = candidate.joker.column;
      if (await write(next => {
        const applied = settleRandomJoker(next, source, { attemptId, revision, column, id, path });
        if (applied) logTaskAction(next, 'UseJokers', 'helper');
        return applied;
      })) {
        randomJokerIntent = undefined; closeDialogs(); scene?.sync();
      }
    } catch { message('Проверьте сохранение перед повторной попыткой.', true); }
  }, domOptions);
  $('#result-continue').addEventListener('click', async () => {
    const button = $<HTMLButtonElement>('#result-continue');
    if (button.hidden || button.disabled || serviceBusy || saving) return;
    const proof = continueCheck.proof;
    if (!casual && requiresContinueProof(save.attempt) && (!proof || !verifiesContinue(save.attempt, proof))) return;
    if (casual ? hasVideoContinueCredit(save) : (save.platform?.continueCredits ?? 0) > 0) {
      const source = deal;
      await continueFromResult(next => logTaskContinue(next, casual ? useVideoContinue(next, source) : useContinue(next, proof)));
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
      if (ready && save.attempt.board.phase === 'playing') {
        closeDialogs(); scene?.sync(); telemetry.sync();
      }
      error.hidden = true;
    } catch { error.textContent = 'Пока не удалось проверить сохранение.'; error.hidden = false; }
  }, domOptions);
  $('#save-retry').addEventListener('click', async () => {
    try {
      await write(() => undefined);
      if (ready) { scene?.sync(); message('Сохранение проверено. Можно продолжать.'); }
    }
    catch { message('Пока не удалось проверить сохранение. Попробуйте ещё раз.', true); }
    renderHud();
  }, domOptions);
  function refreshTimedContent() {
    if (!alive || !ready) return;
    const now = Date.now();
    if (dailyBonusEnabled && !saving && !serviceBusy && dailyTasksAvailable(save) && shouldScheduleTasks(save, now))
      void write(next => syncRetention(next, now)).catch(() => undefined);
    renderHome();
    if (dailyBonusEnabled) renderDailyBonus();
    if (TASKS_PREVIEW) renderTasks();
    if (rewardOffersEnabled) renderRewardOffers();
    if (productOfferEnabled) renderProductContext();
    if (screen === 'game' && save.attempt.daily) renderHud();
  }
  const dayRefresh = setInterval(refreshTimedContent, 30000);
  let mostRecentCountdown = 0;
  const countdownTick = setInterval(() => {
    if (!alive || document.hidden) return;
    const now = Date.now();
    for (const element of document.querySelectorAll<HTMLElement>('dialog[open] [data-countdown-at]:not([hidden])')) {
      renderCountdown(element, now);
      const end = Number(element.dataset.countdownAt);
      if (end <= now && end > mostRecentCountdown) {
        mostRecentCountdown = end;
        refreshTimedContent();
      }
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTimedContent(); }, domOptions);
  const checkpoint = setInterval(() => {
    if (!alive || saving || pauseOpportunity || workerDeadline || store.needsRecovery || !save.attempt.telemetry?.started) return;
    const activeMs = telemetry.activeMs();
    if (activeMs - save.attempt.telemetry.activeMs < 1000) return;
    void store.mutate(next => { if (next.attempt.telemetry) next.attempt.telemetry.activeMs = activeMs; }).catch(() => undefined);
  }, 5000);
  const removeTouch = installTouchActivation($('#dock'), { resolveButton: target => target instanceof Element ? target.closest('button') : null });
  const removeBonusTouch = installTouchActivation($('#game'), {
    resolveButton: target => target instanceof Element ? target.closest<HTMLButtonElement>('.board-bonus') : null,
  });
  renderHud(); renderHome();
  offerFact({ trigger: OfferTrigger.SessionStarted, key: 'session' });
  const cleanup = () => {
    if (!alive) return; clearPraise(); clearActionFeedback(); alive = false; clearTimeout(workerDeadline); clearTimeout(outcomeTimer); clearTimeout(messageTimer);
    cancelPause('dispose'); clearTimeout(overlayExit);
    telemetry.track('session_end'); cancelAnimationFrame(deadEndPaint); clearInterval(checkpoint); clearInterval(dayRefresh); clearInterval(countdownTick); clearInterval(recoveryHudTick); clearTimeout(guideTimer); clearTimeout(adBreakTimer); clearTimeout(recoveryClock); removeForeground?.(); banner?.destroy(); ads.destroy(); telemetry.destroy();
    finishRewardClaim();
    abort.abort(); removeTouch(); removeBonusTouch(); wallet?.dispose();
    clearTimeout(themeExpiry); worker?.terminate(); cancelShuffle?.(); continueCheck.clear(); resize.disconnect(); resultResize.disconnect(); unblock(); runtime.destroy(); destroyRenderer(renderer);
  };
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); }, domOptions);
  window.addEventListener('pageshow', () => { if (alive) renderer.loop.wake(); }, domOptions);
  import.meta.hot?.dispose(cleanup);
} catch (error) {
  runtime.destroy(); game && destroyRenderer(game);
  showStartupFailure(error);
}

}
void start();
