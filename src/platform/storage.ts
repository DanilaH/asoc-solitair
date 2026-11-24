import { validUnlimitedAccess } from '../domain/campaign-recovery';
import { validLavaRun } from '../domain/events/campaign-liveops';
import { validCampaignLives } from '../domain/campaign-lives';
import { validStoreProgress } from '../domain/commerce/storefront';
import { validCampaignAds } from '../domain/campaign-advertising';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { JsonStorageRepository, type StorageAdapter } from '@danilah/mini-games-kit/platform';
import { dayNumber, metaState, milestoneRewards } from '../domain/meta';
import { BALANCE } from '../domain/balance';
import { validRewardOffers } from '../domain/reward-offers';
import { validOfferCampaignJournal } from '../domain/commerce/offer-campaigns';
import { validCommerceJournal } from '../domain/commerce/orders';
import { validEventLedger } from '../domain/events/ledger';
import { validPicture } from '../domain/events/picture';
import { validDailyTasks } from '../domain/events/daily-tasks';
import { applyBoard, assertBoard, boardRules } from '../domain/engine';
import { MAX_UNDO_HISTORY } from '../domain/history';
import { DIFFICULTY_WINDOW } from '../domain/difficulty';
import { BALANCE_VERSION, CONTENT_VERSION, RULES_VERSION, type CampaignOutcome, type Deal, type Save } from '../domain/types';

