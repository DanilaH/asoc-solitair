import { Capacitor, registerPlugin } from '@capacitor/core';
import { JsonStorageRepository, type StorageAdapter } from '@danilah/mini-games-kit/platform';
import { BALANCE } from '../domain/balance';
import { assertBoard } from '../domain/engine';
import { BALANCE_VERSION, CONTENT_VERSION, RULES_VERSION, type Deal, type Save } from '../domain/types';

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
  if (save.schema !== 1 || (!legacy && (save.rulesVersion !== RULES_VERSION || save.contentVersion !== CONTENT_VERSION || save.balanceVersion !== BALANCE_VERSION)) || save.attempt.dealId !== deal.id) throw Error('Сохранение другой версии. Исходные данные оставлены на устройстве.');
  if (legacy) { save.profile.jokers ??= BALANCE.initialJokers; save.rulesVersion = RULES_VERSION; save.contentVersion = CONTENT_VERSION; save.balanceVersion = BALANCE_VERSION; }
  assertBoard(save.attempt.board, deal);
  if (!natural(save.revision) || typeof save.attempt.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(save.attempt.id)) throw Error('Повреждён номер сохранения');
  for (const value of [save.profile.coins, save.profile.hints, save.profile.undos, save.profile.jokers, save.profile.wins, save.attempt.streak.coins]) if (!natural(value)) throw Error('Повреждён профиль');
  const streak = save.attempt.streak;
  if (!natural(streak.tier) || streak.tier > 3 || !natural(streak.progress) || streak.progress >= 4 + streak.tier || !strings(streak.counted)) throw Error('Повреждена серия');
  if (!strings(save.profile.rewards) || !Array.isArray(save.attempt.undo) || save.attempt.undo.length > 300) throw Error('Повреждена история');
  save.attempt.undo.forEach(board => assertBoard(board, deal));
  if (['sfx', 'haptics', 'reducedMotion'].some(key => typeof save.settings[key as keyof Save['settings']] !== 'boolean')) throw Error('Повреждены настройки');
  if (save.platform) {
    const p = save.platform;
    if (![p.receipts, p.continuedAttempts, p.completedCampaign].every(strings) || ![p.continueCredits, p.winsSinceInterstitial, p.lastFullscreenAt].every(natural)) throw Error('Повреждён журнал выдач');
  }
  if (save.attempt.continued !== undefined && typeof save.attempt.continued !== 'boolean') throw Error('Повреждено продолжение');
  const t = save.attempt.telemetry;
  if (t && (typeof t.started !== 'boolean' || typeof t.finished !== 'boolean' || !natural(t.activeMs))) throw Error('Повреждён счётчик времени');
  if (save.campaign && (save.campaign.version !== 1 || !strings(save.campaign.tutorials))) throw Error('Повреждено обучение');
  if (save.attempt.jokerUsed !== undefined && typeof save.attempt.jokerUsed !== 'boolean') throw Error('Повреждён Джокер');
  if ((save.attempt.board.joker || save.attempt.undo.some(board => board.joker)) && !save.attempt.jokerUsed) throw Error('Джокер без расхода');
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
  constructor(private adapter: StorageAdapter, private deal: DealSource, createDefault: () => Save) {
    this.repository = new JsonStorageRepository({ storage: adapter, key: SAVE_KEY, createDefault, codec: { decode: value => decodeSave(JSON.stringify(value), deal) } });
  }
  get state(): Save { return this.value; }
  get needsRecovery(): boolean { return Boolean(this.uncertain); }
  async open(): Promise<Save> {
    // A failed native read never becomes a fresh game. Import legacy WebView state only when native is definitely empty.
    const nativeRaw = await this.adapter.getItem(SAVE_KEY);
    const legacy = nativeRaw === null && Capacitor.isNativePlatform() ? localStorage.getItem(SAVE_KEY) : null;
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
    const pending = this.uncertain, raw = await this.adapter.getItem(SAVE_KEY);
    if (raw === pending.after) { this.value = pending.next; this.uncertain = undefined; this.onChange?.(this.value); return true; }
    if (raw === pending.before) { this.uncertain = undefined; return false; }
    throw Error('Сохранение ожидает проверки. Попробуйте ещё раз.');
  }
  flush(): Promise<unknown> { return this.tail; }
}
