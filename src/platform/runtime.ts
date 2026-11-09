import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { GameplayActivityCoordinator, installDocumentVisibilityBlocker } from '@danilah/mini-games-kit/platform';
import { OneShotPlayer } from '@danilah/mini-games-kit/audio';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { createHaptics, type HapticCue } from './haptics';
export { decodeSave } from './storage';
interface AudioBridge {
  configure(options: { enabled: boolean }): Promise<{ focused: boolean }>;
  addListener(name: 'audioFocus', cb: (event: { focused: boolean }) => void): Promise<PluginListenerHandle>;
}

export function createRuntime(onCancel: () => void, onBack: () => void) {
  if (Capacitor.isNativePlatform()) document.body.classList.add('platform-native');
  const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
  const visibility = installDocumentVisibilityBlocker(activity);
  const audio = new OneShotPlayer({
    maxVoices: 4,
    groups: { card: { minIntervalMs: 45 }, flip: { minIntervalMs: 70 }, reward: { minIntervalMs: 80 }, ui: { minIntervalMs: 40 } },
  });
  const haptics = createHaptics();
  const nativeAudio = Capacitor.isNativePlatform() ? registerPlugin<AudioBridge>('SolitaireAudio') : undefined;
  let audioFocused = !nativeAudio;
  let disposed = false;
  let mute = false;
  const handles: { remove: () => Promise<void> }[] = [];
  const buffers = new Map<string, AudioBuffer>();
  const tones: Record<string, [number, number]> = { lift: [330, .035], transfer: [650, .075], flip: [420, .045], draw: [480, .055], invalid: [190, .07], complete: [880, .19], coins: [1250, .11], win: [1046, .28], undo: [370, .09], ui: [520, .04] };
  const eligibility = () => {
    const reasons = activity.getBlockReasons();
    audio.setEligibility({ gameplay: audioFocused && !mute && reasons.length === 0, ui: audioFocused && !mute && reasons.every(r => r === 'modal') });
    haptics.setBlocked(reasons.some(reason => reason !== 'modal'));
    if (reasons.length) onCancel();
    void nativeAudio?.configure({ enabled: !mute && !reasons.some(reason => reason !== 'modal') }).then(({ focused }) => {
      if (disposed) return;
      audioFocused = focused;
      const current = activity.getBlockReasons();
      audio.setEligibility({ gameplay: focused && !mute && current.length === 0, ui: focused && !mute && current.every(r => r === 'modal') });
    }).catch(() => undefined);
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
  if (nativeAudio) void nativeAudio.addListener('audioFocus', ({ focused }) => {
    if (disposed) return;
    audioFocused = focused;
    const reasons = activity.getBlockReasons();
    audio.setEligibility({ gameplay: focused && !mute && reasons.length === 0, ui: focused && !mute && reasons.every(r => r === 'modal') });
  }).then(handle => { if (disposed) void handle.remove(); else handles.push(handle); }).catch(() => undefined);
  activity.setGameplayDesired(true);
  return {
    activity,
    setMute(value: boolean) { mute = value; eligibility(); },
    setHaptics(value: boolean) { haptics.setEnabled(value); },
    pulse(cue: HapticCue) { haptics.pulse(cue); },
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
    destroy() { disposed = true; visibility(); removeBlocker(); handles.forEach(h => { void h.remove().catch(console.warn); }); audio.dispose(); haptics.destroy(); void nativeAudio?.configure({ enabled: false }).catch(() => undefined); activity.setGameplayDesired(false); },
  };
}