export const SAVE_KEY = 'asoc-solitaire.save.v1';
interface StorageBridge {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}
export function createStorage(bridge?: StorageBridge): StorageAdapter {
  if (!bridge && !Capacitor.isNativePlatform()) return {
    async getItem(key) { return localStorage.getItem(key); }, async setItem(key, value) { localStorage.setItem(key, value); }, async removeItem(key) { localStorage.removeItem(key); },
  };
  const native = bridge ?? registerPlugin<StorageBridge>('SolitaireStorage');
  return { async getItem(key) { return (await native.get({ key })).value; }, async setItem(key, value) { await native.set({ key, value }); }, async removeItem(key) { await native.remove({ key }); } };
}
const natural = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string' && s.length <= 200) && new Set(v).size === v.length;
export type DealSource = Deal | ((id: string) => Deal | undefined);
export function decodeSave(raw: string, source: DealSource): Save {
  const save = JSON.parse(raw) as Save;
  const deal = typeof source === 'function' ? source(save.attempt?.dealId) : source;
  if (!deal) throw Error('Неизвестная раздача. Сохранение оставлено без изменений.');
  const legacy = save.rulesVersion === 1 && save.balanceVersion === 1 && ((save.contentVersion === 1 && deal.id === 'intro-001') || (save.contentVersion === 2 && (deal.campaignLevel ?? 0) <= 20));
  const previous = save.rulesVersion === 2 && ((save.contentVersion === 3 && save.balanceVersion === 2) || (save.contentVersion === 4 && save.balanceVersion === 3));
  const v2 = save.rulesVersion === 2 && save.contentVersion === 5 && save.balanceVersion === BALANCE_VERSION;
  const archived = save.rulesVersion === 3 && save.contentVersion === 5 && save.balanceVersion === BALANCE_VERSION;
  const content6 = save.rulesVersion === 3 && save.contentVersion === 6 && save.balanceVersion === BALANCE_VERSION;
  const content7 = CONTENT_VERSION === 8 && save.rulesVersion === 3 && save.contentVersion === 7 && save.balanceVersion === BALANCE_VERSION;
  const attempts=[save.attempt,...Object.values(save.parked??{})];
  const prematureIdentity = attempts.some(a => a && [6, 7, 8].some(revision =>
    save.contentVersion < revision && a.dealId.startsWith(`campaign-c${revision}-`)));
  const migration = legacy || previous || v2 || archived || content6 || content7;
  if (save.schema !== 1 || (!migration && (save.rulesVersion !== RULES_VERSION || save.contentVersion !== CONTENT_VERSION || save.balanceVersion !== BALANCE_VERSION)) || save.attempt.dealId !== deal.id || prematureIdentity) throw Error('Сохранение другой версии. Исходные данные оставлены на устройстве.');
  // Tag every active/parked board before advancing the envelope. Undo may never change rules.
  const previousRules = save.rulesVersion < 3;
  for (const attempt of [save.attempt, ...Object.values(save.parked ?? {})]) {
    if (!attempt || !Array.isArray(attempt.undo)) throw Error('Повреждена история');
    const rules = attempt.board.rulesVersion ?? (previousRules ? 2 : RULES_VERSION);
    if (previousRules && rules !== 2) throw Error('Правила попытки не согласованы с сохранением');
    for (const board of [attempt.board, ...attempt.undo]) {
      board.rulesVersion ??= rules;
      if (boardRules(board) !== rules) throw Error('Отмена меняет правила попытки');
    }
  }
  if (legacy || previous) save.profile.jokers ??= BALANCE.initialJokers;
  if (migration) { save.rulesVersion = RULES_VERSION; save.contentVersion = CONTENT_VERSION; save.balanceVersion = BALANCE_VERSION; }
  assertBoard(save.attempt.board, deal);
  if (save.attempt.verifiedTaskHints !== undefined && !natural(save.attempt.verifiedTaskHints)) throw Error('Повреждён учёт подсказок');
  if (save.attempt.lessonHint !== undefined) {
    const command = save.attempt.lessonHint;
    const location = (loc: { kind: string; index: number }) => loc && ['tableau', 'foundation', 'waste'].includes(loc.kind) && natural(loc.index);
    if (deal.training !== 'hint' || !command || !(['draw', 'recycle'].includes(command.type) ||
      command.type === 'transfer' && location(command.from) && location(command.to)) ||
      typeof applyBoard(save.attempt.board, command, deal) === 'string') throw Error('Повреждена учебная подсказка');
  }
  if (!natural(save.revision) || typeof save.attempt.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(save.attempt.id)) throw Error('Повреждён номер сохранения');
  for (const value of [save.profile.coins, save.profile.hints, save.profile.undos, save.profile.jokers, save.profile.wins, save.attempt.streak.coins]) if (!natural(value)) throw Error('Повреждён профиль');
  const streak = save.attempt.streak;
  if (!natural(streak.tier) || streak.tier > 3 || !natural(streak.progress) || streak.progress >= 4 + streak.tier || !strings(streak.counted)) throw Error('Повреждена серия');
  if (!strings(save.profile.rewards) || !Array.isArray(save.attempt.undo)) throw Error('Повреждена история');
  save.attempt.undo.forEach(board => {
    assertBoard(board, deal);
    if (board.tableau.length !== save.attempt.board.tableau.length ||
      board.foundations.length !== save.attempt.board.foundations.length) throw Error('Повреждены бонусные места в истории');
  });
  // Validate the full old history before discarding only its oldest entries.
  if (['sfx', 'haptics', 'reducedMotion'].some(key => typeof save.settings[key as keyof Save['settings']] !== 'boolean')) throw Error('Повреждены настройки');
  if (save.platform) {
    const p = save.platform;
    if (![p.receipts, p.continuedAttempts, p.completedCampaign].every(strings) || ![p.continueCredits, p.winsSinceInterstitial, p.lastFullscreenAt].every(natural)) throw Error('Повреждён журнал выдач');
    const cadence = p.fullscreenCadence;
    if (cadence !== undefined && (!cadence || cadence.version !== 1 ||
      typeof cadence.lastShownId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(cadence.lastShownId) || p.lastFullscreenAt === 0)) {
      throw Error('Повреждена история показов');
    }
  }
  if (save.difficultyHistory !== undefined && (!Array.isArray(save.difficultyHistory) ||
    save.difficultyHistory.length > DIFFICULTY_WINDOW || save.difficultyHistory.some(entry =>
      !entry || !natural(entry.restarts) || !['Clean', 'ExtraSteps', 'Restart'].includes(entry.outcome) ||
      (entry.outcome === 'Restart') !== (entry.restarts > 0)))) throw Error('Повреждена история сложности');
  if (save.difficultyPenalty !== undefined && (!Number.isSafeInteger(save.difficultyPenalty) ||
    Math.abs(save.difficultyPenalty) > 100)) throw Error('Повреждён коэффициент сложности');
  const validOutcome = (entry: CampaignOutcome) => entry && natural(entry.restarts) &&
    ['Clean', 'ExtraSteps', 'Restart'].includes(entry.outcome) && (entry.restarts > 0) === (entry.outcome === 'Restart');
  const sourceHistory = save.sourceDifficultyHistory;
  if ((sourceHistory !== undefined && (!Array.isArray(sourceHistory) || sourceHistory.length > DIFFICULTY_WINDOW ||
      !sourceHistory.every(validOutcome))) || (save.attempt.sourceDifficulty !== undefined &&
      (deal.daily || deal.campaignLevel === undefined || !validOutcome(save.attempt.sourceDifficulty)))) {
    throw Error('Повреждены исходные события сложности');
  }
  if (save.sourceDifficultyPenalty !== undefined && (!sourceHistory || sourceHistory.length < DIFFICULTY_WINDOW ||
    !Number.isSafeInteger(save.sourceDifficultyPenalty) || Math.abs(save.sourceDifficultyPenalty) > 100)) {
    throw Error('Повреждён исходный коэффициент сложности');
  }
  if (save.equality !== undefined) {
    const state = save.equality;
    if (!state || state.version !== 1 || ![state.eligible, state.attempted, state.selected, state.issued, state.lost, state.completed].every(natural) ||
      state.attempted > state.eligible || state.selected > state.attempted || state.issued !== state.selected ||
      state.completed > state.issued || state.lost > state.issued || Boolean(state.last) !== (state.issued > 0)) {
      throw Error('Повреждена история выдачи особой раздачи');
    }
    const last = state.last;
    if (last !== undefined && (!last || typeof last.attemptId !== 'string' || typeof last.dealId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(last.attemptId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(last.dealId) ||
      !natural(last.dealVersion) || last.dealVersion === 0 || typeof last.policyVersion !== 'string' || !last.policyVersion ||
      (last.segment !== undefined && !['NonPayer', 'Payer', 'PotentialPayer', 'SleepPayer'].includes(last.segment)) ||
      (last.cohortEvidence !== undefined && !['controlled-fixture', 'verified-provider'].includes(last.cohortEvidence)) ||
      (last.seed !== undefined && (!Number.isSafeInteger(last.seed) || last.seed <= 0 || last.seed > 2147483647)) ||
      (last.attestation !== undefined && (typeof last.attestation !== 'string' || !/^[a-f0-9]{64}$/.test(last.attestation))) ||
      (last.providerRevision !== undefined && (last.cohortEvidence !== 'verified-provider' ||
        typeof last.providerRevision !== 'string' || !last.providerRevision)) ||
      typeof last.lost !== 'boolean' || typeof last.completed !== 'boolean' ||
      (last.attemptId === save.attempt.id && (deal.daily || last.dealId !== deal.id || last.dealVersion !== deal.version)))) {
      throw Error('Повреждена особая попытка');
    }
  }
  const issuance = save.attempt.issuance;
  if (issuance !== undefined && (!issuance || issuance.version !== 1 || deal.daily || !deal.campaignLevel ||
    issuance.dealId !== deal.id || issuance.effectiveBudget !== deal.initial.movesLeft ||
    ![issuance.profile, issuance.policy, issuance.baseId].every(value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value)) ||
    (issuance.baseBudget !== null && !natural(issuance.baseBudget)) ||
    !['unknown-cohort', 'not-eligible'].includes(issuance.equality) ||
    !['authored', 'director-r1', 'budget-r2', 'certified-seed'].includes(issuance.source) ||
    (issuance.source === 'certified-seed') !== Boolean(issuance.seed) ||
    (issuance.seed && (!natural(issuance.seed.value) || ![issuance.seed.inputHash, issuance.seed.boardHash, issuance.seed.routeHash]
      .every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)))))) throw Error('Повреждён паспорт раздачи');
  const director = save.attempt.director;
  if (director !== undefined && (!director || deal.daily || deal.campaignLevel === undefined ||
    !natural(director.restarts) || !natural(director.previousLosses) || director.previousLosses > director.restarts ||
    (director.exhausted !== undefined && director.exhausted !== true))) throw Error('Повреждён прогресс сложности');
  if (save.attempt.continued !== undefined && typeof save.attempt.continued !== 'boolean') throw Error('Повреждено продолжение');
  const t = save.attempt.telemetry;
  if (t && (typeof t.started !== 'boolean' || typeof t.finished !== 'boolean' || !natural(t.activeMs))) throw Error('Повреждён счётчик времени');
  if (save.campaign && (save.campaign.version !== 1 || !strings(save.campaign.tutorials))) throw Error('Повреждено обучение');
  if (save.attempt.jokerUsed !== undefined && typeof save.attempt.jokerUsed !== 'boolean') throw Error('Повреждён Джокер');
  if (save.attempt.shuffleUsed !== undefined && (save.attempt.shuffleUsed !== true || (deal.shufflePreview !== 1 && !deal.shufflePolicy)))
    throw Error('Повреждено перемешивание');
  const revive = save.attempt.revive;
  if (revive !== undefined && (!deal.recovery || !save.attempt.continued || !revive || revive.version !== 1 ||
      !['coins', 'earned'].includes(revive.channel) || revive.moves !== BALANCE.continueMoves ||
      revive.price !== (revive.channel === 'coins' ? BALANCE.continueCoinPrice : 0))) throw Error('Повреждено возрождение');
  const unlimited = save.attempt.unlimited;
  if (save.attempt.unlimitedAccess !== undefined && !validUnlimitedAccess(save.attempt.unlimitedAccess, save.attempt, deal))
    throw Error('Повреждено право на ходы без лимита');
  if ((save.attempt.stockRestores !== undefined && (!deal.recovery || !natural(save.attempt.stockRestores))) ||
      (unlimited !== undefined && (!deal.recovery || !unlimited || unlimited.version !== 1 ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(unlimited.id) || !natural(unlimited.issuedAt) ||
        (unlimited.until !== undefined && (!natural(unlimited.until) || unlimited.until <= unlimited.issuedAt)) ||
        (unlimited.purchaseRef !== undefined && (typeof unlimited.purchaseRef !== 'string' ||
          !unlimited.purchaseRef || unlimited.purchaseRef.length > 400 || unlimited.until === undefined)) ||
        (unlimited.expired !== undefined && (unlimited.expired !== true || unlimited.until === undefined)))) ||
      ([save.attempt.board, ...save.attempt.undo].some(board => board.retainedMoves !== undefined) && (!unlimited || unlimited.expired))) {
    throw Error('Повреждён договор восстановления');
  }
  if (save.attempt.randomJokerUsed !== undefined && (save.attempt.randomJokerUsed !== true || deal.randomJokerPreview !== 1))
    throw Error('Повреждён расход случайного Джокера');
  if ([save.attempt.board, ...save.attempt.undo].some(board => board.joker &&
      (board.joker.card ? !save.attempt.randomJokerUsed : !save.attempt.jokerUsed))) throw Error('Джокер без расхода');
  save.attempt.undo = save.attempt.undo.slice(-MAX_UNDO_HISTORY);
  if (save.attempt.daily && (save.attempt.daily.dayId !== deal.daily?.dayId || save.attempt.daily.contentVersion !== deal.daily?.contentVersion)) throw Error('Повреждена дата попытки');
  if (Boolean(save.attempt.daily) !== Boolean(deal.daily)) throw Error('Повреждён режим');
  if (save.lavaRun !== undefined && !validLavaRun(save.lavaRun)) throw Error('Повреждена серия события');
  if ((save.campaignLives !== undefined && !validCampaignLives(save.campaignLives)) ||
      (save.attempt.lostLife !== undefined && (save.attempt.lostLife !== true || deal.daily || !deal.campaignLevel ||
        !save.campaignLives))) throw Error('Повреждены жизни кампании');
  if ((save.campaignAds !== undefined && !validCampaignAds(save.campaignAds)) ||
      [save.attempt.adBreakShown, save.attempt.coffeeRequested].some(value => value !== undefined && (value !== true || deal.daily || !deal.campaignLevel)))
    throw Error('Повреждена история рекламы');
  if (save.rewardOffers !== undefined && !validRewardOffers(save.rewardOffers)) throw Error('Повреждены бонусные предложения');
  if (save.storeProgress !== undefined && !validStoreProgress(save.storeProgress)) throw Error('Повреждена история магазина');
  if (save.commerceAccount !== undefined && !/^[0-9A-Za-z_.:-]{1,128}$/.test(save.commerceAccount)) throw Error('Повреждён профиль покупок');
  if (save.offerCampaigns !== undefined && !validOfferCampaignJournal(save.offerCampaigns)) throw Error('Повреждён журнал предложений');
  if (save.commerce !== undefined && !validCommerceJournal(save.commerce)) throw Error('Повреждён журнал покупок');
  if (save.events !== undefined && !validEventLedger(save.events)) throw Error('Повреждён журнал событий');
  if (save.picture !== undefined && !validPicture(save)) throw Error('Повреждён альбом');
  if (save.dailyTasks !== undefined && !validDailyTasks(save.dailyTasks)) throw Error('Повреждён журнал задач');
  if (save.parked) {
    const active = save.attempt.daily ? 'daily' : 'campaign';
    if (save.parked[active]) throw Error('Два активных состояния режима');
    for (const [mode, attempt] of Object.entries(save.parked)) {
      if (!['daily', 'campaign'].includes(mode) || !attempt || Boolean(attempt.daily) !== (mode === 'daily') || attempt.id === save.attempt.id) throw Error('Повреждён резерв попытки');
      save.parked[mode as 'campaign'|'daily'] = decodeSave(JSON.stringify({ ...save, attempt, parked: undefined }), source).attempt;
    }
  }
  if (save.meta) {
    const m = save.meta;
    if (m.version !== 1 || !natural(m.winCycle) || m.winCycle > 4 || !natural(m.cycles) || !natural(m.dailyStreak) || !strings(m.dailyDates)) throw Error('Повреждён прогресс');
    m.dailyDates.forEach(dayNumber);
    if (m.lastDaily !== undefined && (!m.dailyDates.includes(m.lastDaily) || m.dailyStreak < 1)) throw Error('Повреждена серия дней');
  } else { metaState(save); milestoneRewards(save); }
  for (const [key, values] of Object.entries({ palette: ['green', 'ink'], cardBack: ['classic', 'diamonds'], deckSide: ['right', 'left'], deckPosition: ['top', 'bottom'], contentLanguage: ['ru', 'en'] })) {
    const value = save.settings[key as keyof Save['settings']];
    if (value !== undefined && !values.includes(String(value))) throw Error('Повреждено оформление');
  }
  const victory = save.attempt.victory;
  if (victory !== undefined && (!victory || victory.version !== 1 || deal.daily || !deal.campaignLevel ||
      save.attempt.board.phase !== 'won' || victory.rewardKey !== `win:${save.attempt.id}` ||
      typeof victory.policy !== 'string' || !victory.policy ||
      ![victory.tier, victory.tierBase, victory.movesBonus, victory.contentVersion, victory.balanceVersion].every(natural) ||
      victory.tier > 4 || !save.attempt.payout?.some(grant =>
        grant.key === victory.rewardKey && grant.reason === 'win' && grant.coins === victory.tierBase + victory.movesBonus))) {
    throw Error('Повреждена выплата победы');
  }
  if (save.attempt.payout && (!Array.isArray(save.attempt.payout) || save.attempt.payout.some(r => !strings([r.key]) || !natural(r.coins) || !['win', 'campaign_milestone', 'campaign_win_cycle', 'daily_completion', 'daily_streak_milestone', 'golden_cards'].includes(r.reason) || typeof r.label !== 'string' || r.label.length > 200 || (r.hints !== undefined && !natural(r.hints)) || (r.undos !== undefined && !natural(r.undos))))) throw Error('Повреждён результат');
  return save;
}

