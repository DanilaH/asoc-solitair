# Content8+ · фактический журнал автономной разработки

**Инициализирован 21.11.2026.** Это рабочая таблица разработчика, а не свидетельство, что задачи уже выполнены. Основа — [очередь из 38 пакетов](DELIVERY_QUEUE.md) и её [машинный манифест](DELIVERY_QUEUE.json). При каждой успешной инженерной приёмке обновлять соответствующий `state` в JSON, эту таблицу и source IDs в [ADOPTION_LEDGER.json](ADOPTION_LEDGER.json) **вместе с фактическими доказательствами**.

**Стартовый статус:** 38 пакетов `QUEUED`, 0 пакетов с инженерной приёмкой по этой новой очереди; ранее сделанные CORE0–5 и исследования **не нужно переписывать**. При P00 их существующие PR/тесты анализируются и признаются фактом ровно в той области, которую доказывают. Source-feature snapshots 114/114: 39 IMPLEMENTED_UNVERIFIED, 5 IN_PROGRESS, 47 ROADMAPPED, 13 EVIDENCE_GAP, 9 BLOCKED, 1 DEFERRED, 0 ACCEPTED, 0 OWNER_EXCLUDED.

## Как обновлять

- **Начало:** отметить `IN_PROGRESS`, указать базовый code SHA, собственный PR, feature IDs, старые implementation/unknown.
- **После QA:** `ENGINEERING_VERIFIED` только с точным Git SHA, номером успешного CI и реальными unit+Playwright+Android-build доказательствами; если реальный телефон отсутствует — `NEEDS_DEVICE` с конкретным воспроизводимым сценарием, не PASS.
- **При внешнем source/merchant/SDK блокере:** `BLOCKED_EXTERNAL` с точным `ORIGINAL_RUNTIME_UNKNOWN`/отсутствующим SDK/API/платежкой; инженерную часть проверить и продолжать следующий доступный пакет. `NEEDS_OWNER` только для изменяющих правила/монетизацию/аккаунты/финансы решений, а не для любого готового unit-теста.
- **Полная приёмка:** `ACCEPTED` только с требуемыми независимыми evidence tiers (source parity там, где обещано, Android/P6 там, где нужно, реальная платёжная транзакция для live IAP). Сложный source feature может оставаться EVIDENCE_GAP и при хорошей PRODUCT_ADAPTED реализации; объяснить разницу.
- **Каждый PR:** число source IDs и точные (id,status) до/после, инженерная функциональность, регрессии C1–C8, web/native devices, signed APK и реальная GIF для видимой части, source-original status, outstanding unknowns, KIT IMPACT; **следующий пакет берётся самостоятельно**.

## Пакеты и статус

