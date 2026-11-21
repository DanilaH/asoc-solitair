# Content 8 · Q2 director source → product evidence and remaining parity gaps

**21 November 2026 | RESEARCH SOURCE/PRODUCT CODE AUDIT, NOT HUMAN ACCEPTANCE.** Active consumer: 0.20.3 CORE-5 (runtime `b15c075004081ab42828f22012920462f318c782`), branch inherited Q1b research. Original Hitapps client: `com.hitappsgames.wordsolitaire` 1.26.2/code3742, native ARM32/XAPK SHA `22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0`. No original Android execution in this audit.

**Research provenance:** [native DynamicDifficulty functions, lifecycle and penalty](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-difficulty/README.md); [native candidate selection and Equality distinction](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-candidate-selection/README.md); [Paywall/segment gates](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-paywall-activation/README.md). Product: `src/domain/difficulty.ts`, `src/domain/services.ts`, `src/domain/engine.ts`, `src/domain/campaign.ts`, `src/content/campaign-v8-director.ts`, `tools/content/difficulty-selection.ts`, `tests/unit/difficulty-director.test.ts`, `docs/qa/content-v8/CORE_2.md`. Neither the research verifier nor the product tests establish original runtime activation.

## 1. Verified original source contract (do not reinterpret as active server configuration)

- `DynamicDifficultyService.UpdateProgress`: `Clean=1` fills an empty slot; `ExtraSteps=2` supersedes Clean but not Restart; `Restart=3` supersedes both, incrementing the current-slot restart count. Native lifecycle callers: `OnContinueRequested → ExtraSteps`, `OnRestartedLevelBegin → Restart`, `OnLevelWon → Clean`, followed on winning by `IncrementPointer → CheckProgress`. **Continue requested does not prove paid/rewarded success**.
- After **ten recorded completed results**, `CleanRate=Nclean×10`; `AdjustedRate ≈ round(10 × (Nclean + Nextra + Σ[1/(restartCount+1)]))`. Native tie rounding is still unverified. Strictly above upper configured rate selects Hard, strictly below lower selects Easy. `SetPenalty` resets an opposite-sign stored penalty to zero, rather than accumulating the next opposite-sign penalty immediately.
- `GetStepsLimit` applies a signed percentage to the authored move budget only where `IsStableMoves` is true; native bootstrap separately adds the dynamic penalty to a source-level field before conversion. The complete post-override original final board is **unknown**.
- `EasyDeals`, `Priority` and `Equality/Paywall` are **distinct** strategies. Source Equality targets late automated non-wins at ≥80% of the move budget, not mathematically proven human dead ends. Its real original activation requires a positive Paywall seed plus remote config (enable/minLevel/segment/cap), whose values and actual active population remain **unknown**. It is not interchangeable with the product's explicitly certified +10 exhausted-board recovery.

## 2. Actual 0.20.3 implementation and delta

| Mechanism / source ID | What product currently does | Evidence boundary / missing proof |
| --- | --- | --- |
| `hitapps-dynamic-difficulty` | `recordCampaignOutcome` appends Clean/ExtraSteps/Restart **only when first clearing a campaign level**; ten-completion window, restart weighting, strict cutoffs, signed penalty budget math. R1 product config minRate70/maxRate90, hard−5%, easy+10%. | Original writes intermediate Restart/ExtraSteps immediately into its current level slot and advances its pointer on win. Our product writes a single consolidated outcome at first clear. Likely same broad ranking of **completed, first-clear** attempts; exact source event timing and replays/abandoned attempts are **not** equivalent. Original live config and float rounding unknown. |
| `hitapps-easy-deals` | Three **exhausted losses** on same R1 level can select a pre-certified relief deal on fresh issue; in-place Restart retains old deal ID. `previousLosses` increments only for exhaustion; `restarts` increments on restart even before exhaustion. | Real original EasyDeals `decCoef`, two target lookups and post-Paywall priority are not yet fully reconstructed. R1 thresholds and eligibility are **product policy**, not source-live defaults. |
| `hitapps-candidate-priority` | Source-shaped offline seeded candidate authoring, but actual app uses fixed published immutable deals. | Normal game launch does not run native Hitapps candidate search for each request; source seed→final original Android board parity absent. |
| `hitapps-equality-paywall` / `hitapps-paywall-segmentation` | Offline positive-seed, min-level, cap and segment eligibility model; independently replayed late no-win across policies. Actual campaign does **not** issue those candidate boards in R1. | No original active remote config or player cohort, no certified fully integrated Paywall issue path. Separate CORE-5 +10 is product ContinueConvertible, not source Equality. |
| `azur-coin-moves` / `azur-rewarded-moves` | CORE-5 selected exhausted positions can offer actual proven +10, with durable receipt/coins. | Different original AZUR mechanic; neither a DynamicDifficulty signal nor a substitute for source Paywall eligibility. Real original/Android SDK still unverified. |

