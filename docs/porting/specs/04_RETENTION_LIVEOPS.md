# Technical Spec 04 — complete F1/F2/F3 events, retention and meta progression

**P26–P32.** [All 23 source ID evidence and current consumer delta](../../qa/content-v8/F1_F3_RETENTION_META_SOURCE_TO_PRODUCT_2026-11-21.md), [AZUR original retention enums](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-retention-loops/evidence.json), [machine source crosswalk](../../qa/content-v8/f-source-event-matrix.json), [existing compact consumer meta](../../content/COMPACT_META.md). This is **full owner-approved roadmap scope**, not the older kit memo's suggested **one mini experiment / permanent exclusion**.

**Метод исследования и переноса · 24.11.2026:** [текущий метод](../RESEARCH_METHOD_2026-11-24.md) и [шаблон передачи](../RESEARCH_TO_IMPLEMENTATION_BRIEF.template.md) применяются к исходным event state, расписаниям, зависимостям, выдаче и восстановлению. Разработчик читает исследованный код и архитектуру и использует их как основу собственного исполнения без clean-room изоляции; точные релевантные фрагменты вывода инструментов хранятся с provenance в private mini-games-kit, отдельно от псевдокода и нашего кода. Статические ветви, изолированное исполнение исходных функций и работа полного клиента подтверждают разные границы. Live-активацию события подтверждает соответствующее наблюдение полного клиента; вывод об удержании требует отдельных измерений.

## Core requirement: event progression is distinct from gameplay and ordinary rewards

The current game already has **28 rotated dated daily solitaire levels**, first-completion daily rewards, 3-/7-day streak, five-first-win campaign cycle, milestones at 10/20 and two cosmetics. Those are functioning **product adaptations** — they are NOT AZUR DailyTasks, Hitapps PuzzleEvent/Gallery, separate DailyRewards, real WinStreak, WeekendRace, Lives, GoldRush, PlayPass, Unico Fortune/TaskStreak or long LiveOps. Do not duplicate wallet grants or collapse every original event into a generic «+20 coins on login».

All events require explicit `eventId, eventVersion, sourceFeatureId, effective start/end, eligibility, progress, grant/claim state`, and distinction between **earned progress**, **purchased/claimed reward**, **shown animation** and **expiration**. Persist with existing single SaveStore writer, outside board Undo; consumer can pause active or parked Daily/campaign with no data loss. A real win receipt and a picture token may refer to same canonical completed level, but **each payout must have its own idempotency key**. Never infer genuine retention or participation rates from static APK.

## P26 · Shared EventScheduler, EventStore and claim ledger

No additional primary source ID; this is a dependency for the other 23.

1. Implement versioned event/collection state (source-aware event identity, optional scoped local schedule vs independent server epoch, `opened/active/completed/expired/claimed`, progress currency and unclaimed rewards). Event state belongs to profile SaveStore, not current board/Phaser. Use deterministic per-event/source ID+local day+canonical first-completion ID for once-only grants. Initial schema migration must preserve old C1–C8 active/parked games, Undo, receipts, cosmetics and preexisting streaks.
2. Clock/eligibility: no claim solely on opening a window or app background; control local midnight, time zone change, daylight savings, clock rollback, offline use, game leave/re-enter, event expired while rewards already earned, event reactivation with new ID and replay old level. If using server time later, **do not claim server truth** when only device local date is available.
3. Event UX: compact home/result progress and optional skip, no mandatory interruption inside card drag; accessible 320px/font scaling, native banner safe area, animations only after committed progress; no fabricated players, unavailable reward claim or hidden paid task.
4. QA: 2 simultaneous events from one unique win, duplicate event grant key, app kill before/after persist, event restart/reuse, partial claim, expired pending claim, UI stale if switching mode, conflict between two reward writes, genuine receipt callback arriving mid-event, signed Android. No kit runtime API assumption.

**Exit:** source-agnostic local event state with exact-once rewards and a full negative test matrix, default no unexpected new events enabled.