/** One authoritative serial writer for commands, settings, receipts and cadence.
 * No stale snapshot writes. Read back ambiguous writes before allowing later mutations.
 */
export class SaveStore {
  onChange?: (save: Save) => void;
  private tail: Promise<unknown> = Promise.resolve();
  private uncertain: { before: string; after: string; next: Save } | undefined;
  private repository: JsonStorageRepository<Save>;
  private value!: Save;
  constructor(private adapter: StorageAdapter, private deal: DealSource, createDefault: () => Save, private key = SAVE_KEY) {
    this.repository = new JsonStorageRepository({ storage: adapter, key, createDefault, codec: { decode: value => decodeSave(JSON.stringify(value), deal) } });
  }
  get state(): Save { return this.value; }
  get needsRecovery(): boolean { return Boolean(this.uncertain); }
  async open(): Promise<Save> {
    // A failed native read never becomes a fresh game. Import legacy WebView state only when native is definitely empty.
    const nativeRaw = await this.adapter.getItem(this.key);
    const legacy = this.key === SAVE_KEY && nativeRaw === null && Capacitor.isNativePlatform() ? localStorage.getItem(SAVE_KEY) : null;
    this.value = legacy === null ? await this.repository.load() : decodeSave(legacy, this.deal);
    await this.repository.write(this.value);
    return this.value;
  }
  mutate<T>(change: (next: Save) => T): Promise<T> {
    const task = this.tail.then(async () => {
      if (this.uncertain) await this.recover();
      const next = structuredClone(this.value), result = change(next);
      if (JSON.stringify(next) === JSON.stringify(this.value)) return result;
      // Changes outside the engine, e.g. telemetry markers, still get a monotonically increasing revision.
      if (next.revision <= this.value.revision) next.revision = this.value.revision + 1;
      const pending = { before: JSON.stringify(this.value), after: JSON.stringify(next), next };
      try { await this.repository.write(next); }
      catch {
        this.uncertain = pending;
        const applied = await this.recover();
        if (!applied) throw Error('Не удалось сохранить. Повторите действие.');
      }
      this.value = next; this.onChange?.(this.value); return result;
    });
    this.tail = task.catch(() => undefined); return task;
  }
  async recover(): Promise<boolean> {
    if (!this.uncertain) return true;
    const pending = this.uncertain, raw = await this.adapter.getItem(this.key);
    if (raw === pending.after) { this.value = pending.next; this.uncertain = undefined; this.onChange?.(this.value); return true; }
    if (raw === pending.before) { this.uncertain = undefined; return false; }
    throw Error('Сохранение ожидает проверки. Попробуйте ещё раз.');
  }
  flush(): Promise<unknown> { return this.tail; }
}
