# Association Solitaire — полная дорожная карта переноса исследованных систем

**19 ноября 2026 · Owner scope: full reference-system adoption, staged implementation · research/program document, NO game runtime edits in this PR.**

This is the **single product-facing stage map** of all currently inventoried Hitapps/AZUR/Unico systems. The source inventory [mini-games-kit](https://github.com/DanilaH/mini-games-kit/blob/research/association-solitaire-full-porting-audit-20261119/research/games/association-solitaire/porting/SOURCE_FEATURES.json), this [consumer ledger](ADOPTION_LEDGER.json), and the [full source evidence audit](https://github.com/DanilaH/mini-games-kit/blob/research/association-solitaire-full-porting-audit-20261119/research/games/association-solitaire/porting/FULL_REFERENCE_AUDIT_2026-11-19.md) must be reconciled before any implementation.

**Coverage at this reviewed snapshot:** **76 feature IDs**, 20 IMPLEMENTED_UNVERIFIED; 2 IN_PROGRESS; 40 ROADMAPPED; 1 DEFERRED; 4 BLOCKED; 9 EVIDENCE_GAP. **0 OWNER_EXCLUDED**. No `ACCEPTED` yet, because an original compiled-source match, a browser bot and a green unit test are not user/Android/live-source approval. Later source discoveries must be added; this inventory is not exhaustive of all original remote configurations.

## 1. Action priorities based on dependencies (not a feature ceiling)

**A — Governance & acceptance.** The porting framework [kit PR #73, merged](https://github.com/DanilaH/mini-games-kit/pull/73) and [game PR #43, merged into active Content8](https://github.com/DanilaH/asoc-solitair/pull/43) are in place. Preserve current `AGENTS.md` and consumer `PORTING_POLICY.md`, never restore C6/C7 agent-authored feature bans. CI gate must compare **all source IDs vs ledger IDs** and require reason/action for blockers; only explicit owner order can create `OWNER_EXCLUDED`.

**B — Core generator + director.** Normal `Priority` and ordinary C8 generator already have partial source-derived parity. Implement independent source-model `DynamicDifficulty` (Clean/ExtraSteps/Restart, 10-entry window, configured penalty on eligible budget), `EasyDeals` loss-streak relief, and the separately requested `Equality/NoPossibleMoves` special selector. These policies must **not be collapsed** into an invented single target loss heuristic. `SourceEquality` merely finds late bot non-wins; our `ContinueConvertible` requires certified move-budget and actual recovery-path evidence. [Game PR #42](https://github.com/DanilaH/asoc-solitair/pull/42). Freeze chosen deals for each attempt, preserve Undo and dated Daily.

**C — Actual 1–80 playable content.** Accept Content8 1–15 on a **physical Android**, including Hint/Undo/Joker, stock/waste, difficulty presentation and lost/recovered play. Fix current red CI first: one 320px board-contact visual test and external Gradle dependency resolution; not evidence that documentation broke game. Rewrite 16–80 to reference-size/meaningful decision structures, not legacy Content7 collapse at level16. Reconstruct five-column geometry at source positions26/31; beyond Hitapps local EN31 treat exact source parameters as UNKNOWN. Track both layout novelty and semantic-repeat distance. **No artificial 15/20 level product cap.**

**D — Special play and feedback.** Introduce/teach and independently validate all source mechanisms: category order, key locks, frozen, bound, golden cards, extra upper foundation, Magnet/Hammer/Shuffle, word explanations, deck placement, rendering/sound. New rules require rules version, save and helper solver, cost/pricing tests and non-copied assets. GoldenCards placement is separate from the Gold Rush event reward.

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

Below: every source ID must appear once. `currentImplementation` and `nextAction` refer to the **audited C8 candidate and known PRs**, not necessarily accepted main.

### B1. Генератор и выбор обычного кандидата (2)

C8 source-derived dealer; random seed/stock tableaux, known target steps and independent oracle before altering gameplay.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-stock-dealer` | `IMPLEMENTED_UNVERIFIED` | Confirm original-device final-board parity and Content8 human/device QA |
| `hitapps-candidate-priority` | `IMPLEMENTED_UNVERIFIED` | Independent original selected-seed/runtime parity; measure human decision quality |

### B2. История игрока и восстановление сложности (3)

DynamicDifficulty (last10), EasyDeals relief, alternative Retry variant. Never confuse a clicked ad with earned extra moves.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-dynamic-difficulty` | `ROADMAPPED` | Prototype ten-result window, Clean/ExtraSteps/Restart and source-derived penalty on new attempts |
| `hitapps-easy-deals` | `ROADMAPPED` | Model native reason codes/threshold and relief after loss streak as separate selector |
| `unico-redeal-restart` | `ROADMAPPED` | Study Unico sample vs true replay config; design new eligible variant and frozen save semantics |

### B3. Special Equality / Paywall (2)

Source-based gating and late simulator failure vs our mathematically certified +10 continuation variant; two distinct modes, existing receipt.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-equality-paywall` | `ROADMAPPED` | Implement source-bound Equality candidate selection and separate +10 validated recovery |
| `hitapps-paywall-segmentation` | `ROADMAPPED` | Implement eligible profile/attempt gates with explicit source/runtime uncertainty |

### C1. Непрерывное обучение и Difficulty UX (2)

User onboarding Hint/Undo/Joker, stock/waste/recycle, visible Hard/SuperHard, first-use evidence.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `azur-action-ftue` | `IMPLEMENTED_UNVERIFIED` | Owner plays 1–8 continuously on real phone; keep achievement markers action-based |
| `azur-difficulty-label` | `IMPLEMENTED_UNVERIFIED` | Human/device check 320px, accessibility and perceived actual challenge |

### C2. Полная кампания и тематический контент (4)

Finish C8 16–80, 5-column peaks, semantic repetition control, daily quality/variation.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-level-wave` | `IN_PROGRESS` | Author reference-sized progression16–80 without abrupt stock collapse |
| `azur-topic-rotation` | `ROADMAPPED` | Author semantic repeat-distance schedule independent from layout; test local-language ambiguities |
| `hitapps-daily-puzzle` | `IMPLEMENTED_UNVERIFIED` | Audit original daily constraints and improve 28-puzzle repetition, human validation |
| `unico-daily-puzzles` | `IMPLEMENTED_UNVERIFIED` | Compare failure-retry loop and daily award once-per-date on actual Android |

### D1. Специальные игровые правила (8)

Ordered, keys, Frozen/Bound, Golden, new upper slot, Magnet/Hammer and Shuffle each with standalone rule + solver + teaching.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `azur-extra-foundation` | `ROADMAPPED` | Prototype 1 additional upper-slot effect with solver/save/hint/320px UI tests |
| `hitapps-golden-cards` | `ROADMAPPED` | Develop one original golden-card event with undo/expiry/save and modified-board oracle |
| `hitapps-ordered-category` | `IMPLEMENTED_UNVERIFIED` | Verify first C8 introduction and match rule provenance; device teaching still pending |
| `hitapps-lockers` | `IMPLEMENTED_UNVERIFIED` | Re-author gated C8 16–80 with independent solver and onboarding/device check |
| `hitapps-frozen` | `ROADMAPPED` | Reconstruct eligible frozen state and design original mechanic + undo/solver/migration |
| `hitapps-bound` | `ROADMAPPED` | Reconstruct bound-card pattern and design original mechanic + undo/solver/migration |
| `hitapps-magnet-hammer` | `ROADMAPPED` | Prototype one differentiated helper first, preserving post-seed insertion proof boundaries |
| `azur-shuffle-helper` | `ROADMAPPED` | Determine re-deal constraints/save/provable solvability and user teaching |

### D2. Качество взаимодействия (6)

Joker, Hint, info/dictionary, lower-buffer/stock side, feedback, sound, cross-device validation.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-joker` | `IMPLEMENTED_UNVERIFIED` | Native playtest Joker, costs, save, cancel, reduced motion |
| `hitapps-ghost-hint` | `IMPLEMENTED_UNVERIFIED` | Validate Hint after off-witness choice on Android and strict no-charge failure |
| `ui-motion-audio-coin` | `IMPLEMENTED_UNVERIFIED` | Complete actual device audio/vibration/rapid play acceptance and competitor 1x compare |
| `hitapps-ingame-streak` | `IMPLEMENTED_UNVERIFIED` | Replay negative invalid-drop/recycle/Undo against original video and Android coin UX |
| `azur-card-dictionary` | `IMPLEMENTED_UNVERIFIED` | Compare on-device card readability, foreign/ambiguous semantics and text visibility |
| `azur-stock-side-setting` | `IMPLEMENTED_UNVERIFIED` | Test both deck sides with tall stock, ads banner and active/parked game saves |

### E1. Rewarded и платежные решения на экране результата (10)

Continue +10, coin +moves, rewards multipliers, offer variants, correct no-fill and receipts.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-stock-restore` | `DEFERRED` | Design true rule difference and migration before free/paid restore; don't sell existing free behavior |
| `hitapps-revive-offers` | `ROADMAPPED` | Compare coin/rewarded/segment options and save/device flow |
| `azur-coin-moves` | `ROADMAPPED` | Design coin price against our actual wallet supply and safeguard once-per-attempt |
| `azur-rewarded-moves` | `IMPLEMENTED_UNVERIFIED` | Complete real phone SDK callback/no-fill/relaunch/earned verification; adapted amount differs from AZUR |
| `azur-win-multiplier` | `ROADMAPPED` | Prototype optional post-win earned bonus with separate idempotent receipt and economy model |
| `hitapps-win-rewarded-offer` | `ROADMAPPED` | Prototype receipt-safe opt-in post-win bonus under valid Android rewarded SDK |
| `azur-unlimited-moves-offer` | `ROADMAPPED` | Define exact entitlement duration/UI/server/SaveStore/budget migration without falsely copying AZUR |
| `unico-rewarded-theme` | `ROADMAPPED` | Design opt-in themed cosmetic offer, entitlement persistence and receipt grants |
| `unico-double-reward` | `ROADMAPPED` | Compare Unico post-win CTA to AZUR x3 and develop independent rewarded bonus policy |
| `unico-loss-dialog` | `IMPLEMENTED_UNVERIFIED` | Compare visible alternatives on compact screen; SDK no-fill and clear Retry path |

### E2. Контекстные рекламные возможности (5)

In-game interstitial gates/caps, Coffee Break offer, banner, exact impression-level revenue attribution.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-adbreak` | `ROADMAPPED` | Prototype in-level configurable opportunities/cooldowns with valid SDK impression attribution |
| `hitapps-ingame-banner` | `IMPLEMENTED_UNVERIFIED` | Phone/RuStore safe-area+SDK ready/impression test; compare original placement and day mode |
| `azur-fullscreen-ads-clock` | `IMPLEMENTED_UNVERIFIED` | Reconcile actual shown-vs-attempt clock and in-level cooldown with native flow |
| `azur-ad-revenue-attribution` | `ROADMAPPED` | Verify ILRD/currency+placements in target ad provider, not revenue from click |
| `unico-coffee-break` | `ROADMAPPED` | Study exact observed break context; design separate optional break/reward and native ad return preservation |

### E3. Коммерческая витрина и предложения (10)

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

### F1. Ежедневные и коллекционные системы (10)

PuzzleEvent/Puzzle Journey, daily tasks, daily bonus, daily reward, streaks, cosmetics and Daily Fortune.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `hitapps-puzzle-event` | `ROADMAPPED` | Prototype original 6-piece picture reward on actual wins/daily; assess visual payoff |
| `azur-daily-tasks` | `ROADMAPPED` | Design distinct earned 2–4 daily objectives and seven-day rewards with save identity |
| `azur-daily-bonus` | `ROADMAPPED` | Prototype optional daily card-choice mini reward; measure friction, scope and locale dates |
| `hitapps-daily-rewards` | `ROADMAPPED` | Compare separate login reward against existing daily; propose value and dedup if selected |
| `hitapps-win-streak` | `ROADMAPPED` | Define streak failure/reset milestone and test against current cycle without double credits |
| `unico-win-and-task-streak` | `ROADMAPPED` | Compare separate reward ledgers; choose distinct milestones without duplicate grants |
| `hitapps-puzzle-gallery` | `ROADMAPPED` | Reconstruct video-based gallery journey and distinguish from time-limited PuzzleEvent |
| `azur-cosmetics` | `IMPLEMENTED_UNVERIFIED` | Compare catalog UX/unlocks; extend own assets without copying vendor artwork |
| `unico-daily-fortune` | `ROADMAPPED` | Prototype isolated day-keyed reward selection with once-only claim and odds disclosure |
| `unico-themes-and-skins` | `IMPLEMENTED_UNVERIFIED` | Audit unlock/reward placement and visual consistency without vendor art |

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

### G1. Долгосрочное масштабирование и адаптация (3)

Locale move budgets, remote content settings, late-campaign structural cadence from AZUR after localizing.

| Source feature ID | Actual status | Next implementation or evidence action |
| --- | --- | --- |
| `azur-localized-move-budget` | `EVIDENCE_GAP` | Trace real native method/data; only consider if multiple locales are supported |
| `azur-remote-level-overrides` | `EVIDENCE_GAP` | Capture original config semantics before proposing optional versioned remote bank rollout |
| `azur-structured-long-campaign` | `IN_PROGRESS` | Design C8 16–80 source-grounded curve, layout 5 columns, semantic de-dup and future endless/extended stages |

## 4. Strict evidence and change controls

Every PR in this implementation program must report feature IDs, original reference and exact build, source evidence tier (VIDEO, METADATA, NATIVE STATIC, MODEL PARITY, ORIGINAL RUNTIME), consumer implementation code/commit and whether it is playable in a signed Android APK. `NOT_INSPECTED` and `UNKNOWN` never become `PORT_PASS` merely through a matching method name.

**Quality:** Independent simulator/bot + actual player visible decisions. Bound solver timeout is UNKNOWN, not mathematically unwinnable; `SourceEquality` late bot failure is NOT proof of an impossible board. Protect content IDs, migration, Undo, advertising native earned receipts, and result wallets. For game modification, use original independently authored assets/text/code; test human and platform constraints.

**Commercial:** Original hidden server rates and ad activation are unknown. Measure real eligible/offered/SDK shown/impression/earned +10/apply/recovered/won/return, never infer earnings from request. Paid IAP remains BLOCKED for missing authorized store billing and payout proof, not OWNER_EXCLUDED. Do not make the PR34/35 feel candidates a blanket reason to omit monetization or meta.

**Backlog governance:** change `SOURCE_FEATURES.json` in kit and `ADOPTION_LEDGER.json` in game together for every discovered system. After implementation, update both roadmap and ledger to `IMPLEMENTED_UNVERIFIED` or `ACCEPTED` with evidence. Owner alone can exclude a roadmap entry. Previous `HOLD/REJECT` archived notes remain historical, not controlling policy.

**Next developer command:** Read `AGENTS.md`, `docs/porting/PORTING_POLICY.md`, this roadmap, both ref inventories, C8 PR #41/42 and current active code. Generate the full source→product matrix, verify 76/76, and implement the next unblocked package with exact SDK/save/Android evidence.