## P27 · Hitapps PuzzleEvent, permanent gallery and win-multiresource payouts

Primary IDs: `hitapps-puzzle-event`, `hitapps-puzzle-gallery`, `hitapps-win-multiresource-payout`.

Original native PuzzleEvent `minLevel/schedule/galleryConfig/tokensGainPerWin`, `GetRewardPerLevel`, `TryUnlockPuzzlePart` checks **art part currencyPrice** and marks `isBought`; saved `currencyAmount/puzzleArtworkDatas/currentPhase/isStarted/isFinished/isGrandRewardClaimed`. Publisher publicly promoted a time-limited picture reveal; **live token rates/parts count and current schedule unknown**. Gallery and multi-resource win reward are **separate** source systems. A first adapted **six-piece illustration** may be used as product-authored level of scope, but **six is not confirmed original source quantity**.

**Build:** one original owned artwork plus a versioned `PictureEvent` state: unique level win creates true event tokens once, separate token spend/reveal part at explicit price, source-inspired completion, claim once, permanent gallery entry survives event expiry; event win resource and gallery grant visibly independent from current 25+remaining-move coins, existing five-win cycle, ten-level milestone. Event can have multiple images later, all with standalone art licensing. Test opened/closed, replayed level, daily first completion if declared enabled, phone crash after winning before reveal, duplicate tap, insufficient token, expired unclaimed reward, source source-known vs adapted parameter. **Measure voluntary next-level start, not made-up D1 uplift.** Do not copy vendor illustrations.

**Exit:** actual reveal/currency/claim mechanic with real saved effects, gallery and multiresource settlement, all three source IDs traced; original live timing/amount unknown if not observed.

## P28 · Full AZUR DailyTasks: all 16 task kinds and all 9 reward kinds

Primary ID: `azur-daily-tasks`. Do **not** implement only two profitable-positive tasks and silently delete other source categories. Original **16 TaskKind values (1–16)** plus enum fallback Unknown0:

| Kind | Original event trigger evidence required |
| --- | --- |
| CompleteLevels | Unique accepted level completions, not UI next click |
| CollectThemes | Actual category collected, dedup per source move |
| ExecuteMoves | Accepted legal commands only; invalid drag ignored |
| UseHints | Valid accepted paid/free hint use event, once per real use |
| WinNoHints | Actual won attempt with zero hints since start |
| DrawCards | Real draw source transition, not tapping empty stock illegally |
| DailyLogin | Session/day access per defined calendar, no automatic gameplay win |
| CollectDailyBonuses | Verified claim of the separate P29 DailyBonus |
| UseDefinitions | Actual resource use under P20; free reader differs |
| UseJokers | Distinct helper used from actual P04/P15, not opening the modal |
| UseRollbacks | Actual charged/free Undo accepted, not undo request |
| UseShuffles | Actual Shuffle accepted under P16 |
| EarnCoins | True persisted positive coin grant, not animation/revenue |
| BuyExtraMoves | Actual accepted P18/P19 coin or rewarded moves (explicit eligibility) |
| BuyBoosters | Actual verified helper purchase/entitlement, not opening shop |
| MakePurchase | **Verified paid** P23/P24 transaction only; never show as completed by fake QA receipt/attempt |

Nine **RewardKind 0–8**: Coins, MoveHint, Undo, Definition, Shuffle, Joker, Medals, RandomBoostersChest, CardBack. Every kind must have a typed reward effect and original `SUPPORTED/UNKNOWN` status; no generic payout substitution for unavailable helper. The source has compiled defaults **4 tasks/day**, event duration **7 days**, unlock Level **2**, unlock Day **1** — these are source defaults, **not confirmed active remote config nor mandatory our product policy**.

