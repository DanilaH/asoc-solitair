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
