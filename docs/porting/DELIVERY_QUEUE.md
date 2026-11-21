# Association Solitaire · автономная очередь разработки Content 8+

**21.11.2026 — владелец одобрил полную программу переноса исследованных систем и самостоятельное продвижение разработчика между пакетами.** Это точка входа разработчика: **[машинная очередь](DELIVERY_QUEUE.json)** → спецификация указанного пакета → [протокол приёмки](DELIVERY_PROGRESS.md) → [115-feature adoption ledger](ADOPTION_LEDGER.json) → актуальный код. Не считай очередью старую короткую CORE-0…5 дорожку, которая уже фактически сделана в C8 preview.

## 0. Истина по коду и исследованию

- Текущая интеграционная база **game C8 0.20.3** — [CORE-5 runtime #68](https://github.com/DanilaH/asoc-solitair/pull/68), ещё не merged в старый production main. Свежий **research-descendant HEAD** `e092ba156eebb5ebc703d89e4e98bf657bbd6f14` — [G1 PR #85](https://github.com/DanilaH/asoc-solitair/pull/85) с интегрированными отчётами QA/коммерции/меты и **успешным CI 44912166802**. Это база *данной очереди*; до начала нового кода перепроверь HEAD и сравни фактическую ветку разработчика. Закреплённый runtime mini-games-kit — `a9325265e87583a4872cf6a158e1e881a0d7508e`, не обновляй для видимой «новизны» без API review.
- **История research descendants:** #68 → #70 Q1 → #71 Q2 → #72 Q5 → #75 Q1b → #76 B2 → #77 B3 → #78 Q1c (сохраняет #74) → #79 D1 → #81 E1/E2 → #82 E3 → #83 F1–F3 → #85 G1. Независимые #67/#69 QA-файлы возвращены в #72; уникальные #74 в #78. **Не слепо merge/cherry-pick исходные #67/#69/#74 поверх нового HEAD.** [#73 Q2 отдельный control APK](https://github.com/DanilaH/asoc-solitair/pull/73) намеренно независим и не сливается в обычный пользовательский UI.
- [CORE reference implementation spec](../qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md) — контракт Rules, генератора и source pipeline; [owner porting policy](PORTING_POLICY.md) — приоритет над старыми агентскими HOLD/REJECT; [full stage roadmap](IMPLEMENTATION_ROADMAP_2026-11-19.md) — весь набор. Здесь **38 пакетов**, каждому из **115/115** source IDs назначен один primary owner. 0 `OWNER_EXCLUDED`, 0 формально `ACCEPTED`. `IMPLEMENTED_UNVERIFIED` — в коде есть механизм, но исходная/Android/human-паритетность не принята.
- Эталонные исходники: [mini-games-kit Reference → Product Porting Framework](https://github.com/DanilaH/mini-games-kit/blob/main/docs/agent-workflows/REFERENCE_PORTING_FRAMEWORK.md), [Choice Evidence Ladder](https://github.com/DanilaH/mini-games-kit/blob/main/docs/agent-workflows/PLAYABILITY_CHOICE_EVIDENCE_LADDER.md). Собственная чистая реализация; никаких vendor binaries/assets/word banks/SKU IDs/ключей в продукт.

**Current original-source upgrade 21.11, kit PR #96:** new 115th source system AZUR greedy Hint `azur-greedy-hint-order` → P04, and source native Shuffle/animation → P16. P16 existing free stock-only win-certified implementation deliberately differs from native closed tableau+Stock+Waste, Undo.Clear and Spend/refund. [New source/product contract](../qa/content-v8/P16_AZUR_SHUFFLE_AND_GREEDY_HINT_ORIGINAL_NATIVE_2026-11-21.md); [developer source parity issue #104](https://github.com/DanilaH/asoc-solitair/issues/104). Do not wait for user between packets or claim original Android was executed. Still 38 packets, now 115/115 source IDs.

## 1. Исполнительный цикл — без просьб «продолжай» между пакетами

1. Каждый рабочий заход читать `AGENTS.md`, эту очередь и `DELIVERY_QUEUE.json`, `DELIVERY_PROGRESS.md`, релевантный spec, `ADOPTION_LEDGER.json` и действительную ветку приложения. **Стартовать с P00**. После него брать **первый по номеру `QUEUED`/дорабатываемый, чьи code-dependencies закрыты**. Не ждать пользовательской команды между готовыми независимыми задачами.
2. Для каждого пакета создать **отдельный небольшой PR** от актуальной согласованной code-ветки; провести source → product diff, реализовать чистый код, добавить **положительные и отрицательные regression fixtures**, реальные взаимодействия (если UI), SaveStore/Undo/Hint/recency/SDK тесты. **Никогда не обещать original exact parity, если original Android не запускали.**
3. После QA зафиксировать в `DELIVERY_PROGRESS.md`: commit/PR, какие source IDs действительно изменились, статусы `NOT_STARTED/IN_PROGRESS/ENGINEERING_VERIFIED/NEEDS_DEVICE/BLOCKED_EXTERNAL/NEEDS_OWNER/ACCEPTED`, **конкретный CI run**, APK/GIF если видимое изменение, фактическую функциональность, failed/unknown traces и оставшиеся тесты. Статусы adoption ledger менять **только** если реализованное соответствует реально проверенному; отсутствие оригинального source Android не даёт `ACCEPTED`.
4. Если нет оригинального APK/достаточных source тела/живого телефона/платежей/владельческого решения для опасного изменения: закончить независимую **offline-модель, контрольные сценарии и подготовку UI/SaveStore где можно**, записать точный блокер и **перейти к следующему независимо доступному пакету**. Не превращать `SOURCE_EVIDENCE` или `MERCHANT_ELIGIBILITY` в `OWNER_EXCLUDED`; не ждать отдельного «продолжай».
5. Если выяснилась ошибка первоначального исследования или конфликт новых пользовательских решений с ранним `HOLD/REJECT`, сначала проверить исходные данные, затем обновить spec/ledger/QA и действительное поведение **в одном сквозном пакете**. Не маскировать невозможность exact port придуманным правилом.
6. Для видимых изменений: подписанный **debug APK** от той же ветки и **короткая GIF реального приложения**, в ответе дать рабочие ссылки/путь и остаток. Не сообщать об успешном Android-run, если Gradle упал из-за Maven 429/403 или не был протестирован телефон. Для чистых docs/infra без визуальных изменений GIF не нужен.
7. Каждый пакет сообщает `KIT IMPACT: REUSE / ADAPT / FEEDBACK`. Обобщаемые изменения в mini-games-kit создавать отдельно и пересматривать совместимость с текущим pinned runtime, не переносить закрытые источники в публичный repo. Не сливать в production `main` из research branch без проверки PR ancestry, текущих флагов и подписанного релизного контракта.

**Зависимости** в JSON — обязательные инженерные предпосылки для законченного результата. **Внешние gates** (телефон, source original, merchant/owner) — отдельные условия *полной приёмки*, а не причина бросать уже независимую инженерную работу. Пакеты высокого риска, например платный Refund/Paywall/Unlimited/energy/Undo wipe, не включать по умолчанию без product policy; **написание offline-проверок и версии данных разрешено**.

## 2. Канонический порядок 38 пакетов

| ID | Инженерный результат | Входной gate | Зависит от |
| --- | --- | --- | --- |
| P00 | Reconcile CORE/QA/CI branches, source pin, signed C8 preview | READY_LOCAL | — |
| P01 | **P1 issue #80: request vs SDK-shown clock** | READY_LOCAL | P00 |
| P02 | Q2/Q3 Android/control/novice acceptance | PHYSICAL_ANDROID | P00 |
| P03 | Q1b/c: tradeoff/UNKNOWN/recycle/semantic novelty checks | READY_LOCAL | P00 |
| P04 | C1+D2: onboarding, helper discovery, all 11 UX/feel systems | READY_LOCAL | P00 |
| P05 | Distinct source-driven Hitapps/AZUR dealer/seed/preset pipelines | READY_LOCAL | P00 |
| P06 | DynamicDifficulty + EasyDeals beyond currently limited 11–15 | READY_LOCAL | P05 |
| P07 | Source-shaped Equality, three stacks, Shuffle/Final and bot policies | SOURCE_EVIDENCE | P05 |
| P08 | Default-off pre-certified Equality candidate issuance | OWNER_ACTIVATION_GATE | P07 |
| P09 | Existing ordered, locks, upper/lower bonus slots acceptance | PHYSICAL_ANDROID | P00 |
| P10 | FrozenCards layers and state | SOURCE_EVIDENCE | P05, P09 |
| P11 | BoundCards + Scissors distinct mechanics | SOURCE_EVIDENCE | P05, P09 |
| P12 | PuzzleTop/PuzzleBottom card types | SOURCE_EVIDENCE | P05 |
| P13 | GoldenCards post-Final; Gold Rush separate | SOURCE_EVIDENCE | P05 |
| P14 | Hitapps postseed Magnet/Hammer boosts | SOURCE_EVIDENCE | P05 |
| P15 | AZUR random-inserted Joker vs our manual Joker | OWNER_ACTIVATION_GATE | P05, P09 |
| P16 | AZUR Shuffle action and controller | SOURCE_EVIDENCE | P05 |
| P17 | Unico Magnet source action then product implementation | SOURCE_EVIDENCE | P05 |
| P18 | Existing CORE-5 coin/rewarded +10, no-fill, late receipt | READY_LOCAL | P00 |
| P19 | True StockRestore, segmented revive, unlimited entitlement | OWNER_ACTIVATION_GATE | P18 |
| P20 | Win multipliers, Definition, free coins, rewarded cosmetics | READY_LOCAL | P18 |
| P21 | Optional AdsBreak, banner, ILRD, Coffee Break | OWNER_ACTIVATION_GATE | P01, P18 |
| P22 | E3 complete offline 41-item-family SKU catalog | READY_LOCAL | P00 |
| P23 | Paid order journal, exactly-once grants, refund/restore | READY_LOCAL | P22 |
| P24 | Official supported merchant/provider for actual paid transactions | MERCHANT_ELIGIBILITY | P23 |
| P25 | Piggy/Pass/VIP/NoAds/offers/coin packs/unlimited family | OWNER_ACTIVATION_GATE | P22, P23 |
| P26 | Versioned Event/Claim/Time infrastructure | READY_LOCAL | P00 |
| P27 | PuzzleEvent, gallery, multi-resource reward | READY_LOCAL | P26 |
| P28 | Full 16 DailyTask types + nine reward kinds | READY_LOCAL | P26 |
| P29 | DailyBonus, login DailyRewards, Fortune, DailyPuzzle | SOURCE_EVIDENCE | P26 |
| P30 | Native-like WinStreak / Unico streaks / AZUR Combo | SOURCE_EVIDENCE | P26 |
| P31 | WeekendRace, LavaQuest, Lives, GoldRush and prewarm | OWNER_ACTIVATION_GATE | P26 |
| P32 | Regions, Cascade, Digging, LuckyWheel, Treasure | SOURCE_EVIDENCE | P26 |
| P33 | G1 80+ content, thematic novelty, provenance/geometry | READY_LOCAL | P03, P05 |
| P34 | Locale packs, art-count override, move-budget, language switch | SOURCE_EVIDENCE | P05, P33 |
| P35 | Remote override and immutable offline bank sync | SOURCE_EVIDENCE | P34 |
| P36 | Original Hitapps/AZUR/Unico Android source traces | PHYSICAL_ANDROID | P05 |
| P37 | Versioned release QA + ledger/kit sync + actual hardware acceptance | RELEASE_GATE | P00, P01, P03, P09, P18 |

**Фактическая готовность:** `READY_LOCAL` означает, что можно начать инженерную работу **после актуальной сверки кода**, не что feature уже готова или одобрена в релиз. `SOURCE_EVIDENCE` означает, что точная исходная механика частична; допустим отдельно подписанный `PRODUCT_ADAPTED` вариант и исследовательские проверки без ложного native-паритета. `OWNER_ACTIVATION_GATE` — owner-approved выпуск/стоимость/опасная миграция; не молчаливое разрешение менять правила. `PHYSICAL_ANDROID` — требуются реальные наблюдения, но desktop browser тесты продолжать. `MERCHANT_ELIGIBILITY` — реальная правовая/платежная проверка.

## 3. Полные инженерные ТЗ по потокам

| Файл | Точные пакеты |
| --- | --- |
| [Основа, интеграция, качество](specs/00_FOUNDATION_QA.md) | P00/P03 (+ P02/P04/P09/P18 acceptance crosscuts) |
| [Генератор, директор, Equality, контент, локаль](specs/01_GENERATION_DIRECTOR.md) | P05–P08, P33–P35 |
| [Специальные карты, помощники, FTUE и polish](specs/02_SPECIALS_FEEL.md) | P04, P09–P17 |
| [Реклама, награды, IAP и магазин](specs/03_REWARDS_ADS_COMMERCE.md) | P01, P18–P25 |
| [DailyTasks, события, галерея, гонки, регионы](specs/04_RETENTION_LIVEOPS.md) | P26–P32 |
| [Оригинал/Android/P6/Release evidence](specs/05_SOURCE_DEVICE_ACCEPTANCE.md) | P02, P36, P37 |

Все спецификации ссылаются на полноценные исследования и их source tier. Если внутри ТЗ числовой параметр отмечен `PRODUCT_POLICY`, он не является оригинальной активной конфигурацией конкурента; все TBD остаются явно неизвестными.

## 4. Универсальная приёмка любого пакета

Пакет проходит **ENGINEERING_VERIFIED** только после воспроизводимых unit/infrastructure/model/Playwright checks, точного PR SHA, CI run, проверки сохранений и списка незакрытых source evidence. **DEVICE_VERIFIED** только после Android физического/isolated QA с настоящим SDK, если он задействован. **SOURCE_PARITY** только по authentic build+locale+seed/config+final board oracle, не по названию метода. **P6 HUMAN** только при фактическом наблюдении без навязанного witness; исходы UNKNOWN solver не являются доказанными проигрышами. **LIVE_COMMERCE** требует реального легального provider/merchant, оплаченного verified order, корректного receipt/refund и settlement. **FULL ACCEPTED** требует всех выбранных для данного feature критериев, а не просто зелёного CI.

Ветвь `main` по-прежнему не совпадает с C8 preview. Пакеты **не дают** оснований автоматически переопределять старые `campaign-c[1-8]-*` IDs, Rules3, earned receipts, SourceFeatures pin или оплаченные entitlement. Полная программа включает все 115 систем, даже если конкретный original source или платежный канал временно недоступен.

**Передача разработчику:** «Бери `docs/porting/DELIVERY_QUEUE.md` и `DELIVERY_QUEUE.json` из PR с этой очередью, выполни P00 и дальше бери первый доступный пакет автоматически. После каждого — actual PR, тесты, APK/GIF для видимых изменений и обновление `DELIVERY_PROGRESS.md`. Если часть gated оригиналом, Android или платежкой — зафиксируй точный блокер и продолжай независимый пакет. Не жди моего 'продолжай'.»
