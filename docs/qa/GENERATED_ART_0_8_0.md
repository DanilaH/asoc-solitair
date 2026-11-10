# Generated art implementation — 0.8.0 / code 11

Working implementation of docs/design/ART_IMPLEMENTATION_PLAN_2026-11-10.md. This document starts as a checkpoint; completed evidence is recorded below as it arrives. Runtime currently pending exact-source final CI/device acceptance; do not call the APK production ready.

## Implemented scope

- 49 original optimized resources: 4 card surfaces/backs, 12 UI/effect icons and 33 semantic subjects covering every existing 35 illustration reference. Published data URLs, membership, IDs and order remain unchanged. Presentation-only resolver in src/game/art.ts.
- Actual Phaser cards and stock use the generated materials; both card widths, both backs, both palettes, four deck placements and no-stock teaching layouts remain supported. Darker main text and fewer forced breaks on short words. Drag shadows lift with the group.
- HUD/helpers/home share materials and icons. Coral main actions, paper secondary controls, coherent panels, rendered-art cosmetic previews, checkbox toggles, dialog close controls and states across all 11 dialogs. Corrected 0.7.1 layout remains authoritative.
- Pooled local completion sparkles/coral ribbon, shared coin sprites, matching key/lock/Joker artwork. Reduced motion suppresses decorative travel. Undo/restart clear decorative effects; opening dialogs clears local ribbon/sparks. Domain/economy/save ownership are unchanged.
- Source atlas SHA/crops and generation briefs are recorded in docs/art/GENERATED_ART_0_8_0.md. Native version is 0.8.0/code 11; debug package/signing policy unchanged.

## Evidence so far

- 59 model/platform tests PASS; intro + all 80 campaign + 28 daily fixed witnesses and four-layout bounds PASS. No domain/content/balance changes.
- Early real production-touch recording PASS: first level to result/Next; reachable level 17 completion, next move during effect tail, Undo and pause; 320×568 captures including bottom-left deck. This initial recording preceded replacement of the remaining semantic art; final recordings will use the complete pack.
- Initial layout audit interrupted by a load timeout while another command rebuilt served assets. It is not passing evidence; the matrix is rerunning against stable files.
- Full local browser regression is in progress; no pass count claimed before completion.
- Added a browser check that every published illustration resolves to shipped generated art and all 49 sprites decode with opaque content/transparent gutters and no external HTTP dependency.

The new art check found white/near-opaque backing in 17 preliminary subject exports. Their atlas/rope backgrounds were corrected with image generation and all affected sprites re-exported. Both phone and compact resource checks now PASS (49 decoded sprites, all 35 published reference paths resolved). The exported runtime pack totals 806,892 bytes. The complete original-source archive was replaced in place with nine final source PNGs and updated metadata.

A stable-build layout pass completed all 176 existing DOM/dialog/raster states with 0 issues; final CSS/pixel verification is also running against an immutable output directory. One long meta scenario in the concurrent broad local browser run hit its 30-second limit; it will be diagnosed/rerun separately and is not counted as passing yet. All 80 campaign levels have already been traversed through real touch in that run.

The later full raster pass caught one genuine blank-canvas frame at 520×700 after a backing-store/banner resize (no overlapping controls). Static reduced-motion scenes could sleep in the same POST_RENDER turn that cleared their backing store. The renderer now keeps a bounded two-frame repaint tail on screen entry/real resize, wakes after changing the backing store, and then resumes idle sleep. Real resize also clears decorative ribbon/spark flights. A regression checks actual painted card pixels over repeated viewport/banner changes, without a Phaser debug bridge or geometry-derived oracle.

The initial broad run completed 66 scenarios with four deliberate duplicate chapter skips and two 30-second total-journey timeouts. The milestone scenario passed alone in 26 seconds. The legacy intro journey also exhausted its 30-second total while advancing ordinary moves; these two complete-level/reload/cosmetic journeys now have a 60-second total allowance. All per-step state, scene-barrier and reward assertions remain unchanged; this is not a game frame-rate claim. Exact-source final CI and focused repaint checks are pending before delivery.

Repaint fix verification: all 176 layout states now PASS again with **0 DOM/raster issues**, including the previously blank positive-control case. Both profiles pass all art-decode and repeated static viewport/banner repaint checks (4 tests, 24s). Manual small-sprite inspection additionally removed tinted backing from seven transport/tool subjects; these are resource-only changes after the repaint verification. Final production recordings and exact-source hosted checks are being refreshed before delivery.

## Still required before delivery

Exact-source build, asset decode check, final layout/raster audit, completed browser regression, updated final touch recordings, Android debug/release compilation, APK embedded-file comparison and matching preview signature. Physical-device readability, gestures, sound/haptics/FPS/insets and live production SDK behavior remain separate acceptance work.

Final runtime art size after matte cleanup: 766,066 bytes across 49 files.
