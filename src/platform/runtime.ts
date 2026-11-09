import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { GameplayActivityCoordinator, installDocumentVisibilityBlocker } from '@danilah/mini-games-kit/platform';
import { OneShotPlayer } from '@danilah/mini-games-kit/audio';
import { assertBoard } from '../domain/engine';
import { BALANCE_VERSION, CONTENT_VERSION, RULES_VERSION } from '../domain/types';
import type { Deal, Save } from '../domain/types';

const SAVE_KEY = 'asoc-solitaire.save.v1';
export function decodeSave(raw: string, deal: Deal): Save {
  const save = JSON.parse(raw) as Save;
  if (save.schema !== 1 || save.rulesVersion !== RULES_VERSION || save.contentVersion !== CONTENT_VERSION || save.balanceVersion !== BALANCE_VERSION || save.attempt.dealId !== deal.id) throw Error('Сохранение другой версии. Исходные данные оставлены на устройстве.');
  assertBoard(save.attempt.board, deal);
  if (!Number.isInteger(save.revision) || save.revision < 0 || !save.attempt.id) throw Error('Повреждён номер сохранения');
  for (const value of [save.profile.coins, save.profile.hints, save.profile.undos, save.profile.wins, save.attempt.streak.coins]) {
    if (!Number.isInteger(value) || value < 0) throw Error('Повреждён профиль');
  }
  const streak = save.attempt.streak;
  if (!Number.isInteger(streak.tier) || streak.tier < 0 || streak.tier > 3 || !Number.isInteger(streak.progress) || streak.progress < 0 || streak.progress >= 4 + streak.tier || !Array.isArray(streak.counted)) throw Error('Повреждена серия');
  if (!Array.isArray(save.profile.rewards) || !Array.isArray(save.attempt.undo) || save.attempt.undo.length > 300) throw Error('Повреждена история');
  save.attempt.undo.forEach(board => assertBoard(board, deal));
  if (['sfx', 'haptics', 'reducedMotion'].some(key => typeof save.settings[key as keyof Save['settings']] !== 'boolean')) throw Error('Повреждены настройки');
  return save;
}
export const storage = {
  load(deal: Deal): Save | null { const raw = localStorage.getItem(SAVE_KEY); return raw === null ? null : decodeSave(raw, deal); },
  write(save: Save): void { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); },
};

/** Optional services are deliberately unavailable until real native integrations are supplied. */
export const services = {
  ads: { available: false, reason: 'Нативная реклама ещё не подключена' },
  analytics: { available: false },
  haptics: { available: false },
};

export function createRuntime(onCancel: () => void, onBack: () => void) {
  const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
  const visibility = installDocumentVisibilityBlocker(activity);
  const audio = new OneShotPlayer({
    maxVoices: 4,
    groups: { card: { minIntervalMs: 45 }, flip: { minIntervalMs: 70 }, reward: { minIntervalMs: 80 }, ui: { minIntervalMs: 40 } },
  });
  let disposed = false;
  let mute = false;
  const handles: { remove: () => Promise<void> }[] = [];
  const buffers = new Map<string, AudioBuffer>();
  const tones: Record<string, [number, number]> = { lift: [330, .035], transfer: [650, .075], flip: [420, .045], draw: [480, .055], invalid: [190, .07], complete: [880, .19], coins: [1250, .11], win: [1046, .28], undo: [370, .09], ui: [520, .04] };
  const eligibility = () => {
    const reasons = activity.getBlockReasons();
    audio.setEligibility({ gameplay: !mute && reasons.length === 0, ui: !mute && reasons.every(r => r === 'modal') });
    if (reasons.length) onCancel();
  };
  const removeBlocker = activity.onBlockReasonsChange(eligibility);
  if (Capacitor.isNativePlatform()) {
    let stateEvents = 0;
    const retain = (pending: ReturnType<typeof App.addListener>) => {
      void pending.then(handle => { if (disposed) void handle.remove(); else handles.push(handle); }).catch(console.warn);
    };
    retain(App.addListener('appStateChange', ({ isActive }) => { stateEvents++; if (!disposed) activity.setBlocked('native-background', !isActive); }));
    retain(App.addListener('backButton', () => { if (!disposed) onBack(); }));
    void App.getState().then(({ isActive }) => { if (!disposed && stateEvents === 0) activity.setBlocked('native-background', !isActive); }).catch(console.warn);
  }
  activity.setGameplayDesired(true);
  return {
    activity,
    setMute(value: boolean) { mute = value; eligibility(); },
    play(name: string) {
      const tone = tones[name] ?? tones.ui;
      const group = ['coins', 'win', 'complete'].includes(name) ? 'reward' : name === 'flip' ? 'flip' : name === 'ui' ? 'ui' : 'card';
      audio.play({ group, channel: name === 'ui' ? 'ui' : 'gameplay', gain: .32, buffer(ctx) {
        let buffer = buffers.get(name);
        if (!buffer) {
          buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * tone[1]), ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            const time = i / ctx.sampleRate;
            const attack = Math.min(1, time / .004);
            data[i] = Math.sin(time * 2 * Math.PI * tone[0]) * attack * Math.exp(-time / (tone[1] * .23)) * .5;
          }
          buffers.set(name, buffer);
        }
        return buffer;
      } });
    },
    destroy() { disposed = true; visibility(); removeBlocker(); handles.forEach(h => { void h.remove().catch(console.warn); }); audio.dispose(); activity.setGameplayDesired(false); },
  };
}
