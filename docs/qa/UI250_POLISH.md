# №250 · Card Table B UI/UX/Feel · implementation in progress

Base: PR248 `3e1b61814016b92cf7aef3aba9573d22228aa715`,0.21.9/code60,full CI46143066585 17/17. Current branch `feat/250-ui-ux-feel`. Owner approved the complete visual pass in issue250, including UX01–07 proposals; no further art-direction choice required. Card Table B, M1, Rules4, all definitions/saves, #246 isolated A/B and115/38/15/9 remain mandatory. No publication, SDK activation, economy or campaign-bank promotion.

Read issue250 and research PR249 `8098b7f931d663fec81f0b17c6806962929734e3`. The diagnostic workflow is not merged. Guidance: pinned UX_AND_ART_SYSTEM, STABLE_PROGRESS_UI, UI_MOTION_RECIPES, accessibility at aab9dc8; actual installed runtime a9325265 unchanged. KIT IMPACT: REUSE (existing OneShotPlayer, value-transfer, activity/lifecycle and touch activation).

## Baseline

Exact base worktree `/workspace/scratch/5fb3a045ed9b/solitaire-ca246`, temporary untracked `tests/browser/ui250-baseline.spec.ts`, source copied from PR249 with all encoded-image log generation removed. Sequential ordinary/A/B builds and browser captures completed, each87 PNG/104 report rows. Files `.recording/ui250-before/{ordinary,azur21-v1,hybrid21-v1}` and run logs. Five sizes320×480(+90banner),360×640,393×851(+60),768×1024(+90),640×360, plus lives150% text. No physical Android claim.

The original test's source-point calculation uses the second semantic packet ID as the covering card; tableauPresentation can move a leader to the front. It recorded short/wide last-action mismatches. Investigate with correct raw visible-hit coordinates; do not call this an engine bug without reproduction. Need focused baseline victory recordings with corrected helper before final comparison.

## Current implemented work, not final acceptance

- UX01: monthly paper text changed from cream-on-cream to#345746; actual final contrast/theme matrix still required.
- UX02/03: compact44px game header,24px HUD,58px dock,18px transient feedback; explicit70px teaching and48px recovery reservations. boardFrame bounded centered table, scale from immutable deal/viewport; max .8, no per-turn zoom. Browser short-wide uses a separate stock/waste rail with preferences retained; Android portrait manifest unchanged. Fixed waste fan to preserve earlier drawn positions in side rail. Slot/stock centering and all settings need complete regression.
- Card text uses advanced wrap and editorial breaks for owned words; category title larger, leader count moved to bottom, count/native marker26worldpx. Actual text metrics, special/long crowded samples and legacy markers still need work. Native/legacy source badge overlap must be checked, not assumed solved.
- UX04/06:44px wallet/lives target, completed unlock presentation collapsed while DOM status remains. Tall home two-column actions, compact cosmetic rail, restored readable monthly progress; short-screen row retained. Prototype screenshots show correct hierarchy after specificity correction. Daily/status secondary text newly exposed on tall home. Exact amounts/price formatting and150% all-menu stress pending.
- Words button replaces ambiguous Aa with existing book art and visible Слова/Готово state. Inspection semantics/Definition consumption unchanged.
- UX07: win/complete no longer alias flip/place samples. Existing own cueSamples generate distinct reward PCM upfront; OneShotPlayer reuses cached buffers. Current Java timings unchanged, but win/complete bypass low-priority60ms suppression; valid card pickup requests existing button pulse. Must verify toggles/background, actual call order and Android compilation; perceived feel remains device QA.
- Final-win combo flight deferred into the result receipt; no separate last-combo numeric source. WalletPresentation suppresses floating coin-gain number when the result already displays amount. Full one-amount motion/rapid-next/reduced/video reward tests pending; save authority untouched.

## Still mandatory before delivery

