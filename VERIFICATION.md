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