**Implementation:** separate day + weekly `DailyTaskState{target,progress,rewardKind,rewardAmount,claimed}`, `DailyTasksEventData{weekStartUtc,totalMedals,claimedMilestones,days,loginDaysUtc}` shapes; eligibility, task generator or curated rotation from own data; all 16 kinds represented in schema/validation/test fixtures and can be enabled only per explicit declared product config. Real tasks for purchases, coin spending, watching ads or assist-use cannot force spending to access ordinary game; show alternatives or omit from a given daily set **without removing their source ID/type from the roadmap**. Weekly medals/claim milestone and independent claimed/persisted identity; a user must never earn it by clicking through a dialog. Keep daily-puzzle content separate from task objectives.

**QA:** source 16 enumerated, nine rewards, rollover/win/no-hint/undo, duplicate task state, two related event claims, P23 paid refund/verified statuses, permissions/no native SDK, old save migration; physical 320px/clear copy.

## P29 · Distinct DailyBonus, DailyRewards, Unico Fortune and actual DailyPuzzle evidence

Primary IDs: `azur-daily-bonus`, `hitapps-daily-rewards`, `unico-daily-fortune`, `hitapps-daily-puzzle`, `unico-daily-puzzles`.

- AZUR DailyBonus source has `DailyBonusRoundData{dayUtc,columns,revealed,wonColumnIndex}` and a separate source UI prefab — **not** 28 dated puzzles. Need actual draw/reveal choice, transparent odds when randomized, day-keyed exactly-once prize, repeated tap/stale earned video/give-up, resource pools. Distinguish internal RNG from dealer RNG (AZUR original uses shared Unity, we can isolate as labelled product adaptation).
- Hitapps DailyRewards source `GetActualState/TryReceiveDayReward` plus persisted date/day index and claim. Create optional login-only streak reward **separate** from existing daily *completion* claim; avoid accidental double payout and meaningless required modal.
- Unico Daily Fortune source video shows separate card-choice and second video try; actual exact odds/SDK callbacks unknown. Product-adapted choice must disclose relevant reward odds or guaranteed outcome per local policy, allow skip and receipt-safe second earned try. Don't call one free daily login the same mechanic.
- Hitapps DailyPuzzle source **EVIDENCE_GAP**: only DailyRewards independent evidence; no genuine original daily level scene captured. Our existing 28 rotating daily levels are a **working consumer product feature**, not proof of copied Hitapps DailyPuzzle. Preserve source action to acquire original original app daily or native scene. Unico DailyPuzzle is a separate video-based reference; do not collapse provenance.

**QA:** local day changes, saved date/version, same-day replay/rolling 28, false clock rollback and tomorrow entry, new/old Daily mode, 3/7-day grants, reward idempotence across 3 separate daily flows. Adapter under disabled flag until human UX confirms not adding redundant friction.

## P30 · Source-specific WinStreak, Unico two streaks, AZUR Combo

Primary IDs: `hitapps-win-streak`, `unico-win-and-task-streak`, `azur-combo-streak`.

Hitapps original `GainProgress/LoseStreak/ClaimAllCompletedMilestones` and persistent event end-time/claim are **not** existing reward from five first wins; loss-aware streak can reset. Unico source shows two distinct win/task surfaces; not verified original exact reset timers. AZUR `ComboStreak` metadata+app update description does not establish original counter, thresholds or reward; mark `EVIDENCE_GAP`.

**Build:** separate identified source/domain models, own explicit reset and payout/achievement triggers, spectator vs first-attempt or win-only policy, grace/offline expiry and no clone of current cycle. If source exact unknown, track `SOURCE_UNVERIFIED` and implement clearly named ProductAdapted optional variant. Test boundary 0/1/target, one failure, Daily vs campaign, Undo, mid-win coin grant, duplicate claim, late event expiry and SaveStore restore. Don't label two visual streak widgets as two implemented systems if they share one fake counter.

## P31 · WeekendRace / LavaQuest / Lives / GoldRush / prewarm

