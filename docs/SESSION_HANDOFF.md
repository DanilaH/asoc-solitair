# Continuation checkpoint — 2026-11-10

## Project and authorization

This is **Солитёр ассоциаций**, `DanilaH/asoc-solitair`, portrait Android/RuStore. Resume this game, not the neighboring portfolio projects. Read AGENTS.md, docs/README.md and the normative product documents before extending scope.

On 2026-11-10 the user explicitly authorized normal repository maintenance, push, PR management and integration: «я разрешаю работать тебе с репозиторием как со своим». Do not ask again for routine repository work. Production ad/analytics IDs and managed release signing remain deferred; there is no store-publication step in this debug handoff.

## Active visual pass — 0.6.2

The user confirmed continuing the casual UI/feel redesign on 2026-11-10. Work is on `polish/casual-feel`, based on `501d54c`. Current candidate is 0.6.2 / Android code 8; the last delivered preview below remains 0.6.1 / code 7 until new CI/artifact verification is recorded.

Read docs/qa/CASUAL_FEEL_2026-11-10.md and docs/art/UI_ASSETS.md. Cards/controls/rewards have a coherent cyan/gold treatment; generated reward art is bundled locally; completion animations survive the next sync; praise has a readable hold; result coins are in the dialog top layer. An actual touch recording exposed a redundant resize cancelling drags; backing-size/zoom guarding and opacity-only screen entry fix it. Rules/content/balance and frozen deals are unchanged. `npm run qa:feel` reproduces real input media, including completion/next input/Undo.

At this checkpoint, local model/content/build and production recordings pass. Final full-suite/Android CI is pending; do not claim a ready APK from this source until verified. Prior production IDs/signing deferral and debug package identity remain in force.

## Current implementation

PR #6 is merged. Runtime merge commit: `8c3e34f11ef9f95de7c45295a40d74c8b6969a6b`, containing final native fix `6885b14959a42155c221bf243a96652233211301`. Version **0.6.1 / Android code 7**. Rules/content/balance stay **2/5/3**; 80 campaign puzzles and the frozen 28-day daily rotation are unchanged, including the first 26 deals and daily-v1 identities/orders.

- Free top/bottom deck placement combines with left/right; optional old-save field defaults to top. Rendering, touch, Hint, Undo and resizes use one geometry. No-deck boards retain their layout.
- Compact guidance owns its actual height, rather than painting over helper controls. Category headings and counters have separate bounded areas.
- Campaign replacement explicitly states its existing win-cycle reset consequence; tutorial deck wording is independent of card-back color.
- Debug package is **com.danilah.asocsolitair.debug**, labelled **Ассоциации · тест**. It installs alongside the earlier canonical-package debug app, with independent progress. Do not tell the user to uninstall the old app or imply automatic save migration between packages.
- Canonical release package remains **com.danilah.asocsolitair**, gated on live configuration and the managed signing identity.
- The old default-keystore cache path never existed (both old/new logs had Path Validation Error), so old APK certificates differed. CI now creates/restores an explicit development keystore, passes its exact path to Gradle and verifies signatures. Deliver from the default-branch run; compare fingerprints on future deliveries. A cache is not a production key vault and may expire.

## Evidence

- Full web: https://github.com/DanilaH/asoc-solitair/actions/runs/42774757157 — **58 model/platform tests, all control/80 campaign/28 daily witnesses and four-layout bounds, 58 browser scenarios PASS, four deliberate duplicate compact chapter skips**. Final native-only changes leave src/tests/tools/dependencies/index.html byte-identical to that tested web revision.
- Final PR native: https://github.com/DanilaH/asoc-solitair/actions/runs/42776078443 — debug + unsigned SDK-disabled R8 builds, signature verification and successful explicit-key cache save PASS.
- Default-branch build: https://github.com/DanilaH/asoc-solitair/actions/runs/42776786652 — APK handoff verification: debug + unsigned SDK-disabled R8 compilation PASS; final APK 9,587,873 bytes, package com.danilah.asocsolitair.debug, v0.6.1/7; signature verified and all 40 embedded web files matched. SHA256 a2803a2cce7a8c6bc47a1abe76dd0d9c64bdc48fb5e4ee38194b244248c7b261.
- Local recovered check and 22 focused UX/meta scenarios PASS. Production recording uses actual touch drag, appearance controls and Undo from a valid restored level-17 state. Reproduce with npm run qa:review; no runtime test bridge.
- Editorial review: docs/qa/UX_REVIEW_2026-11-10.md. Level 19's 45/45 witness and broad «Инструменты» category in 12/15/daily-03/17 are human-review priorities, not measured difficulty or confirmed rule errors.

The unpushed earlier local commits a1a78a0/6e32922 were pruned by workspace maintenance. The reviewed files were restored from the conversation over main and reverified; the recovered web bundle filenames matched. Those old local hashes and media hashes must not be assigned to the recovered files. Current source is safely in GitHub.

## Deliverables and next step

Latest APK details are recorded in VERIFICATION.md and the user's handoff reply. QA GIF is delivered as a separate persistent file; the recorder also regenerates its local screenshots. Do not create duplicate files merely because a conversation stopped.

Next is **physical phone acceptance**: readability/gestures, sound/haptics, Back/background, process-kill/relaunch, native insets/banner and actual SDK callbacks/dashboard delivery. Browser/compilation evidence does not establish those outcomes. Human pacing and semantic review also remain open. Finish with the existing content and scope; do not restart genre research or add excluded meta systems.

## Binary handling

Never print GIF/APK/archive bytes, base64 or encoded chunks into tool/chat text. Transfer files directly; show GIFs inline through absolute sandbox paths. Keep large logs filtered to relevant metadata. There is no need to request or expose production keys in chat.
