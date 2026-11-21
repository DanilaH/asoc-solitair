# Content 8 — B3: source-bound Equality/Paywall activation versus current product

**21.11.2026 | INDEPENDENT RESEARCH AND QA; NOT A LIVE FEATURE ACCEPTANCE.** Current product evidence: C8 0.20.3/CORE-5 branch `b15c075004081ab42828f22012920462f318c782`, research descendants through B2/Q1b. Source: original Hitapps `com.hitappsgames.wordsolitaire` **1.26.2/code3742**, XAPK SHA256 `22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0`; ARM32 static verification, **zero original app Android executions**. This report advances the owner-approved [PR #42 commercial-selector specification](https://github.com/DanilaH/asoc-solitair/pull/42), not historical agent-authored rejection. All reference systems remain on the roadmap.

## 1. Source execution chain — what is actually known

The [Hitapps candidate-selection study](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-candidate-selection/README.md), [native eligibility](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-paywall-activation/README.md) and [three-stack RNG study](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-rng-stacks/README.md) together show **distinct source phases**, not one generic "hard level" switch:

```text
BuildSimulatedPlan: LevelDto.PaywallLevelSeed > 0
  + IsPaywallAvailable(enable, currentLevel+1 >= minLevel,
                       payerTypeList contains GetPlayerStatus(), attempts < cap)
  -> GetPaywallStrategyType = NoPossibleMoves(1)
  -> LevelSimulationRunner.Run = Equality(1)
  -> ShuffleLevelWithSeed(seed, placeCategoryPairsOnTop=true)
  -> 3 unique play-stack indices from the SAME already-advanced EmbeddedRandom
  -> feature Shuffle callback (Lockers/Frozen/Bound when eligible)
  -> strategy-system bot trials: NOT WON with steps >= 0.8 * MovesLimit
  -> conditional candidate-selection branch + LevelType.Paywall
  -> separate Final phase (e.g. Golden/StarterBooster, when eligible)
```

**Crucial source provenance and limits:**
- `GetPaywallStrategyType` original RVA `0x240b0b0` delegates to `IsPaywallAvailable` `0x240b238`. Four named segment statuses are NonPayer(0), Payer(1), PotentialPayer(2), SleepPayer(3); native price/payment history source is different from current product's unresolved IAP provider. Eligibility includes **positive Paywall seed**, config enable, minimum level, whitelist and attempt cap; values and cohorts are **UNKNOWN**. Original native `GetPlayerStatus` checks a date branch before the purchase-made branch; do not manufacture extra source guarantees.
- When the strategy qualifies, `Equality` seeks a **late bot failure**, not mathematical impossibility, not 80% chance to lose and not proof players would pay to recover. It is distinct from successful-bot `Priority`, EasyDeals relief and our own `ContinueConvertible`.
- The fourth Shuffle argument conditionally invokes `PlaceCategoryPairsOnUniqueStacks` **only for Equality strategy=1** in the inspected simulator call path. Native calls `EmbeddedRandom.Next(playStackCount)` until **three different indices** have been selected, skipping duplicates. Verified source ABI/100-word AOT clone does **not** on its own provide a complete card-pair placement algorithm or the **already advanced** RNG state, card order and actual emitted stock. Fresh RNG seed examples are not observed original placements.
- The **alternative Initial path** `PaywallFeatureApplier.Apply` can reset `paywallAttempts`, gate on seed and availability, shuffle with the paywall seed and mark context flags. The simulated-path successful strategy check can **increment** the counter before final candidate acceptance. These are distinct native control-flow paths; the current conditional 100-candidate cap does not guarantee 100 attempts occur in every live session.
- Among **226** original authenticated local level records, **none** contains a visible root Paywall field/seed. Remote overrides and live activation remain unknown. Original `campaignList` field is known to exist but its use in this call path is not established.

**Evidence tier:** `NATIVE_STATIC` for the bounded source control flow, `SOURCE_MODEL` for our test code. `ORIGINAL_RUNTIME`, live cohort, selected final board, revenue/retention and human difficulty are all **NOT VERIFIED**.

## 2. Actual product code audit — what exists and what is missing

| Feature / source ID | Existing source/behavior on our active branch | Missing for a real port | Correct stage |
| --- | --- | --- | --- |
| `hitapps-equality-paywall` | `tools/content/difficulty-selection.ts` models eligible + `selectEquality` over Rules3 bot trials; enforces observed ≥80% predicate and a max of 100 candidates | **No product `selectCampaignDeal`/SaveStore path calls `selectEquality`; no offline issued pool with selected special source Deal ID/seed/phase/strategy outcomes.** No current active C8 Equality specials | B3 IN_PROGRESS |
| `hitapps-paywall-segmentation` | Offline `eligibleForEquality` takes input `level,seed,issued,segment`; configurable enabled, minLevel, cap, whitelist | **No authenticated purchase-status classifier, live configuration or saved special-issuance counter**. The synthetic `unknown` segment is a local sentinel; a test config can include it, but that is **not** an original Hitapps purchase cohort. Native reset/increment lifecycle unported | B3 IN_PROGRESS |
| `hitapps-equality-three-stack-pair-placement` | Ordinary Hitapps-style source-ordered seeded dealer exists; current `preparePriorityPlan` has no Equality pair placement callback | No `placeCategoryPairsOnTop` flag threaded from Equality to the same advanced RNG, no 3-distinct-index selection + exact card-pair transform, no paired-state validation after Shuffle and before Final | B3 ROADMAPPED |
| `hitapps-feature-seed-one-time-reshuffle` | Separate phase model and once-only re-shuffle flags in `tools/content/candidate-pipeline.ts` | Concrete Frozen/Bound/Lockers source appliers and final source-native candidate parity remain open | B3/D1 IN_PROGRESS |
| `azur-coin-moves`, `azur-rewarded-moves` | Current CORE-5 tests real exhausted C8 board for legal route within +10, uses existing receipts, supports saved credit and coin offer | Physical Android earned/no-fill/foreground and original AZUR prices/results unverified. This is **our own actual-board** continuation, not original Hitapps Equality issuance | E1 IMPLEMENTED_UNVERIFIED |

**Runtime call-chain observed:** `src/main.ts` → `src/content/campaign.ts:selectCampaignDeal` → `src/content/campaign-v8-director.ts:selectC8Deal` selects only current **normal, tight and relief** fixed R1 deals (levels 11–15); `src/domain/campaign.ts:beginDeal` saves the exact selected ID. Neither `selectC8Deal` nor `src/content/campaign.ts` imports the offline Equality selector. Other levels follow the ordinary/special/bonus published banks. Current win/continuation UI is not equivalent to a native Paywall-generated level.

**Proof-of-independence gap:** offline `selectEquality` demands **distinct policy IDs**, not distinct bot logic. Two identical `SimulationPolicy.choose` functions under different IDs can both satisfy the threshold. The source iterates strategy systems; those exact bots, their behavioral independence, RNG use, feature interactions and fallback are **not** reconstructed. A green synthetic test therefore proves only our predicate, not source-equivalent gameplay difficulty or multiple authentic strategies.

## 3. Source / product boundary tests (read-only current model)

`tests/unit/content8-equality-source-boundary.test.ts` adds independent negative-control fixtures for:
- positive signed seed, minLevel, enabled config, attempt cap and the four named whitelisted segments; `unknown` is excluded unless **our synthetic config** lists it (no actual billing evidence);
- 79% early policy failure rejected vs two 80%+ late LOST results accepted only in the existing product **offline** adapter; UNKNOWN or a winning bot cannot qualify; full candidate search returns at most 100 attempts;
- existing adapter only checks unique strategy names, not behavioral difference — demonstrate this limitation deliberately, rather than disguising a copied bot as source parity.

Tests require current Rules3; fixtures are self-authored minimal card sets, **no vendor words/assets/code**. No release change, no live special seed, no modified purchase flow.

## 4. Exact independent implementation packet for developer (B3, owner-approved roadmap)

**B3.1 — controlled offline source branching (no user issuance yet):** implement the equality-only `placeCategoryPairsOnTop` path with a deterministic injected **already-advanced** EmbeddedRandom state, source-supported exactly-3-distinct-index sampling, and a separate verified/unknown boundary for the actual pair transform. Add negative fixtures: 3/4/5-column repetition draws, same-seed stream consumption before/after, flag off for Priority/None, lock/frozen/bound appliers and failed-feature flags. Never label a partial transform exact native parity.

**B3.2 — candidate selection proof:** generate *our own* immutable special candidates offline using separate Equality vs Priority strategy modes; log request/actual seed, candidate count/cap, first accepted branch, real policy IDs and distinct behavior proof, late LOST vs UNKNOWN vs WON, feature-phase statuses, actual moves limit, original-source-evidence tier and final board digest. Validate **complete candidate state** through Rules3 and independent oracle; do not call LOST `UNSOLVABLE` without exhaustive graph proof. Negative controls at B=99/100/101, 79%/80%, policy winner, timeout, failed pair transform, 100-attempt cutoff.

**B3.3 — configured runtime experiment (separate explicit scope / default disabled):** only eligible new campaign issue selects a **pre-certified** versioned ID; SaveStore atomically persists chosen ID, attempt, counter/flags and immutable board. Never reinterpret prior attempts or Daily. Distinguish `eligible`, `attempted`, `selected`, `issued`, `lost` counters; original native counter is **not** an issued count. If payer segment is unsupported or config absent, default to ordinary bank, not a fabricated paid-status cohort. Reset/retry/Undo/parked/migration tests before any live monetization release. No UI-thread solver.

**B3.4 — fair recovery / commercial safeguards:** treat `SourceEquality` (original conditional late-bot failure) as **separate** from `ContinueConvertible` (product's additional criterion). Keep existing CORE-5 actual-exhausted-board <=10-move **proven route** as prerequisite for showing a rewarded/coin +10 offer; UNKNOWN must not be marketed as guaranteed completion. No synthetic earned receipts, no spending on unavailable rescue, no second grant/SDK. Measure earned impressions, resumed wins, quit/restart and genuine day-one/day-seven retention by variant with suitable consent. A source-side score alone does not justify injecting unwinnable deals.

**B3.5 — source runtime validation gate:** two isolated original ARM32 Android captures with real eligibility/config, seed and selected pre/post Shuffle/Final board, original class/per-strategy bot outcomes and counter lifecycle. Until then, source-parity acceptance remains limited to static branch evidence; original live activation remains UNKNOWN. [Prepared original runtime oracle](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-runtime-oracle/README.md).

## 5. Carry-forward systems; not excluded

Keep `hitapps-stock-restore` (different future paid rule from our presently free recycle), `hitapps-revive-offers` (broader segmented multi-offer economics), `azur-unlimited-moves-offer`, `hitapps-adbreak`, IAP catalog, VIP, GoldenCards, timed events, albums and all other inventory items in the unified consumer roadmap. B3's incomplete port is **not** a basis for permanent HOLD/REJECT. Only the owner can choose `OWNER_EXCLUDED`.

**Acceptance:** source → code → verified candidate → saved actual issuance → accurate earned receipt → real device/offer → human fairness are **separate gates**. Current conclusion: **B3 offline model exists; real Equality special-deal issuance and original runtime parity do not.** No automatic product difficulty/monetization change approved by this research PR.

**KIT IMPACT:** REUSE [Reference → Product Porting Framework](https://github.com/DanilaH/mini-games-kit/blob/main/docs/agent-workflows/REFERENCE_PORTING_FRAMEWORK.md) and [Playability Choice Evidence Ladder](https://github.com/DanilaH/mini-games-kit/blob/main/docs/agent-workflows/PLAYABILITY_CHOICE_EVIDENCE_LADDER.md). Evidence distinction reinforces existing methodology; no new shared kit runtime API.
