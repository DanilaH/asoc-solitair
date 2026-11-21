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

Статусы ниже учитывают проверки в отдельных ветках пакетов. Ссылки ведут на PR и фактический запуск; изменения остаются на своих ветках до интеграции.

| Пакет | State | PR/commit + CI | Доказанная функциональность / остаток |
| --- | --- | --- | --- |
| P00 | ENGINEERING_VERIFIED | [База #86 `ba44580`](https://github.com/DanilaH/asoc-solitair/pull/86), [CI 44925229086](https://github.com/DanilaH/asoc-solitair/actions/runs/44925229086) | [Сверка веток, подписанного APK и регрессий](P00_C8_BASELINE.md). Все 114 ID сохранены, 0 изменений статусов механик. Физический Android и плейтест в P02. |
| P01 | NEEDS_DEVICE | [PR #88](https://github.com/DanilaH/asoc-solitair/pull/88), [CI 44928339856](https://github.com/DanilaH/asoc-solitair/actions/runs/44928339856) | Подписанный APK и тесты прошли. Настоящий SDK и lifecycle в Q3. |
| P02 | NEEDS_DEVICE | [PR #89](https://github.com/DanilaH/asoc-solitair/pull/89) | Подписанные сборки A/B/C и точные сценарии. Нужны телефон и участники. |
| P03 | ENGINEERING_VERIFIED | [PR #90](https://github.com/DanilaH/asoc-solitair/pull/90), [CI 44928912745](https://github.com/DanilaH/asoc-solitair/actions/runs/44928912745) | 528 переносов, 325 WIN, 203 UNKNOWN. Углублённый CI 13/18, 5 UNKNOWN. |
| P04 | NEEDS_DEVICE | [PR #91](https://github.com/DanilaH/asoc-solitair/pull/91), [CI 44930638939](https://github.com/DanilaH/asoc-solitair/actions/runs/44930638939) | Попап закрытых помощников и сверка 16 ID. Подписанный APK есть, нужен TalkBack и физический плейтест. |
| P05 | ENGINEERING_VERIFIED | [PR #92](https://github.com/DanilaH/asoc-solitair/pull/92), [CI 44929964011](https://github.com/DanilaH/asoc-solitair/actions/runs/44929964011) | Две воспроизводимые модели раздачи, обычный AZUR и отдельный preset. P36 остаётся открытым. |
| P06 | NEEDS_OWNER | [PR #93](https://github.com/DanilaH/asoc-solitair/pull/93) | 130 контрольных вариантов бюджета на 65 уровней. Политика включения открыта. |
| P07 | ENGINEERING_VERIFIED | [PR #94](https://github.com/DanilaH/asoc-solitair/pull/94), [CI 44930830479](https://github.com/DanilaH/asoc-solitair/actions/runs/44930830479) | Фазы, гейты, отдельные trace и 3 столбца. Преобразование карт оригинала остаётся UNKNOWN. |
| P08 | NEEDS_OWNER | [PR #95](https://github.com/DanilaH/asoc-solitair/pull/95), [CI 44931235799](https://github.com/DanilaH/asoc-solitair/actions/runs/44931235799) | Контрольная транзакционная выдача. Для включения нужен утверждённый каталог и правила. |
| P09 | NEEDS_DEVICE | [Ветка P09](https://github.com/DanilaH/asoc-solitair/tree/docs/c8-p09-special-device-20261121) | [34 unit и 12 touch-проверок](P09_SPECIAL_DEVICE.md). Четыре механики готовы к физическим касаниям и проверке настоящего SDK. |
| P10 | NEEDS_DEVICE | [Ветка P10](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p10-frozen-cards-20261121) | [PRODUCT_ADAPTED лёд и два выигрышных пути](P10_FROZEN_CARDS.md). Правило испытано в отдельном 23-м уровне; оригинальные снятие слоя и взаимодействие с Джокером остаются в P36. |
| P11 | NEEDS_DEVICE | [Ветка P11](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p11-bound-scissors-20261121) | [Связи и ножницы на пяти столбцах](P11_BOUND_SCISSORS.md). Наша адаптация прошла 38 unit и два touch-профиля; исходная механика остаётся P36. |
| P12 | NEEDS_DEVICE | [Ветка P12](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p12-puzzle-pairs-20261121) | [Собственные парные карты, 31 unit и два touch-прогона](P12_PUZZLE_PAIRS.md). Точная логика оригинала остаётся открыта. |
| P13 | NEEDS_DEVICE | [Ветка P13](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p13-golden-cards-20261121) | [Золотые карты и однократная выплата](P13_GOLDEN_CARDS.md). 40 unit и два touch-профиля. Расписание Gold Rush в P31, исходная выплата открыта. |
| P14 | NEEDS_DEVICE | [Ветка P14](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p14-starter-boosters-20261121) | [Отдельный Final seed и две адаптированные карты](P14_STARTER_BOOSTERS.md). 24 unit и два touch-прогона. Оригинальная вставка и действия helpers остаются P36. |
| P15 | NEEDS_OWNER | [Ветка P15](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p15-azur-joker-model-20261121) | [Изолированная модель вставки и Undo.Clear](P15_AZUR_JOKER.md). Подключение к игре требует решения о сбросе истории. |
| P16 | NEEDS_DEVICE | [PR #103](https://github.com/DanilaH/asoc-solitair/pull/103), [CI 44935035936](https://github.com/DanilaH/asoc-solitair/actions/runs/44935035936) | [Проверяемое перемешивание и анимация](P16_PROOF_SHUFFLE.md). Физическое устройство и оригинальный алгоритм отсутствуют. |
| P17 | BLOCKED_EXTERNAL | [PR #105](https://github.com/DanilaH/asoc-solitair/pull/105) | [Доказательства и отдельная офлайн-проба](P17_UNICO_MAGNET.md). Для точного переноса нужны оригинальная сборка или запись действия. |
| P18 | NEEDS_DEVICE | [PR #106](https://github.com/DanilaH/asoc-solitair/pull/106), [CI 44935496139](https://github.com/DanilaH/asoc-solitair/actions/runs/44935496139) | [Матрица продолжения CORE-5](P18_CONTINUATION_ACCEPTANCE.md). Доказательство +10, поздний кредит при daily и 16 touch-проверок. Нужна запись настоящего SDK. |
| P19 | NEEDS_OWNER | [PR #107](https://github.com/DanilaH/asoc-solitair/pull/107) | [Три офлайн-контракта](P19_RECOVERY_CONTRACTS.md). Параметры игровой выдачи и оригинальное поведение открыты. |
| P20 | NEEDS_DEVICE | [PR #109](https://github.com/DanilaH/asoc-solitair/pull/109) | [Раздельные победные и магазинные офферы](P20_REWARD_OFFERS.md). 29 C8 unit и 10 touch; нативный earned ждёт телефона. |
| P21 | NEEDS_OWNER | [PR #110](https://github.com/DanilaH/asoc-solitair/pull/110) | [Интеграция P01 и отключённая модель рекламы](P21_AD_PLACEMENTS.md). Частота новых точек, ILRD и Coffee Break открыты. |
| P22 | IN_PROGRESS | [PR #111](https://github.com/DanilaH/asoc-solitair/pull/111) | [41 офлайн-позиция](P22_OFFLINE_CATALOG.md). Типы и суммы проверены; ожидается точный CI. |
| P23 | IN_PROGRESS | [PR #112](https://github.com/DanilaH/asoc-solitair/pull/112) | [Офлайн-журнал SaveStore](P23_PURCHASE_ORDERS.md). Диск, повторы, возврат и восстановление проверены; живой провайдер P24. |
| P24 | BLOCKED_EXTERNAL | [PR #113](https://github.com/DanilaH/asoc-solitair/pull/113) | [Официальные условия продавцов](P24_MERCHANT_GATE.md). Нет подтверждённого аккаунта, принятого договора и платежей sandbox. |
| P25 | NEEDS_OWNER | [PR #114](https://github.com/DanilaH/asoc-solitair/pull/114) | [Все 15 офлайн-семейств](P25_COMMERCIAL_FAMILIES.md). Платный запуск зависит от P24, условия не активированы. |
| P26 | IN_PROGRESS | [PR #116](https://github.com/DanilaH/asoc-solitair/pull/116) | [Версионные часы и призы событий](P26_EVENT_LEDGER.md). Проверены прогресс, истечение окна и атомарное получение. |
| P27 | NEEDS_DEVICE | [PR #118](https://github.com/DanilaH/asoc-solitair/pull/118) | [Оранжерея, альбом и жетоны](P27_PICTURE_GALLERY.md). Реальный финальный ход, фрагмент и сохранённая выдача проверены в браузере. |
| P28 | NEEDS_DEVICE | [Ветка P28](https://github.com/DanilaH/asoc-solitair/tree/feat/c8-p28-daily-task-model-20261121) | [16 действий, 9 наград и недельный preview](P28_DAILY_TASKS.md). Добор и получение приза проверены через UI. |
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
