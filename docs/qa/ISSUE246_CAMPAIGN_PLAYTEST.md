# №246 · длинная кампания, генерация и помощники

База проверена: PR237 `1ef3db5b4d86227b95451de68a5a857f0687d8f4`, 0.21.7/58. E0 вынесен в [PR247](https://github.com/DanilaH/asoc-solitair/pull/247): `73b90e193606424fdfe4720147143de51d062762`, 0.21.8/59, [полный CI46137293691,4/4](https://github.com/DanilaH/asoc-solitair/actions/runs/46137293691). Продолжение пакета — отдельная ветка `feat/246-campaign-playtests`, 0.21.9/60. Точный итоговый SHA,17 заданий CI и APK сверяются по manifest и checks этой ветки. Публикация и перевод экспериментального банка в ordinary не выполняются.

## Матрица приёмки

| Часть | Реализация и воспроизводимая проверка |
| --- | --- |
| E0 / CA-06 | [Протокол](CA244_CONTINUE.md),28 frozen states,5→11 proof при3000/1400ms,0 потерянных прежних положительных. Предыдущие8:0→4. Шесть добавленных маршрутов3/3/5/8/9/9 ходов, полное oracle-воспроизведение,900/+10 один раз. Earned video остаётся proof-free. |
| E1 / выдача | A/B по21 позиции L81–101, три сертифицированные геометрии на позицию.72 уникальных расклада в24 наборах:18 одинаковых контрольных позиций и три различных пика на каждый вариант. Никакой повторной геометрии на другом уровне. Резервы15%/floor12 и25%/floor18, каждый −5/0/+10 конечный бюджет проверяется независимо. В APK выбран экспериментальный25%, альтернативный15% остаётся отдельной версией допуска. |
| E1 / генератор | Восстановленные AZUR one-pass/exclusive-bound dealer и Hitapps ten-pass dealer, существующий source-phase authoring и восемь семейств. Каждый seed повторяется через тот же фазовый pipeline с проверкой sourceHash/final board; конечную трассу проверяет независимый Rules4 oracle. Priority — предложение маршрута, а не сертификат или человеческий игрок. |
| E1 / контент | Собственный расширяемый registry119 существующих тем; collision rejection нормализует NFC/регистр/ё→е. Планировщик выбирает наименее недавно использованные темы; использование иллюстраций проверяется через реальный `cardArtwork`. Все попытки и отказы зафиксированы в [admission-v1.json](issue246/admission-v1.json). |
| E2 / помощники | `audit-playtest246-helpers.ts`: matched reachable snapshots, no-helper proof и одинаковая независимая policy, фактические quote/acquire/consume, wallet/inventory, следующий ход, proof и результат policy. Manual/Random Joker и два слота разделены. Definition отдельно требует человеческой смысловой оценки. |
| E2 / Shuffle | Сравниваются существующий single-seed и bounded multi-seed под1800ms, с полным proof и actual commit. Изменение алгоритма не активировано по одному предположению; фактические результаты и UNKNOWN сохраняются. Hidden pool, открытые позиции, предупреждение и Undo.Clear остаются. |
| E2 / Hint | Только в A/B заряд резервируется до применения рекомендованного действия. Повтор, закрытие, другой ход, stale/timeout и reload не списывают его. Резерв другой партии исключает двойное использование при Campaign/Daily. Task/telemetry use фиксируется при применении. Точная FTUE остаётся на прежнем контракте, ordinary поведение не меняется. |
| E2 / восстановление | Restore0/100/150 и точный sidecar refund через Undo, затем300 Undo на крупном поле. Unlimited800/60s, истечение/retained budget/reload; часы функционального теста не изображают физический Android. Continue дополнительно сравнивает +10/+20/явно гипотетическую формулу, без активации новых сумм. |
| E3 / экономика | `audit-playtest246-economy.ts`: current/A/B, full/partial/no-optional × no voluntary RV/conditional modeled RV/all-no-fill, одинаковый реальный L1–80 prefix; отдельно новый тестовый checkpoint100. Отдельные +2 slope и редкий игрок послеL80. Все счета сверяются; forced scripted rescue считается отдельно. Цены, выплаты M1, вес бесплатных наград и частоты рекламы в продукте неизменны. |
| E4 / регрессия | Полный ordinary workflow сохранён. Дополнительные jobs проверяют оба кандидата, все допущенные варианты, native signing и реальные touch-сценарии текущего UI. APK ordinary/A/B получают разные manifest/package IDs, одну прежнюю тестовую подпись и demo SDK. |

## Два варианта и границы эксперимента

Реализация кандидатов — [PR248](https://github.com/DanilaH/asoc-solitair/pull/248). В текущем ordinary-контроле L81–101 отсутствует `deal.recovery`: тест честно фиксирует недоступность Stock restore на этих полях. Кандидаты проверяют существующую механику0/100/150 на своих подходящих finite-recycle полях. Доступность ordinary ради успешного теста не меняется. Исторический CA-03 browser-сценарий сохраняет прежнюю проверку ordinary и отдельно подтверждает отложенное списание после реального touch-действия в A/B.

A использует три семишаговые волны с точными статическими четверками AZUR `[F,C,firstDepth,displayTier]`:

`[3,3,3,1],[3,4,3,2],[4,4,4,3],[3,4,3,2],[5,5,5,4],[4,4,4,3],[5,5,5,4]`.

B заменяет последнюю позицию каждой волны на G12/G15/G12:82/98/82 обычных физических карт, до добавления стартера/половинки. В L94 Молоток увеличивает98 до99 физических карт. Частота пиков — наша тестовая гипотеза. Display label не является доказанной объективной сложностью; M1 reward tier описывается отдельно существующим mapping.

`audit-playtest246-authoring.ts` дополнительно сертифицирует независимые числовые профили36/64/66/80/82/98/100 и их точные stock/columns. Они QA-only, не добавляют уровни в ordinary. Для восьми семейств сравниваются text/image/special controls на тех же своих словах и requested seed. Изменение геометрии при source pattern reseed и физические добавления Puzzle/Starter обозначаются явно. Image-only control имеет те же правила и трассу; semantic usefulness не выводится из solver.

Для каждого набора фиксированы immutable template, requested/resolved seed, все94 попытки финального авторинга,72 принятых и22 bounded UNKNOWN, source/board/route/trace/receipt hashes, реальные эффекты, два резерва и сертификаты каждого бюджета. Найденный минимум не называется оптимальным. При отсутствии трёх доказанных вариантов авторинг прекращается с отчётом, не подставляет другой размер и не выпускает неизвестную раздачу. Вне L81–101 используется сохранённый сертифицированный ordinary bank по прежней версии; ошибочная или смешанная конфигурация отклоняется при сборке.

## Сохранения и установка

- Ordinary: `com.danilah.asocsolitair.debug`, обновление прежнего тестового приложения с сохранением данных.
- A: `com.danilah.asocsolitair.debug.azur`, «Ассоциации A · AZUR».
- B: `com.danilah.asocsolitair.debug.hybrid`, «Ассоциации B · гибрид».

A/B устанавливаются рядом с ordinary. Только при действительно пустом хранилище их SaveStore создаёт явный тестовый checkpoint L81 с исходными M1 ресурсами100 монет/3 подсказки/5 отмен/1 Джокер. Пропущенные canonical L1–80 и их milestone rights закрыты без выплаты, поэтому первый тестовый выигрыш не выдаёт ретроактивные800 монет. Это новый изолированный тестовый профиль, не экономика игрока, реально прошедшего80 уровней. Последняя сравнивается отдельно в симуляции.

Существующее сохранение всегда минует factory. Старые C1–C8/Rules2/3/4 IDs, реальные ordinary L81–200 definitions и обе версии допуска A/B сохраняются в lookup. Новый выбор не подменяет уже активную/parked раздачу. Level-scoped losses/restarts/source outcome, Easy Deals, rotation,5 жизней/5min/100, earned rights, slot credits, сохранённые Random Joker и receipt journal остаются у прежних владельцев. Canonical first-clear защищает награды от повторов. Проверяются L80/81,101/102,200/200 и Campaign/Daily. ПослеL101 доступна прежняя ordinary L102–200; нового массового банка нет.

Тест300 Undo на99-карточном поле дал локально3,712,060 raw bytes и627,866 encoded bytes, при неизменном native limit4MiB. Все300 Undo приняты; только сохранённые restore sidecars вернули1350 монет, повторного возврата нет. Это функциональная высокая-wallet fixture, не предложение выдачи100000 монет игроку. Финальный CI повторяет измерение на точном HEAD. Многолетние журналы и прежняя FA-04 регрессия остаются в полном ordinary suite.

## Источники и точность

Читались [семь пилотов, ac3d889](https://github.com/DanilaH/mini-games-kit/blob/ac3d889fbce1daebc395970ba1b37164dd82e5a8/research/games/association-solitaire/2026-11-28-campaign-economy-pilot/PILOT2.md), [capacity](https://github.com/DanilaH/mini-games-kit/blob/ac3d889fbce1daebc395970ba1b37164dd82e5a8/research/games/association-solitaire/2026-11-28-campaign-economy-pilot/content-capacity.md), [AZUR static2000, d91def6](https://github.com/DanilaH/mini-games-kit/tree/d91def6f0f2239405a3de9b0f1703dd63cb9ffa4/research/games/association-solitaire/2026-11-16-azur-static), [числовые поздние Hitapps/Unico,96c47b1](https://github.com/DanilaH/mini-games-kit/tree/96c47b1924b4f1dc5049c24c0f4aa5c215cd2821/research/games/association-solitaire/2026-11-28-long-campaign-wave), [generator architecture/native matrices,81da64b](https://github.com/DanilaH/mini-games-kit/tree/81da64b3f11acc1a4e4e9ff69c06e3baea5f8481/research/games/association-solitaire/2026-11-26-hitapps-generator-handoff), [recovery native branches,28675ef](https://github.com/DanilaH/mini-games-kit/tree/28675ef1fa2fd8f974f4a05ed97d14e3eb49adfa/research/games/association-solitaire/2026-11-26-hitapps-recovery-lives).

Приоритет у восстановленного поведения оригинала и проверочных матриц. Использованы существующие собственные reconstructed algorithms и настоящий consumer Rules4/oracle, без второго игрушечного engine. Unity RNG seed state не восстановлен: в AZUR destination adapter используется наш явный seeded RNG, это PRODUCT_ADAPTED. Поздние stock/columns Hitapps — THIRD_PARTY_WEB_UNVERIFIED, верхние слоты предположены. Server difficulty/offer coefficients и actual live segments неизвестны. Гипотеза recovery `.5/cap30/min5` не называется исходной активной конфигурацией. Пять и семь позиций, pending moves, infinite lives, Equality/Paywall, Unico Magnet/Super/Show Category и остальные115/38/15/9 систем остаются в дорожной карте; ничего не исключено и source status не повышен по browser engineering.

## Воспроизведение и оставшаяся приёмка

`tools/content/build-playtest246.ts` + `pack-playtest246.mjs` авторят новый versioned bank; существующие definitions не перезаписываются. `audit-playtest246.ts` повторяет generator seeds и все finite certificates. `audit-playtest246-authoring.ts`, `audit-playtest246-helpers.ts`, `audit-playtest246-economy.ts`, `playtest246-capacity.ts` сохраняют JSON в `.recording/issue246/`. Project CI выгружает их вместе с реальными UI-видео; source CI самого кита не вызывается. Локальные данные рядом с этим документом — pre-CI measurements, итоговым доказательством служит exact-head artifact.

Capacity report считает normalized overlap, совместную последовательность Campaign/Daily и арифметические нижние оценки на1000/2000. Наш119-topic pool не доказывает semantic diversity уровня4539 AZUR IDs. Близкое повторение между режимами показано, а не скрыто. Предполагаемые40/80/120min editorial и15/30/60min/image — открытые входы what-if стоимости, не измеренные ставки. Длинный словарь/арт/сертификация требуют отдельного объёма и редакторской приёмки;1000/2000 не утверждены.

Физический Android остаётся отдельным: ordinary upgrade без очистки, active/parked и ресурсы; A/B side-by-side;5 columns, длинные слова, scroll/drag/touch, Puzzle/ice/locks/gold и понятность обоих Joker/слотов; latency на слабом устройстве; настоящие Yandex test shown/earned/no-fill/late/close callbacks и фон/возврат. Browser/bridge mocks и модель75% fill не заменяют эти проверки. Retention, RPM, конверсия и человеческий win-rate не заявляются.

Решения после плейтеста: чистый A или частота пиков B; резерв15/25; сохранить M1 или отдельно согласовать изменение после human данных; объём следующей главы и бюджет собственного словаря/арта; перенос отложенной Hint settlement/других helper policies в ordinary. До этих решений кандидат не становится production. KIT IMPACT: REUSE, runtime pin `a9325265e87583a4872cf6a158e1e881a0d7508e` неизменен.
