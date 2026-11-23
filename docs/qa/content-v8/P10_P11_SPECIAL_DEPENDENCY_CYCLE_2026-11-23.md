# Hitapps specials · source-informed authoring dependency-cycle counterexample

**23 November 2026 · PRODUCT_ADAPTED rules, not ORIGINAL_RUNTIME.** Base: [independently QA-tested P10–P12 composite PR #173](https://github.com/DanilaH/asoc-solitair/pull/173). Source static evidence in [kit PR #121](https://github.com/DanilaH/mini-games-kit/pull/121), original 1.26.2/code3742 native pattern fields `FrozenCardData.layers` and `BoundCardPattern.boundCards/scissors`. Actual Hitapps thaw/cut rules, server patterns and live original boards remain UNKNOWN.

## Counterexample that ordinary syntax validation cannot catch

On a four-card, two-category, original-author-controlled *product* board:

- A has leader `a` and **ice1** member `a1`.
- B has leader `b` and bound member `b1`, whose scissors trigger is `a1`.
- Own Frozen rule removes one layer per completed category; own Bound rule releases only once its designated scissors card reaches an upper foundation/collected group.
- **Cycle**: A cannot finish until B completes to thaw `a1`; B cannot finish until `a1` reaches a foundation; `a1` cannot reach foundation before A finishes. With both frozen and bound cards immobile there is no solution.
- Current source-shaped schema/board can be syntactically valid under `assertBoard` despite this puzzle-level deadlock. A direct negative test on the independent gameplay oracle `search(..., cap=2500)` must return **exhaustive UNSOLVABLE**, not cap-UNKNOWN.

Fixing *only* `scissorsByCard.b1` to point at unlocked `a` changes the dependency graph and yields a four-move winning witness `a→f0, b→f1, b1→f1, a1→f0`, separately replayed in actual `applyBoard` and independent oracle. The geometry and move budget stay unchanged. Thus the combination, rather than the isolated special mechanics, caused the issue.

## Transfer and release QA

**Do not** declare source Hitapps generator faulty: original `TryToWinLevel` and applier pattern application may reject such combinations; original active configs are not captured. This is a **clean-room product authoring guard example**. Apply the full Reference→Product rule:

1. For all future product special-card generated Deals, certify final state **after Frozen/Bound/Puzzle insertion**; an initial vanilla shuffled deal's winning witness is not enough.
2. Track failure reasons separately: `FEATURE_APPLIED`, `FEATURE_FAILED`, `UNSOLVABLE_PROVEN`, `SOLVER_BOUNDED_UNKNOWN`, `RECOVERABLE`, `HUMAN_QA_OPEN`. Do not attribute a failed applier to a rejected candidate unless source/prod selector actually does it.
3. Add explicit dependency-cycle diagnostics for frozen card progress, scissors trigger and required puzzle halves to the *offline authoring report*, but do not rely on a graph-only heuristic as a mathematical no-solution proof. The independent solver has final authority within its documented coverage.
4. Keep all 115 source features, 38 packets, historical Deal IDs, commercial settings and full owner-approved roadmap. Distinguish source static gates from product adapted thaw/scissors semantics.

**QA provenance:** `tests/unit/content8-special-authoring-cycle.test.ts`, running actual Rules3 `applyBoard` and independent `tools/qa/gameplay-oracle` search, under a separate non-published fixture. Exact CI result and human/device original runtime status reported independently.

**KIT IMPACT:** reusable source-informed negative game-authoring method candidate, not common runtime policy and not a new original feature.
