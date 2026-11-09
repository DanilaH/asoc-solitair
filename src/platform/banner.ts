import { resolveNativeBannerPlacement } from '@danilah/mini-games-kit/layout';
import type { AdsBridge } from './ads';

/** A single geometry flight; visibility epochs also cross the native bridge. */
export class NativeBanner {
  private generation = 0;
  private frame = 0;
  private alive = true;
  private visible = false;
  private flight = false;
  private dirty = false;
  private observer: ResizeObserver;
  constructor(private bridge: AdsBridge, private slot: HTMLElement) {
    this.observer = new ResizeObserver(() => this.schedule()); this.observer.observe(slot);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
  }
  private resize = () => { this.generation++; void this.bridge.hideBanner({ generation: this.generation }).catch(() => undefined); this.schedule(); };
  setEligible(eligible: boolean, blocked: boolean) {
    this.slot.hidden = !eligible;
    const visible = eligible && !blocked;
    if (visible === this.visible) { if (visible) this.schedule(); return; }
    this.visible = visible; this.generation++;
    if (visible) this.schedule(); else void this.bridge.hideBanner({ generation: this.generation }).catch(() => undefined);
  }
  schedule() {
    if (!this.alive || !this.visible) return;
    if (this.flight) { this.dirty = true; return; }
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; void this.layout(); });
  }
  private async layout() {
    if (!this.alive || !this.visible || this.flight) return;
    this.flight = true; const generation = ++this.generation;
    try {
      const rect = this.slot.getBoundingClientRect(), viewport = { width: innerWidth, height: innerHeight };
      if (rect.width <= 0 || rect.height <= 0) return;
      const measurement = await this.bridge.measureBanner({ viewportWidth: viewport.width, slotWidth: rect.width });
      if (!measurement || !this.alive || !this.visible || generation !== this.generation) return;
      const placement = resolveNativeBannerPlacement({ ...measurement, slot: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport });
      if (placement.kind === 'reserve') {
        if (placement.heightCss > viewport.height * .16) { this.visible = false; void this.bridge.hideBanner({ generation: ++this.generation }); return; }
        this.slot.style.height = `${placement.heightCss}px`; this.dirty = true; return;
      }
      if (placement.kind !== 'place') { await this.bridge.hideBanner({ generation }); return; }
      await this.bridge.placeBanner({ placement, generation });
    } catch { /* Load/geometry failures never cover the dock or block play. */ }
    finally { this.flight = false; if (this.dirty) { this.dirty = false; this.schedule(); } }
  }
  destroy() {
    this.alive = false; this.generation++; cancelAnimationFrame(this.frame); this.observer.disconnect();
    window.removeEventListener('resize', this.resize); window.visualViewport?.removeEventListener('resize', this.resize);
    void this.bridge.hideBanner({ generation: this.generation }).catch(() => undefined);
  }
}
