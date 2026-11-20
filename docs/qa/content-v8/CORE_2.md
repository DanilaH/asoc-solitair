# Content 8 CORE-2 · director preview 0.19.5 (36)

[CORE-2 PR #51](https://github.com/DanilaH/asoc-solitair/pull/51) uses the CORE-1 authoring pipeline and active C8 research through [#53](https://github.com/DanilaH/asoc-solitair/pull/53). Research inventory and adoption ledger cover all 112 IDs. The runtime mini-games-kit pin remains `a9325265e87583a4872cf6a158e1e881a0d7508e`.

The app records up to ten actual first clears as Clean, ExtraSteps or Restart with a count of restarts. Reload, Undo and late receipts do not add outcomes. Historical saves without this history gather outcomes as the player plays. The 0.19.4 history can be read without the optional saved penalty.

## Product configuration R1

Fresh starts of uncompleted C8 levels 11–15 can issue one of two prevalidated variants. The weighted win rate below 70% selects relief (+10%) and above 90% selects the tight budget (−5%), subject to the source-shaped penalty reset. A full ten-outcome window is required for DynamicDifficulty. EasyDeals can select the relief variant on a fresh start of the same level after three losses, ahead of the current penalty. Players can do this via Home → Play or the level picker. The result panel’s Restart and continuing a parked or reloaded session retain the issued ID. All selected IDs include the R1 revision. Each device save stores the exact current board and remaining moves through the existing SaveStore.

| Level | Default / tight / relief budgets | Relief seed | Moves on the tight / relief witnesses |
| --- | --- | --- | --- |
| 11 | 168 / 160 / 185 | 110097 | 146 / 146 |
| 12 | 67 / 64 / 74 | 121204 | 61 / 60 |
| 13 | 120 / 114 / 132 | 131236 | 107 / 106 |
| 14 | 118 / 112 / 130 | 141213 | 107 / 106 |
| 15 | 118 / 112 / 130 | 151299 | 108 / 106 |

Tight uses the default layout. The relief seed is different on levels 12–15. Level 11 uses the default layout with extra moves. The bank records the final boards and witnesses. Unit tests reproduce the relief stock and tableau from their seeds and replay every variant with the independent Rules 3 oracle. The known witness and remaining slack establish a path to victory. Human difficulty is pending. FTUE, previously issued attempts, completed-level replays, Daily and levels outside the R1 bank use their existing issuance rules.

## Source verification and remaining work

| Mechanism | Evidence and next gate |
| --- | --- |
| DynamicDifficulty | Game-model tests cover the ten-result window, restart weighting, strict rate boundaries, penalty reset and signed rounding. R1 percentages are product playtest values. Original live defaults and rate rounding remain open. |
| EasyDeals | Game-mode issuance uses a certified relief bank and the configured loss threshold. Native `decCoef`, the two lookups and the post-Paywall branch still need separate source verification. |
| Equality and payer eligibility | Offline model executes real Rules 3 on independent copies of one candidate. Definite LOST at 79% and UNKNOWN are rejected. At 80%, each policy must agree. Seed, level, issuance cap and segment gates are separate. Runtime issuance awaits precise three-stack pair placement and RNG consumption, a verified candidate bank and explicit eligibility policy. Recovery proof from an actual exhausted state belongs to CORE-5. |
| FeatureLevelSeed | Fresh models one reshuffle at the first eligible Shuffle applier. An invalid pattern can still fail after the reshuffle. PreparePriority skips the extra reshuffle for an already prepared candidate. The functional Lockers, Frozen and Bound appliers belong to CORE-4. |

Checks cover same-level Start and Reload through touch input, retry/parked/Undo persistence, older save formats and canonical first-win rewards. Physical Android playtest and original reference app traces remain open. KIT IMPACT · REUSE.
