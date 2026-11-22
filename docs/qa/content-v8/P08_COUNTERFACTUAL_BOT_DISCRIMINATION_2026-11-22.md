# P08 counterfactual: late bot failure is not a difficulty discriminator

**22.11.2026 · consumer-only QA; no original Android runtime.** Based on `feat/c8-p08-owner-equality-20261122` at `04293eafcff6c1798db2ccb63f7bb7da6913fb7e`. Exact source input: `src/content/campaign-v8-wave.json`, `src/content/campaign-v8-equality-bank.json`, `tools/content/build-owner-equality.ts`. Test: `tests/unit/equality-counterfactual-bots.test.ts`.

## Falsifiable claim

The two *product-authored* P08 policies are not evidence of player difficulty, source-native `SimulationController.StrategySystems` behavior or mathematical impossibility:

- `stock-first`: draws/recycles, never transfers a card when a stock/recycle command exists. On the P08 candidate, recorded **162 draws, 2 recycles, zero transfers** and a terminal loss on move 164.
- `tableau-first-then-stock`: transfers only while remaining moves are above `budget - 32`; on the P08 candidate, **15 transfers through move 31**, then **133 operations without a transfer**, ultimately loses on move 164.
- The P08 candidate has a **verified product winning witness 163 / budget 164**, leaving **1** move of route slack. The corresponding existing ordinary level-16 deal has a **verified winning witness 138 / budget 164**, leaving **26** moves of slack. *Slack of one witness is not a proof of shortest solution or human difficulty.*
- A counterfactual running those **same two policies**, with the existing `distinctPaths:true` requirement, on both complete game boards must show whether the apparently source-shaped late-loss filter discriminates difficulty. If both boards pass, putting the ordinary board first causes the filter to select it on the first attempt despite its 25-step shorter winning witness.

The test executes actual consumer `selectEquality` and independently replays BOTH witnesses with `tools/qa/gameplay-oracle`. It is not a synthetic guess at source-native bot policies. Treat any observed acceptance as **PRODUCT_MODEL** and keep source-native/real-player claims open.

## Product consequence

**Do not activate or claim fairness based only on the two late-loss traces.** Preserve owner-approved P07/P08 full scope and all four payer segments, and preserve the tested optional issuer/SaveStore contracts; the defect is in evidence **quality**, not a reason to exclude Equality.

Before QA acceptance, add at least: (1) neutral ordinary-pool counterfactual acceptance-rate comparison; (2) actual different bot decision policies, including transfer-first and semantic/foundation-aware variants, not forced stock exhaustion; (3) candidate-winning alternatives/branching and bounded UNKNOWN over multiple randomized seeds; (4) source-native strategy-system inspection and original runtime captures where available; (5) blind player tests on physical Android with recorded mistake/recovery rates. Report tiers separately and avoid inferring exact source behavior or retention from a model.

**KIT IMPACT: REUSE + CANDIDATE for research QA methodology; no game runtime, merchant, price, ad or inventory IDs changed.**
