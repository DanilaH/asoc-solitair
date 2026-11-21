# Content 8 · F1–F3: полный аудит удержания, событий и метапрогрессии

**21.11.2026 · ORIGINAL SOURCE → PRODUCT RESEARCH, NOT SHIPPED LIVEOPS.** Предыдущая стадия: [E3 commerce evidence PR #82](https://github.com/DanilaH/asoc-solitair/pull/82). Исследованные источники: оригинальный Hitapps 1.26.2/code3742 XAPK SHA256 22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0; оригинальный AZUR 1.3.3.8/code244 XAPK SHA256 4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4; Unico видео без проверенного Android оригинала.

Источник истины: [mini-games-kit retention native audit](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-retention-loops/README.md), [независимый source verifier](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-retention-loops/verify-retention.py), [агрегированные схемы и enum](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-retention-loops/evidence.json), [Hitapps source modules](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-systems/SYSTEMS.md). Исходный verifier ранее подтвердил 22 Hitapps named native pointers, 17 opcode anchors, 4 direct BL, 10 schema; AZUR 7 schema, 29 method names, два enum и четыре compiled defaults. **НЕ было живого оригинального Android клиента, реальной remote config, оригинальных полученных наград, A/B удержания или дохода**.

Исследование придерживается действующего owner full-port policy: ранние рекомендации HOLD/REJECT из kit retention memo — **исторические оценки**, не разрешение исключить Gold Rush, Daily Tasks, Pass, гонки, Lives или коллекции. Каждая система остаётся в общей roadmap; этапы и тесты не равны урезанию объёма.

## 1. Что есть в нашей игре сейчас (реальный код C8)

- `src/domain/meta.ts` и `src/domain/services.ts`: campaign first clear → единственный `completedCampaign` ID; каждые пять новых побед → 20 soft coins + Hint; milestones каждые десять уровней → 40 soft coins и unlock косметики на уровнях 10/20; persistent `rewards` keys, один SaveStore. Повторное прохождение старого уровня НЕ даёт метапрогресс; обычные игровые монеты за партию отличаются от метанаграды. `abandonCampaign` сбрасывает текущий five-win cycle после завершения незаконченной попытки. **Это не** исходная отдельная Hitapps WinStreak с системой потери streak и claim.
- `src/content/daily.ts`: 28 фиксированных задач с периодом календарного дня, без per-day user task objectives. `finishDaily` награждает первый выигрыш актуальной даты; streak дня 3/7 и следующие кратные 7; повтор/daily date rollback не создаёт двойной награды. **Это не** 16-kind AZUR DailyTasks, DailyBonus choice или подтверждённый Hitapps DailyPuzzle.
- Appearance: две собственные награды palette/card back, не галерея Unico и не 41 SKU AZUR. **НЕТ** Picture PuzzleEvent, gallery artwork, source-specific WinStreak, WeekendRace, GoldRush, energy/lives, regions/buildings, combo, timed meta scheduler, weekly medals/Pass claims или полноценного EventStore.
- `src/platform/analytics.ts`: generic bounded event contract для текущей сессии, не измерение реального D1/D7 эффекта перечисленных будущих систем.

## 2. F1 — 12 ежедневных, коллекционных и reward-loop IDs

| Source feature ID | Source evidence / реальная граница | Current consumer and transfer delta |
| --- | --- | --- |
| `hitapps-puzzle-event` | **NATIVE_STATIC**: `PuzzleEventRemoteConfig{minLevel,schedule,galleryConfig,tokensGainPerWin}`, `IsUnlockedByLevel`, `GetRewardPerLevel`, `TryUnlockPuzzlePart` сравнивает saved currency с `artworkPart.currencyPrice`, marks isBought; saved `currencyAmount/currentPhase/isStarted/isFinished/isGrandRewardClaimed` | ROADMAPPED: нет event currency, unlock part, artwork, schedule/claim. Отдельный продуктовый 6-piece prototype — ранее предложенная гипотеза, **НЕ доказанная точная численность частей оригинала** |
| `azur-daily-tasks` | **ASSET_VERIFIED** (source registry tier; separate native method/config study): 16 task kinds + Unknown, девять reward enum, task/weekly state, compiled defaults 4 tasks/day/7 days/unlock level2/day1. Реальная конфигурация и награды UNKNOWN | ROADMAPPED: daily puzzle ≠ task engine. ВСЕ 16 источников, включая commercial/use-helper tasks, остаются каталогом типов; каждое условие выдачи отдельно owner-approved |
| `azur-daily-bonus` | **ASSET_VERIFIED** (source registry tier): `DailyBonusRoundData{dayUtc,columns,revealed,wonColumnIndex}`, отдельный DailyBonus UI bundle, случайный выбор колонок | ROADMAPPED: нет day-keyed card-choice bonus; не смешивать с календарным daily puzzle |
| `hitapps-daily-rewards` | **NATIVE_STATIC**: `DailyRewardsData` stores date, reward index, received count, `TryReceiveDayReward` | ROADMAPPED: сейчас награда только за выигрыш дня, нет отдельного login claim |
| `hitapps-win-streak` | **NATIVE_STATIC**: `GainProgress`, `LoseStreak`, `ClaimAllCompletedMilestones`, own event end time and claim | ROADMAPPED: five-first-win cycle отличается от loss-sensitive WinStreak; отдельные saved streak/milestones required |
| `unico-win-and-task-streak` | **VIDEO_OBSERVED**: два отдельных streak/task направления | ROADMAPPED: собственная daily streak и five-win cycle не доказывают два Unico event ledger |
| `hitapps-puzzle-gallery` | **VIDEO_OBSERVED**: pictures + gallery, distinct from time-limited PuzzleEvent state | ROADMAPPED: нет коллекционного album/gallery; gallery identity, persistent unlock, art pack needed |
| `hitapps-daily-puzzle` | **UNKNOWN**: для original Hitapps Daily Level **нет независимого подтверждения**, лишь DailyRewards source | EVIDENCE_GAP: собственная 28-daily игра не может помечаться source Hitapps DailyPuzzle parity; нужна original scene/session/native |
| `azur-cosmetics` | **ASSET_VERIFIED**: cosmetic customization family | IMPLEMENTED_UNVERIFIED: две оригинальные собственные palette/back rewards, но не весь исходный каталог/UX |
| `unico-daily-fortune` | **VIDEO_OBSERVED**: daily reward choice, possibly second video try in sample | ROADMAPPED: нет day-keyed fortune, reward chance/SDK result UNKNOWN |
| `unico-themes-and-skins` | **VIDEO_OBSERVED**: custom themes/skins | IMPLEMENTED_UNVERIFIED: palette+backs только адаптация, без vendor art и original parity |
| `hitapps-win-multiresource-payout` | **VIDEO_OBSERVED**: ordinary win can advance picture/piggy/multi reward counters | ROADMAPPED: current win coins/cycle only; eventual multiple resource journals must atomically settle one first win |

**F1 snapshot: 9 ROADMAPPED, 2 IMPLEMENTED_UNVERIFIED, 1 EVIDENCE_GAP.** Это 12 существующих feature IDs, не новый список и не отдельный продуктовый блокирующий MVP.

## 3. AZUR Daily Tasks: все 16 типов и девять наград без исключений

Оригинальные IL2CPP enum из [pinned static evidence](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-retention-loops/evidence.json):

**TaskKinds 1–16:** CompleteLevels, CollectThemes, ExecuteMoves, UseHints, WinNoHints, DrawCards, DailyLogin, CollectDailyBonuses, UseDefinitions, UseJokers, UseRollbacks, UseShuffles, EarnCoins, BuyExtraMoves, BuyBoosters, MakePurchase. Отдельный `Unknown=0` — fallback enum, не семнадцатая позитивная задача. **Типы UseHints / BuyExtraMoves / MakePurchase и другие коммерческие тоже остаются в scope**; их наличие в исходном enum не подтверждает, что они реально выдаются каждому игроку. Нельзя превращать расход реальных денег в обязательную цель без отдельного решения и честного UX.

**RewardKinds 0–8:** Coins, MoveHint, Undo, Definition, Shuffle, Joker, Medals, RandomBoostersChest, CardBack. Здесь нет доказанной локальной таблицы соответствий `task→reward` и сумм, поэтому ни один payout автоматически не копируем.

Compiled defaults **4 tasks per day**, **7-day event**, **DefaultUnlockLevel=2**, **DefaultUnlockDay=1** — исходный **STATIC CONFIG DEFAULT**, не активный серверный календарь, не утверждение об обязательном четырёхзадачном режиме. Техническая модель сохраняет `DailyTaskState{target,progress,rewardKind,rewardAmount,claimed}` и `DailyTasksEventData{weekStartUtc,totalMedals,claimedMilestones,days,loginDaysUtc}`. Имена `ClaimTask/TryCommitClaim/ReloadEventAfterFailedClaim` не доказывают crash-atomic/remote truth.

**Разница с нашей daily:** 28 rotated layouts — отдельный выбор поля по локальной дате. Event tasks — набор критериев на **обычных игровых событиях**, привязанный к своему времени, списку претензий, reward inventory, account/payout system and event version. Эти подсистемы могут и должны сосуществовать, не подменяя одна другую.

## 4. F2 — шесть event/race/energy systems

| ID | Источник | Фактический перенос и next gate |
| --- | --- | --- |
| `hitapps-weekend-race` | **NATIVE_STATIC**: WeekendRaceConfig start/end/minLevel, stages `levelsGoal,raceAwards,botParams`, saved stage/race/result, `JoinRace/StartEvent/ClaimResult`, видимая маркетинговая функция | ROADMAPPED: нет турнира; source bot params не доказывают живой PvP, будущий simulated race должен честно обозначать AI соперников и быть независим от соревнования реальных игроков |
| `hitapps-lava-quest` | **VIDEO_OBSERVED**: first-attempt / multi-win race family | ROADMAPPED: нужна source eligibility/claim/refund after failure и собственное безопасное правило; не подменять настоящих игроков ботами |
| `hitapps-lives` | **VIDEO_OBSERVED**: lives/energy system state | ROADMAPPED: собственная игра сейчас доступна без энергоограничения; версионированный режим/таймер/восстановление, тесты сохранений и доступности, не вводить скрытый блок |
| `hitapps-gold-rush-event` | **VIDEO_OBSERVED** for event lifecycle; native GoldenCards Final-phase applier is separately verified under D1 and cannot elevate the entire event to native parity. Event-gated amount and first-golden state used by separate Final GoldenCardsFeatureApplier | ROADMAPPED: создать отдельный lifecycle, gold card placement belongs to D1; не считать активацию Gold Rush доказанной по полю cardType |
| `hitapps-meta-prewarm` | **NATIVE_STATIC**: scoped event preload/unlock services | ROADMAPPED: без отдельного event scheduler/preload, интеграционные границы после первого event |
| `azur-combo-streak` | **METADATA** + app updates mention category | EVIDENCE_GAP: current in-game transfer streak coins and five-win meta are **different**; не восстановлены native counter/reward reset/tooltip |

**F2 status: five ROADMAPPED + one EVIDENCE_GAP.** Timing, genuine notification, device clock rollback, bots, loss and claim are separate acceptance axes.

## 5. F3 — пять больших метасистем

| ID | Source evidence | Consumer gap / action |
| --- | --- | --- |
| `hitapps-meta-regions` | **METADATA** (pinned source feature tier; scoped native MetaUnlockGate reported separately): MetaRegionCatalogConfig unlockLevel, region starCount, MetaUnlockGate native level compare, buildings/reward model | ROADMAPPED: нет region/building/star gallery и отдельной цепочки получения; need art, progression versions, own texts, unlock proof |
| `hitapps-cascade-events` | **METADATA**: LiveOps service source name and module dependencies | EVIDENCE_GAP: не восстановлены original scheduler order, priorities, disabled modules, reward trust |
| `hitapps-digging-event` | **METADATA** | EVIDENCE_GAP: actual gameplay/level layout/timers/results missing |
| `hitapps-lucky-wheel` | **METADATA** | EVIDENCE_GAP: animation/odds payout and eligibility unknown; never guess odds or claim source gameplay |
| `hitapps-endless-treasure` | **METADATA** | EVIDENCE_GAP: unknown source phases, progress reset and grant |

**F3 status: one ROADMAPPED + four EVIDENCE_GAP.** Это не основание выбрасывать meta/LiveOps: исследование original execution и clean-room authoring остаются в общей программе.

## 6. Product implementation order with no permanent exclusions

**F-A · shared event identity and saving contracts:** separate eventId, version, eligibility, start/end, progress/currency, claim ledger, last server or local-day key, interstitial/rewarded offer state. SaveStore must own exact-once grant and preserve old C1–C8 active/parked attempts, Undo, genuine win/canonical completion. An event can be unfinished or expired without losing already earned claims; neither opening UI nor animation mints currency.

**F-B · PuzzleEvent + Gallery + multiresource win pipeline:** C8 first wins may earn event tokens only once under source-aware eventId; purchase/reveal one original independently authored artwork piece with event currency, persist claim and artwork inventory, no copied reference art. Timer and gallery versioned separately. Existing milestone/cosmetic wallet continues unchanged. Six-piece idea is an **own possible first content variant**, not a source-exact original piece count.

**F-C · complete DailyTasks/Bonus/Rewards/Fortune:** implement all 16 task type contracts/9 reward types in typed source-inspired catalog, enabling selected variants by explicit owner config and verified gameplay/receipt sources. Card-choice DailyBonus and Unico Fortune separately on a day-keyed non-repeat receipt. Login reward and daily puzzle win remain separate; no rewarded/purchase task marked completed on request alone. Reward types requiring D1/E3 helper/entitlement must explicitly wait for those systems rather than mis-award. Use both local and server date policies only where actually available; never promise remote anti-cheat without a backend.

**F-D · WinStreak, Unico two streaks, AZUR combo:** separate loss-aware native source rules from existing non-failure five-win cycle; exact ID/claim/counters/expiry and user-visible value. No duplicate grant if one event consumes the same win; keep multiple reward tracks intentional and auditable.

**F-E · Weekend Race/Lava/Lives/Gold Rush/MetaPrewarm:** stage event grants, first-attempt tracking, bot progression and honest opponent labels. Timer, race finish and last-minute claim tests, real-time/lives UX and safe opt-in. GoldRush event scheduling independent of D1 GoldenCards final-board insertion; source-native remote activation still pending.

**F-F · Regions/Cascade/Digging/Wheel/Endless Treasure:** recover source behavior where possible, authorize clean-room product-adapted designs for incomplete source mechanics, explicit random odds/distribution and non-manipulative reward copy. Larger art/data/scheduler pipelines are independent stage gates, not a reason to drop their source IDs. All remain in roadmap even when initial event contents are fewer.

**F-G · physical Android/player validation:** observe first touch of event and its claim/skip/exit, same-day re-entry, local midnight, backwards clock, restored attempts, native SDK earned vs shown, purchase verification, expired offer, actual achievement of voluntary extra play. D1 retention/paid revenue require real cohort and settlement, not model-only CI.

## 7. Coverage and evidence status

**Full F register = 12 F1 + 6 F2 + 5 F3 = 23 source IDs.** Status: **2 IMPLEMENTED_UNVERIFIED, 15 ROADMAPPED, 6 EVIDENCE_GAP**, 0 ACCEPTED, 0 owner-excluded. Their original source tiers are preserved in [feature evidence crosswalk](f-source-event-matrix.json), with *all 16+9 AZUR enum names* and compiled defaults as a **non-proprietary research aggregate**, not an executed original session.

No original XAPK was rerun in this turn; all native source provenance comes from the pinned, previously original-SHA-verified kit reports, not from a new client execution. No new game mechanic, economy, user identity, SDK, admin account, APK or runtime save modification occurs in this research PR.

**Next after F:** G1 original 2,000-stage/locale/remote overrides versus actual C8 80-level and Russian-only content, then source runtime sessions and Q2 human tests. **KIT IMPACT:** REUSE Reference → Product Porting Framework; full event data ownership is a consumer implementation package, not a generic mini-games-kit export yet.