**Critical scope detail:** R1 uses exactly **five source-independent product levels 11–15**, two variants each = **10 published variants**. No such newly issued dynamic variants exist for 16–80. Existing campaign's main 80-level bank, archived identities and active/parked saves remain unchanged. Any full-80 extension must use a new versioned issue policy and certified bank, not an inferred blanket native parity.

## 3. Verified R1 variants — budget, not an observed human difficulty grade

| Level | Default / tight / relief moves | Relief source | Witness length tight / relief |
| ---: | ---: | --- | ---: |
| 11 | 168 / 160 / 185 | Same card order, budget-only relief | 146 / 146 |
| 12 | 67 / 64 / 74 | R1 second seeded layout | 61 / 60 |
| 13 | 120 / 114 / 132 | R1 second seeded layout | 107 / 106 |
| 14 | 118 / 112 / 130 | R1 second seeded layout | 107 / 106 |
| 15 | 118 / 112 / 130 | R1 second seeded layout | 108 / 106 |

Actual bank `src/content/campaign-v8-director.json`: **5 records**, `content8DirectorDeals` generates 10 resolvable frozen variant IDs. Q1 decision audit sampled those **10** variants separately: 115 alternative probes, 67 independently replayed wins, 48 bounded UNKNOWN; this is neither source parity nor player difficulty.

## 4. Two product-policy effects worth human testing (not proven defects)

**A. Using +10 can still count as high adjusted performance.** Original-derived formula gives `AdjustedRate = 100` even for **10 completed ExtraSteps** outcomes (because ExtraSteps contributes 1; `CleanRate=0`). With our **own** maxRate90 setting, the next eligible issued level takes the hard (−5%) branch. Native source and current product tests agree on weighting, but player-facing fairness of this policy is unmeasured. Do **not** label ten continuation wins «clean»; separate adjusted rate from clean rate in QA telemetry.

**B. The history only affects levels 11–15.** After ten first clears, a Clean-heavy player can receive a tighter level 11; after level 15, the stored penalty remains, but the current deal bank has no 16–80 director variants to act on it. That is a known **partial R1 rollout**, not proof that a full original adaptation is shipped. Likewise, three failures on the same current level can trigger EasyDeals relief, independently of the ten-completion history.

## 5. Next independent checks

1. **Source-event exactness:** native `UpdateProgress` writes and pointer lifecycle across restarted → resumed → abandoned → won, especially whether OnContinueRequested fires before earned/ad dismissal; original app execution remains P0 blocked by a controlled ARM32 environment. Do not regress product receipt semantics to mimic an unverified remote flow.
2. **Product correctness (automatable):** source-aligned ten-outcome synthetic windows: 10 Clean, 10 ExtraSteps, 10 Restart once, 4+4+2; exact 70/90 boundary; penalty opposite-sign reset; each R1 fresh issue and saved retry/Undo/park/reload; 11–15 only, no accidental 16–80 issue. Existing `tests/unit/difficulty-director.test.ts` already covers many but not source event-time parity.
3. **Difficulty value (human/P6):** A/B compare the same level's frozen default/tight/relief on real Android; record attempts, move slack, hint use, first wrong transfer, active duration and player acceptance. Ten outcomes without a controlled observer cannot quantify native retention impact.
4. **Expansion gate:** independently certify additional variants and explicit policy for full 80; validate old immutable deal IDs, saved attempt identities, native receipt ordering, source-inventory 114/114 and Android UI. Do not blend `EasyDeals`, `DynamicDifficulty` and `Equality` into one fabricated «difficulty manager».

**Recommendation:** retain the staged B2/B3 implementation; advance the trace and real-human checks. No broad director retune or automatic source exclusion based solely on the current model. Original live remote config, final RNG/boards, and human difficulty remain **UNKNOWN**.

**KIT IMPACT: REUSE** reference → product evidence framework and native-static source studies; no new general runtime code or source feature ID. 114 original Hitapps/AZUR/Unico feature IDs remain in the consumer adoption ledger.
