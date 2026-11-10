# Casual presentation pass — 0.6.2

User direction: make the game feel like a casual puzzle, using the existing Hitapps/AZUR observations, rather than a phone utility. No rules, content bank, balance or meta expansion.

## Changes

- Ivory faces with cyan edges; warm gold category headers and separate counters; stronger raised helper and primary controls, calmer teal table, coherent blue/gold reward treatment.
- Original generated star/card emblem, reused in category praise and results. Praise has a readable hold before fading; category cards travel, show their full count, then shrink away. Bounded spark/ring accents are independent of the next accepted move.
- Completion nodes retain their transition through an unrelated sync; Undo takes ownership of any restored node. Model/persistence never depend on an animation finishing.
- Streak cells retain identity across HUD refreshes and pop only when newly filled. Result coins join the native dialog top layer and target its existing reward amount; no second grant is performed.
- Buttons, menus and screen entry have short transitions. Reduced motion disables CSS movement and coin flights. Failed attempts do not show the victory emblem.
- Avoid redundant scene resize events when rounded backing size and zoom are unchanged. Screen entry uses opacity so a transformed parent cannot invalidate the canvas bounds mid-gesture. True geometry changes still cancel a drag.

## Recording

`npm run qa:feel` uses the production bundle, normal touch events and CDP touch drags. There is no runtime debug bridge.

1. `feel-first.gif`: fresh first campaign level, complete touch play, both category reactions, win and ordinary Next.
2. `feel-dense.gif`: level 17 restored from its exact frozen winning path to the first completion, followed by a completion, a new action during its tail, Undo and settings. The recording asserts the persisted board after every command and Undo. This fixture demonstrates a reachable state, not independent human difficulty.

All media are generated under `.recording/feel-evidence/` and delivered separately. Screenshots: `feel-home.png`, `feel-board.png`, `feel-category.png`, `feel-result.png`, `feel-dense.png`.

## Verification status

58 model/platform tests and all fixed deal witnesses/four-layout bounds pass locally. Focused UX/top-layer/reduced-motion tests and the production recording pass. Final full-suite/CI and Android compilation are recorded separately in VERIFICATION.md when complete. Concurrent exploratory local runs exceeded 30-second test limits under contention; they are not counted as successful evidence.

Physical phone acceptance remains open: gesture comfort, sound/haptics, frame pacing, native Back/background/process kill, banner/insets and actual SDK delivery. Source references and the original normative feel contract remain unchanged.