**OWNER APPROVED 22.11.2026:** Lives **must limit ordinary campaign play**, not optional/event-only. This is the binding chosen product direction, not a currently activated APK or permission to invent max, refill, coin/ad price. Free timer + coins + genuinely earned RV recovery channels must be implemented with negative/SaveStore/real Android tests before enablement. Other P31 events stay fully in roadmap; recurring event keys, exact gold claim and bounded loss journals need QA [#127](https://github.com/DanilaH/asoc-solitair/issues/127), [#134](https://github.com/DanilaH/asoc-solitair/issues/134), [#135](https://github.com/DanilaH/asoc-solitair/issues/135). [Unified owner decision TZ](../OWNER_SEVEN_DECISIONS_IMPLEMENTATION_TZ_2026-11-22.md).

Primary IDs: `hitapps-weekend-race`, `hitapps-lava-quest`, `hitapps-lives`, `hitapps-gold-rush-event`, `hitapps-meta-prewarm`.

Original WeekendRace config has `minLevel, eventStart/end, stages{levelsGoal,raceAwards,botParams}`, native stage/claim/number data and bot min/max timing. This **does not prove live human PvP**; user-visible simulated opponents must be honestly labelled. LavaQuest first-attempt/multi-win stage distinct, source details partial; no fake original win requirement. Lives/Energy can change access to an otherwise unlimited offline game: design explicit mandatory normal-campaign gate with versioned persistence and recovery; **owner approved mandatory Lives**, but enable only after original/product parameter, loss accounting and Android/SaveStore QA, never silently mutate an old in-progress attempt. GoldRush event chooses gold amount via source gate but **D1 GoldenCards Final injection** belongs P13: event reward/progress and actual card effect are different systems. Meta-prewarm starts events/loads UI at correct eligibility/priority, does not itself give gold or mark event available.

**Build:** independent event rules and source/proof tiers for each; complete stage claim and result settlement, deterministic bot simulation with visibility, first-attempt counters, no fake score from multiplayer, late result/window expiry, remote source UNKNOWN, optional signed image/sound. Connect GoldRush to P13 only after separate gold rule safe, otherwise event visual disabled. The owner has approved the mandatory campaign Lives direction; keep current offline QA models until real integrated rule/SDK/UX and yet-unspecified numeric values pass acceptance. Proceed with other independent work; do not re-ask the principle.

## P32 · Regions, CascadeEvents, Digging, LuckyWheel, EndlessTreasure

Primary IDs: `hitapps-meta-regions`, `hitapps-cascade-events`, `hitapps-digging-event`, `hitapps-lucky-wheel`, `hitapps-endless-treasure`.

Source coverage: MetaRegion catalog has unlockLevel/regions/starCount and native gate; other four source families are metadata with no genuine original full gameplay/odds/reward/phase reconstruction. **Do not implement one generic animated slot machine and declare five original systems done.**

**Separate product contracts:**
- Regions/buildings: region map, star/level/dedicated resource balance and building unlock, milestone and saved quest state.
- CascadeEvents: genuine event schedule priority, dependencies, conflict/overlay/expiry, saved pending claims; recover source call order from authenticated code and distinguish a static path from an executed NATIVE_ISOLATED trace. Actual full-client event activation remains a separate P36 observation.
- Digging: own stage board/action/token costs and rewards, exact deterministic generation/retention data; original rule unknown must be marked adapted.
- LuckyWheel: explicit probabilities, no hidden manipulation, reward grant idempotence, honest labels if odds/expected outcomes are product-selected rather than vendor-derived.
- EndlessTreasure: authored progression, costs and chapter resets, own rewards/claims and independent state, not simply new LuckyWheel skin.

Shared SaveStore/graphics can be reused but original feature identity, action contract and acceptance remain independent; all source UNKNOWNs documented. Source evidence does not prove which events are activated or revenue uplift; compare human engagement and legal compliance before live paid mechanics. Multiple event clocks and paid purchases require proper P24 provider and consent.

**KIT IMPACT:** REUSE event identity and serialized grant tests product-owned; only propose shared mini-games-kit module after real independently verified multigame use and actual effects.
