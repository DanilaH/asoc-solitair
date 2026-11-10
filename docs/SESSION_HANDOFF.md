# Continuation checkpoint — 2026-11-10

## Project and authorization

This is **Солитёр ассоциаций**, `DanilaH/asoc-solitair`, portrait Android/RuStore. Resume this game, not adjacent portfolio projects. Read AGENTS.md, docs/README.md and the normative product documents before extending scope.

The user explicitly authorized normal repository maintenance, push, PR management and integration: «я разрешаю работать тебе с репозиторием как со своим». Do not ask again for routine repository work. Production ad/analytics IDs, managed release signing and store publication remain deferred.

## Active implementation candidate — 0.7.0 / code 9

The user explicitly approved implementing the selected identity mockup («ну всё ебашь тогда»). The candidate on `feat/identity-ui` ports home/game/pause to production HTML/CSS/Phaser, with left-aligned foundations, short one-line category display titles, local Nunito, the original linked-card emblem, aggregated foundation faces/dots and a separate level-picker dialog. Scope/evidence: docs/qa/IDENTITY_UI_2026-11-10.md. Rules/content/balance stay 2/5/3; the frozen 80+28 bank and save/native ownership are unchanged. Hosted CI/APK verification is pending at this checkpoint; do not call the old 0.6.2 APK the redesigned version.

## Latest design feedback — find our own character

The user says the Hitapps-led structural prototype is now reasonably appealing and asks to find our own character by blending in AZUR and the third reference, Unico. Treat the earlier composition as an accepted starting point, not permission to regress to the old dashboard. Proposed identity is documented in docs/design/OWN_CHARACTER_2026-11-10.md and shown in docs/design/identity-prototype.html; the earlier reference-prototype.html is preserved.

The new proposal keeps the composition and uses warm paper/petrol/coral materials, AZUR-inspired light controls/periwinkle card edges, Unico-inspired category dots/budget track, and an original ribbon-connected leaf/tree card emblem at docs/design/art/linked-cards.webp. The user has chosen this identity mockup as the working direction; it is not yet an implemented APK. Category titles must stay on one line: use «Музыка» and «Кухня» instead of the two-word labels. Choose short, clear display names when implementing, preserving category IDs, membership and published deals. Latest explicit tweak: the two upper foundation slots now align to the left edge and the first two tableau columns in the identity prototype, retaining the common safe gutter. Current game runtime remains 0.6.2 below. Reproduce/check with `node tools/record-reference-design.mjs identity-prototype.html` (360×780, 320×568 and existing ink-palette preview). S3 was fully retrieved and hash-verified; no video bytes/encoded dumps belong in chat.

## Structural direction after 0.6.2 — reference-based redesign

The user still finds the presentation weak, especially field/menu structure, and explicitly asked to revisit their Hitapps/AZUR videos and copy the interface much more directly. Both full recordings were retrieved and SHA256-verified; new review/design lives in docs/design/REFERENCE_REBUILD_2026-11-10.md. Choose Hitapps as the primary composition, with AZUR full-face word presentation and dictionary access.

A concrete three-screen prototype is in docs/design/reference-prototype.html; reproduce its 360×780 and 320×568 checks/screens with `node tools/record-reference-design.mjs`. It is a proposed interface example, not a new game/APK, not an exact saved attempt, and not proof of new Phaser/native behavior. The actual runtime below is unchanged. Next presentation package: compact HUD, independent deck/moves zone, distinct category row, aggregate foundation face with title tab, centered open-card content, uncluttered home with separate level picker, coherent cream pause. Preserve two actual foundation slots, four deck placements and the frozen bank/save ownership; do not add meta systems from the references.

## Current implementation — 0.6.2 / code 8

PR #7 is merged. Runtime source: `c53bf4e173471e85aa7ee5f12f08e3c1cdefc3cf`; merge: `1d266072eb6dd5d75f984ecc2a9346f0c83526f4`. Later documentation-only changes do not change the tested runtime. Rules/content/balance remain **2/5/3**. The 80 campaign puzzles, first 26 deals, daily-v1 identities/orders and frozen 28-day rotation are unchanged.

The user's latest direction was a more convincing casual puzzle presentation, with attractive reinforcing effects, actual feel/UI/UX runs, generation and a stronger use of the existing Hitapps/AZUR observations. Do not return to genre research or add excluded meta systems.

