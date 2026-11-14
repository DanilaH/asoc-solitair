# Menu, audio, wallet and performance —0.16.0/code24

Owner requests five concrete corrections on base9845e57: unclear home/menu, harsh sound, directionless result coins, audible/visible streak income and lag. This is one bounded implementation; rules/content/balance3/5/3, frozen80+28deals, old attempts, saves, economics, compact board/art and SDK configuration remain unchanged.

## Implemented

- Home names Campaign, current level and completed progress; secondary activities are rows with their purpose/progress/reward. First entry keeps a centred title/Play rather than promoting locked systems. Pause explicitly names Main menu.
-15short CC0 PCM clips replace synthesized card/coin noise: actual place/slide/fan/shuffle and coin drop. Kenney/Vinrax sources, licenses, hashes and processing are recorded in [audio provenance](../art/AUDIO_0_16.json). Four voices, peak-bounded mix, fades when replacing a voice, prefetch/parse before use. A missing recording is skipped, never queued for a late replay. Abstract hint/key tones remain quieter.
- A single actual wallet is pinned above the result backdrop at its normal header anchor. Coins travel from the payout out around the panel to this wallet. Receipt/shared wallet counters animate; a visible exact +N and bounded arrival audio explain both streak and final reward income.
- SaveStore confirms currency before any animation. The presentation owns only displayed numbers; affordability/dedup never uses them. Skip/navigation/background/reflow settles the real balance. Reloading a saved win does not invent an earlier balance or replay income.
- Gesture legality is cached for a fixed board/source/target, while accepted commands still pass the authoritative engine. Slots/depth/tween killing are performed at drag start rather than each pointer/frame. Hidden home/calendar/level-grid rebuilding stops during play. Shadow/shade geometry is cached into texture sprites. Backing DPR capped1.5 with redundant GL MSAA disabled; CSS coordinates/drop rules unchanged.

## Current verification

94unit/platform tests pass. Initial62targeted browser cases cover real recorded buffers, contact sound timing, packet feel/Undo, wallet ownership/arrival/counting, reduced motion, modal visibility and save recovery. Final home layout, independent baseline/final profiling, full CI/Android/source matching and recordings are in progress.

Initial controlled route(360×780, backing requestDPR2) removes543→1drag clones and168→0hidden-home mutations. At4×CPU, observed script time1.97→1.04s, total task9.19→5.31s, mixed-framep9583.3→50ms. These are software-rendered browser/automation measurements, not proof of native60FPS. Pre-final intermediate profile after cached shadows alone did not improve noisy frame timing; the accepted DPR/MSAA variant is reported separately. Profile scripts assert the real seven-command model route; repeated comparisons will be appended.

No physical-phone sound/latency/thermal/comfort claim. No production/store changes.

## Reuse

KIT IMPACT:REUSE — pinned createValueTransferPlan/valueAfterVisualArrival/emission/audio stride, OneShotPlayer, activity/focus and UI motion/stable-progress contracts. Recorded asset choice, menu policy and wallet DOM remain game-owned; no new kit runtime/version/export.