| Пакет | State | PR/commit + CI | Доказанная функциональность / остаток |
| --- | --- | --- | --- |
| P00 | ENGINEERING_VERIFIED | [База #86 `ba44580`](https://github.com/DanilaH/asoc-solitair/pull/86), [CI 44925229086](https://github.com/DanilaH/asoc-solitair/actions/runs/44925229086) | [Сверка веток, подписанного APK и регрессий](P00_C8_BASELINE.md). Все 114 ID сохранены, 0 изменений статусов механик. Физический Android и плейтест в P02. |
| P01 | QUEUED | — | Исправить ad request≠shown; issue #80 |
| P02 | QUEUED | — | Q2/Q3 реальный Android и плейтест |
| P03 | QUEUED | — | Q1c/semantics baseline |
| P04 | QUEUED | — | C1/D2 UX и косметика |
| P05 | IN_PROGRESS | [Ветка P05](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p05-dealer-provenance-20261121) | [Две раздельные модели и пресет](P05_DEALER_PROVENANCE.md). 51 целевой unit-тест; два собственных образца раздач пройдены движком и oracle. Оригиналы в P36. |
| P06 | QUEUED | — | DynamicDifficulty/EasyDeals 16–80 |
| P07 | QUEUED | — | Equality source pipeline |
| P08 | QUEUED | — | Opt-in special Deal issuance |
| P09 | QUEUED | — | Ordered/Keys/bonus actual device QA |
| P10 | QUEUED | — | FrozenCards |
| P11 | QUEUED | — | Bound+Scissors |
| P12 | QUEUED | — | PuzzleTop/PuzzleBottom |
| P13 | QUEUED | — | GoldenCards |
| P14 | QUEUED | — | Hitapps Magnet/Hammer |
| P15 | QUEUED | — | AZUR random Joker |
| P16 | QUEUED | — | AZUR Shuffle and animation |
| P17 | QUEUED | — | Unico Magnet |
| P18 | QUEUED | — | CORE-5 recovery, earned/coin |
| P19 | QUEUED | — | RestoreStock/Revive/Unlimited |
| P20 | QUEUED | — | Result bonus/Definition/coins/themes |
| P21 | QUEUED | — | AdsBreak/banner/ILRD/Coffee |
| P22 | QUEUED | — | 41 item-family offline catalog |
| P23 | QUEUED | — | IAP order/entitlement ledger |
| P24 | QUEUED | — | Merchant legal provider and payout |
| P25 | QUEUED | — | All 15 E3 offers |
| P26 | QUEUED | — | Shared event identity and claims |
| P27 | QUEUED | — | PuzzleEvent/gallery/multiresource |
| P28 | QUEUED | — | All 16 AZUR tasks + 9 rewards |
| P29 | QUEUED | — | DailyBonus/Rewards/Fortune/Puzzle |
| P30 | QUEUED | — | Win/Task/Combo streaks |
| P31 | QUEUED | — | Race/Lava/Lives/GoldRush/prewarm |
| P32 | QUEUED | — | Regions/Cascade/Digging/Wheel/Treasure |
| P33 | QUEUED | — | Long campaign / original RU novelty |
| P34 | QUEUED | — | Locale/art/count/language |
| P35 | QUEUED | — | Remote bank, immutable rollout |
| P36 | QUEUED | — | Original ARM32/ARM64/Unico actual traces |
| P37 | QUEUED | — | Full source+game release gate |

## Первоначально известные внешние и исходные блокеры

- **Device Q2/Q3/P02, P09, P36:** нет подтверждённой настоящей физической сессии; [Q2 isolated control PR #73](https://github.com/DanilaH/asoc-solitair/pull/73) только готовит детерминированные позиции. Истинные native rewarded/ad callbacks и original vendor final boards не наблюдались.
- **Original action gaps:** Frozen layer clearing, Bound/Scissors, PuzzleTop/Bottom, Unico Magnet, AZUR Shuffle/paid action remain partially or only metadata/video evidenced. Пакет может двигаться с явно собственным PRODUCT_ADAPTED контрактом; точное исходное поведение остаётся `SOURCE_GAP`.
- **Revenue and billing:** [issue #80](https://github.com/DanilaH/asoc-solitair/issues/80) source-confirmed bug not fixed. RuStore Pay SDK current account form and NashStore in-app purchase/payout have separate legal availability gates in [E3 report](../qa/content-v8/E3_IAP_COMMERCE_SOURCE_TO_PRODUCT_2026-11-21.md); не запускать платный продукт по синтетическому чеку.
- **Content:** [issue #84](https://github.com/DanilaH/asoc-solitair/issues/84) semantic repetition 78 unique categories/80 fresh levels, original source AZUR min repeat162. Human effect not measured, no automatic mass reauthor.
- **Integrations:** development CORE0–5 and descendant research #85 remain nested open PRs, `main` older C7; latest research source SHA `e092ba156eebb5ebc703d89e4e98bf657bbd6f14` and successful CI `44912166802` are **baseline proof, not new delivery acceptance**.

**Пример записи после каждого пакета:** «P01 — ENGINEERING_VERIFIED on PR #N/SHA, web run..., Android APK SHA...; 3 new negative SDK cases pass; original ad source still NATIVE_STATIC; physical no-fill NEEDS_DEVICE; changed ID azur-fullscreen-ads-clock → IMPLEMENTED_UNVERIFIED; next independent P03 while P02 device gated». Не копировать этот пример как реальный результат.

**KIT IMPACT:** REUSE current framework; record future actual feedback separately.