- Ivory/cyan cards, gold category headers and separated counters, raised helper/primary controls, coherent table and reward styling.
- An original generated reward emblem is bundled at `public/art/ui/reward-emblem.webp`; provenance/prompt: docs/art/UI_ASSETS.md. Category travel/full-count hold/collapse survives an unrelated save/sync. Undo takes ownership of restored nodes. Praise holds before fading, with bounded ring/spark accents and no input barrier.
- Streak cells retain identity and animate only newly filled cells. Result coins join the dialog top layer and use the existing reward amount; no extra grant. Reduced motion suppresses decorative movement/coin flights. Failed attempts do not show the victory emblem.
- Real touch recording exposed redundant scene resize events cancelling drags. Unchanged backing-size/zoom notifications are ignored, screen entry uses opacity, and real geometry changes still cancel the gesture.
- All 0.6.1 deck placement, compact guidance, counter separation, save ownership and win-cycle warnings remain. Four deck placements still share one geometry for rendering/touch/Hint/Undo/resize; no-deck layouts remain supported.

## Preview identity

Debug package: **com.danilah.asocsolitair.debug**, label **Ассоциации · тест**. It is independent of the old canonical-package debug app. Do not tell the user to uninstall the old app or imply cross-package progress migration.

0.6.2 retains the 0.6.1 development signer: certificate SHA256 `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e`. CI restores the explicit `asoc-solitair-preview-signing-v2` cache, passes its path to Gradle and verifies the APK. Deliver from the default-branch run and compare future fingerprints. This cache is not a production key vault and can expire.

Canonical release package remains **com.danilah.asocsolitair**, gated on live configuration and the managed signing identity.

## Evidence

- PR CI: https://github.com/DanilaH/asoc-solitair/actions/runs/42799777690 — PASS: **58 model/platform tests**, all control/80 campaign/28 daily witnesses/four-layout bounds, **64 browser scenarios** and four intentional duplicate compact chapter skips, debug + unsigned SDK-disabled R8 release compilation and signature verification.
- Default-branch artifact run: https://github.com/DanilaH/asoc-solitair/actions/runs/42801252715 . Android job `129779039950` passes both compilations/signature verification. Delivered APK: 9,617,970 bytes, SHA256 `cee34333068cf8672a3f1aa809e246f7872319eaff8cf5e715b63c2f79939f92`, all 41 embedded production files match; persistent file `libfile_15e32d63f5548191b7dd9412e549ae2a`. Full identity is in VERIFICATION.md. The repeated main web run was still running at delivery; completed PR web evidence applies to byte-identical runtime.
- Local focused runs: 18 UX/result/reduced-motion scenarios, 12 legacy control scenarios, 8 meta scenarios and both real-input recordings pass. Earlier concurrent exploratory runs hit 30-second test limits under contention; they are not passing evidence.
- `npm run qa:feel` reproduces media under `.recording/feel-evidence/`, with production touch input and persisted-board assertions. `feel-first.gif` is a fresh first level, win and ordinary Next. `feel-dense.gif` seeds a state reached by replaying level 17's exact frozen witness, then records completion, the next action during its tail, Undo and settings. No runtime debug bridge.
- Delivered persistent media: first-level GIF `libfile_80694fcdac808191985a968ca56ffd9c` (SHA256 `130fd93c5888e8f5588a15227e0240236843b27ff1143c87400eba4c72fb723f`); dense GIF `libfile_42f7b59bb7e881919c97b889ef99e27d` (SHA256 `94175b5cef89346645d39f4929a4f699607e6f333c2f7b78db7997d4640bb79f`). Do not duplicate merely because a chat stopped.

Read docs/qa/CASUAL_FEEL_2026-11-10.md for this pass and docs/qa/UX_REVIEW_2026-11-10.md for the prior editorial review. Level 19's 45/45 witness and broad «Инструменты» in 12/15/daily-03/17 remain human-review priorities, not measured difficulty or confirmed rule defects.

## Next acceptance

Review the new presentation on a physical phone: readability/gesture comfort, sound/haptics, frame pacing, Back/background, process-kill/relaunch, native insets/banner and actual SDK callbacks/dashboard delivery. Browser/compilation evidence does not establish these outcomes. Human pacing and semantic review remain open. User feedback may direct another bounded visual pass; do not silently add content/meta scope.

SaveStore remains the sole authoritative writer; active Save.attempt is canonical, Save.parked contains only the other mode, and the presentedDealId scene barrier remains required. Native receipts/effects/dedup ordering and optional-service startup must remain independent of playability. See docs/platform/NATIVE_SERVICES.md.

## Binary handling

Never print GIF/APK/archive bytes, base64 or encoded chunks into conversation output. Transfer files directly and filter large API/log responses to metadata. Show GIFs inline through absolute sandbox paths. Current recordings were saved via file transfer, not encoded text dumps. The exact cause of earlier chat failures remains unconfirmed.
