# Association Solitaire — полное ТЗ переноса core gameplay из Hitapps / AZUR / Unico

**Дата:** 20.11.2026  
**Источник продукта:** `DanilaH/asoc-solitair` — development `feat/c8-onboarding-dealer-20261119`, baseline `bf26fe7280b05c458e12626590bbe5cf789c6788` на момент аудита. `game/main 19ea067f1788f9aabdabf819c6008e15475b22be` — старый C6. Разработка Content8: [PR #41](https://github.com/DanilaH/asoc-solitair/pull/41). [PR #42](https://github.com/DanilaH/asoc-solitair/pull/42) — **исследовательское ТЗ Equality**, не реализованный runtime.  
**Исследовательский исходник:** [mini-games-kit core audit PR #78 (merged)](https://github.com/DanilaH/mini-games-kit/pull/78) и [доказательства](https://github.com/DanilaH/mini-games-kit/blob/3f18a9e915a8414b8b10f645bf9e76ef4a30e3ac/research/games/association-solitaire/2026-11-20-core-source-proof/README.md); source inventory **113** ID (after the separate AZUR tutorial preset study) и [consumer ledger](../porting/ADOPTION_LEDGER.json). Research-gui-dance revision и runtime kit dependency — **разные pin**; это ТЗ не обновляет SDK.  
**Назначение:** **инженерная спецификация core системы для разработчика**, не новый список советов и не согласие вычеркнуть дорогие механики. Все найденные core-механики — генератор, баланс, модификаторы, сложность, рестарт, помощники, failure/revive — входят в программу продукта. Можно внедрять пакетами, **исключать из roadmap только по явному решению владельца**.

## 0. Истинные статусы доказанности и критерии закрытия

| Маркер | Что действительно известно | Что НЕ означает |
| --- | --- | --- |
| `ORIGINAL_NATIVE_STATIC` | ARM/IL2CPP RVA/инструкции/вызовы проверены относительно конкретной сборки и exact hashes | Что этот путь активен в удалённой конфигурации / что видел игрок |
| `ASSET_VERIFIED` | исходные authenticated LevelBundle / LevelConfig значения | Итоговая выбранная генератором раздача или online override |
| `VIDEO_OBSERVED` | конкретное действие/экран/результат | Точный seed/RNG, payout policy, SDK callback |
| `MODEL_PARITY` | две свои модели или наш engine+oracle дали одинаковый replay | Сопоставление с запущенным оригинальным APK |
| `GAME_IMPLEMENTED` | изменение есть в точном коде/коммите | Плейтест на телефоне или коммерческий успех |
| `ORIGINAL_RUNTIME_PARITY` | точные оригинальные build/config/seed и сравнённые состояния **реально выполняемого** оригинала | Невозможно получить из статического отчёта |
| `UNKNOWN` | конкретно указана отсутствующая проверка | Можно подменить произвольной эвристикой и объявить копию |

**Первоисточники:**
- Hitapps `com.hitappsgames.wordsolitaire`, **1.26.2/code3742**, XAPK SHA256 `22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0`, ARM32 ELF SHA `f25d9a988f6fa61eb201879f72c556a5875a4ac2c5f541670950589afbb51e26`. [source map](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-level-map/README.md), [seed/RNG](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-rng-stacks/README.md), [candidate selector](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-candidate-selection/README.md), [special phases](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-final-phase/README.md), [source simulation callback](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-simulation-callback/README.md), [runtime oracle OPEN](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-hitapps-runtime-oracle/README.md).
- AZUR `com.solitaire.match.words`, **1.3.3.8/code244**, XAPK SHA256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`, ARM64 ELF SHA `27eb2e67ba00093ed575e16fc01a876a9e90fff8e53b504338047a4bf2c0d924`. [native core verifier and results](https://github.com/DanilaH/mini-games-kit/blob/3f18a9e915a8414b8b10f645bf9e76ef4a30e3ac/research/games/association-solitaire/2026-11-20-core-source-proof/README.md), [2000-row LevelConfig](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-azur-static/README.md), [budget/cadence](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-azur-static/BUDGET_MODEL.md), [loss/revive native](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-loss-ads-flow/README.md).
- Unico `com.unicostudio.wordsolitaire`: источник [S3 video analysis](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-09-reference/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md). **Исходный XAPK отсутствует** в подтверждённом [Drive каталоге исходников](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/source-apks/unico/README.md): core не восстановлен нативно. Никаких выдуманных чисел от Unico.

Оригинальный Hitapps XAPK на Drive имеет ~288 MB и не может быть целиком передан через нынешний Drive connector download с ограничением 256 MiB. Старые read-only proof scripts и результаты source-bound исследовательских проверок сохранены в kit; **настоящий Android original runtime не захвачен**. Для AZUR нативные static evidence и исходный verifier были проведены в отдельном исследовательском окружении; CI в kit может проверить модели/fixtures без приватного XAPK, но **не может доказать повторный запуск оригинала без него**.

## 1. Системная схема ядра, которую надо реализовать

```text
Reference source LevelConfig / LevelBundle (source hash, local override, remote UNKNOWN)
  → Level preparation (locale/difficulty budget, player history, source type and feature seeds)
  → Chosen plan:
      non-random/tutorial
      ordinary Priority + EasyDeals decision when eligible
      source-supported special Equality/Paywall when eligible
  → Card/slot enumeration (leader→members; puzzle/ordered/booster special types)
  → Seeded destination-list shuffle (EmbeddedRandom + ten full-length passes)
  → optional Equality three-distinct-stack pair placement
  → feature-conditioned Shuffle phase (Lockers / Frozen / Bound, optional FeatureLevelSeed re-shuffle ONCE)
  → real rule-accurate simulation, scoring & selected candidate (bounded 100, fallback)
  → separately applied Final phase (GoldenCards / StarterBooster independent RNG)
  → IMMUTABLE final Deal + effective moves + 1..5 columns + witness / unknown proof
  → Rules v3 versioned gameplay: legal move / draw / recycle / group completion / loss
  → optional Undo/Hint/booster/rewarded+10 / re-deal / restart / next level
  → saved exact attempt, receipt and outcome history for future eligible adaptive difficulty
```

**ВАЖНО:** native Hitapps `RunForNewLevel` (`Initial→Shuffle→Final`) и `BuildSimulatedPlan` (candidate search + delegated `RunShufflePhase` BEFORE scoring + `RunFinalPhase` afterward) — **разные ветви**. Не упрощать их до «после рандома включить все эффекты». `LevelType` flags и `Applied/Failed` результаты хранить отдельно от вероятности победы.

Core должен быть построен на **нашем чистом коде**, а не копировании стороннего Unity/IL2CPP. Для опубликованных уровней итоговый `Deal` заморожен; тяжёлый solver/генератор выполняется offline или отдельным worker, а не во время жеста на UI-thread.

## 2. Блок R — точность обычных правил и cost model

### R1. Проверить правила на реальных состояниях

В текущем `src/domain/engine.ts` уже есть `packet`, `applyBoard`, `draw/recycle`, foundation/temporary tableau, ordered, ключи, Joker. Прежде чем переделывать правила, сделать независимую таблицу **source action → наш action → expected board/cost**, с fixtures:

1. Лидер категории может открыть пустой верхний слот, слово — присоединиться к соответствующему лидеру; категориальные пачки и порядок `rank` должны проходить с теми же ограничениями, которые **подтверждены** для нашего game Rules v3; для неизвестного original поведения — `ADAPTED, NOT SOURCE EXACT`.
2. Перемещение группы из нижней колонки и открытие нижней карты, перенос из waste, временное складывание на нижние колонки, завершение/освобождение верхнего слота. `Joker` — временная нижняя опора, **не** свободный upper slot и не бонусный нижний столбец.
3. `draw` обязан потреблять ход и перенести следующую карту из stock в waste; `recycle` потребляет ход по **нашему** Rules v3, переоткрывает ту же последовательность. На AZUR native `Deck.DrawNextCard` берёт конец списка, `Deck.Reset` переворачивает waste обратно в stock, скрывает карты и увеличивает счётчик цикла; **внутренняя ориентация массива** может отличаться при одинаковом user-visible цикле.
4. После завершения партии `movesLeft=0` и `won` имеют приоритет **победы в последний ход**. Отдельно проверять `HasAnyValidMove`, `canReachTransfer` через полный recycle/stock и `actualBudgetExhausted`; **не объявлять поражение**, пока существует допустимый draw/recycle до будущего переноса.
5. Ошибочное действие/tap/drag не тратит ход; Undo восстанавливает состояние и **не отзывает заработанные рекламные +10**, корректно сохраняет revisions/receipts. `Hint` **не списывает заряд**, если solver возвращает UNKNOWN или не доказал полезный ход.

**Original AZUR native verified:** `GameManager.CheckDefeat 0x26a4090` вызывает `MovesSystem.HasMovesLeft 0x26a91e8` и `GameBoard.IsVictory 0x269fce8`; отдельный `HasAnyValidMove 0x26a40f8 → MoveValidator.HasAnyValidMove 0x26a9b14`. Это **две разные семантики** и **не доказательство**, что AZUR всегда заканчивает уровень заранее при отсутствии хода.

### R2. Обязательная матрица игровых состояний

Снимки: stock full/one/empty, waste full/one/empty, нижний столбец empty, blocked by lock/frozen/bound, foundation full/empty/one-slot-left, past recyclable zero cards, win last move, loss at zero, true inability to transfer despite deck, Undo/rewarded after low budget, saved tutorial step and app relaunch. Для каждого — one-step transition, move delta, face-up flags, legal actions, `phase`, hint response и Android hit region.

**Source Unknown:** Hitapps точная стоимость всех special действия/условия revert/restore и AZUR фактический paid stock reset vs обычный не возвращают `ORIGINAL_RUNTIME_PARITY`; зафиксировать отдельно.

## 3. Блок G — источник уровня, RNG и выбор раздачи

### G1. Config → final distribution

Только Hitapps original local EN1–31 подтверждены точно; 14 локалей/226 authenticated `map→LevelBundle` записей. `isRandom=false` для первого local уровня, EN2–31 randomized. Остальные исходные уровни/online override UNKNOWN.

`AllCards`: category leader first, потом собственные `wordsData` по исходному порядку. `N=stockSize + Σ columnSize`; сформировать `ushort` destination labels (low-byte container type Stock=0 или PlayStack=2; high-byte index/position), затем `System.EmbeddedRandom(seed)` 56-state и **10 полных проходов** swap: `for pass=0..9, i=N-1..1, j=Next(N)`, **НЕ Fisher–Yates** и `N` не уменьшается. Всего `10*(N-1)` вызовов `Next(N)`.

`src/content/campaign.ts` в normal build показывает Content7; C8 preview selection через `VITE_CONTENT8_PREVIEW=1` заменяет позиции **1–15**; 16–80 FALLBACK Content7. `tools/content/build-opening-dealer.ts` уже реализует ordinary source-prefix и свой solver. **Старый** `tools/content/build-reference-slice.ts` содержит xorshift/Fisher–Yates/«woven» и остаётся исторической адаптацией, **не может случайно стать source canonical**.

**Проверки:** sample seed0,1,42,43 по source 188×4 conditional ordinary placements, source hash `ac7cf98c3c522a6f8593c2a98d38ccd966c130feea9f6a9948b04651b98fabf5`, плюс самостоятельно сгенерированные mini fixtures, exact stock and tableau occupancy, order leader/member. Источник conditional `MODEL_PARITY` ≠ оригинальный terminal Android board. `Int32.MinValue` constructor behavior vs negative `ShuffleLevelWithSeed(seed<0)` (выбрать новый seed) — **разные случаи**.

### G2. Отбор кандидата и provenance

Сейчас C8 `selectPriority` смотрит **только успешные** маршруты собственного `findReferenceRoute`, целевой steps выбирается нашим default `round(.89 * movesLimit)`, tolerance15%. Это **приближение нашей модели**, не подтверждённые Hitapps `accuracy/targetSteps/solverStrategies`.

Портируемые стратегии:
- `Priority=0`: `TryToWinLevel` success → ближе к target steps; первая лучшая при равенстве, ранний выход при `IsWithinPercentRange`, верхняя граница **100 кандидатов только одной нативной ветки**, fallback and errors.
- `Equality=1`: `TryToWinLevel` **did not win**, but sim consumed **≥0.8×MovesLimit**; последовательная проверка требуемого числа `StrategySystems`, отказ на успешном боте. Это поиск *late bot failure*, **не доказательство математической непроходимости**. Параметр `placeCategoryPairsOnTop=true` делает три **разных** `playStack` placement (не повторно созданный RNG).
- `None=2`: original source enum существует, семантика конкретного выбора/использование в live UNKNOWN — не заменять `Priority` по умолчанию.
- `EasyDeals`: отдельное вычисление по порогу поражений/гейтов и source types, **не** свойство `Equality`. После неудач может выбирать релаксирующий план, но конкретный активный `lossThreshold` UNKNOWN.

**Данные кандидата** в frozen audit-паспорте:

```ts
type DealAudit = {
  sourceBuild: string; configDigest: string; localLevelPosition?: number;
  authoredLevelVersion: number; strategy: 'Priority'|'Equality'|'None'|'Adapted';
  requestedSeed: number; actualSeed: number; featureSeed?: number;
  candidateCount: number; selectedBy: string; sourceAccuracy?: number;
  targetSteps?: number; evaluatedPolicies: {
    policyId: string; result: 'WON'|'LOST'|'UNKNOWN';
    steps: number; terminalReason: string;
  }[];
  appliedFeatureFlags: number; failedFeatureFlags: number;
  afterShuffleHash: string; postFinalHash: string;
  moveBudgetBase: number|null; moveBudgetEffective: number|null;
  independentWinningWitness?: string; proofLevel:
    'SOURCE_PREFIX'|'MODEL_CROSSCHECK'|'ORIGINAL_RUNTIME'|'UNKNOWN';
}
```

Это **предложенная структура нашего авторинга**, не оригинальный тип Hitapps. Она не должна попадать в приватный runtime/analytics целиком; запись production `DealId+version+immutable seed` для восстановления попытки.

### G3. Сложность и лимиты

Hitapps original `DynamicDifficulty` различает `Clean=1`, `ExtraSteps=2`, `Restart=3`. Ведёт окно **10 исходов**, проверяет win-rate interval, нелинейно взвешивает повторы, применяет `Penalty` через `LevelDataHandler.PrepareLevelForGameplay → Convert → GetStepsLimit` **только при `isStableMoves=true`**. Нативная формула использует процентное signed изменение `MovesLimit` c rounding **AwayFromZero**. **Положительный Penalty в проверенной формуле увеличивает доступные ходы**, отрицательный уменьшает. Не привязывать знак автоматически к `Hard/SuperHard`. Активные `hardPenalty/easyPenalty/winRateRange` UNKNOWN, вводятся **явными нашими конфигами**, не выдуманными «оригинальными значениями».

Новое доказательство AZUR: `LevelConfigManager.GetAdjustedMovesForCurrentLocale` original ARM64 `0x262e4a8`, на positive `M,E,L` при включённом locale branch:

[
mathrm{movesLocalized}=min(2^{31}-1, 5lceil Mcdot L/(5E)ceil).
]

`M` authored source moves, `E` original English word count, `L` localized word count. Fixture `(70,16,17) → 75`, `(117,50,60) → 145`. **Это AZUR, не Hitapps; не использовать для нашей единственной RU локали до появления собственного локализованного контента**. Stage `G1` в реестре, не `OWNER_EXCLUDED`.

**Не менять бюджет уже выданной партии при следующей победе/рестарте/получении события**: корректировать при подготовке **нового canonical attempt**, сохранять применённый effective budget и config revision.

### G4. Не смешивать математические свойства с рекламой

Пользователь отдельно одобрил систему специальной сложной выдачи, включая возможность проигрыша/продолжения. [Полный source-bound spec](https://github.com/DanilaH/asoc-solitair/pull/42).

- `SourceEquality`: source-native late bot non-win после 80% — это свойство симулятора, а не гарантия.
- `ContinueConvertible`: **наше адаптивное требование** для одного rewarded `+10`. Для положительного сценария от начального deal проверить конкретную последовательность победы ≤`B+10`; для утверждения «при B победа невозможна» нужен exhaustive proof `minimumRequiredSteps>B`, а не timeout/UNKNOWN. Для гарантий «+10 спасают» требуется **путь из реального exhausted state**, а не только с начала.
- `BALANCE.continueMoves=10`, `src/domain/services.ts` earned receipt ledger и once-per-attempt already exist; не строить второй экономический кошелёк. Никаких grants по `onShown`, двойных из-за callback, или скрытого перерасчёта бюджета на уже сохранённом уровне.

## 4. Блок F — функциональные фазовые модификаторы

Все source-модификаторы Hitapps остаются в программе, **не только наиболее лёгкие**. В исходном IL2CPP:

| Phase | Priority (НЕ номер открытия) | Applier | Product delta / проверка |
| --- | ---: | --- | --- |
| Initial | 10 | Paywall | seed / special status + segment/counter eligibility; [PR42](https://github.com/DanilaH/asoc-solitair/pull/42) |
| Initial | 40 | OrderedCategory | порядок категориальной последовательности, card.rank/prefix test; current C8 training beyond L15 |
| Shuffle | 20 | Lockers | source pattern index into config; key count/positions; Applied=2/Failed=4 |
| Shuffle | 25 | FrozenCards | `layers/column/position`; Applied=32/Failed=64 |
| Shuffle | 27 | BoundCards | `boundCards/scissors`; Applied=128/Failed=256; scissors actual behavior **UNKNOWN**, нужна отдельная исходная трасса |
| Final | 30 | GoldenCards | GoldRush `CascadeEventsHook` conditional, type=8, first-time tutorial branch |
| Final | 45 | StarterBooster | after candidate choice insert Magnet/Hammer into stock using **new Unity RNG**, not candidate's EmbeddedRandom |

`LevelType`: Basic=0, Paywall=1, Lockers=2, LockersFailed=4, GoldenCards=8, OrderedCategory=16, FrozenCards=32, FrozenCardsFailed=64, BoundCards=128, BoundCardsFailed=256, EasyDeal=512.

**Critical distinction**:
- In `RunForNewLevel`, shared `LevelFeatureContext.LevelShuffled` initially false: first eligible Shuffle applier may **once** reshuffle with `FeatureLevelSeed` and others use the same board.
- In `BuildSimulatedPlan`, candidate is already `ShuffleLevelWithSeed(candidateSeed)`, then bound delegate `RunShufflePhase` sets `LevelShuffled=true` and applies modifiers **without a second seed shuffle** before `TryToWinLevel`. Fallback restore of best seed repeats shuffle+phase.
- **`Failed` feature bits are NOT automatic rejection by native `LevelSimulationRunner.Run`** in inspected scorer. Do not silently reject them and call it source parity. Our product **can** require a separate correctness gate for authoring a playable special level; mark `PRODUCT_POLICY`, not `HITAPPS_SOURCE`.
- `Joker=2`, `PuzzleTop=3`, `PuzzleBottom=4`, `Magnet=5`, `Hammer=6` in `CardType`; **PuzzleTop/PuzzleBottom placement and Bound scissors interaction remain `EVIDENCE_GAP`**, not removed.
- AZUR original native **method bodies now verify independent bonus slot gates**: `BonusFoundation` upper type2 and `BonusColumn` lower tableau type3 use separate indexes, enable/unlock bytes and callbacks. `ConfigureBonusRewardedSlots`, `IsBonusSlot`, `IsBonusSlotUnlocked`, `UnlockBonusSlot` are decoded for their respective branches; UI exposure, actual added/reserved geometry, ad/price gates and device behavior remain UNKNOWN. See the [20.11 native-BODY follow-up](https://github.com/DanilaH/mini-games-kit/pull/80). Implement separately, including dynamic geometry and Hint solver; do not alias Joker to either.

**Strict QA for each new state:** independently authored category/text/asset, source pattern ID, board invariants, legality/Undo, solver/Hint, source/config seed provenance, one-time help/FTUE, 320px touch layout, saved/reloaded/frozen attempts, stop/restart, eventual win/loss and real-device review. Separate PRs for rules that change save schema; never mutate old C6/C7 archived deal definitions.

## 5. Блок C — Content 8 1–80 и качество интеллектуальных решений

### C1. Размеры и ритм исходников

**Hitapps authenticated EN source** (сравнивать с локальной EN позицией, не утверждать, что это публичные level numbers):

| EN position | Categories | Total cards | Stock | Columns | Base moves | Source type |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 21 | 3 | 3 | −1 | 0 |
| 2 | 6 | 32 | 23 | 3 | 61 | 0 |
| 3 | 10 | 61 | 43 | 4 | 125 | 1 |
| 4 | 10 | 62 | 44 | 4 | 118 | 1 |
| 5 | 10 | 64 | 46 | 4 | 125 | 1 |
| 6 | 12 | 78 | 56 | 4 | 161 | 2 |
| 7 | 6 | 35 | 26 | 3 | 65 | 0 |
| 11 | 12 | 80 | 62 | 4 | 168 | 2 |
| 16 | 12 | 80 | 54 | 4 | 164 | 2 |
| 21 | 12 | 80 | 54 | 4 | 170 | 2 |
| 26 | 14 | 94 | 59 | **5** | 180 | 3 |
| 31 | 15 | 100 | 65 | **5** | 199 | 4 |

At EN18/21/23/25/26/29/31 original map overrides `movesLimit` and supplies feature seeds/locker patterns. Например, EN26 `base180→map182`, EN31 `199→201`; **active precedence** unknown. `type` numbers 0–4 **не сопоставлены native способом** с `Hard/SuperHard`. Исходная пятёрка позиций чередует крупный пик, передышку и 3 обычных, дальше добавляет более сложные **5 колонок**. После EN31 exact pattern **UNKNOWN**; не создавать «точный Hitapps80» из домысла.

**AZUR** authenticated `2 000` authored rows: after level550 recurring period7 but **четыре структурных шаблона**, zero adjacent shared `WordsSet` IDs for all pairs, min observed repeat gap162. Mean budget after550 roughly100 moves; different structure and display-difficulty confounded. This is a **content strategy reference**, not copied random algorithm or directive to use 2,000 new levels immediately.

### C2. Реальная текущая кампания

Content8 `src/content/campaign-v8-dealer.json` содержит **15** frozen authored раздач с `tags=['ordinary-dealer']`. Часть первых уроков умышленно уменьшена против Hitapps:
- L1 `16 total/5 stock` vs EN1 `21/3` — unlimited tutorial;
- L2 `28/17` vs `32/23`;
- L3 `36/22` vs `61/43`;
- L4 `46/30` vs `62/44`;
- L5 `60/42` vs `64/46`;
- L8 `34/20` vs EN8 `64/46` for Joker practice.
These adaptations are **known product design**, not exact source reproduction. **Do not undo them without owner's Android FTUE feedback**.

**Hard cliff:** C8 L15 `64 total/42 stock` → old C7 L16 `24 total/0 stock` while preview only overlays first15. This is a concrete release blocker, not a subjective recommendation.

**Layout blocker:** `src/game/layout.ts` `cardMetrics` uses width124 and `gap=(540−4*124)/3` whenever tableau columns≥4. For 5 columns, positions exceed logical viewport. Need dynamic 3/4/5-column grid with correct foundation alignment, stock positioning, tap targets, portrait 320px and native banner safe area. Do not just shrink CSS; cards must remain legible.

**Tutorial warning:** C8 [onboarding README](../qa/content-v8/onboarding/README.md) says player may hide lesson hints and proceed. Owner previously required **mandatory, non-skippable, larger-font actionable lessons** until completed. Independently inspect current `src/app/tutorial.ts` and `src/main.ts`; document/code must align with owner decision. No «реализовано» until Android acceptance.

### C3. Качество партии — отдельный authoring gate, а не только winning witness

Current `tools/content/build-opening-dealer.ts` uses local solver+heuristics; >1 route checks only on handful of levels. **Do not measure interestingness from a 100% solved bot route alone.** For every newly authored deal record:
- `openingLeaderVisibility`; leader-first blockers, early full categories in ≤3 actions, homogeneous prepacked columns, duplicate topics and slot pressure;
- `meaningfulDecisionCount`: how many different legal actions have **measurably distinct downstream outcomes** (not just two identical foundation slots). Discard automatic no-brainer rotations from this count;
- `forcedDrawRunLongest`, fraction of moves spent forced on stock, repeated waste loop count, stock abandonment and recycle recovery;
- `wasteCriticality`: a missed active waste card can be recovered later vs requires redo; min extra actions after misplay;
- `errorRecoverability`: branch from a noncanonical choice wins without help, with Undo, with +10, or is `UNKNOWN`;
- `slack`: moves available after winning route; plan multiple plausible human policies, not only one witness;
- `semanticNovelty`: repeated same topic and ambiguities across adjacent/nearby levels, independent from structural difficulty;
- `specialFirstUse`: mandatory practice for Ordered/Keys/Frozen/Bound/Golden/extra slots and source unlock flags; these need their own acceptance.

Suggested thresholds for each band must be **our own explicit tested balancing parameters**, not invented Hitapps values. Record provenance as `PRODUCT_POLICY` and compare 1–15 human device sessions before locking constants.

## 6. Реализационные пакеты для разработчика

**Важно: ВСЕ обнаруженные core systems остаются в [113-feature roadmap](../porting/IMPLEMENTATION_ROADMAP_2026-11-19.md).** Пакеты ограничивают размер PR, **не финальный scope**. Точные стадии и зависимости:

| Пакет | Что должен получить владелец | Точные source feature ID и основные изменения | Acceptance |
| --- | --- | --- | --- |
| **CORE-0 — базовые правила, тесты и исходный PIN** | Signed playable C8 preview and explicit original-vs-our matrix | `azur-deck-draw-and-recycle`, `azur-defeat-vs-no-valid-move`, stock rules, `src/domain/engine.ts`, `src/domain/solver.ts`, `src/game/layout.ts` | `qa:porting`, existing browser/Android CI, stock rotation + last-move win + no-legal-transfer+future-stock, old C6/C7/C8 saves, actual phone pending |
| **CORE-1 — native-authored baseline** | Offline deterministic complete candidate snapshots | `hitapps-stock-dealer`, `hitapps-negative-seed-request-path`, `hitapps-candidate-priority`, `hitapps-initial-shuffle-final-pipeline`, AZUR generate entrypoints tracked as `EVIDENCE_GAP` | source seed vectors and 752 conditional model fixtures; truly unknown native paths marked explicitly; immutable Deal |
| **CORE-2 — difficulty director** | Player history and strategy chooser, documented own config and effective budget | `hitapps-dynamic-difficulty`, `hitapps-easy-deals`, `hitapps-equality-paywall`, `hitapps-paywall-segmentation`, `hitapps-equality-three-stack-pair-placement`, `hitapps-feature-seed-one-time-reshuffle` | Ten-outcome unit vectors, restart/continue history, 0.8 bot-failure tests, once-per-attempt selection persisted, no pseudoparity |
| **CORE-3 — complete campaign** | Real C8 levels 16–80 (not fake C7 fallthrough); 5-column peaks and decision passports | `hitapps-level-wave`, `azur-structured-long-campaign`, `azur-topic-rotation`, `azur-variable-category-sizes`, `hitapps-mixed-word-image-cards` | Every level finite/budget, independent oracle, accessible 320px/5 columns, semantic-distance and forced-draw tests, human Android samples |
| **CORE-4 — special core modifiers** | Source-shaped and individually toggleable standalone rules/assists | `hitapps-lockers`, `hitapps-frozen`, `hitapps-bound`, `hitapps-bound-scissors-pattern`, `hitapps-golden-cards`, `hitapps-puzzle-top-bottom-cards`, `hitapps-magnet-hammer`, `azur-extra-foundation`, `azur-bonus-lower-column`, `unico-magnet-helper`, `azur-shuffle-helper`, Ordered/Joker | Versioned save/Undo/Hint and source-phase tests per modifier; real Android first-use lesson; no copied content |
| **CORE-5 — loss/assist/continuation & adaptive revenue** | One cohesive out-of-moves screen with truthful alternative options, exact receipts | `hitapps-equality-paywall`, `azur-coin-moves`, `azur-rewarded-moves`, `azur-unlimited-moves-offer`, `hitapps-stock-restore`, `unico-redeal-restart`, `unico-loss-dialog` | Actual exhausted-state +10 proof where possible, no-fill/duplicate/Undo recovery, restart seed/version freeze, receipt lifecycle |
| **CORE-6 — extended locale and platform** | Language-aware meaningful budgets and native original parity evidence | `azur-localized-move-budget`, `azur-localized-definition-packs`, `hitapps-language-change-restart`, `azur-generate-deal-entrypoints` | 5*ceil fixtures, translation word count, SaveStore migration, original AZUR generated board oracle pending |

**Pараллельность:** CORE-1 source-model and CORE-3 level authoring can run independently after CORE-0 contracts. CORE-2 Director must not silently retune an active saved deal. CORE-4 individual mechanics in own feature PRs can overlap without modifying locked older levels. CORE-5 uses existing receipt code.

## 7. Инструменты, тесты и отрицательные контрпримеры

- **Actual source refs:** [kit PR #78 (merged)](https://github.com/DanilaH/mini-games-kit/pull/78), [source-native verifier](https://github.com/DanilaH/mini-games-kit/blob/3f18a9e915a8414b8b10f645bf9e76ef4a30e3ac/research/games/association-solitaire/2026-11-20-core-source-proof/verify-azur-core.py), [numeric evidence](https://github.com/DanilaH/mini-games-kit/blob/3f18a9e915a8414b8b10f645bf9e76ef4a30e3ac/research/games/association-solitaire/2026-11-20-core-source-proof/azur-core-evidence.json). Hitapps native-static verifiers remain under their original research folders. **Не хранить чужие APK, защищённые слова, изображения, ключи в repo/CI**.
- **Independent consumer tests:** `tests/unit/stock-loop.test.ts`, `tests/unit/rules-v3.test.ts`, `tests/unit/content8-preview.test.ts`, `tests/unit/opening-dealer.test.ts`, `tools/qa/gameplay-oracle.ts`, `tools/qa/audit-reference-slice.ts`. New QA should verify each new candidate strategy, no double-spend, actual fallback, `UNKNOWN` vs `UNSOLVABLE` and no extra moves sold when impossible rescue.
- **Adversarial tests:** lost original native config, missing/invalid feature pattern, `featureSeed=0`, `paywallSeed=0`, `payerType=unknown`, expired config while on saved board, 100 candidates none qualifies, bot lost at 79% not accepted, bot lost at 80% accepted only if other policies agree, Player won at last move, card in waste skipped but later recovered, Undo after earned+10, duplicate/lost receipt, alternative foundation ordering, face-up flag after reset, five-column touch hit zones.
- **Performance and input:** avoid UI-thread candidate search for 100-card/five-column game; precompute signed immutable content with small game-runtime selection. Measure frame/tap action on real Android with native banner, wrong tap/drag zero movement charge, no request timeout mistaken as unsolvable.
- **Source evidence status:** without an actual original Android (Hitapps ARM32/AZUR ARM64) execution, acceptance can be `GAME_MODEL_PASS` but **cannot be `ORIGINAL_RUNTIME_PARITY`**. The returned PR must explicitly say which proof tier it passed.

## 8. Контракт сдачи и оформление PR

Перед кодом агент обязан открыть актуальный `AGENTS.md`, `docs/porting/PORTING_POLICY.md`, `ADOPTION_LEDGER.json` (113/113 with exact kit source SHA), source docs/real code and C8 active PR; сверить old 40–42 spec as historical data. Изменения в code сопровождать `sourceFeatureId` и real test. Если старые запреты конфликтуют с владельцем — исправить, а не отложить. Любой `BLOCKED/EVIDENCE_GAP` остаётся в дорожной карте с шагом закрытия, **не OWNER_EXCLUDED**.

**Формат сдачи одного implementation package:**
```text
SOURCE ID: <ids> — verified evidence links/build/sha, unknown gates
ACTUAL BASE: <consumer branch/sha>, kit research pin, runtime kit pin
CHANGES: <source files + emitted immutable Deal IDs + behavior>
PARITY: SOURCE_NATIVE / MODEL / GAME / ORIGINAL_RUNTIME [which actually passed]
QA: unit + negative + full content + browser touch + signed Android + owner test
ROLLBACK/MIGRATION: old C6/C7/C8 deals/Undo/receipt safe; flags and ABI
COMMERCIAL: earned/no-fill, never infer ad revenue from SDK request
BACKLOG: all remaining core and meta/commercial feature IDs unchanged or advanced
KIT IMPACT: REUSE / IMPROVE / CANDIDATE / NONE
```

**Research completeness acceptance:** native-static core branches for Hitapps and AZUR documented; original runtime-gated unknowns called out with instrumented capture instructions; Unico missing APK explicitly listed. **Product completion acceptance:** only after separately implemented CORE-0..6, human Android and owner-approved balance. This TЗ is **not** a fake claim of completed runtime or native device proof.

**Owner priority note:** «Вся найденная система остаётся в общей разработке, даже когда внедряется поэтапно». Ближайшие пакеты по приоритету согласуются с владельцем, но весь CORE scope определён сейчас и не сокращён до MVP.

**Historical evidence correction (20.11):** [kit PR #79](https://github.com/DanilaH/mini-games-kit/pull/79) correctly classified AZUR `GenerateCards/DealCards/DealCardsFromPreset` and `BonusColumn/BonusFoundation` as **method identity only** at that time. **Superseded for the decoded branches by actual native ARM64-body proof in [kit PR #80](https://github.com/DanilaH/mini-games-kit/pull/80).** The new `NATIVE_STATIC` source tiers do NOT establish original runtime, live RNG seed or an active rewarded product.


## 9. AZUR native-BODY supplement — P0 correction, 20 November 2026

**Exact original:** `com.solitaire.match.words` AZUR `1.3.3.8/code244`, original XAPK SHA256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`, ARM64 ELF `27eb2e67ba00093ed575e16fc01a876a9e90fff8e53b504338047a4bf2c0d924`. [Independent native body research](https://github.com/DanilaH/mini-games-kit/pull/80) — code registrations, 23 opcode anchors, eight branch targets and guarded synthetic fixtures. This changes two previously `METADATA` source feature tiers to **`NATIVE_STATIC`**, without asserting `ORIGINAL_RUNTIME_PARITY`.

### 9.1 CORE-1: native dealer is a separate strategy from Hitapps

`GameManager.InitializeGame` @`0x26a1184` first **calls** `GenerateCards` @`0x26a13f0` from `0x26a1380`, then **tail branches** to `DealCards` @`0x26a1818` at `0x26a13a0`. Historical claim that `DealCards` directly invokes `GenerateCards` was incorrect. `GenerateCards` enumerates source theme/leader and word card entries into a working list.

`DealCards` invokes a concrete list shuffle @`0x2c6ab8c`. Verified original native behavior is **one descending Fisher–Yates pass**: `remaining = N..2`, `j=UnityEngine.Random.Range(0,remaining)`, `swap(cards[remaining-1],cards[j])`; consumes `N-1` Unity `RandomRangeInt` calls. **Do NOT reuse the Hitapps 56-state EmbeddedRandom + ten full-length destination-list swaps** for AZUR; those are independently researched reference strategies. In the positive/sufficient-card branch, DealCards assigns `FirstColumnCards+columnIndex` consecutive shuffled cards to each lower column, marks each last placed card revealed, and sends all remaining cards to `Deck.Initialize`. `DealCardsFromPreset` is separately implemented using preset lookup, not this ordinary shuffle.

**Crucial OPEN evidence:** actual upstream Unity RNG initialization/state/seed, original running engine call order before shuffle, source runtime selected theme subset, preset schema, original device stock/columns. Therefore exact AZUR seed→final stock/tableau reconstruction is still **UNPROVEN** even though the ordinary shuffle and placement bodies are decoded.

**Developer delta:** implement a distinct pluggable `AzurDealer` offline authoring strategy or add evidence-graded strategy contracts to existing authoring; it must never silently become the default Hitapps C8 dealer or mutate previously frozen Deal/Undo IDs. Expose a **deterministic injected `range(0, remaining)` callback** for fixtures, but an invented Unity seed generator must be labelled `PRODUCT_ADAPTED` and may not be published as source-exact. Require `N-1` draw-count tests for N=0/1/2/100, fixed scripted RNG ordering, positive shape `[FirstColumnCards, FirstColumnCards+1,...]`, remainder stock and face-up flags, versioned source provenance and original-client parity gate.

### 9.2 CORE-4: bonus lower column has verified separate board-state semantics

Native `GameBoard.ConfigureBonusRewardedSlots` @`0x269f98c` independently configures upper foundation **type2** and lower tableau column **type3**. Verified state includes separate configured indexes, enable and unlocked booleans. Index `0` is a **sentinel for the original list count**, not an unconditionally existing physical slot zero; disabled getter yields `-1`. `IsBonusSlot` @`0x269fa74`, `IsBonusSlotUnlocked` @`0x269fae8`, `UnlockBonusSlot` @`0x269fb68` check their respective type/index and unlock **only the corresponding flag**; unrelated, non-bonus positions are not blocked. This corrects the previous method-pointer-only uncertainty.

**Developer delta:** leave both upper and lower in source registry, implement separate type discriminant/config gates when the feature package is authorized, and ensure lower column gameplay changes Rules, Save/Undo, Hint/solver, card geometry/touch, restoration and reward receipts independently from upper foundation, Joker and historical C6/C7/C8 attempts. Positive/out-of-range/zero index, never-enabled, disabled, locked, unlocked, no cross-unlock and repeated SDK callback cases must have tests.

**Still UNKNOWN:** who configures these slot indexes and their default/remote values, whether original UI *allocates* a new column or unlocks a reserved one, original level eligibility, ad/IAP price, when an active player sees type3, original save/restore behavior, and genuine SDK rewards. Static branch ≠ live monetization.

### 9.3 CORE-4 follow-up: original AZUR remote eligibility, coins, rewarded and saved unlock

**Source:** [mini-games-kit bonus gate/source-body research PR #81](https://github.com/DanilaH/mini-games-kit/pull/81), original AZUR 1.3.3.8, independent of a live Android callback. This **supersedes only specific OPEN items in 9.2**, not the remaining pricing/SDK/live-state blockers.

- **When available:** `GameController.CreateBonusConfigForLevel` reads four independent remote fields: `BonusBaseRewardedActive`, `BonusBaseRewardedStartLevel`, `BonusColumnRewardedActive`, `BonusColumnRewardedStartLevel`. A type2 foundation/type3 lower-column candidate needs its active flag, `level >= startLevel`, respective **regular slot count 3 or 4** and presence of the matching `BoardLayoutGenerator` foundation/column prefab. Source constructs independent enabled and initially-unlocked=false flags. Native feature existence ≠ active remote values.
- **Resume:** `GameController.CreateBonusConfigFromSave` restores four saved enabled/unlocked booleans for foundation+column from the saved board, not blindly recalculating eligibility under new remote flags. `UnlockBonusRewardedSlot` sets only the matching kind/index saved flag and enters `SaveCurrentGameState`. For our product, SaveStore must persist canonical, attempt-specific source-time feature state and preserve it through Undo/relaunch.
- **Coins:** `BonusRewardedSlot.TryUnlockForCoins` checks balance, shows the out-of-coins flow if insufficient, calls `PlayerDataManager.SpendCoins` and **only on successful spend** invokes GrantUnlock and the type-specific Save flow. Price comes from an external input/config; the original video 500-coin example is not a universal native default.
- **Rewarded:** independent `BonusSlotUnlockCoinsActive` flag, InternetConnectionHelper and AdServiceFacade reward-readiness; `RewardedAdLoadingHelper.ShowWithFeedback` is invoked with placement resolved differently for type2 and type3. **Original earned/closed/no-fill callbacks have not been run or fully reconstructed**. We must gate earned unlock on proven SDK reward and deduplicated receipt, not request/show/availability.
- **Negative QA:** level below/at threshold, regular counts 2/3/4/5, one missing prefab, enable flag flips after active-save, separate type/index state, insufficient coins, SpendCoins returning false, delayed/duplicate/stale rewarded callback, no unlock on ad fail/no-fill, save/load/Undo and UI hit zones with optional fifth column.

Source IDs: `azur-extra-foundation` and `azur-bonus-lower-column`. Both are **native-static partially proven, runtime never claimed**. Do not retroactively alter C8 published deals, and keep all 113 registry entries.

### 9.4 Integration contract and no waiting for total research completion

- Research source pin: kit [PR #80](https://github.com/DanilaH/mini-games-kit/pull/80), exact `SOURCE_FEATURES_PINNED.json` and ledger blob/ref updated together. At the time of PR80, IDs were **110/110**; after kit PR82 the historical post-PR82 inventory was **111/111**, now **112/112**, **no `OWNER_EXCLUDED`**.
- CORE-1 and CORE-4 may proceed for known code paths in their already-approved implementation packages. Incomplete source parity is represented as `EVIDENCE_GAP`, not a guessed `ORIGINAL_RUNTIME`. No new release APK is implied by this docs change.
- Research continues on Unity random state, original app final board and bonus-column live/price config. Any further corrections must update kit source inventory **and** this consumer ledger/roadmap using a recorded source Git SHA.


## 10. AZUR tutorial preset — original native dispatcher and Unity RNG boundary (20 November 2026)

**New source:** mini-games-kit [PR #82](https://github.com/DanilaH/mini-games-kit/pull/82), original AZUR 1.3.3.8/code244. Source-native verification: 12 IL2CPP method registrations, 18 exact ARM64 opcodes, 10 call/branch targets and UnityEngine.CoreModule.dll Random wrappers. **No original Android runtime capture yet.**

### 10.1 Distinct source system: authored tutorial placement with fallback

Native `GameController.InitializeGameLogic` checks `TutorialManager.ShouldUseCardPreset` → `ValidateCardPreset` → nonnull `GetCardPreset`. In the verified direct path, `ShouldUseCardPreset` explicitly checks that the requested level **equals 1** and the tutorial preset configuration is enabled. Only a valid, present preset reaches `GameManager.InitializeGameWithPreset`. The handler additionally verifies the preset's enabled flag, calls `GenerateCards` and then `DealCardsFromPreset`, or falls back to ordinary `InitializeGame` if disabled. This separate branch is **not** AZUR's default later-campaign RNG and is not a Hitapps seed experiment.

**Source feature ID:** `azur-tutorial-preset-deal` (new, stage C1/FTUE). This mechanism requires separate authoring/validation/fallback support; preserve the complete source registry and all earlier systems. The original preset structural data, active tutorial config and final visible board remain UNKNOWN.

**Developer delta:** preserve current C8 purposely customized first-five lessons and frozen deal IDs until owner approval. For source-based future tutorial authoring, model `eligibility → validated preset → normal fallback` as an explicit branch, never silently interpret a missing/malformed preset as an impossible/successful deal. Keep level-specific source variant identity in SaveStore and existing old-version Undo. Test level1 vs 0/2/2000, config disabled, invalid schema, null card list, disabled preset object, valid authored preset, and retry after changing config. A documented adapted lesson is legitimate but cannot be labelled an exact original AZUR level-1 tutorial.

### 10.2 Unity Random — correctness of source claim

The original `UnityEngine.CoreModule.dll` compiled module maps `UnityEngine.Random.InitState(int)` (method RID 2719) to wrapper RVA `0x53bb910` and `Random.Range(int,int)` (RID 2723) to RVA `0x53bba88`; both icall names verified. **No direct branch to InitState in the three inspected native control-flow ranges**, including normal/preset initialization, GameController dispatch and tutorial eligibility; this does **not** exclude indirect, engine-startup or elsewhere initiated seed/state writes.

AZUR ordinary `DealCards` still consumes `N−1` Unity `Random.Range(0, remaining)` results. We can reconstruct ordering once given the **actual Unity RNG values/state**; we **cannot yet** reproduce original seed→final stock/tableau from a level ID. The model's scripted RNG fixture is `MODEL_ONLY`. Continue source research into upstream engine state, generated real level-2 trace and actual preset level-1 trace; don't push speculative PRNG equivalence into runtime.

### 10.3 Restart route is a lifecycle fact, not a random-card proof

Native `GameController.RestartLevel` branches to `LoadAndStartLevel`; this confirms level lifecycle re-entry but says nothing conclusive about preserved/randomized card positions without comparing original device snapshots and active save state. Never transfer Unico's observed Retry redeal semantics to AZUR by analogy.

**Practical integration:** CORE-0/1 continue immediately, without waiting for full Unity RNG investigation. New tutorial preset entry remains roadmapped with full evidence/test dependencies; older 110 systems remain. Source inventory and consumer ledger must be pinned to the same exact kit Git blob. No game runtime changes implied by this research documentation.


## 11. AZUR shared Unity Random and distinct Joker insertion — original-native P0 update (20 November 2026)

**Source:** [mini-games-kit PR #84](https://github.com/DanilaH/mini-games-kit/pull/84) original AZUR 1.3.3.8/code244 ARM64 with method RID→native RVA and verified call targets. This is **SOURCE_NATIVE_STATIC**, not original Android runtime or live feature activation. Preserve earlier research, especially the different Hitapps seeded dealer and Hitapps Joker.

### 11.1 CORE-1: random stream ownership is not isolated in the AZUR original

The ordinary AZUR `DealCards` generic Fisher–Yates invokes the shared Unity `Random.Range(int,int)` native wrapper at RVA `0x53bba88`. Source bodies of DailyBonus `BuildShuffledColumnIndices` and `WeightedPick`, ComboSeries `PickRandomTrack`, `GameManager.AddJokerCard` and **developer tools** `ShowRandomOffer` also directly call that same wrapper. There are **four original executable direct BL locations** to Unity `Random.InitState` outside the three previously examined level-routing methods. The owning methods/activation for these four calls have **not** been proven. Direct call registration proves sharing the same Unity API, **not** that a daily bonus or event occurred before a real deal or that it changed a particular user's cards.

**Developer contract:** do not model AZUR `seed = levelId`, assume no Unity reseeds anywhere, or claim an exact original seed-to-layout oracle. Our **product adaptation** should create an independently injected RNG stream per authoring operation and keep UI/meta random calls separate from published campaign deals. Archive final immutable Deal and original evidence tier; test identical initial authoring inputs despite simulated unrelated daily/combo random calls and distinguish the corresponding original-state UNKNOWN. This protects C8 reproducibility without a fictitious claim about source call order.

### 11.2 CORE-4: new source feature, AZUR random lower-column Joker, clears Undo

Original `Solitaire.GameManager.AddJokerCard` native RVA `0x26a4188`: in its positive valid-column branch computes an upperExclusive bounded by the **minimum** of its configured limit and currently available tableau count, calls shared `Random.Range(0,upperExclusive)`, retrieves `GameBoard.GetColumn` for that index, constructs/reveals a new card, forces placement through `Column.PlaceCardForced` and **conditionally calls `UndoSystem.Clear`** when UndoSystem exists. `Solitaire.UI.GameUIController.TryAddJokerCard` reports `GameplayEvents.RaiseJokerUsed` only after a nonnull returned card. The native Card constructor receives discriminator 2; do not conflate this with Hitapps CardType values or claim exhaustive AZUR enum parity.

**New separately tracked source ID:** `azur-joker-random-column-insertion`, **D1**, `NATIVE_STATIC`. This is **not** the existing `hitapps-joker` (implemented, unverified). Preserve both mechanisms in the roadmap. The AZUR player-visible helper availability, coin/ad price, original zero/invalid bounds, actual selected column and full Save/Undo trace remain UNKNOWN.

**Implement only under a versioned feature package:** separately decide whether clearing historical Undo is appropriate for our product; no unexpected deletion of saved Undo/receipt/attempt state. Test an eligible nonempty board with min(configuredLimit,columnCount), card creation/reveal and placement, append identity, no-column/invalid bounds, successful and failed UI helper paths, replay after saved reload, player-facing first use, adapter coin/reward earned/duplicate callbacks if connected. Every added mechanic must survive 320px portrait layout and actual signed Android acceptance.

**Product status ≠ source evidence:** no runtime implementation is claimed by this spec addendum. Newly registered ID requires pinning the exact kit source snapshot and coverage **112/112**, without deleting a previously studied item.


## 12. AZUR art-sprite count determines card multiplicity before shuffle — native P0 (20 Nov)

**Source:** [mini-games-kit original ARM64 research PR #86](https://github.com/DanilaH/mini-games-kit/pull/86) on AZUR `com.solitaire.match.words` `1.3.3.8/code244`; XAPK SHA256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`. Reproducible original binary verifier checks **10 IL2CPP RID→RVA methods, 34 exact ARM64 opcodes, 9 direct BL targets**; independent synthetic negative fixtures, **NOT an original Android runtime trace**.

### 12.1 Source exact positive-path card construction

In ordinary `GameController.InitializeGameLogic`, `BuildArtCardCountsForThemes` checks the loaded `CardSpriteLoader` count per theme. A theme receives an override only when `TryGetLoadedSpriteCount(themeId)` succeeds with a **positive** `CardSpriteData.get_Count`. This map is passed to normal `GameManager.InitializeGame → GenerateCards`. **Tutorial `InitializeGameWithPreset` passes no such map** to GenerateCards; do not conflate its authored tutorial preset with this live-art-dependent ordinary branch.

The source `GenerateCards` creates one category leader then checks the original words list length `W`. If `W=0`, it skips member-card enumeration. Otherwise, if the theme has a positive loaded-art override `S`, the **effective member count `M=S`**, else `M=W`. It writes this into `Theme.SetWordCount`. For each `i=0..M−1`, source selects `theme.Words[i % W]`, constructs a **new unique card ID** and stores sequential ordinal `i`; its original source-word reference can repeat when `M>W`. Because leader is independent, the source count contribution is `1+M` per theme on this well-formed branch.

Examples with **synthetic source-theme indices** (not original content): `W=3,S=0 → [0,1,2]` original word indices; `W=4,S=2 → [0,1]`; `W=3,S=8 → [0,1,2,0,1,2,0,1]`; `W=0,S=8` creates category leader only. Distinct Card IDs and word references are different facts. **Do NOT assert the player sees duplicate text or eight actual images**: original renderer, loaded art packs and runtime image placement have not been executed.

### 12.2 Why this matters to core and Android content

This is a separate source system **`azur-art-sprite-wordcount-override`**, stage **B1**, on top of existing `azur-variable-category-sizes` (observed 4/5/5/7) and `azur-generate-deal-entrypoints` (complete ordinary/preset dealer). Do not merge any of these IDs. The native art count can alter the **total input card count BEFORE Fisher–Yates**, stock length, tableau fit and potentially move-budget requirements; the actual downstream adaptations/solvability remain UNKNOWN.

**Developer contract (separate AZUR offline authoring option):** explicit per-theme original `W`, positive available-art `S` or unavailable, effective `M`, original word-ref identity and new unique Card IDs, count-aware final layout and deterministic injected Unity-`Range` stream. A source-like authoring pass may use `M` to choose card count, but it must be **gated** and never silently change the already-published **Hitapps** C8 deals or previous Save/Undo identities. Once authored, **freeze** the accepted Deal independently of later image pack changes as `PRODUCT_ADAPTED`; the original client’s live asset lifecycle is not proven to do the same.

**Acceptance:** no loaded art → original count; zero/negative counts are not overrides; one theme S<W, S=W and S>W; index modulo word list, no duplicate Card IDs; zero original W guard; multiple themes with different art packs; tutorial preset null-map branch; whole-board count reconciliation, solver/witness, budget, stock/recycle, SaveStore and 320px Android art/card fit. When rendering an art-backed card, avoid protected original word/image assets.

**Remaining runtime evidence:** which per-theme art sprite packs are actually loaded for the original 2000 levels/locales, whether source reuses visible word text or renders distinct images for repeated references, live remote override and Unity RNG state, exact final original deck/layout, Android behavior and human difficulty effect.

Research registry advances to **113 systems**, no permanent exclusions; this document does NOT implement the new source rule.
