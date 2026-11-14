// Provenance: DanilaH/mini-games-kit aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0, tools/critical-actions-check.mjs. QA-only copy; no runtime dependency upgrade.
// Opt-in Playwright QA helper. Not a runtime export and never scrolls or clicks.
import assert from 'node:assert/strict';
export async function inspectInitialActions(page, selectors, {minimumCssSize = 0} = {}) {
  if (!selectors.length || !Number.isFinite(minimumCssSize) || minimumCssSize < 0)
    throw new TypeError('Provide critical selectors and a nonnegative CSS target size');
  return page.evaluate(({selectors, minimumCssSize}) => selectors.map(selector => {
    const matches = document.querySelectorAll(selector);
    if (matches.length !== 1) return {selector, passed: false, reason: 'missing-or-ambiguous', count: matches.length};
    const node = matches[0], r = node.getBoundingClientRect(), style = getComputedStyle(node);
    const rect = {x:r.x, y:r.y, width:r.width, height:r.height};
    const fail = reason => ({selector, rect, passed:false, reason});
    if (node.matches(':disabled') || node.closest('[inert], [aria-disabled="true"]')) return fail('disabled');
    if (!node.getClientRects().length || style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0)
      return fail('hidden');
    if (r.width <= 0 || r.height <= 0 || r.width < minimumCssSize || r.height < minimumCssSize) return fail('target-size');
    if (r.left < -.5 || r.top < -.5 || r.right > innerWidth+.5 || r.bottom > innerHeight+.5) return fail('outside-viewport');
    // Scroll/clip ancestors can conceal an edge even when the center remains hit-testable.
    // Axis-aligned DOM controls only; rotated/rounded shapes and native overlays need device QA.
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const p = parent.getBoundingClientRect(), css = getComputedStyle(parent);
      if (Number(css.opacity) === 0 || css.visibility !== 'visible') return fail('hidden-ancestor');
      const sx = parent.offsetWidth ? p.width / parent.offsetWidth : 1;
      const sy = parent.offsetHeight ? p.height / parent.offsetHeight : 1;
      const left = p.left + parent.clientLeft*sx, top = p.top + parent.clientTop*sy;
      if (['auto','scroll','hidden','clip'].includes(css.overflowX) &&
          (r.left < left-.5 || r.right > left+parent.clientWidth*sx+.5)) return fail('clipped-x');
      if (['auto','scroll','hidden','clip'].includes(css.overflowY) &&
          (r.top < top-.5 || r.bottom > top+parent.clientHeight*sy+.5)) return fail('clipped-y');
    }
    const inset = Math.min(3, r.width/4, r.height/4);
    const points = [[r.x+r.width/2,r.y+r.height/2], [r.left+inset,r.top+inset],
      [r.right-inset,r.top+inset], [r.left+inset,r.bottom-inset], [r.right-inset,r.bottom-inset]];
    if (!points.every(([x,y]) => { const hit = document.elementFromPoint(x,y); return hit && (hit === node || node.contains(hit)); }))
      return fail('occluded-or-not-interactive');
    return {selector, rect, passed:true};
  }), {selectors,minimumCssSize});
}
export async function assertInitialActions(page, selectors, options) {
  const result = await inspectInitialActions(page, selectors, options);
  assert.deepEqual(result.filter(x => !x.passed), [], 'Critical actions must be visible and hit-testable before scrolling');
  return result;
}