1. Finish typography and real glyph/badge measurements; all8 specials, long RU/image/count combinations,9-card stacks, crowded/end states, left/right/top/bottom preferences and true tap/drag. Investigate before touch mismatch. Finish layout tests; one old edge-flush assertion intentionally updated to bounded rail semantics, not skipped.
2. UX05 helpers: action-first menu, current-use/state/owned charges/acquisition, distinct manual/random Joker; all inventory/credits/Shuffle/slots/restore/unlimited/Definition rights retained. Keep original IDs/handlers and guards, precise disabled reasons. Current implementation still pending.
3. Icons: shared shuffle glyph between dock/inventory/warnings, consistent button surfaces,44–48px meaningful targets; source icon still pending. Format wallet consistently with grouped exact amount in detailed context.
4. Finish UX06 task/reward/loss hierarchy and full150% menus, initial viewport primary actions, real scroll/expanded weekly/focus/back; do not redesign satisfactory calendar/streak/settings/cosmetics unnecessarily.
5. Real before/after transition/drag/completion/victory/reward videos, reduced motion, interruption/fast input and sound/haptic combinations. New browser/semantic checks must assert outcomes, not swallow exceptions.
6. Scope metadata/ledger/progress,0.21.10/code61 planned. Full project CI ordinary + #246 + three-profile UI matrix, three signed test APKs with prior0335 certificate, compare/source reports and physical test checklist. Preserve research roadmap. Do not merge PR249 workflow.
7. Save final APK/report/comparison screenshots/videos through current Library helper in one ordered batch; git-backed source itself stays only in repository. User explicitly requests screenshots for this task. Old ca246-transfer helper belongs prior task; fetch current helpers into new private ui250 directory.

Temporary feature probe `tests/browser/ui250-probe.spec.ts` is not the final test and must be removed/replaced before CI. It captures3 viewports in .recording/ui250-probe; uses real input but no acceptance matrix. Current build logs in task root ui250-*.log. Dependencies symlink to ca236-deps/node_modules, exact accepted private kit cache; no dependency pin change.

## Implementation checkpoint

Action-first helpers now retain all original acquisition/confirmation handlers and counts, with guarded forwarding for Hint/Undo/manual Joker/Words/Shuffle/bonus slots. Helpers entry is directly on pause; no need to expand Settings. Stock summary is optional details. Home has visible current status, week claim uses prize icon+amount/action. Exact grouped detailed balance supports0/99/100000/12345678/MAX_SAFE_INTEGER without changing amounts. Shared Shuffle asset used in dock, menu, prize and warning.

Cards: ordinary wrap preserves editorial breaks (no automatic orphan-letter splits), all owned long categories shortened only in presentation, contextual collision falls back to original category title. Count sits below caption; special category image moves beside bottom count while rule header remains separate. Caption/badge fit is measured on real renderer through read-only DevTools heap query, no QA runtime export/build. Layout is state-independent; transient feedback overlays rather than shrinking the field; lessons/recovery/dead-end still reserve rows.

Local first full five-size input pass: all final-card/next paths accepted after visual-source-coordinate correction;5/5 focus returns, no page errors. Text150 discovered real helper/settings title collision; helper fixed, final settings correction rechecking. Ordinary focused10 unit assertions passed including all witness geometry; earlier explicitly release-profile execution of historical release.test has2 pre-existing profile-assumption failures (80 vs200 and rules3/4), not accepted or skipped; full project profile separation retained.

Before wide replay also recorded a no-action mismatch after corrected semantic/visible root in a mixed-profile exploratory run. Discard that mislabeled capture; dedicated CI rebuilds each exact base profile before comparisons. Do not assert an engine bug or claim every old anomaly is solely coordinate-related. After flow acceptance is strict, including real drag.

CI adds three dedicated UI250 profile jobs to the existing17. Baseline is built from exact3e1 accepted worktree with only recording harness injected; after ordinary build includes no fixture navigation. Existing functional/economy/ads/helper/generator/Android jobs retained. Completion and win audio expectation updated to distinct actual5954-frame/9702-frame owned cues, not old flip/place aliases; all eight toggle combinations retained.

Local all-menu150 and helper routing now pass, including Settings. The animated run found a test gesture that put its finger on the target while the lifted card was68 CSS px above; the visible card selected a different valid foundation. Adjust the recording gesture for its actual grip and lift so the visible card reaches the intended target; keep the existing card/finger arbitration. Updated four historical point helpers to include centered frame.offsetX; all outcome assertions retained.

Measured smallest320×480+90 ordinary front text around11.1–12.7 CSS px versus ~9px nominal before, count10.3. The full12–14 target cannot be promised on every long five-column caption at this extreme. Full-word reader remains one explicitly named action; actual per-ID fit rows and screenshots are preserved. Special labels drop redundant glyphs on gold/scissors and use the short cleared status Снято, retaining underlying state and reader content.
