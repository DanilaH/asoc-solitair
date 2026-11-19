# Content 8 — BLOCKER: onboarding, Hard/Super Hard и faithful dealing

**19 ноября 2026 · source-backed corrective technical specification · статус: ПРОВЕРЕННЫЕ ПРОБЛЕМЫ + ПРЕДЛОЖЕНИЕ ДЛЯ РАЗРАБОТЧИКА, НЕ РЕАЛИЗАЦИЯ.**

**Запрос владельца:** новый большой Content 8 заметно интереснее, но уровни 1–5/обучение остались из миниатюрного Content 7, затем уровень 6 внезапно даёт 78 карт/56 stock; помощь открывается без ясной инструкции; нет анонсов «Сложный»/«Очень сложный» и окрашенного Next; не доказано, что скопирован механизм выдачи Hitapps, а не только объём. Требуется исправить **обучаемость, честную сложность, UX и сам метод формирования партий**. Не откатывать улучшенный C8 к маленьким доскам.

## 0. Текущий источник истины / ветки

- На дату аудита `main=b612420fda4d8677073034a91c944c46573cbf08` (C6), Content 7 [PR #33](https://github.com/DanilaH/asoc-solitair/pull/33) на `7187e738`, новый большой **Content 8 [PR #39](https://github.com/DanilaH/asoc-solitair/pull/39) на `db038908f64b80923def9ecd5bb056668634a9b6` — DRAFT**. Ветви feel #35/#36 и Android fixes #37 тоже открыты отдельно. **Нельзя** выбирать старый `main` или произвольно сливать перекрывающиеся PR, не сверив их актуальные heads/changes/QA. Продолжать от принятой базы, сохранить совместимость C8 preview saves и реальные интерфейсные улучшения.
- Реальные C8 6–15: [референсная матрица](https://github.com/DanilaH/asoc-solitair/blob/feat/content8-reference-slice-20261119/docs/qa/content-v8/reference-matrix.md), [реальные скриптовые маршруты](https://github.com/DanilaH/asoc-solitair/blob/feat/content8-reference-slice-20261119/docs/qa/content-v8/README.md), [скрипт авторинга](https://github.com/DanilaH/asoc-solitair/blob/feat/content8-reference-slice-20261119/tools/content/build-reference-slice.ts).
- Original Hitapps 1.26.2 exact XAPK research: [LevelBundle 1–31](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-17-hitapps-level-map), [native generator bridge](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-17-hitapps-generator), [full-list index shuffle](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-17-hitapps-index-shuffle), [752 conditional ordinary layouts](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-18-hitapps-plain-replay), [simulation scoring](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-18-hitapps-candidate-selection), [native-runtime oracle still OPEN](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-18-hitapps-runtime-oracle).
- AZUR video: [nov9 reference analysis](research/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md), owner [S2 original 1.3.3.8](https://drive.google.com/file/d/1i3a71rYs9Ja9ETa0eyqGEpSjYh83zKEE/view). Observed AZUR first level no move limit, action-specific guided teaching, Word Reader unlock 4, Undo6 (unlock shown but usage not tested), Shuffle10; source sample level2 stock19 and level3 stock23. Unico historical sample adds helper-first-use cases (Undo2, Hint3, Magnet4); those are **not** required exact unlock levels for our game.

Do not read title of a class or a source `type` number as evidence of actual live tutorial/difficulty presentation. APK metadata, bundled map, original gameplay video and our candidate are distinct evidence tiers.

## 1. Confirmed severe learning-curve discontinuity

| Level | Current active preview source | Total cards | Stock | Actual learning |
| ---: | --- | ---: | ---: | --- |
| 1 | inherited C7 | 6 | 0 | Leader and simple theme |
| 2 | inherited C7 | 8 | 2 | A couple of draws |
| 3 | inherited C7 | 8 | 0 | Hint opens; a hand may highlight it, but no isolated verified Hint lesson |
| 4 | inherited C7 | 11 | 2 | Undo opens; attention conditional on there being Undo history |
| 5 | inherited C7 | 12 | 3 | Essentially a short easy completion |
| **6** | **C8 reference slice** | **78** | **56** | Sudden jump to 12 themes / 4 lower columns / 4 top slots |
| 7 | C8 REST | 35 | 26 | Lower volume, but still a real stock-driven game |
| 8 | C8 BASE | 64 | 46 | Joker unlock existing default at 8, but **no dedicated easy first-use Joker lesson** |
| 11 | C8 larger peak | 80 | 62 | No separate peak announcement |
| 12 | C8 REST | 36 | 24 | Shorter, not empty-stock |

**Scale cliff:** level5→6: cards **12→78 (6.5×)**, stock **3→56 (18.7×)**. Restoring Hitapps' absolute level counts at 6–15 without repairing 1–5 did not transfer its full progression. Source Hitapps EN positions1–6 are `21/3, 32/23, 61/43, 62/44, 64/46, 78/56` for `total/stock`; they are **bundled source layouts**, not independently captured final live boards. Source AZUR video shows more deliberate early guided interaction, not identical level IDs.

**Implementation contract:** do **not** simply add an explanatory modal at level6. Produce **two source-grounded candidate ramps for levels1–5** (one near Hitapps first-five source scale; one smoother with deliberate first-use micro-lessons) while holding **C8 level6/7, 11/12 geometry unchanged as the reference targets** until the owner compares. Select the actual 1–5 revision on real uninterrupted play, with level5 already containing substantial stock/waste activity. If source-sized 3/4 makes a novice lesson confusing, prioritize the user-visible learnability evidence and document a deviation rather than silently shrinking every later party.

## 2. Teach SKILLS, not just numbered levels

### 2.1 Skill ladder and trigger

| Skill | First teaching episode | What learner must do successfully | Bad previous behavior to avoid |
| --- | --- | --- | --- |
| Topic leader → upper slot | Early 1 | Touch the leader, finish short group; show one physical consequence | A banner then automatic AI move |
| Item + matching group | Early 1–2 | Transfer group/item and reveal the next card | Static descriptive paragraph |
| Stock and waste | Early 2 | Explicit draw, then play top waste; **show +1 spent move** | Introducing only two stock cards and assuming 56 are obvious |
| Skipping stock card / recycle | **Before large 6, typically 3–5** | Deliberately pass an affordable card, then bring it back (optionally park in empty lower column), with visible move cost | Hidden irreversible early trap; teaching only after losing |
| Upper-slot priority and lower buffer | **Before large 6** | Two categories compete for limited upper space; make one recoverable order choice | A bot claim that a board has two decision states |
| **Hint** | Dedicated light puzzle at unlock (**currently 3**) | Button highlights; show **real ghost move**; player executes it manually; distinguish first free Hint demo from paid repeats; mark after actual completion | Button appears silently, hand points without explanation or action |
| **Undo** | Dedicated light puzzle at unlock (**currently 4**) | Make a reversible transfer, tap Undo and see exact restored group, stock and move budget; state cost clearly; mark lesson only after a valid Undo | Appears when history empty/disabled; explanation without an Undo |
| **Joker** | A deliberately **easy** first-use episode when unlock is moved/validated (**currently 8**, C8 level8 has64 cards) | Select Joker → choose an **existing lower column** → see buffer role; free first-use only if separately approved and journal-safe; no auto-spend | Unlocking silently on a large full game or misrepresenting Joker as an extra upper slot |
| Recycle / choice under pressure | Before or at first true PEAK | Compare immediate play vs draw; explain that a missed card is beneath the waste top and might cost a new cycle | Demand a guaranteed loser or show the solver's hidden future |

**Unlock schedule needs a deliberate decision, not incidental survival of C7 constants.** Current `HELPER_UNLOCK={hint:3,undo:4,joker:8}`, `lesson` only draws conditional attention at3/4 and `joker` by `tags:['joker','teaching']`. C8 level8 has `tags:['reference-slice']` — so **Joker onboarding is missing**. Preferred acceptance: keep Hint3/Undo4 if repaired as dedicated easy lessons, and *either* make first Joker exposure an explicit easy micro-lesson before the big C8-8 *or* move its unlock to a nearby REST, e.g. level7, with migration and owner's approval. Don't silently adjust prices/initial balances/feature gates.

**UX structure of helper first-use (common sequence):**
1. `Unlocked: Подсказка/Отмена/Джокер` — clear short introduction, temporary highlight on correct button and one intelligible sentence;
2. actual legal/eligible board with the needed state, not a fabricated click or a false revenue grant;
3. `press → see actual consequence → player acts`, scene remains interactive; skip/close accessible;
4. persist the right `campaign.tutorials` milestone only after the relevant **accepted command**, not after closing a tooltip; action-based guidance should never force spending or mint a reward on animation completion;
5. after reload or veteran migration, do not replay a completed tutorial; if the player never used the helper, let them rediscover it from a short contextual help affordance.

**Do not** change pricing or give artificial free Undo/Joker charges without separate economic, SaveStore and receipt review. The existing `freeHintDemo` is the only agreed free learner claim. If a demo is explicitly approved for another helper, keep it versioned/idempotent. Reduced motion = static source/target + obvious text; no invisible hand-only instruction.

### 2.2 Why an action or stock branch may cause a loss

In our **actual Rules v3**, `draw` takes the next stock card to top of waste and spends one move; `recycle` returns waste to stock and spends a move; only top waste is playable. Starting a category occupies a finite upper slot; moving items into a lower group is limited; `movesLeft=0` exhausts the attempt. A wrong illegal drop is refused **without spending a move**. Tutorial should expose **legitimate move-cost decisions**, not tell users invalid taps are punished.

C8 [verified example](content-v8/README.md): on level15 at step78, skipping a playable `Яблоко` forces a return through waste and a winning route **+2 moves** versus the recorded witness. Good for optional explanation after the learner acts; one case **does not** measure actual fail-rate. Other C8 known branches can cost +1 or more, and 29 proven alternate wins exist; we do not know human error frequencies. Add one *specific* narrated post-action comparison at learning time, not a constant penalty warning on every draw.

New QA case: `skip current available stock card → reproduce changed waste visibility → restart/recycle or recovered route → exact +N move cost`, with saved state, touch clip and independent oracle. Keep at least one **fair**, recoverable misjudgment per difficult authored candidate. Require separately demonstrating a real exhaustion sequence (no invented unwinnability) and the optional Undo/rewarded/Restart screen.

## 3. Hard/Super Hard announcement — visibility and honesty

**Source evidence:** AZUR S2 explicitly shows **Hard level4**; its local 2000-row config has displayed difficulty values1–4. Hitapps source local `type=0..4` has **no verified direct mapping** to `Normal/Hard/Super Hard` UI label. Therefore **do not present** «type2=Super Hard» as verified original semantics, and **do not derive** difficulty only from number of cards or `MovesLimit`.

**Proposed explicit authored metadata:** `difficultyTier:'normal'|'hard'|'superhard'` associated with campaign level in an editorial manifest, **not** inferred from technical `Deal.tags` of limited source confidence. Fill with one approved policy, human-first acceptance and a source rationale. Candidate test: level6 = `hard`, level11 = `superhard`, REST7/12 = `normal`; all other values selected by observed difficulty, not automatic five-step labels. State that these are OUR proposed labels, not known Hitapps flags.

The same tier determines **three coherent UI surfaces**:

| Surface | Required behavior |
| --- | --- |
| Previous level's result → **Next CTA** | Label `Сложный уровень 6 →` / `Очень сложный уровень 11 →`, orange/gold for Hard; darker plum/red-purple for Super Hard; readable ordinary green for normal. Color is extra information, not the only indicator |
| **Next-level entry** | Compact skippable `Уровень 6 · Сложный` / `Уровень 11 · Очень сложный` panel/overlay; one primary `Играть` (or auto-enter without forced delay); no interrupt on every resume, no double navigation or held tap accidentally dismissing it |
| Home continue and level picker | Same tier indicator/border and text/icon when applicable; locked level doesn't reveal hidden board; accessibility label announces tier |

Keep palette coherent with the existing casual art, portrait safe-area and ad-banner reserve. Do not copy competitor graphic assets. Test keyboard/screen reader, high contrast, color-blind distinguishability, reduced motion, initial 320×568/320×480, simultaneous next-level reward, rapid double tap and repeated/resumed levels. The tier must not affect rewards, pricing, allowed moves, native ad placements or payout.

**Important:** a difficult level should be difficult for a reason (limited slots, stock timing, recoverable plan), **not** because the generator secretly tunes it to force a rewarded continue. Never map Hitapps `Equality/Paywall/NoPossibleMoves` strategy into our user-facing Hard labels.

## 4. What we ACTUALLY copied from Hitapps's dealing algorithm

### 4.1 Current C8: custom heuristic (verified in consumer source)

`tools/content/build-reference-slice.ts`:
- builds our own topic sets and exact four numeric source constraints: categories, total physical cards, initial stock, tableau column count;
- uses **`xorshift32`** (`rng(seed*65537+137)`) and ordinary **Fisher–Yates** over card IDs;
- optionally reorders stock via custom **`woven` weighted leader/topic exposure** heuristic;
- keeps some candidates only if top leaders not all/none exposed, no adjacent same-theme initial cards and candidate stock themes cover visible leaders;
- authoring loop tries up to **600** seeds; custom `findReferenceRoute(...,2600)` then requires some lower moves, chosen draws, max forced draw run≤7, enough slack and at least two recoverable alternate continuations; saved **immutable** C8 outcome.

**This is genuinely improved controlled authoring, but NOT a port of Hitapps's shuffler or simulator.** Its route is an offline witness, not an observed person's mistake or user-facing difficulty guarantee.

### 4.2 Hitapps evidence already exists: components ready for deliberate replication

| Hitapps original mechanism | Source proof | Port status in our game |
| --- | --- | --- |
| Authenticated LevelBundle input: source stock, stack sizes, categories, feature flags, accuracy and penalty | XAPK exact SHA, 226 bundles / EN31 | **Only four size fields are used by C8**; other source controls not ported |
| 56-state `System.EmbeddedRandom` | Native ARM32 verified; independent model fixtures | **NOT**: C8 xorshift32 |
| Destination-label list and **10 passes** of a **full-length index-swap**, `Next(N)` (not Fisher–Yates) | Generic AOT specialized instructions, PT_LOAD-correct mapping, 32 ARM words | **NOT**: current Fisher–Yates |
| `AllCards` ordering, numeric card-to-destination mapping and stock/tableau placement | Native bridge, source-authenticated data; conditional 752 Python-vs-C++ ordinary model layouts | **NOT**: current direct shuffled IDs → arrays |
| `PlaceCategoryPairsOnUniqueStacks` | Native method and call path; conditionally active with Equality/feature path | **NOT ported**; **do not enable automatically** or interpret as “preassemble full columns” |
| `RunShufflePhase` feature pipeline before simulation | Native indirect delegate proof | **NOT**: only ordinary content C8, no features in preview |
| `Priority` candidate simulation with target steps and accuracy/tolerance, bounded search, selected seed replay, then `RunFinalPhase` | Verified native call graph and branch-level scorer | **PARTIAL conceptual analogy only**: our finder proves own wins but uses different scoring/selector |
| Dynamic budget adjustment based on recent results | Native `DynamicDifficultyService` and penalty formula (live numbers UNKNOWN) | **NOT**. Do not add live adaptive difficulty in this content exercise |
| Paywall-gated `Equality/NoPossibleMoves` near-failure strategy | Verified conditional path in original native code, live enablement UNKNOWN | **EXPLICITLY REJECT** for our project; not a fair balancing requirement |

**Strongest source boundary:** 752/752 numeric layouts agree between two *independently implemented models of the same restricted native-derived ordinary algorithm*. They are **NOT** compared to two original Android executions. Exact original saved `stock/tableau` after runtime feature phases and active remote config remain UNKNOWN. The kit already supplies [Frida capture/comparator tooling](https://github.com/DanilaH/mini-games-kit/tree/main/research/games/association-solitaire/2026-11-18-hitapps-runtime-oracle); no approved controlled original ARM32 execution has been captured.

### 4.3 Concrete porting task, no “magical clone” claim

**G0 / source replay (offline lab, no live campaign change):**
1. Use the **existing** source-pinned kit Python/C++ plain-path verifier, don't reverse the same symbols from zero. Port **our own clean implementation** of plain `EmbeddedRandom → encoded destination list → 10 full-list passes → card allocation` into a **separate offline authoring module**, using **our own original Russian card IDs** as inputs. Keep a source-step table: exact known ARM behavior vs adapted game rule vs not-yet-known.
2. Validate every intermediate step against approved synthetic vectors and the conditional 752-crosscheck corpus where appropriate. Preserve exact seed and module revision in output. The *published* deal remains a frozen immutable record; **no runtime reshuffle on Next, retry, Undo or reload**.
3. In a controlled ARM32 original-app environment, capture **≥2 genuine native snapshots** `(build/locale/levelId/actual seed/config/preFinal/final stock/tableau)` and compare with the conditional plain-path port. If no suitable environment is available, keep label **STATIC/CONDITIONAL REPLAY**, NOT `NATIVE_EQUIVALENCE_PASS`; source verification alone is valuable but not a full port.
4. Only after accepted G0: add separately configurable ordinary `Priority` candidate selection by **our own authoritative engine** with target-step bands and tolerance; validate a selected candidate again **after all applicable modifications**. Separate this from a product difficulty label; no `Equality`/Paywall near-failure objective or hidden manipulation based on ad availability.
5. If/when ordered/keys are included in larger campaign, test those as **explicit accepted feature constraints**, not silently ignored flags or automatic addition of third-party modifiers. Preserve a bounded `UNKNOWN` outcome instead of claiming an unsolved board is impossible.

**G1 / make the player understand risk:** for each authored PEAK and selected BASE record a trace of **at least one visible consequential stock/slot choice**, one recovered wrong/inefficient choice and one genuine budget exhaustion or note `NOT FOUND`. Record what's **visible to the player at the decision**, not bot-only full-information reasoning. `choice=draw when transfer exists` is a *candidate for examination*, not proof that the choice mattered. A large deck can still be boring if every card is immediately moved to an obvious category.

**G2 / scalability:** C8 source notes that full hint BFS currently caps at 4000 states and the UI at 5 seconds, producing a practical failure on dense boards after a deviation. Before shipping a much larger campaign, make **Hint useful on correct and recoverable off-witness states** (targeted priority search, bounded continuation index or proven fallback). Don't charge a Hint if valid move not returned, don't fabricate a winning continuation, preserve free first lesson and pending/error UI. Test C8 levels6,11,15 on actual deviating states.

## 5. Dependencies and releases: do not conflate these changes

| Work package | Blocking relation | Deliverable |
| --- | --- | --- |
| **O1 — onboarding first five + helper lessons** | **P0 before full C8 release** | Two 1–5 ramps, at least one chosen, actual walkthrough/recording; accepted moves/cost clarity, no 5→6 cliff |
| **O2 — Hard/Super Hard UI** | P0 alongside O1 | Authored tier manifest, consistent Next+entry+picker+home, 320px tests and flow/active-attempt safety |
| **G0 — native-derived plain generator lab** | P0 research, **parallel** to O1/O2 | Source-step parity evidence, runnable offline module/test fixtures, explicit original-runtime oracle UNKNOWN/PASS |
| **G1 — authoring decision quality** | Before expanding C8 to the remaining 70 levels | Consequence and counterexample passports, fair miss and no mandatory forced draws, human pilot |
| **G2 — Hint at larger size** | Blocking product quality if demonstrably failing after C8 deviation | Reliable targeted Hint and no-charge failure gate |
| **C8 16–80** | After accepted 1–15 experience and G1 | Staged immutable campaign, rule/save, CI/Android, human review; don't auto-regenerate old release IDs |

**Do not let the optional native Android instrumentation block the learner-facing fixes.** Conversely, do not claim “we copied the original generator” just because G0's function names resemble Hitapps. Gameplay feel, authored card balance and original binary equivalence are three independent acceptance statements.

## 6. Detailed acceptance, negative tests and QA

- **1–6 onboarding path, from clean save:** same small tutorial scenes on phone and desktop, no permanent paragraph; press/skip/reload/Undo/Next; first **valid** Hint returns demonstrable ghost action and no spent resource in approved free demo; learn via an accepted action, not tooltip dismissal. First valid Undo reverses the recorded move and the displayed charge matches saved inventory. Level6 starts with stock already learned through several smaller decks, not suddenly 56.
- **C8 7–8 and first Joker:** REST/first-use state with the helper actually usable; veteran migrations don't retrigger completed tutorials. Opening of locked future helper is clear (optional short level label) and no dead button acts as tutorial.
- **Next to Hard/Super:** Enter5→6,10→11; Next CTA colored/labelled for **next** level, single clear entry state, title + tier, exit/skip without held-tap double transition; no extra ad and no change in coin payout. Resume/restart/home/level picker: tier remains coherent, no repeated forced animation. Ordinary7/12 controls unchanged. Color-independent A11y label.
- **Stock/decision fairness:** compare visible available actions, budget cost, missed waste card and gained/avoided recycle in at least two levels. Three replayable traces each: first/alternate/recovered-miss, and fail if found; every candidate independently validated against production and a distinct transition oracle; don't select based only on number of RNG iterations or fake “difficulty rating.”
- **Regressions:** Content8 active/parked old C7/C6 saves, daily28, help unlock/paid vs free, Joker/keys/ordered, Undo and historical snapshots, economy3 receipts/one-wallet, original preview signer and SDK test/disabled contract, native banner/pause, four deck orientations, short-screen viewport/safe area, drag latency and reduced motion.
- **Evidence:** latest exact HEAD/build, two source-linked reference videos with timecodes, before/after 1× captured real inputs, count of covered named skills, funnel of visible errors and fixes, clean build/full checks and signed test APK if signing available. Human/device feel = `PENDING` until personally tested. **Owner must accept early C8 learning/playtest before C8 16–80 is called finished.**

## 7. Requested developer handoff

Deliver **(1)** specific 1–5 ramp options and one working preview, **(2)** three-surface difficulty UI, **(3)** source-bound *actual* generator-port inventory and offline G0 implementation evidence, **(4)** 2–3 player-visible C8 error scenarios and Hint repairs where necessary, **(5)** exact QA/video/APK and unresolved gates. If G0 cannot be fully reproduced, say exactly what source-based part is implemented and what original runtime data is unavailable; don't hide it under “generator copied.”

**KIT IMPACT:** research REUSE initially; a truly general, separately proven offline generator/QA module may be a `CANDIDATE` for the kit, not a reason to change runtime exports or ship competitor code/assets. Native structures are used as a reference for independent implementation, no third-party copyrighted data in production.
