# Verification — 2026-11-09

## Local environment

Node 24.22.1 / npm 11.9.0. Chromium through Playwright 1.56.1. JDK 17 only; no Android SDK configured locally. Android compilation was performed in the configured JDK21/SDK36 CI environment. No physical phone attached.

## Completed checks

- Pinned dependency installation and TypeScript check.
- 11 domain tests: full control path, exact last-move win, compound Undo, recycle order, invalid drop, no repeated rewards, hint boundaries, victory identity/restart, reachable-state card invariants, search limits and save validation.
- Validation replay of `intro-001`: 15 unique cards, 21 accepted moves, budget 32, slack 11, no helpers/ads. Record: [intro-001.json](docs/validation/intro-001.json).
- Production Vite build and Capacitor Android generation/sync.
- Final local browser run: 12/12 scenarios passed across Pixel 7 and 360×640 (complete touch play/reload/result/replay, hint replay without another charge/Undo, fast successor during coin flight/invalid drop, pointer cancellation, whole-packet drag/Undo, replay of the last hint at zero charges).
- Opening and result screenshots visually inspected; long-title overflow corrected with wrapping and width bounds. The expanded run exposed an idle-render wake bug between touch down/up: sync now explicitly wakes presentation, and the entire browser suite passes with the original quick gestures.
- A separate real-touch recording script completed all 21 moves and saved opening/midgame/result images and a silent WebM under docs/qa. It runs the actual production bundle, not a static mock.
- First hosted CI (5dd099b) passed dependency install/domain checks/build; Android setup failed before compilation because the action requested obsolete package `tools`. Both workflows now explicitly request `platform-tools`. Final hosted compilation status is tracked below.
- Hosted CI [42600591880](https://github.com/DanilaH/asoc-solitair/actions/runs/42600591880), commit f7db2d6: web and Android jobs both PASS, including `assembleDebug assembleRelease`. The `android-builds` artifact contains debug and unsigned release outputs; signing was not supplied or claimed.
- Chromium idle/wake probe: 0 new animation frames during 300 ms initial idle, 9 frames during a normal transfer, 0 new frames during 300 ms settled idle; accepted move persisted at 31 remaining. This is a controlled browser probe, not phone FPS/thermal evidence.
- Active economy numbers now live in `src/domain/balance.ts` without changing their values. Local explanations describe each word; image cards do not receive a pretend dictionary definition. Closing a word view returns to ordinary play.

## Explicit remaining limits

The synchronous browser save uses localStorage. No claim of tested physical Android process-kill/backup durability. No native ad impression/reward, analytics dashboard event, haptic pulse or signed release verified. Original audio is synthesized and has not been tuned on a physical phone. No retention/revenue/organic-acquisition measurements.

The first control deal is independently authored but only self-edited. Its validation is engine replay plus independent card invariants, not an independent solver implementation, proof of optimality or human difficulty measurement. Twenty campaign deals, modifiers and compact meta remain pending. The source-video analysis came in the supplied packet; only selected frames were re-inspected in this implementation pass.

## Native services package — 2026-11-09

- Connected consumer-owned Yandex Mobile Ads/AppMetrica 8.6.0, AtomicFile storage/earned journal, native feedback, audio focus and root-owned system insets. Kit geometry/receipt/repository APIs are used directly, with its SHA unchanged.
- Local typecheck, 29 model/platform tests and 18 production-browser scenarios pass; the extra platform tests cover serial command/reward/settings commits, ambiguous disk write/read-back, corrupt/failed restore preservation, duplicate receipt/ack failure plus spending, once-per-attempt continuation including Undo, cadence/clock rollback, hung optional calls/late disposal, distinct haptic generations, active-time exclusions, analytics transport caps, SDK banner height reservation and stale geometry after hiding. Browser additions cover helper exchange, failed save/retry, independent preferences, unavailable video and compact dialogs.
- Capacitor production asset preparation/sync passes. The TS analytics schema is copied to native assets deterministically.
- Initial native CI [42609652686](https://github.com/DanilaH/asoc-solitair/actions/runs/42609652686), f4b6854: web PASS, native demo debug compilation PASS. Unsigned disabled-SDK release reached R8 and exposed hard references to the excluded analytics-appsetid module. The module is restored rather than suppressing missing-class diagnostics; corrected release verification is recorded below when available.
- No phone/emulator is attached locally. Native ad inventory/earned callback display, haptic/audio feel, physical process-kill/upgrade, AppMetrica dashboard delivery, live configuration and production signing remain unverified. The unsigned disabled-SDK R8 artifact is compile-only, not a store candidate. See docs/platform/RELEASE_CHECKLIST.md.

The original first-slice limitations above describe that earlier revision. Native services and storage are now implemented; remaining hardware/live limits are still real. Campaign bank, modifiers and compact meta were not added by this infrastructure package.

### Corrected hosted verification

- CI [42610405612](https://github.com/DanilaH/asoc-solitair/actions/runs/42610405612), implementation commit `930f77df7820107b2c3361773059aa090cd98ddc`: web PASS (29 model/platform tests, content replay/build, 18 browser scenarios); Android PASS (`assembleDebug` in demo mode and unsigned `assembleRelease` in disabled-SDK compile-only mode with R8/resource shrinking). App Set ID dependency closure is fixed; no missing-class suppression was introduced.
- Native artifact `android-builds`, id `13668779787`, 16,367,729 archive bytes, digest `sha256:55033798d546defa91bea4d43c6dca3d336b476b41a30a75833ad41175b55511`, retains both APKs and R8 mapping output. This is an archive identity/size, not an APK-size or signing claim.
- New compact helper screenshot and [GIF](docs/qa/platform-services.gif) recorded from the actual production browser bundle at 360×640, showing independent haptic preference and a persisted Undo purchase. This proves the visible UI flow, not a native haptic pulse. The helper dialog was tightened after visual inspection to avoid clipping the return button.
- Subsequent verification/media documentation changes do not alter the tested implementation. Live configuration, signing and physical-device acceptance above remain pending.

## First campaign package — 2026-11-09

- 20 original fixed deals / 29 used topics / 130 distinct member words, 24 local vector images. Every initial order and winning witness is stored; contentVersion 2 migrates the legacy intro attempt without a profile reset. All 578 witness commands replay without helpers or ads, with separate multiset/asset/caption/geometry checks.
- Local 33 model/platform tests pass. Added whole-campaign progression/restore, first-clear vs replay, helper unlocks/free demo and legacy migration tests.
- Production-browser full campaign passed with real taps for all twenty deals, ordinary Next navigation, final 20/20, replay and exact reload restore. Onboarding/free demo and dense four-column switching passed on both Pixel 7 and 360×640. The compact duplicate full-bank run is intentionally skipped; its dense/interruption/geometry cases run separately.
- Latest targeted run: 10 scenarios pass on the final caption/hero layout, including short field with a 90px DOM banner reservation. This is controlled DOM reservation evidence, not a native ad impression or phone font check. Earlier 18 regression scenarios also passed after campaign integration. Full final CI is tracked below.
- The first transition run exposed stale scene/save ownership during level replacement; presentedDealId and listener cleanup now prevent old views from accepting the new save. The entire real-touch campaign then passed. Screenshot review corrected hero/title overlap and single-letter caption wraps.
- GIFs/screenshots are generated by npm run qa:campaign from the actual production browser UI. The dense example uses an explicitly seeded valid restored profile; the separate full touch run establishes genuine campaign reachability. No global runtime test bridge or fake rewarded success was introduced.
- Physical-device feel/performance, human difficulty/editorial review and live SDK/dashboard/signing remain separate limits. The twenty-deal bank is not an approved final release-bank size.

### Campaign CI and artifact evidence

- [CI 42618981335](https://github.com/DanilaH/asoc-solitair/actions/runs/42618981335), implementation `b5c8c68faec8d6c8ea6c2cb36138170205f627e2`: web PASS — 33 model/platform tests, 21 validation replays including the legacy control, production build and 25 browser scenarios. One duplicate compact full-bank run is intentionally skipped; compact onboarding/dense/interruption/reservation cases run. The real-touch phone-browser campaign reaches 20/20 with no page errors, plus replay and exact restore.
- Android PASS — demo `assembleDebug` and unsigned SDK-disabled `assembleRelease` with R8/resource shrinking, version 0.3.0/code 3. This is successful compilation, not production signing/device or live SDK evidence.
- `android-builds` artifact id `13675460909`, 16,416,876 archive bytes, digest `sha256:d9363d097d45e4386608fa8eb72c91e24c1c0771b3e85c190300f5b8b575bcc8`, associated with the implementation above. Archive size is not an APK-size claim.
- Authentic media: [home](docs/qa/campaign-home.png), [first level](docs/qa/campaign-first.png), [dense field](docs/qa/campaign-dense.png), [first win / next level GIF](docs/qa/campaign-first.gif), [dense field / inspection / Hint GIF](docs/qa/campaign-dense.gif). Captured at 360×640 from the production bundle. Dense media restores a valid fixture; it does not replace the separate full touch reachability run.
- The following documentation/media-only commit changes no tested runtime behavior.

## Rule extensions package — 2026-11-09

Version 0.4.0/code 4, rules/content/balance 2/3/2. Added six teaching/application deals (26 total) without editing the frozen twenty ordinary initial orders or witnesses. Exact scope and save migration are documented in docs/content/MODIFIERS.md.

- Local `npm run check` passes: TypeScript, 46 model/platform tests, replay/invariant/asset/layout validation of control + 26 campaign witnesses, alternate Joker witness, production bundle.
- Modifier tests cover zero-move valid placement, free invalid target, one Joker per attempt even after Undo, spent inventory across restart, held packet boundary/release, restored support, helper-free solver continuations with empty and occupied support, ordered interval/prefix/refusal, stock/recycle/Undo, locked source/destination, atomic third-key unlock+flip/rollback/reveal deduplication, and old profile/attempt/receipt migration without replenishing a spent migrated Joker.
- A complete actual-touch catalog traversal won all 26 levels via ordinary Next controls. The initial expanded browser run exposed unconditional pointerupoutside cancelling a newly selected Joker from the DOM dock; fixed by cancelling only an active board gesture. Targeted tests then confirmed the selector and charge boundary on both viewports. Final hosted evidence follows below.
- Inspected real production screenshots/recordings at 360×640. Deals without a deck reserve no waste row; Joker support retains a visible gold heading and side badge. Rank badges and locked-column 0/3 counter are code-native graphics. The bounded key flights/praise are cleared on Undo/restart.
- Silent GIFs in docs/qa/modifier-{joker,ordered,keys}.gif show completed-touch production play: support held/released, skipped rank refusal and ordered completion, three-key unlock, Undo to two keys, unlock again and win. They are development recordings using valid restored chapter profiles, without runtime test bridges.

No physical Android/device/live SDK/signing acceptance is implied. Phone touch/audio/haptics, native kill/upgrade, final content pacing/bank, compact meta/daily, live IDs and signed release remain pending; keys/signing are deferred by user instruction.

- Final local modifier browser rerun after selector/layout fixes: **8/8 PASS** (Pixel 7 and 360×640), including all six teaching/application witnesses, Joker cancel/release/hint/reload/Undo, skipped-rank budget preservation and third-key Undo/reload.

- Hosted [CI 42624412629](https://github.com/DanilaH/asoc-solitair/actions/runs/42624412629) on implementation commit `8d06c17c038e414241189d3ec1482881541f34eb`: **web PASS / android PASS**. All 46 model/platform checks and 33 browser scenarios pass; one intentional compact duplicate of the full catalog is skipped. The full 26-level real-touch traversal and all eight modifier scenarios pass. Native demo debug and unsigned SDK-disabled R8 release both compile successfully.
- CI artifacts (7-day retention): `android-builds` id `13678960218`, SHA256 `60c8504f355a7a86d2fba92f49d477aca46af48821ff4e16f38c3cac83418300`; `browser-evidence` id `13678306928`, SHA256 `c5b4e5e3b58ec1f6f0a9be66dfdfeb3d4c98d7411bade8b4dc30fcfe14543edf`. The Android archive contains demo debug/unsigned compile outputs and release mapping, not a production signed store candidate.
- Follow-up commit changes only documentation and QA media. Executable source and dependencies remain exactly those tested in the implementation commit above.

## Compact meta package — 2026-11-09

Version 0.5.0/code 5; rules/content/balance 2/4/3. Card rules and the 26 fixed campaign orders/witnesses remain unchanged. Exact behavior and limits: docs/content/COMPACT_META.md.

- Local TypeScript, **55 model/platform tests**, production build and validation of control + 26 campaign + **28 new daily** helper-free witnesses pass. Both deck-side layouts are checked along the witnesses. Daily rotation has 28 distinct fixed orders and a 28-day repeat period; no infinite uniqueness or human difficulty claim.
- New model checks cover simultaneous tenth milestone/fifth win, once-only payout/reload/replay, temporary exhaustion/Undo/continuation vs restart, milestone catch-up migration, exact independent attempts, late native continuation receipts, leap-date/unknown-version rejection, daily same-date replay and stale-date training, 3/7/14-day payouts, skipped day/clock rollback and failed mode-switch disk write/retry.
- Local complete campaign/browser regression: **33 PASS / one intentional compact duplicate catalog skip**. All 26 levels won through actual touch/ordinary Next with new cycle rewards. New meta scenarios: **8/8 PASS** across Pixel 7 and 360×640, including simultaneous milestone/cycle result and palette, daily/campaign switching and calendar/replay, midnight old-puzzle training vs new date, unlocked back and mirrored deck.
- Reduced-motion card positions are now assigned synchronously: the first ready scene frame owns its hit coordinates. This removes a fast first-touch race when switching modes. Clock-controlled browser tests advance simulated time normally; freezing Date.now would incorrectly stop Phaser timing and is not used as gameplay evidence.
- Inspected production home, consolidated payout, locked/unlocked appearance and ink/diamond/left-deck field. Silent GIFs under docs/qa/meta-{progress,daily,appearance}.gif use actual UI actions from valid restored profiles near results. They show automatic payout, usable unlocks, third-day calendar bonus, exact campaign resume and free appearance changes. No runtime success/test bridge.
- Hosted complete source/native verification follows below. Physical phone feel/audio/haptics, native process-kill/upgrade, live SDK/dashboard acceptance, final human content/pacing and release-bank size remain pending. Live keys and signing remain deferred by the user.
