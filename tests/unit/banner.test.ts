import { afterEach, expect, it, vi } from 'vitest';
import { NativeBanner } from '../../src/platform/banner';
import type { AdsBridge } from '../../src/platform/ads';

afterEach(() => { vi.unstubAllGlobals(); });
function harness() {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('innerWidth', 360); vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
  const slot = { hidden: true, style: { height: '60px' }, getBoundingClientRect: () => ({ x: 0, y: 700, width: 360, height: parseInt(slot.style.height) }) } as unknown as HTMLElement;
  const geometry = { webView: { x: 0, y: 0, width: 360, height: 800 }, root: { width: 360, height: 800 }, adHeight: 90 };
  const bridge = { measureBanner: vi.fn(async () => geometry), placeBanner: vi.fn(async () => undefined), hideBanner: vi.fn(async () => undefined) } as unknown as AdsBridge;
  const banner = new NativeBanner(bridge, slot);
  return { banner, slot, bridge, geometry, async frame() { const cb = frame; frame = undefined; cb?.(0); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); } };
}
it('reserves SDK-required height before attaching a banner and keeps the reservation through a modal', async () => {
  const h = harness(); h.banner.setEligible(true, false); await h.frame();
  expect(h.slot.style.height).toBe('90px'); expect(h.bridge.placeBanner).not.toHaveBeenCalled();
  await h.frame(); expect(h.bridge.placeBanner).toHaveBeenCalledTimes(1);
  h.banner.setEligible(true, true); expect(h.slot.hidden).toBe(false); expect(h.bridge.hideBanner).toHaveBeenCalled();
  h.banner.destroy();
});
it('does not let a late measurement redisplay a hidden banner and bounds unresolved measurements', async () => {
  const h = harness(); let resolve!: (value: typeof h.geometry) => void;
  h.bridge.measureBanner = vi.fn(() => new Promise<typeof h.geometry>(r => { resolve = r; }));
  h.banner.setEligible(true, false); await h.frame();
  for (let i = 0; i < 30; i++) { h.banner.schedule(); await h.frame(); }
  expect(h.bridge.measureBanner).toHaveBeenCalledTimes(1);
  h.banner.setEligible(true, true); resolve(h.geometry); await Promise.resolve(); await Promise.resolve();
  expect(h.bridge.placeBanner).not.toHaveBeenCalled(); expect(h.slot.hidden).toBe(false); h.banner.destroy();
});
