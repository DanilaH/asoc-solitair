# P08 counterfactual: late bot failure is not a difficulty discriminator

**22.11.2026 · consumer-only QA; no original Android runtime.** Based on `feat/c8-p08-owner-equality-20261122` at `04293eafcff6c1798db2ccb63f7bb7da6913fb7e`. Exact source input: `src/content/campaign-v8-wave.json`, `src/content/campaign-v8-equality-bank.json`, `tools/content/build-owner-equality.ts`. Test: `tests/unit/equality-counterfactual-bots.test.ts`.

## Falsifiable claim

The two *product-authored* P08 policies are not evidence of player difficulty, source-native `SimulationController.StrategySystems` behavior or mathematical impossibility:

- `stock-first`: draws/recycles, never transfers a card when a stock/recycle command exists. On the P08 candidate, recorded **162 draws, 2 recycles, zero transfers** and a terminal loss on move 164.
- `tableau-first-then-stock`: transfers only while remaining moves are above `budget - 32`; on the P08 candidate, **15 transfers through move 31**, then **133 operations without a transfer**, ultimately loses on move 164.
- The P08 candidate has a **verified product winning witness 163 / budget 164**, leaving **1** move of route slack. The corresponding existing ordinary level-16 deal has a **verified winning witness 138 / budget 164**, leaving **26** moves of slack. *Slack of one witness is not a proof of shortest solution or human difficulty.*
- **COUNTERFACTUAL CONFIRMED:** the unit test with the **same two policies** and existing `distinctPaths:true` passes on both complete game boards. The selector also accepts the ordinary board when it comes first, although its recorded successful route is 25 actions shorter. A late loss from these policies is therefore not a valid discriminator between these two cases.

The test executes actual consumer `selectEquality` and independently replays BOTH witnesses with `tools/qa/gameplay-oracle`. Its **unit test passed** as part of `npm run check` in [CI run 45054239044](https://github.com/DanilaH/asoc-solitair/actions/runs/45054239044). Other browser/real Android gates are independent. This does not guess source-native bot policies. [Corresponding kit research PR #119](https://github.com/DanilaH/mini-games-kit/pull/119) records the evidence; full generator/P06 source study is [kit #118](https://github.com/DanilaH/mini-games-kit/pull/118). Treat any observed acceptance as **PRODUCT_MODEL** and keep source-native/real-player claims open.

## Product consequence

**Do not activate or claim fairness based only on the two late-loss traces.** Preserve owner-approved P07/P08 full scope and all four payer segments, and preserve the tested optional issuer/SaveStore contracts; the defect is in evidence **quality**, not a reason to exclude Equality.

Before QA acceptance, add at least: (1) neutral ordinary-pool counterfactual acceptance-rate comparison; (2) actual different bot decision policies, including transfer-first and semantic/foundation-aware variants, not forced stock exhaustion; (3) candidate-winning alternatives/branching and bounded UNKNOWN over multiple randomized seeds; (4) source-native strategy-system inspection and original runtime captures where available; (5) blind player tests on physical Android with recorded mistake/recovery rates. Report tiers separately and avoid inferring exact source behavior or retention from a model.

**KIT IMPACT: REUSE + CANDIDATE for research QA methodology; no game runtime, merchant, price, ad or inventory IDs changed.**
