# HITAPPS Paywall / Equality / NoPossibleMoves — реализация для Association Solitaire

**19.11.2026 · owner-approved research/implementation track · источник: оригинальный Hitapps 1.26.2/code3742**  
**Статус:** ТЗ для разработчика, код consumer не изменён. **Позиция владельца** после обсуждения: *исследовать и перенять условную стратегию специально трудных/проигрышных раздач, включая вероятность продолжения за rewarded +10 ходов*, а не исключать весь механизм по умолчанию. Этот документ уточняет раннее рекомендательное `HOLD/REJECT` в исследованиях; не переписывает исторические записи о реально обнаруженных нативных условиях.

**Технический принцип:** отдельно восстановить **фактическую стратегию Hitapps `Equality`**, отдельно обеспечить нашу коммерческую цепочку **`budget failure → earned rewarded receipt → +10 real moves → possible completion`**. `Equality` означает **поражение симулятора у границы бюджета**, а не математическую неразрешимость, поэтому эти два свойства нельзя объявлять эквивалентными.

## 0. Границы доказанности и прямые источники

- Original XAPK: `com.hitappsgames.wordsolitaire`, 1.26.2/code3742, SHA256 `22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0`; ARM32 `libil2cpp.so` `f25d9a988f6fa61eb201879f72c556a5875a4ac2c5f541670950589afbb51e26`, IL2CPP v31 `global-metadata.dat` `47e2db3a792411193b25ed90c590facebcb3af861834eca90cb8e433a8e14aca`.
- [Candidate selector: source-bound Equality/Priority](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-candidate-selection/README.md) + [read-only verifier](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-candidate-selection/verify-candidate-selection.py).
- [Paywall activation: четыре native gate, четыре player status, попытки и alternate Initial path](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-paywall-activation/README.md) + [верификатор](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-paywall-activation/verify-paywall-gates.py).
- [Seed→Shuffle→simulation bridge](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-generator/README.md), [Shuffle-phase callback](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-simulation-callback/README.md), [native end-state oracle, execution OPEN](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-runtime-oracle/README.md).
- Consumer HEAD на момент задания: `main b612420fda4d8677073034a91c944c46573cbf08` исторический C6; основной разрабатываемый Content8 [PR #41](https://github.com/DanilaH/asoc-solitair/pull/41) HEAD `afd631c175c015dfafda9d00f1b68a9457935f97` основан на PR #39; PR #33–40 параллельные/staged. **Перед кодом сверить актуальные PR/HEAD**, сохранять все feature, feel/Android и content изменения.
- Нынешние `src/domain/balance.ts` и `src/domain/services.ts` уже имеют `continueMoves=10`, одно rewarded-продолжение на попытку, `SaveStore`/receipt-idempotency; `src/main.ts` показывает `+10 ходов · видео` только когда rewarded доступен. Это готовый infrastructure contract; **не писать новый ad-grant путь**.

**Открытые оригинальные факты:** значения `PaywallConfig` на сервере; реально участвующие purchase segments; `PaywallLevelSeed` в каждой активной партии; применение `campaignList`; доля специальных раздач, повтор/перезапуск у реальных игроков; native selected seed→final stock/tableau после Shuffle и Final; реальная монетизация и человеческий win rate. В 226 аутентифицированных локальных `LevelBundle` нет явного paywall поля — **это не доказательство отсутствия удалённой активации**, но нельзя выдавать гипотезы за числа оригинала.

## 1. Аутентичный условный pipeline Hitapps: что именно перенять

```text
LevelDto.PaywallLevelSeed > 0
    AND PaywallService.IsPaywallAvailable(player, config):
         PaywallConfig.enable == true
         currentLevel + 1 >= minLevel
         payerTypeList contains GetPlayerStatus()
         paywallAttempts < maxPaywallAttempts
    -> GetPaywallStrategyType() => NoPossibleMoves=1
    -> LevelSimulationRunner.Run(strategy=Equality=1)
    -> each candidate: seeded Shuffle + RunShufflePhase
    -> SimulationController.TryToWinLevel using configured strategy systems
    -> candidate qualifies if solver DOES NOT WIN
       AND simulated steps >= 0.8 × MovesLimit
       for the required strategy-system attempts
    -> candidate accepted via conditional native branch
    -> LevelDto.LevelType gets Paywall flag
    -> RunFinalPhase may further mutate candidate
```

**Evidence precisions**:
- `PaywallService.GetPaywallStrategyType` RVA `0x240b0b0`; eligibility `IsPaywallAvailable` RVA `0x240b238`. `NoPossibleMoves` **integer value 1**; `Core.Simulation.StrategyType.Equality` integer1, `Priority` integer0.
- `BuildSimulatedPlan` obtains `PaywallLevelSeed` and passes `isLevelPaywall` into service, then calls Run with selected strategy.
- `Run` uses `TryToWinLevel` result and native constant `0.800000011920929`. For Equality the **successful bot** is disqualified; premature failed bots before 80% also don't satisfy qualifying branch. Multiple strategy systems may be cycled; exact runtime combination and all fallback exits are **not** fully mirrored by one simple pseudocode `every(bot fails)`.
- Bound `100` candidate attempts appears in native `Run` branch; **not** a guarantee that every live level evaluates 100.
- `RunForNewLevel` Initial path has separate `PaywallFeatureApplier.Apply`: resets `paywallAttempts`, checks positive seed / availability, then can call `ShuffleLevelWithSeed(paywallSeed, true)` and mark `LevelShuffled/PaywallApplied`. **Do not conflate** this path with `BuildSimulatedPlan/Equality` and invent a universal reset.
- `GetPlayerStatus`: 0 NonPayer;1 Payer;2 PotentialPayer;3 SleepPayer. Last purchase time, historical purchases, `payerDayLimit`, `isPotentialPayer`; whitelist `payerTypeList` is configurable. See original source caveat: native date comparison may precede explicit purchase-made branch.
- `PaywallConfig` fields include `enable,minLevel,paywallAttempts,payerDayLimit,payerTypeList,isPotentialPayer,campaignList`. Native usage of `campaignList` in this distribution path **is not established**.

**CLOSED on original binary**: eligible → conditional strategy, late solver failure, Paywall flag and two separate paths; source checks/ARM/IL2CPP are independently reproducible. **NOT CLOSED**: real activation, exact final snapshot, actual fail guarantee, ad conversion.

## 2. Два режима разработать РАЗДЕЛЬНО

### A. `SourceEquality` — faithful native strategy, offline research parity

Implement clean-room, source-pinned (not copied vendor code/Unity prefabs) `Equality` as a **separate candidate-selection mode** in the current C8 offline authoring pipeline:
1. Use existing C8 `EmbeddedRandom`, 10 full-length swaps, stock/tableau allocation and preserved seed. No new Fisher–Yates and no extra unverified shuffle.
2. Candidate simulation runs **actual Rules v3** (not an invented fake failure flag); for each configured independent play policy record `won?`, `spentSteps`, `termination`, `unknown(reason)`. `failure >= ceil(0.8*MovesLimit)` is an *eligible predicate*, not a guarantee of unsolvability.
3. Simulate with current candidate **after applicable category/lock/key modifiers**; preserve exact modified board in frozen `Deal`. If modifier failed, don't silently claim it applied.
4. Record `seed, strategySystemIds, strategyOutcomes, candidateCount, sourceThreshold, selectedBy, postFinalHash, knownUserWinnablePath, evidenceState`. Distinguish `solver LOST` from `search TIMEOUT/UNKNOWN`, exhaustive `PROVEN` vs sampled, and actual budget.
5. Implement native-like `Priority` normal path separately; a special failed-bot candidate must not corrupt standard candidate selection. Test exact old C8 plain dealer vectors and separate synthetic candidate fixtures.
6. Preserve discovered native short-circuits and original enum/gates **where verified**; unavailable live config should remain `UNKNOWN`, not fabricated. A static match can be reported `SOURCE_BRANCH_PARITY`; `NATIVE_FINAL_PARITY` requires actual original execution.

**Important:** Hitapps' `Equality` can select boards that better humans beat on the first attempt, as well as boards impossible for its own bots. Calling it `guaranteed impossible` misrepresents the verified algorithm.

### B. `ContinueConvertible` — OUR monetization constraint for **+10 moves**

This is **not proven to exist in Hitapps** and should not be claimed as exact source port. It is a compatible extension needed by our game to get meaningful rewarded-continue conversions.

A special candidate can be accepted for *our* monetization experiment only when all relevant conditions can be checked:

- `initialBudget = B`. Have at least one **verified** solution for the identical initial deal with `B+10`, e.g. a route length `B+delta` where `1 <= delta <=10` (or small test range agreed in balance). Verify route against Rules v3 and independent oracle **after** all transforms.
- To **guarantee** no win at `B`, the selector needs an exhaustive/proven lower bound `minimumRequiredMoves > B`. A bounded BFS/heuristic with no found win **is UNKNOWN, not a proof**. Large 64/78-card games may make optimality proof computationally expensive. If proof unavailable, classify `CHALLENGE_UNCERTAIN` and don't label mathematically impossible.
- A proof `B+10` is enough *from the start* does **not** guarantee +10 rescues the **actual exhausted player state**, because their earlier decisions may be worse. At outcome, if practical, run a bounded recovery check on the **actual saved board with 0 moves** under a temporary `+10` budget. Return `PROVEN_RECOVERABLE` only if a concrete legal route exists; `UNKNOWN` if search times out. **Do not promise a win** on an unknown state.
- Our present `useContinue` is **one use per attempt**, 10 moves, and can be triggered only on `exhausted`; no double-credit through multiple callbacks/reloads. No rewarded grant until native *earned receipt*. No-fill closes the flow with normal Retry/Undo options; no fake +10.
- Important subtlety: if `+10` cannot ever complete the selected board, it is a **bad candidate for a one-ad rescue mechanic**. Either reject it as monetization candidate or explicitly change the continued-move UX/product contract in a separately approved implementation. Do not quietly mint more continues, change ad SDK or produce indefinite purchase pressure.

**Acceptable implementation sequence:** SourceEquality source parity first; ContinueConvertible with solvability/certified-minimum and actual-state recheck second. Keep them distinctly labeled in code, docs and metrics.

## 3. Conditional activation / segmentation in OUR game

Design a separate config, defaults **DISABLED until developer QA/owner verification**:

```ts
type PlayerSegment = 'non_payer'|'payer'|'potential_payer'|'sleep_payer'|'unknown';
type SpecialDealConfig = {
  enabled: boolean;
  minCampaignLevel: number;              // our chosen value, NOT from Hitapps remote
  eligibleSegments: PlayerSegment[];     // source-shaped configurable whitelist
  maxSpecialAttempts: number;            // explicit owner config, not default from original
  levelAllowlist?: number[];             // OUR policy; original campaignList use UNKNOWN
  strategy: 'source_equality'|'continue_convertible';
  minFailureBudgetFraction: 0.8;         // only this is native-verified
  candidateAttemptCap: number;           // can test 100; native upper bound per branch
  continuationMoves: 10;                // OUR BALANCE.continueMoves
  cooldownLevels?: number;               // OUR optional protection; not original native gate
}
```

**Do not claim** exact Hitapps defaults. Purchase segments in our current consumer may have **no authoritative IAP transaction history**: do not fake paid-status values; use `unknown`/available data and only explicitly configured eligibility. If we are not using store purchases, payer segmentation remains a supported future contract, not a real claim. Keep other privacy/analytics data minimal.

Activation must evaluate once **when constructing a new canonical campaign attempt**, not on every render, restart UI redraw, app foreground or hint request. Persist the **actual selected Deal ID/seed/content revision** and special status in attempt/save; old C1–C8 and Daily attempts remain independently readable. No silent reselect on resume, Undo, ad dismissal, change deck position or SaveStore retry.

Choose explicitly for our game whether Restart regenerates an eligible special candidate or keeps the existing one; **the original's full restart policy is unverified**. For initially safer controlled trial keep same Deal on Restart (no reroll), don't count mere resume as another issued attempt, and allow offline deterministic replay. Distinguish `specialCandidateEvaluated`, `selected`, `issued` and `playerLost` counters; the original's source-visible `paywallAttempts` increments on successful `GetPaywallStrategyType` and resets on one Initial-feature path, so do not falsely report an identical counter lifecycle unless reproduced.

**No user-visible false promises:** existing result says `+10 ходов · видео`, which is a literal grant. Do not add `вы точно победите` unless certified from the actual state.

## 4. Integrate with the EXISTING ad receipt, not a second economy

Verified consumer contracts at PR #41 HEAD `afd631c`:

- `BALANCE.continueMoves = 10` in `src/domain/balance.ts`.
- `src/domain/services.ts`: `RewardPlacement='continue'`, native receipt ledger, `continuedAttempts[]`, `continueCredits`, `useContinue` guards `exhausted/0 moves/not already continued`. Keeps credited budget valid across earlier Undo snapshots.
- `src/main.ts`: failure result shows `+10 ходов · видео` when rewarded is ready, `Undo`/Retry fallback, ad callback and no-fill handling. Current interstitial cadence belongs to **campaign new win**, not to this experiment.

Contract:
1. Candidate issued and completed `exhausted` state saved before presenting any ad UI.
2. User **voluntarily taps** rewarded continue; request attributed to exact `attemptId/dealId`.
3. `onShown` is not earned. **Earned receipt only** → existing `applyReceipt` / `useContinue` → +10. Dedupe attempt, receipt and effect; no app background race.
4. Ad not available/no-fill/dismissed/no reward: board and budget unchanged; retry / available Undo paths remain functional.
5. On +10 completion: ordinary win reward, first-clear, campaign progress, 5-win cycle, and 10-level milestones **once only**. Existing `BalanceVersion=3` untouched unless new commercial economics deliberately approved.
6. Exposure and attribution: distinguish requested, SDK shown, **impression counted if accessible**, earned, continued, then won. Don't infer ad revenue from button taps.

## 5. Implementation architecture and product QA (NOT "one flag")

**Offline authoring stage (preferred initial version)**:
```
source-native verified plain dealer
  → candidate seeds (bounded)
  → independent bot policies/solver outcome trace
  → Equality eligibility and late bot failure predicate
  → optional ContinueConvertible budget certificate / verified post+10 path
  → validate modifiers and independently replay final Deal
  → immutable candidate pool annotated with tier, seed, content version, proof status
```

**Runtime** (selection only, no heavy BFS during touch):
```
campaign new-attempt
  → read saved config/segment and completed level
  → decide normal vs eligible special **once**
  → choose prevalidated immutable variant / seed; SaveStore persists exact Deal reference
  → normal Rules v3 gameplay
  → normal exhausted state
  → optional rewarded +10 using existing receipts
  → win/loss/exit telemetry
```

Don't generate or solve a 78-card board on the UI thread. Don't replace 80-level authoring with unfalsifiable live difficulty tweaks. If allowed pool exhausted, disabled config, missing purchase data, no validated variant, no-fill, or unsupported modifier, **fall back to ordinary Priority**.

**Proposed QA matrix**:
- two source predicates with synthetic edge values: `solverWin=true` excluded from Equality; fail at `0.79×B` excluded; fail at `0.80×B` potentially eligible; independent strategy system count; 100 cap; tie/fallback branches where native proven; label `UNKNOWN` separately from loss;
- 4 gates: enabled false, below minLevel, ineligible segment, attempt cap, plus seed≤0. Test native **Initial reset vs BuildSimulatedPlan increment** as *two separate* source-parity tests, not invented unified semantics;
- no special first campaign/tutorial or Daily unless explicitly configured; hard/super-hard tier independent of special mode;
- exact Deal/seed persistence through SaveStore, restart, Undo, reload, park Daily, active/parked C6/C7/C8 previews, migration, background, legal mid-animation action;
- verified (+10) rescue: `B` limit route state, ad earned once, +10, independent winning route; no reward when ad unavailable or duplicate; late receipt cannot mutate a different attempt; Undo preserves granted budget;
- high-card C8 6/11/15 performance: time budget offline, runtime selection O(1), no freeze, existing Hint remains usable on off-witness states;
- tests must measure **all player-visible failures** in source-vs-special variants, not just the known winning path.

## 6. Measurement and go/no-go

Instrument through existing telemetry (do not add an SDK) event family:
`special_eligible`, `candidate_selected`, `special_issued`, `exhausted`, `continue_offer_seen`, `rewarded_request`, `rewarded_shown`, `rewarded_earned`, `continue_applied`, `post_continue_win`, `restart/exit`, `no_fill`, `d1/d7_cohort`. Attach `strategy,level,variantId,proofStatus,attemptId` **without personal purchase details**.

Compare normal `Priority` pool against special selection *for the same cohort/level range*. Relevant ratios: `true rewarded earned / special attempts`, `won after +10 / earned continues`, `restart/quit immediately after exhausted`, D1/D7, actual network revenue per install where reliable. An increase in ad-click rate without ad-earned or without next-session return is not evidence of net commercial gain. Do not hardcode competitor success claims; no live Hitapps uplift data exists.

Phases:
1. **Source parity memo/tests** for native `PaywallService`, `Equality`, Initial-path distinction and original classification (source-level; no code shipped).
2. **Executable offline Equality selector** on our cards with immutable output and negative fixtures, verified under ordinary C8 engine; A/B candidates including budget-recoverable and `UNKNOWN` cases.
3. **Product integration** with one-time attempt selection, save migration, existing rewarded+10 flow, and developer/device QA. Config disabled until explicitly enabled in approved preview.
4. **Small measured experiment** after the owner accepts device UX and content 1–15; expand conditionally and monitor actual earned impressions, continuation win, cohort-level engagement. Do not promise a numeric uplift.

## 7. What is needed for “досконально как в оригинале”

The original client itself **has not been executed under instrumentation**. Existing kit has verified ABI and Frida read-only capture package in [native runtime oracle](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-runtime-oracle/README.md). Controlled isolated original ARM32 environment must capture **at least two** native `(build,config,levelId,PaywallLevelSeed,strategy,selectedSeed,preFinal/postFinal stock/tableau,LevelType)` traces, including **one with Paywall actually eligible and applied**, if such remote config state can legitimately be reproduced. Do not claim active strategy unless actually observed; if remote config cannot be obtained, report **blocked**, not synthetic as live.

A faithful compiled-code path and conditional config can be ported and verified today. Exact **live player segmentation, levels, remote defaults, frequency, enforced math impossibility, or +10-convertibility of original** cannot be inferred from this archive. That is the remaining reverse-engineering work, not an excuse to skip the executable implementation of source-verified parts.

## 8. Developer handoff and scope boundary

**Build this as a separate Content8 follow-up, after reconciling latest PR heads.** The user has explicitly opted to investigate and implement the Paywall/Equality selection track; don't silently discard it based on earlier advisory HOLD. Stage as a feature flag and offline verifier, preserve all existing app systems. Do not replace genuine wins with a hardcoded `phase='exhausted'`, inject fake SDK rewards, silently reduce moves on an already started attempt, or claim an Android capture that never occurred.

Do not reuse proprietary card texts, artwork or original SDK binaries. Run local source-bound tests and user-visible recorded real play. Send exact `SOURCE VERIFIED / PORT PASS / DEVICE PASS / ORIGINAL LIVE UNKNOWN` matrix.

**KIT IMPACT:** research interpretation updated by owner decision, game-owned implementation initially; only extract a generic bounded candidate-selection primitive into mini-games-kit after demonstrated reuse. No new runtime-kit API now.
