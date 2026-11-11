# Compact edge-aligned UI — 2026-11-11

User feedback: columns and controls were spread across the available width rather than grouped against an edge. This is a presentation follow-up to 0.8.0; the previously delivered APK does not contain these changes.

## Implemented

- Two/three-column rows start at the left edge with a 14-logical-unit gap. Four-column rows keep the established card size and spacing. Foundation slots follow the first two columns. Height-constrained boards stay against the left safe gutter instead of drifting to the centre.
- Stock and waste form a separate pair against the chosen edge, with a real gap; the rear waste cards fan away from stock. All four deck settings still share the rendering/input/Hint/Undo geometry.
- Helpers form a compact left-aligned dock. Card reading now lives there as a labelled Aa button, independent of board scaling (52×68/76 CSS px). The menu and dialog close buttons have 44×44 CSS-pixel hit areas. Calendar and level-picker entries are at least 44px high.
- Home events share one left-aligned row beneath the emblem/title. The primary play action remains anchored near the bottom, with stale-daily continuation in its own row.
- Pause navigation shares a two-button row. Restart retains its separate confirmation and explanation. No controls or functions were removed.
- Narrow headers use tighter streak spacing, preserving the larger menu target even with the largest test wallet and seven streak cells.

No rule/content/economy/save/native changes. Rules/content/balance remain 2/5/3, all published deals and the kit pin are unchanged. This source change does not increment the Android release version or claim a new APK.

## Verification

- Production build/typecheck and 59 unit/platform tests pass.
- All fixed intro/80 campaign/28 daily witnesses pass four-layout bounds and card conservation.
- 36 focused browser scenarios pass on phone/compact: feel, home/daily/appearance, restart, bottom-deck full wins on both sides, resize/banner repaint and actual touch input. Two additional browser passes exercise the relocated card reader on 320×568, verify its physical target size, open the correct card explanation and preserve board/wallet.
- Production-touch recording passes a fresh first-level win/Next and a reachable dense collection/next move/Undo/pause. No synthetic game commands are used for the recorded actions.
- The first complete independent raster/DOM audit found no rendered field collisions but caught eight repeated narrow-header overflows after enlarging Menu. Streak spacing was corrected; the final seven-viewport audit passes all 176 states (119 fields, 21 home states, 36 dialogs) with zero DOM/raster violations. The audit checks Aa through the shared dock selector rather than counting the same button twice.

Reproduce: `npm run check`, `npm run qa:layout`, `npx playwright test tests/browser/ux.spec.ts tests/browser/meta.spec.ts tests/browser/feel.spec.ts tests/browser/art.spec.ts --workers=2`, `npm run qa:feel`.

## Remaining UX priorities

1. The unlimited-budget teaching HUD still spends a large card on ∞. A future pass can use a compact learning indicator and bring the first two rows higher; this requires a separate vertical/touch audit, not another horizontal spacing adjustment.
2. Several secondary home/status labels are 7–10px on short screens. They need less copy and larger type together, rather than merely scaling the entire UI down further. Physical-phone readability is still unverified.
3. Pause contains both preferences and game navigation. The grouped row shortens it, but a future simplification should separate settings from the primary Continue/Restart/Home actions while preserving current entry points and cancellation behavior.

Physical-device comfort, haptics/sound/FPS/native insets and live SDK delivery remain outside browser evidence. CI/Android and repository integration status must not be inferred from local checks.

## Saved review media

- Before/after identical first-deal state: `libfile_ae85027083c481918edc97de77545712`.
- Actual home/two-column/dense screens: `libfile_616df963eecc8191920f6ffe38bbbc2c`.
- Fresh production-touch first win/Next GIF: `libfile_721d5f9726988191a9f99b3eea9438e4`.

These are actual production browser renders/inputs. They are not generated UI concepts. The fresh-run GIF trims only the initial loading lead-in.
