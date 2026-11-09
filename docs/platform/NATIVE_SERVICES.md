# Android services — 2026-11-09

Target: `com.danilah.asocsolitair`, portrait RuStore Android, version 0.5.0/code 5. No Yandex Games web SDK, server, account, push, purchases or cloud saves are introduced.

## Reuse and ownership

Kit remains pinned to `a9325265e87583a4872cf6a158e1e881a0d7508e`. `GameplayActivityCoordinator`, document visibility, `JsonStorageRepository`, `DurableReceiptQueue`, `resolveNativeBannerPlacement`, OneShotPlayer, render density, text sharpness, renderer teardown and completed-touch activation are integrated. Android SDKs are consumer source, not package exports.

Native recipes were adapted from the inspected `DanilaH/arrows` checkout (platform files introduced before its Stage C `077af59` head) and `DanilaH/road-lines` RoadAdsPlugin/MainActivity snapshot in the shared reference checkout. No other repository is modified. Class names, storage keys, application ID, cue profiles, receipt schema, economy and analytics contract belong to this game.

## Storage and recovery

Browser continues using the existing `asoc-solitaire.save.v1` localStorage document. Android uses one process-wide IO queue and AtomicFile under `noBackupFilesDir/solitaire-state-v1`. On a definitely empty native store, a valid old WebView document is imported; the original remains intact. Failed reads/corrupt data never create a fresh profile. Backup is disabled, and receipts share the same no-backup lifetime as the profile.

`SaveStore` is the sole writer for moves, settings, helper exchange, native receipts and ad cadence. Every change runs against the latest confirmed state and publishes after persistence. A rejected write is read back: the exact candidate confirms application, the previous value confirms failure, anything else keeps recovery protection. No later valuable mutation can overwrite an ambiguous commit. `Повторить сохранение` reconciles it. The browser development surface is not a distributed multi-tab save service.

Native SDK `onRewarded` creates an AtomicFile receipt before JS notification. JS applies effect and receipt identity in one snapshot, then acknowledges that exact native ID. Failed ack leaves normal play/spending available. Duplicate callbacks/relaunch replay cannot mint another grant. A temporary disk error retains the exact native receipt process-wide for another persistence attempt; a process death before disk persistence cannot be guaranteed recoverable.

Hint/Undo rewarded offers grant +2/+3 charges. Continuation gives +10 moves at most once per attempt, outside board Undo. Historical Undo budgets receive the same earned addition so undoing a board move cannot erase the paid-for allowance. A late continuation for an abandoned attempt becomes a retained continuation credit, used explicitly on a future exhausted attempt; it never modifies a different live board or disappears on acknowledgement. An unavailable/cancelled/dismissed ad alone gives nothing. Existing schema-1 saves remain compatible; optional platform/telemetry fields initialize when first used. Card rules and existing numeric rewards are unchanged.

## Ads and UI

Yandex Mobile Ads and AppMetrica are pinned to 8.6.0, verified against official docs below. Native SDK initialization, status/pending/ack and telemetry never gate the first playable frame. Each optional operation has at most one unresolved request; recovery retries in the background. Listener handles arriving after disposal are removed. A displayed fullscreen is not released by a generic JS timeout.

Native loaders and SDK views run on the main thread. Interstitial preload has its own generation and 15s loading deadline; loading a resource never authorizes display. Rewarded load has a 15s deadline. A missing pre-show callback is checked only while the game Activity still owns focus, and is separate from an actually shown ad. Destruction cancels loaders, removes listeners/views and resolves the active call.

The native root owns system-bar/cutout insets once. The WebView uses its contained safe bounds, avoiding duplicate CSS insets. Banner reservation lives below the helper dock, remains reserved during temporary hiding and uses SDK-measured sticky height plus the kit's CSS/native projection. Epochs cross hide/place calls; stale layout callbacks cannot redisplay a hidden view. Background, dialogs and fullscreen hide the view. Resizes remeasure instead of multiplying CSS coordinates by screen density.

Product policy: campaign levels 1–2 have no banner; first five new campaign levels have no interstitial. Later, at least three new wins and 120s since the last fullscreen are required. Relaunch applies a conservative additional 120s grace. Replays/control deals do not advance cadence; daily cannot request an interstitial; settings restart never requests one mid-level. Only a deliberate post-win transition may show. The legacy control deal has no campaign ordinal, so it cannot accidentally become campaign progress or show a banner/interstitial. Campaign ordinals now authorize the banner/cadence policy; the home screen remains ad-free. Daily has its own saved attempt and mode-tagged rewarded receipts; it does not request interstitials or banners. Shared wallet/settings/native receipt lifetime remain unchanged.

Helper exchange is accessible from settings or an empty stock of charges. It spends ordinary coins (+1 Hint/Undo for 100/60), saves before presentation and does not make a move. Native video buttons are unavailable until the SDK reports availability; the browser never substitutes a successful mock.

## Feedback and analytics

Native vibration uses capability checks, bounded per-action profiles, timestamp freshness, cancellation generations and foreground cancellation. Transfer/collection/invalid/Undo/win have distinct profiles; disabling vibration is independent of sound. Hardware feel still requires a phone.

Native audio focus is independent of visibility, modal and ad state. Focus loss stops one-shots; background/ads release focus. Resume reacquires only for enabled sound. Native focus transport does not gate playing. No music is presented as a feature when no music track exists.

`analytics-contract.json` is the shared event/key/type source copied deterministically into Android assets by `prepare-native.mjs`; TS and Java reject unknown/oversized payloads. Schema includes session, attempt start/resume/win/fail/restart, rejected move with reason, helper use/exchange, grant reason, ad request/load/show/impression/earned/dismiss/error phases and daily start/completion events. Common fields include attempt/deal/mode/versions/moves and monotonic active play time. A level starts on its first accepted board action; durable attempt markers prevent relaunch from faking a fresh start. Active time excludes modal, ad, hidden and native background; best-effort checkpoints run every 5s and accepted commands save a checkpoint. Telemetry is best-effort, not an exactly-once delivery system.

No boards, raw saves, ad unit IDs or API keys enter custom analytics. Location and advertising identifiers are disabled for the app's AppMetrica configuration; optional analytics modules are excluded. analytics-appsetid remains linked because the 8.6.0 core references its interfaces; R8 caught an unsupported exclusion in the first release run. App Set ID is distinct from the advertising ID and must be reflected in disclosure. The advertising SDK can still collect its own technical/ad data; test ad mode does not prove zero automatic SDK telemetry.

## Official contracts checked

- https://ads.yandex.com/helpcenter/en/dev/android/quick-start
- https://ads.yandex.com/helpcenter/en/dev/android/adaptive-sticky-banner
- https://ads.yandex.com/helpcenter/en/dev/android/interstitial
- https://ads.yandex.com/helpcenter/en/dev/android/rewarded
- https://appmetrica.yandex.com/docs/en/sdk/android/analytics/quick-start

Code, successful compilation, SDK display, physical-device feel and dashboard delivery are separate evidence levels. See ../../VERIFICATION.md and RELEASE_CHECKLIST.md.
