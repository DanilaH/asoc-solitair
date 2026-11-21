# Association Solitaire — полная дорожная карта переноса исследованных систем

**19 ноября 2026 · Owner scope: full reference-system adoption, staged implementation · research/program document, NO game runtime edits in this PR.**

This is the **single product-facing stage map** of all currently inventoried Hitapps/AZUR/Unico systems. The source inventory [mini-games-kit](https://github.com/DanilaH/mini-games-kit/blob/7f91abfd824162780a6567c6823b95864142957c/research/games/association-solitaire/porting/SOURCE_FEATURES.json), this [consumer ledger](ADOPTION_LEDGER.json), and the [full source evidence audit](https://github.com/DanilaH/mini-games-kit/blob/c751ae5e20cf5d466d4f2b4eb1ed504f0a220395/research/games/association-solitaire/porting/FULL_REFERENCE_AUDIT_2026-11-19.md) must be reconciled before any implementation.

**Current ledger snapshot (21 November 2026, audit PR #70 branch on 0.20.3):** **114 feature IDs**, **39 IMPLEMENTED_UNVERIFIED**, **5 IN_PROGRESS**, **47 ROADMAPPED**, **1 DEFERRED**, **9 BLOCKED**, **13 EVIDENCE_GAP**; **0 ACCEPTED**, **0 OWNER_EXCLUDED**. These are exact status counts from `ADOPTION_LEDGER.json` on the audited branch, not a claim that these features were merged into `main`, tested on physical Android or matched to live original clients. Human/device acceptance and original runtime evidence remain separate gates. The earlier 29/2/60 counts represented the pre-CORE-5 roadmap and must not be reused as current. Later source discoveries must be added; this inventory is not exhaustive of all original remote configurations.

## 0. B3 evidence checkpoint (21 November 2026)

[Equality/Paywall research-to-runtime audit](../qa/content-v8/B3_EQUALITY_PAYWALL_SOURCE_TO_PRODUCT_2026-11-21.md): the existing `selectEquality` and `eligibleForEquality` are **offline source-shaped models**, not a currently issued C8 special-deal path. Hitapps' native flag selects three unique columns in Equality-only simulation; final pair transform/advanced RNG, live server cohort/counter/remote activation and post-Final boards remain UNKNOWN. The product +10 receipt on exhausted boards is **separate ContinueConvertible**, not proof of SourceEquality. All B3 IDs and all 114 discovered systems stay in roadmap. Verified Q1b route-cost results (PR #75 CI 44899121169) are documented separately; no product balance changed.

## 1. Action priorities based on dependencies (not a feature ceiling)

**A — Governance & acceptance.** The porting framework [kit PR #73, merged](https://github.com/DanilaH/mini-games-kit/pull/73) and [game PR #43, merged into active Content8](https://github.com/DanilaH/asoc-solitair/pull/43) are in place. Preserve current `AGENTS.md` and consumer `PORTING_POLICY.md`, never restore C6/C7 agent-authored feature bans. CI gate must compare **all source IDs vs ledger IDs** and require reason/action for blockers; only explicit owner order can create `OWNER_EXCLUDED`.

**B — Core generator + director.** Normal `Priority` and ordinary C8 generator already have partial source-derived parity. Implement independent source-model `DynamicDifficulty` (Clean/ExtraSteps/Restart, 10-entry window, configured penalty on eligible budget), `EasyDeals` loss-streak relief, and the separately requested `Equality/NoPossibleMoves` special selector. These policies must **not be collapsed** into an invented single target loss heuristic. `SourceEquality` merely finds late bot non-wins; our `ContinueConvertible` requires certified move-budget and actual recovery-path evidence. [Game PR #42](https://github.com/DanilaH/asoc-solitair/pull/42). Freeze chosen deals for each attempt, preserve Undo and dated Daily.

**C — Actual 1–80 playable content.** Accept Content8 1–15 on a **physical Android**, including Hint/Undo/Joker, stock/waste, difficulty presentation and lost/recovered play. Fix current red CI first: one 320px board-contact visual test and external Gradle dependency resolution; not evidence that documentation broke game. Rewrite 16–80 to reference-size/meaningful decision structures, not legacy Content7 collapse at level16. Reconstruct five-column geometry at source positions26/31; beyond Hitapps local EN31 treat exact source parameters as UNKNOWN. Track both layout novelty and semantic-repeat distance. **No artificial 15/20 level product cap.**

**D — Special play and feedback.** Introduce/teach and independently validate all source mechanisms: category order, key locks, frozen, bound, golden cards, extra upper foundation, Magnet/Hammer/Shuffle, word explanations, deck placement, rendering/sound. New rules require rules version, save and helper solver, cost/pricing tests and non-copied assets. GoldenCards placement is separate from the Gold Rush event reward.

**E1/E2 independent research checkpoint (21.11.2026):** [13 E1 recovery/offer systems and 5 E2 ad/cadence systems audited](../qa/content-v8/E1_E2_MONETIZATION_SOURCE_AND_AD_CADENCE_2026-11-21.md). Native AZUR local 900 coins/+10 and 5 rewarded moves differ from our own 120/+10 and 10 earned; do not apply unverified native defaults to product economics. [Consumer ad-clock issue #80](https://github.com/DanilaH/asoc-solitair/issues/80): current `beforeShow` updates persistent fullscreen timestamp and resets interstitial win counter **before** SDK confirms show, even on no-fill. Regression must distinguish requested/shown/impression/earned. The **18 E3 store/IAP systems** remain fully registered, with payment-provider/legal gates, not deleted or automatically OWNER_EXCLUDED.

**E — Complete monetization opportunities.** Expand beyond unique-first-win-only interstitials: explicit in-play opportunities with per-difficulty caps/cooldowns, rewarded +moves and coin choice, further paid/optional help, win-screen bonus, optional paid slots, long-tail daily/replay ad policy, shop and offers. Use existing native receipt queue; never claim ad impression or revenue from show-request. Before premium IAP implement real legal store billing/payout and crash-safe entitlements. `RestoreStock` remains planned but requires explicit gameplay-rule revision because current recycle is free except for one move.

**F — Meta and retention.** Add independent reward/progress layers (picture reveal / timed PuzzleEvent, daily tasks/bonus/rewards, WinStreak, Gold Rush, races and local rival simulation) and eventual extended LiveOps models (regions, LuckyWheel, Digging, EndlessTreasure, birthday/deals, energy/lives, premium/pass). Keep user-authored content/art/save boundaries and truthful simulated opponents. Large features need evidence-gaps and selected implementation steps, **not permanent removal**.

**G — Long-tail.** AZUR 2000-stage structure and thematic/locale delivery: source structural repeat vs semantic rotation, remote overrides and optional localization-aware move budgets. Do not copy proprietary words or claim every source stage solved.

## 2. Packaging by independent developer packages

| Package | Concrete deliverable | Owner/QA gate |
| --- | --- | --- |
| **P0. Stabilize C8 + CI** | Verify PR #41 head, fix browser board-contact and Android Gradle downloads; deliver signed APK and real phone recorded progression 1→15 | All tests and **human acceptance** separated |
| **P1. Director lab + source truth** | Explicit `Priority`, `EasyDeals`, `DynamicDifficulty`, `SourceEquality`, `ContinueConvertible` in independent offline selection harness; raw candidate metrics and no fake parity | Source-verified predicates, failure↔recovery evidence, old SaveStore regressions |
| **P2. 16–80 campaign** | New immutable C8 content, 5-column responsive layout, ordered/keys introduction, full stock/recycle and semantic variety; each deal quality passport | Real gameplay and source-size + decision-choice traces; no artificial “solved = fun” |
| **P3. Special cards/helpers** | GoldenCards, extra foundation, Frozen/Bound, Magnet/Hammer/Shuffle built as separately toggleable tested components | Correct rules, hint, undo, model and developer-run native Android |
| **P4. Reward/ad product loop** | Coin+RV moves, result multiplier, in-level ads with clocks, attribution and future IAP store decisions | Native shown/earned/no-fill receipts, save/relaunch and real impression telemetry |
| **P5. Event/meta suite** | Picture journeys, daily tasks/bonus, Gold Rush, streaks, local race, bigger region and offer families in staged stand-alone PRs | Native event reset/claim, deterministic schedule, production art/locale and player return |
| **P6. Continued research** | Original ARM32 final state, Unico build/native, Hitapps active remote settings, later-level source beyond EN31, data-backed commercial rates | Status stays evidence gap; no invented algorithm advertised as original |

Packages may run **in parallel** if independent. A smaller first playable or short pilot is an **evaluation stage**, not a decision to limit the product. Risks/costs belong in estimates, not deleted ledger rows.

## 3. Exact complete stage matrix

Every known source ID appears exactly once; a stage is **not** a permission to omit other systems.

### B1. Генератор и выбор обычного кандидата (8)

C8 source-derived dealer; random seed/stock tableaux, known target steps and independent oracle before altering gameplay.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-stock-dealer` | `IMPLEMENTED_UNVERIFIED` | Confirm original-device final-board parity and Content8 human/device QA |
| `hitapps-candidate-priority` | `IMPLEMENTED_UNVERIFIED` | Independent original selected-seed/runtime parity; measure human decision quality |
| `azur-deck-draw-and-recycle` | `IMPLEMENTED_UNVERIFIED` | Add exact source-model two-pass fixtures, Undo/reload/faceUp/cycle UI tests; compare user-observable order rather than internal array equality |
| `azur-defeat-vs-no-valid-move` | `IMPLEMENTED_UNVERIFIED` | Verify native branch budget exhaustion&&!win separate from legal-action availability; test stock/recycle cycles and no false loss on temporary no-transfer |
| `azur-async-theme-art-preload` | `ROADMAPPED` | [Original static art evidence PR #88](https://github.com/DanilaH/mini-games-kit/pull/88) and [runtime oracle PR #90](https://github.com/DanilaH/mini-games-kit/pull/90): original LoadAndStartLevel→PreloadThemes→positive TryGetLoadedSpriteCount supplies member-card count, but **zero actually observed Android loads**. New numeric Frida hooks can capture requested theme count and loaded/not-loaded sprite IDs/counts with no image/PII. Implement separately versioned optional AZUR offline authoring/immutable Deal, fallback on missing art, real device verification before original parity |
| `azur-art-sprite-wordcount-override` | `ROADMAPPED` | [Original AZUR 1.3.3.8 native source proof, kit PR #86](https://github.com/DanilaH/mini-games-kit/pull/86): BuildArtCardCountsForThemes looks up loaded CardSpriteData count per theme; positive count replaces default number of member cards in GenerateCards; member word ref uses i % original words count (unique new Card IDs). Implement isolated optional AZUR pre-shuffle content authoring and count/ordinal tests; preserve existing Hitapps C8 immutable deals and source art license. Original live loaded art, rendered images, Unity RNG/final board remain UNKNOWN |
| `azur-generate-deal-entrypoints` | `EVIDENCE_GAP` | [Source-native temporary-list correction, kit PR #91](https://github.com/DanilaH/mini-games-kit/pull/91): original AZUR `DealCards` clones unshuffled `manager.allCards` into a NEW temporary List<Card>, applies Unity Random.Range single-pass Fisher–Yates only to the copy, then consumes column-major prefix (FirstColumnCards+c, last face up) and stock suffix. Prior oracle v1 falsely expected shuffled `manager.allCards`; corrected v2 compares `concat(tableau columns)+stock` against real recorded RNG permutation, verifies unchanged original AllCards, order/card conservation, and rejects special/unsupported branches. **0 genuine original Android captures**; need >=2 before runtime parity. Source game C8 remains Hitapps-based; do not mutate frozen Deal/Undo |
| `hitapps-negative-seed-request-path` | `ROADMAPPED` | Implement native semantics negative-requested-seed→separate random seed draw on eligible paths, record selected seed and reproducibility; not same as EmbeddedRandom ctor(-seed) |

### B2. История игрока и восстановление сложности (3)

DynamicDifficulty (last10), EasyDeals relief, alternative Retry variant. Never confuse a clicked ad with earned extra moves.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-dynamic-difficulty` | `ROADMAPPED` | Prototype ten-result window, Clean/ExtraSteps/Restart and source-derived penalty on new attempts |
| `hitapps-easy-deals` | `ROADMAPPED` | Model native reason codes/threshold and relief after loss streak as separate selector |
| `unico-redeal-restart` | `IMPLEMENTED_UNVERIFIED` | C8 levels 12–15 offer a certified different layout with the same topics. Verify actual Android and original Unico Daily Retry policy. [Checks](../qa/content-v8/CORE_5_REDEAL.md) |

### B3. Special Equality / Paywall (5)

Source-based gating and late simulator failure vs our mathematically certified +10 continuation variant; two distinct modes, existing receipt.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-equality-paywall` | `ROADMAPPED` | Verify and issue source-bound Equality candidates. The product has a separate actual-board +10 check in CORE-5. |
| `hitapps-paywall-segmentation` | `ROADMAPPED` | Implement eligible profile/attempt gates with explicit source/runtime uncertainty |
| `hitapps-equality-three-stack-pair-placement` | `ROADMAPPED` | Implement exactly flagged placeCategoryPairsOnTop for Equality only with same advanced RNG stream; compare selected stack indices and new candidate stock/cols in offline tests |
| `hitapps-feature-seed-one-time-reshuffle` | `ROADMAPPED` | Model shared LevelShuffled flag and precisely one FeatureLevelSeed shuffle across valid Lockers/Frozen/Bound; test invalid pattern flags without assuming unchanged board |
| `hitapps-initial-shuffle-final-pipeline` | `ROADMAPPED` | Implement source-ordered phases 10/40,20/25/27,30/45 around candidate simulation, with independent source/adapter distinctions |

### C1. Непрерывное обучение и Difficulty UX (4)

User onboarding Hint/Undo/Joker, stock/waste/recycle, visible Hard/SuperHard, first-use evidence.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `azur-action-ftue` | `IMPLEMENTED_UNVERIFIED` | Owner plays 1–8 continuously on real phone; keep achievement markers action-based |
| `azur-tutorial-preset-deal` | `IN_PROGRESS` | [Original dispatcher PR #82](https://github.com/DanilaH/mini-games-kit/pull/82) and [preset schema and placement PR #93](https://github.com/DanilaH/mini-games-kit/pull/93) support the [offline authoring tool](../qa/content-v8/AZUR_PRESET_AUTHORING.md). The tool resolves ordered columns, negative category references and separate stock with last authored card drawn first. Invalid or unavailable presets route to the ordinary dealer. Product checks require an exact card partition. The independently authored Russian example has a verified Rules 3 witness. Native validation, original first-level board and live activation remain open. Campaign activation is an owner decision. |
| `azur-difficulty-label` | `IMPLEMENTED_UNVERIFIED` | Human/device check 320px, accessibility and perceived actual challenge |
| `azur-locked-helper-discovery` | `ROADMAPPED` | Design previewable locked helper icon + level requirement without accidental spending; test screen reader and FTUE progression |

### C2. Полная кампания и тематический контент (5)

Finish C8 16–80, 5-column peaks, semantic repetition control, daily quality/variation.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-level-wave` | `IN_PROGRESS` | Author reference-sized progression16–80 without abrupt stock collapse |
| `azur-topic-rotation` | `ROADMAPPED` | Author semantic repeat-distance schedule independent from layout; test local-language ambiguities |
| `unico-daily-puzzles` | `IMPLEMENTED_UNVERIFIED` | Compare failure-retry loop and daily award once-per-date on actual Android |
| `azur-variable-category-sizes` | `IMPLEMENTED_UNVERIFIED` | Compare S2 4/5/5/7 (category cards incl leader), C8 topics and 80-level semantic curve; independent solve and Android UI QA |
| `hitapps-mixed-word-image-cards` | `IMPLEMENTED_UNVERIFIED` | Audit mixed word/image proportions, asset quality and on-device legibility with original gameplay reference |

### D1. Специальные игровые правила (14)

**Research status (21.11.2026):** [independent D1 source→product report](../qa/content-v8/D1_SPECIAL_RULES_HELPERS_SOURCE_GAP_2026-11-21.md) maps **all 14 existing D1 source IDs**: 4 implemented-unverified, 7 roadmapped, 3 evidence-gap, 0 accepted. Hitapps Shuffle gates/flags are not player-visible card rules; Frozen/Bound/Scissors need exact action-state research. GoldenCards and Magnet/Hammer are **separate Final-phase** systems; original AZUR random-created Joker and existing manual C8 buffer-Joker are different algorithms. This evidence checkpoint changes no runtime or feature inclusion decision.


Ordered, keys, Frozen/Bound, Golden, new upper slot, Magnet/Hammer and Shuffle each with standalone rule + solver + teaching.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `azur-extra-foundation` | `IMPLEMENTED_UNVERIFIED` | C8 levels 22/40 open an upper slot by coin debit or its earned receipt. Authored eligibility, real transfers, Hint, save and Undo are tested. Physical taps, production ad behavior and original runtime parity remain open. [Verification](../qa/content-v8/CORE_4_AZUR_BONUS_SLOTS.md) |
| `hitapps-golden-cards` | `IMPLEMENTED_UNVERIFIED` | [P13 PRODUCT_ADAPTED preparation and award](P13_GOLDEN_CARDS.md). Source payout and event schedule remain P31/P36. |
| `hitapps-ordered-category` | `IMPLEMENTED_UNVERIFIED` | Verify first C8 introduction and match rule provenance; device teaching still pending |
| `hitapps-lockers` | `IMPLEMENTED_UNVERIFIED` | Re-author gated C8 16–80 with independent solver and onboarding/device check |
| `hitapps-frozen` | `IMPLEMENTED_UNVERIFIED` | [P10 PRODUCT_ADAPTED preview](P10_FROZEN_CARDS.md), per-card layers, Undo and two proven routes. Original thaw and source configuration remain P36. |
| `hitapps-bound` | `IMPLEMENTED_UNVERIFIED` | [P11 PRODUCT_ADAPTED binding](P11_BOUND_SCISSORS.md), separately replayed with ice and Undo. Original remains P36. |
| `hitapps-magnet-hammer` | `ROADMAPPED` | Prototype one differentiated helper first, preserving post-seed insertion proof boundaries |
| `azur-shuffle-helper` | `ROADMAPPED` | Determine re-deal constraints/save/provable solvability and user teaching |
| `azur-shuffle-animation-controller` | `ROADMAPPED` | Implement independent shuffle mechanic and optional source-inspired animation only after solver/save guarantees |
| `azur-bonus-lower-column` | `IMPLEMENTED_UNVERIFIED` | C8 levels 30/40 open a separate lower column by coin debit or its earned receipt. Temporary card storage, Hint, save and Undo are tested with up to five columns. Physical taps, production ad behavior and original runtime parity remain open. [Verification](../qa/content-v8/CORE_4_AZUR_BONUS_SLOTS.md) |
| `hitapps-puzzle-top-bottom-cards` | `IMPLEMENTED_UNVERIFIED` | [P12 PRODUCT_ADAPTED paired cards](P12_PUZZLE_PAIRS.md). Original placement and moves remain P36. |
| `hitapps-bound-scissors-pattern` | `IMPLEMENTED_UNVERIFIED` | [P11 PRODUCT_ADAPTED scissors transfer](P11_BOUND_SCISSORS.md). Native reveal, cost and target remain open. |
| `unico-magnet-helper` | `EVIDENCE_GAP` | Acquire verified Unico APK/runtime; reproduce magnet card source/target and unlock semantics, then implement distinct helper; video shows level4 tooltip but not action |

### D2. Качество взаимодействия (11)

Joker, Hint, info/dictionary, lower-buffer/stock side, feedback, sound, cross-device validation.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-joker` | `IMPLEMENTED_UNVERIFIED` | Native playtest Joker, costs, save, cancel, reduced motion |
| `azur-joker-random-column-insertion` | `ROADMAPPED` | [Original AZUR ARM64 PR #84](https://github.com/DanilaH/mini-games-kit/pull/84): GameManager.AddJokerCard uses shared Unity Random.Range bounded by min(configured limit,current columns), gets a lower tableau column, creates/reveals/force-places card, conditionally clears Undo; UI success emits RaiseJokerUsed. Implement separate gated optional helper with documented Undo policy, saved receipt/migration and 320px Android QA, distinct from existing Hitapps Joker. Actual live unlock/price, zero bounds, source device behaviour and RNG state remain UNKNOWN |
| `hitapps-ghost-hint` | `IMPLEMENTED_UNVERIFIED` | Validate Hint after off-witness choice on Android and strict no-charge failure |
| `ui-motion-audio-coin` | `IMPLEMENTED_UNVERIFIED` | Compare actual 1× device footage to game; track child IDs for CardAnimator/coin flights/victory/buttons/shuffle separately |
| `hitapps-ingame-streak` | `IMPLEMENTED_UNVERIFIED` | Replay negative invalid-drop/recycle/Undo against original video and Android coin UX |
| `azur-card-dictionary` | `IMPLEMENTED_UNVERIFIED` | Compare on-device card readability, foreign/ambiguous semantics and text visibility |
| `azur-stock-side-setting` | `IMPLEMENTED_UNVERIFIED` | Test both deck sides with tall stock, ads banner and active/parked game saves |
| `azur-card-animation-controller` | `IMPLEMENTED_UNVERIFIED` | Map source/target animation interruption and cancellation on phone; metadata alone is not exact native implementation |
| `azur-coin-flight-animator` | `IMPLEMENTED_UNVERIFIED` | Compare timeout, landing and duplicate callbacks with original UI reference; physical Android audio pending |
| `azur-victory-reward-sequencer` | `IMPLEMENTED_UNVERIFIED` | Replay skip/background/reopen/win/reward/Next with actual saved wallet and 320px UI |
| `azur-button-haptic-feedback` | `IMPLEMENTED_UNVERIFIED` | Test press/release/exit scale/sound/haptics alignment on signed Android |
| `hitapps-invalid-transfer-feedback` | `IMPLEMENTED_UNVERIFIED` | Recheck touch cancel/hitbox, displayed error semantics and 0 move cost on Android |

### E1. Rewarded и платежные решения на экране результата (13)

Continue +10, coin +moves, rewards multipliers, offer variants, correct no-fill and receipts.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-stock-restore` | `DEFERRED` | Design true rule difference and migration before free/paid restore; don't sell existing free behavior |
| `hitapps-revive-offers` | `ROADMAPPED` | Compare coin/rewarded/segment options and save/device flow |
| `azur-coin-moves` | `IMPLEMENTED_UNVERIFIED` | C8 preview offers +10 for 120 coins after exact-board proof and durable debit. Verify price and channel choice on Android. [Checks](../qa/content-v8/CORE_5_COIN_CONTINUE.md) |
| `azur-rewarded-moves` | `IMPLEMENTED_UNVERIFIED` | C8 shows +10 only for a verified exhausted-board route. Verify physical SDK earned, no-fill and relaunch. |
| `azur-win-multiplier` | `ROADMAPPED` | Prototype optional post-win earned bonus with separate idempotent receipt and economy model |
| `hitapps-win-rewarded-offer` | `ROADMAPPED` | Prototype receipt-safe opt-in post-win bonus under valid Android rewarded SDK |
| `azur-unlimited-moves-offer` | `ROADMAPPED` | Define exact entitlement duration/UI/server/SaveStore/budget migration without falsely copying AZUR |
| `unico-rewarded-theme` | `ROADMAPPED` | Design opt-in themed cosmetic offer, entitlement persistence and receipt grants |
| `unico-double-reward` | `ROADMAPPED` | Compare Unico post-win CTA to AZUR x3 and develop independent rewarded bonus policy |
| `unico-loss-dialog` | `IMPLEMENTED_UNVERIFIED` | [C8 loss recovery](../qa/content-v8/CORE_5_LOSS_RECOVERY.md) promotes a usable action after video fails. Background callbacks are verified against the Android bridge contract. Check physical Android no-fill, earned callbacks and original Unico alternatives. |
| `azur-definition-consumable` | `ROADMAPPED` | Trace Definition usage/intro pricing and define own paid/free resource vs reader UX |
| `azur-free-shop-coin-claim` | `ROADMAPPED` | Prototype source-observed optional 200-coin claim with real receipt/availability/cooldown verification |
| `azur-remaining-moves-coin-bonus` | `IMPLEMENTED_UNVERIFIED` | Check own multiplier/economy and baseline reward integrity; do not label adapted coefficient exact AZUR copy |

### E2. Контекстные рекламные возможности (5)

In-game interstitial gates/caps, Coffee Break offer, banner, exact impression-level revenue attribution.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-adbreak` | `ROADMAPPED` | Prototype in-level configurable opportunities/cooldowns with valid SDK impression attribution |
| `hitapps-ingame-banner` | `IMPLEMENTED_UNVERIFIED` | Phone/RuStore safe-area+SDK ready/impression test; compare original placement and day mode |
| `azur-fullscreen-ads-clock` | `IMPLEMENTED_UNVERIFIED` | Reconcile actual shown-vs-attempt clock and in-level cooldown with native flow |
| `azur-ad-revenue-attribution` | `ROADMAPPED` | Verify ILRD/currency+placements in target ad provider, not revenue from click |
| `unico-coffee-break` | `ROADMAPPED` | Study exact observed break context; design separate optional break/reward and native ad return preservation |

### E3. Коммерческая витрина и предложения (18)

**E3 research checkpoint · 21.11.2026:** [all 18 tracked E3 mechanisms, original 41-SKU AZUR local catalog and legally verified payment constraints](../qa/content-v8/E3_IAP_COMMERCE_SOURCE_TO_PRODUCT_2026-11-21.md); [non-proprietary machine-readable evidence](../qa/content-v8/e3-source-commerce-matrix.json). **9 BLOCKED / 7 ROADMAPPED / 2 EVIDENCE_GAP**, 0 ACCEPTED, 0 owner exclusions. AZUR source 41 = 28 consumable, 13 nonconsumable, zero subscription *in packaged asset*, four separate 5-tier helper families, all 41 local storeIDs/payouts arrays empty; actual paid grants, currencies and seller receipts UNKNOWN. **RuStore own payment SDK for an individual self-employed without IP has been unavailable since 01.02.2026** under current official terms; publication/ads remain separately available. [RuStore official policy](https://www.rustore.ru/developer/blog/self-employed) documents IP on NPD + qualified signature as eligible; [NashStore official developer offer](https://nashstore.ru/doc/developer_agreement) allows self-employed sellers but does not prove live in-app SDK/payout for a given account. Preserve all E3 products in future product scope, but separate offline catalog/receipt architecture from provider-specific real checkout approval.

Starter/Birthday/Decoy, shop bundles, PlayPass/VIP and IAP receipt integrity after store/legal verification.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-piggy-bank` | `BLOCKED` | Verify legal supported Android store purchase/receipts/payout before feature spec |
| `azur-play-pass` | `BLOCKED` | Verify store IAP/entitlements and payments then spec free/premium claims |
| `hitapps-rotating-offers` | `ROADMAPPED` | Inventory eligible offers and verify store purchase capability before implementing any |
| `hitapps-birthday-offer` | `EVIDENCE_GAP` | Verify actual trigger/privacy/eligibility and legal storefront payments before implementing |
| `hitapps-decoy-offer` | `EVIDENCE_GAP` | Inspect concrete source display/eligibility and product semantics; avoid guessing from class name |
| `hitapps-starter-offer` | `ROADMAPPED` | Define owner-approved first-play offer and legal store purchase contract |
| `hitapps-inapp-shop` | `ROADMAPPED` | Separate soft-currency helper store vs IAP; verify actual store capabilities and payouts |
| `azur-offer-campaign` | `ROADMAPPED` | Build separable offer schedule + owner-verified store provider after event state |
| `unico-vip` | `BLOCKED` | Confirm legal IAP + Russian self-employed payout/provider before building premium policy |
| `azur-purchase-receipts` | `BLOCKED` | Verify supported store billing provider and test pending/duplicate purchase recovery |
| `azur-iap-product-catalog` | `ROADMAPPED` | Design source-backed own offer catalog and lawful supported store-product mapping; never treat AZUR local prices as live |
| `azur-iap-helper-ladder` | `ROADMAPPED` | Specify original 4×5 multi-offer schema and separately approved own pricing/entitlements |
| `azur-iap-no-ads` | `BLOCKED` | Verify target store billing + no-ads policy and persistence before paid offer/reward receipt |
| `azur-iap-coin-packs` | `BLOCKED` | Check supported store IAP and payout, then model eight source tiers against own currency supply |
| `azur-iap-coin-offer-series` | `ROADMAPPED` | Recover live trigger sequence or author a declared own offer sequence; source titles are not logic |
| `azur-iap-premium-bundles` | `BLOCKED` | Verify IAP provider, settlement, refund and specific benefit contents before shipping |
| `azur-iap-welcome-offer` | `BLOCKED` | Validate store purchases and first-use entitlement; keep future welcome-bundle ID in roadmap |
| `azur-iap-unlimited-moves-tiers` | `BLOCKED` | Reconstruct true entitlement/expiry, billing and SaveStore restore before pricing or SDK calls |

**F1–F3 source/consumer checkpoint (21.11.2026):** [complete 23-system matrix](../qa/content-v8/F1_F3_RETENTION_META_SOURCE_TO_PRODUCT_2026-11-21.md), [machine-readable source/tier/enum fixture](../qa/content-v8/f-source-event-matrix.json). **2 IMPLEMENTED_UNVERIFIED / 15 ROADMAPPED / 6 EVIDENCE_GAP, 0 ACCEPTED, 0 OWNER_EXCLUDED.** Native AZUR compiled source has **16 actual task types (+Unknown) and 9 reward types**, including purchase/use-helper tasks, *all retained in full roadmap*; local defaults 4/day, 7-day window, unlock level2/day1 are not observed live settings. Current daily 28-content rotation, first-clear five-win cycle and two earned cosmetic styles do NOT substitute for PuzzleEvent, DailyTasks, GoldRush, WeekendRace, Lives or EventScheduler. Historical kit HOLD/REJECT suggestions do not remove owner-approved source feature scope. Source/runtime and human P6 remain distinct.

### F1. Ежедневные и коллекционные системы (12)

PuzzleEvent/Puzzle Journey, daily tasks, daily bonus, daily reward, streaks, cosmetics and Daily Fortune.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-puzzle-event` | `ROADMAPPED` | Prototype original 6-piece picture reward on actual wins/daily; assess visual payoff |
| `azur-daily-tasks` | `ROADMAPPED` | Inventory ALL 16 original DailyTask kinds and 9 reward kinds (engagement, helper-use, spend/purchase), with per-kind evidence and trigger; implement in owner-approved stages without silently dropping commercially oriented task types |
| `azur-daily-bonus` | `ROADMAPPED` | Prototype optional daily card-choice mini reward; measure friction, scope and locale dates |
| `hitapps-daily-rewards` | `ROADMAPPED` | Compare separate login reward against existing daily; propose value and dedup if selected |
| `hitapps-win-streak` | `ROADMAPPED` | Define streak failure/reset milestone and test against current cycle without double credits |
| `unico-win-and-task-streak` | `ROADMAPPED` | Compare separate reward ledgers; choose distinct milestones without duplicate grants |
| `hitapps-puzzle-gallery` | `ROADMAPPED` | Reconstruct video-based gallery journey and distinguish from time-limited PuzzleEvent |
| `hitapps-daily-puzzle` | `EVIDENCE_GAP` | Acquire original Hitapps Daily Level actual session or native scene/level data; do not claim this was source-copied |
| `azur-cosmetics` | `IMPLEMENTED_UNVERIFIED` | Compare catalog UX/unlocks; extend own assets without copying vendor artwork |
| `unico-daily-fortune` | `ROADMAPPED` | Prototype isolated day-keyed reward selection with once-only claim and odds disclosure |
| `unico-themes-and-skins` | `IMPLEMENTED_UNVERIFIED` | Audit unlock/reward placement and visual consistency without vendor art |
| `hitapps-win-multiresource-payout` | `ROADMAPPED` | Design separate earned resource identities and settlement when those systems implemented, compare S1 visible example |

### F2. Временные события и соревнования (6)

Gold Rush, WeekendRace/LavaQuest, limited lives/events, first-encounter and offline bot/state contracts.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-weekend-race` | `ROADMAPPED` | Design offline staged bot-race as distinct mode, with honest presentation and saves |
| `hitapps-lava-quest` | `ROADMAPPED` | Specify first-attempt multi-win event and safe simulator presentation/rewards |
| `hitapps-lives` | `ROADMAPPED` | Determine effect on current unlimited offline play and clear rule+save variation |
| `hitapps-gold-rush-event` | `ROADMAPPED` | Design prize progress and first-attempt bonus independent from GoldenCards insertion; ensure event grant once |
| `hitapps-meta-prewarm` | `ROADMAPPED` | Add optional event unlock level and preload timing in meta scheduler after first event exists |
| `azur-combo-streak` | `EVIDENCE_GAP` | Reconstruct reward/counter reset/FTUE and determine whether separate progress necessary |

### F3. Полная расширенная LiveOps-мета (5)

Region progression, LuckyWheel, Digging, EndlessTreasure, CascadeEvents; original config/UX research first.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-meta-regions` | `ROADMAPPED` | Estimate asset pipeline and staged owner-visible progression UI for later season |
| `hitapps-cascade-events` | `EVIDENCE_GAP` | Trace native source config/calls to derive event sequencing before porting a generic event lifecycle |
| `hitapps-digging-event` | `EVIDENCE_GAP` | Inspect original event behavior and schema; define adaptation and authoring cost |
| `hitapps-lucky-wheel` | `EVIDENCE_GAP` | Find original UI/state/odds evidence, then design own optional reward minigame |
| `hitapps-endless-treasure` | `EVIDENCE_GAP` | Determine native phases and actual gameplay before creating design spec |

**G1 source/content checkpoint (21.11.2026):** [full five-feature source→product audit](../qa/content-v8/G1_LOCALE_LONG_CAMPAIGN_AND_REMOTE_SOURCE_2026-11-21.md), [numeric source/product coverage fixture](../qa/content-v8/g1-structure-locale-matrix.json), [semantic repetition P2 issue #84](https://github.com/DanilaH/asoc-solitair/issues/84). **1 IMPLEMENTED_UNVERIFIED, 3 ROADMAPPED, 1 EVIDENCE_GAP; 0 ACCEPTED/OWNER_EXCLUDED.** Original AZUR packaged LevelConfig has 2000 rows, 4539 theme IDs, 162-level minimum recurrence, 0 adjacent overlap and 551+ 7-period structural signatures. Current C8 fresh 80 has 78 distinct category IDs in 862 usages, minimum recurrence 1 (levels4→5,5→6,10→11), while levels32–80 use 78 topics in 574 usages and minimum gap6. Current seven-profile ordering is an *adaptation*, not exact original 1/2/2/2 structural cadence. Original 33 theme/word banks and **separate** 36-locale/468 definition bundles plus art-loaded count and gated M/E/L budget formula remain not original-runtime verified. No existing Deal IDs, source systems or saved attempts were rewritten. Extended content diversity is a planned research/product gate, not a basis to delete features.

### G1. Долгосрочное масштабирование и адаптация (5)

Locale move budgets, remote content settings, late-campaign structural cadence from AZUR after localizing.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `azur-localized-move-budget` | `ROADMAPPED` | [Original exact native branch](https://github.com/DanilaH/mini-games-kit/pull/78) and [read-only runtime oracle PR #90](https://github.com/DanilaH/mini-games-kit/pull/90): prepared hooks for numeric English/local word counts and adjusted budget. **Zero original Android observations**; source formula 5*ceil(M*L/(5E)) applies only to gated positive branch, current remote/locale flags still UNKNOWN. Keep existing frozen RU C8 budget until versioned and separately accepted implementation |
| `azur-remote-level-overrides` | `EVIDENCE_GAP` | Capture original config semantics before proposing optional versioned remote bank rollout |
| `azur-structured-long-campaign` | `IN_PROGRESS` | Design C8 16–80 source-grounded curve, layout 5 columns, semantic de-dup and future endless/extended stages |
| `hitapps-language-change-restart` | `ROADMAPPED` | Design explicit locale/content compatibility, preserve spent wallet and attempt history, test forced restart notifications |
| `azur-localized-definition-packs` | `ROADMAPPED` | [Source XAPK PR #88](https://github.com/DanilaH/mini-games-kit/pull/88): 33 bundled theme banks × 4539 IDs; EN/RU differ in member count for 1357 themes and conditional total cards in 1687/2000 source configurations. Distinct from 36-locale/468 definition-bundle catalog. Validate missing/malformed numeric rows, localized content and SaveStore/Undo migration before multilingual rollout |

## 4. Strict evidence and change controls

Every PR in this implementation program must report feature IDs, original reference and exact build, source evidence tier (VIDEO, METADATA, NATIVE STATIC, MODEL PARITY, ORIGINAL RUNTIME), consumer implementation code/commit and whether it is playable in a signed Android APK. `NOT_INSPECTED` and `UNKNOWN` never become `PORT_PASS` merely through a matching method name.

**Quality:** Independent simulator/bot + actual player visible decisions. Bound solver timeout is UNKNOWN, not mathematically unwinnable; `SourceEquality` late bot failure is NOT proof of an impossible board. Protect content IDs, migration, Undo, advertising native earned receipts, and result wallets. For game modification, use original independently authored assets/text/code; test human and platform constraints.

**Commercial:** Original hidden server rates and ad activation are unknown. Measure real eligible/offered/SDK shown/impression/earned +10/apply/recovered/won/return, never infer earnings from request. Paid IAP remains BLOCKED for missing authorized store billing and payout proof, not OWNER_EXCLUDED. Do not make the PR34/35 feel candidates a blanket reason to omit monetization or meta.

**Backlog governance:** change `SOURCE_FEATURES.json` in kit and `ADOPTION_LEDGER.json` in game together for every discovered system. After implementation, update both roadmap and ledger to `IMPLEMENTED_UNVERIFIED` or `ACCEPTED` with evidence. Owner alone can exclude a roadmap entry. Previous `HOLD/REJECT` archived notes remain historical, not controlling policy.

**Next developer command:** Read `AGENTS.md`, `docs/porting/PORTING_POLICY.md`, this roadmap, both ref inventories, C8 PR #41/42 and current active code. Generate the full source→product matrix, verify 114/114, and implement the next unblocked package with exact SDK/save/Android evidence.

**Audit correction (19.11, pass3):** Previous 76/76 was incomplete across existing source packaging/IAP, uneven AZUR categories, multiresource rewards, language, helper discovery and 10 AZUR metadata UI systems. Source inventory now **110**, with real pinned-source consumer `qa:porting` mandatory. The old Hitapps Daily puzzle line was downgraded to `EVIDENCE_GAP` because only Hitapps DailyRewards and Unico actual Daily Level are proven. Source-like names do not prove live/runtime behavior.

**Native core follow-up (20.11.2026):** [Exact AZUR/Hitapps/Unico core-source → gameplay implementation spec](../qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md). This adds 11 separately tracked core mechanisms (including AZUR budget formula, native draw/recycle, loss vs no moves, independent lower bonus column; Hitapps Equality stack placement, reseed/phase/negative seed/puzzle/scissors; Unico Magnet). Published old C1–C8 saves remain unchanged until a scoped implementation PR. Kit source native verifier [mini-games-kit PR #78](https://github.com/DanilaH/mini-games-kit/pull/78).

**P0 source follow-up (20.11 native-body, mini-games-kit PR #80):** AZUR normal deal uses Unity `Random.Range` one-pass Fisher–Yates, not the Hitapps ten-pass EmbeddedRandom; its column widths grow from `FirstColumnCards`. Bonus type2 foundation and type3 tableau column have decoded, independent unlock gates. Their ledger/roadmap entries remain open until source-seed/original-device/monetization evidence and product implementation. Research/consumer inventory remains 110/110. Existing C8 frozen deals and kit runtime dependency are unchanged.

**P0 native bonus eligibility follow-up (20.11, mini-games-kit PR #81):** Source code establishes separate upper/lower min-level and 3/4-normal-slot/prefab gates, saved configuration restoration, coin debit-before-unlock, and an advertised rewarded route. No inference of active live monetization, current prices or SDK earnings. These are source-evidence advancements only; both game rows remain ROADMAPPED.

**P0 tutorial preset and RNG source discovery (20.11, mini-games-kit PR #82):** A separate original AZUR level-one authored tutorial preset route is source-proven; disabled/missing/invalid preset falls back to ordinary Unity Random dealer. `UnityEngine.Random.InitState` has a native CoreModule wrapper but no direct call in inspected level-routing ranges; global seed/state and real original board remain UNKNOWN. Added the separate `azur-tutorial-preset-deal` system to C1. Source and product coverage now 111/111, no owner exclusions.\n
**P0 shared Unity RNG and AZUR Joker follow-up (20.11, kit PR #84):** ordinary AZUR dealer, daily bonus, combo track, Joker helper and developer tools call the same Unity Random.Range native wrapper; some other original code directly calls InitState, source owners/runtime order unknown. A new separately tracked native source Joker chooses a random lower tableau, constructs/reveals/places a card and conditionally clears Undo. Game product policy should isolate deterministic authoring RNG and preserve immutable Deal. New row in D1; **112 total** source IDs, no owner exclusions; exact original live RNG/device and SDK remain unknown.

**P0 AZUR card enumeration from art assets (20.11, kit PR #86):** Original `GameController.BuildArtCardCountsForThemes` supplies strictly positive loaded sprite counts to ordinary `GenerateCards`, changing per-theme member card count and using cyclic underlying word references with unique card IDs. This does not establish actual original Android art packs, rendered image/text variants or source RNG state. Added distinct B1 system; full roadmapped source inventory now **113/113**, zero exclusions. Keep game published deals immutable.

**P0 original AZUR sprite-pack and localized count audit (20.11 kit PR #88):** Verified 90 UnityFS art sets/490 sprites, 89/90 art size parity with English and Russian word counts; set385 has one extra sprite conditionally affecting source levels44/884/1290/1974. Native level preload and localized count call sites now source-confirmed. All 33 theme dictionaries have 4539 IDs; EN/RU member counts differ in 1357 themes. The new independent B1 lifecycle item `azur-async-theme-art-preload` brings the complete map to **114/114**, no owner exclusions. Packaged != successfully loaded live; do not alter published C8 deals from this research alone.

**P0 runtime instrumentation evidence gate (20.11, mini-games-kit PR #90):** Exact original AZUR XAPK metadata/ARM64 IL2CPP field ABI and dynamic exports now source-verified, opt-in local Frida numeric state capture authored, synthetic comparator tested, **but original Android process/seed outputs/board was not run or observed**. 114/114 systems unchanged, source tiers retained; actual two or more original level snapshots still prerequisite. This research update does not alter the Hitapps C8 dealer or existing saves.
