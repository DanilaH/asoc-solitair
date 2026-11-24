# ТЗ: Daily Tasks, Daily Bonus и политика внутрипартийной серии

[Общее поручение и порядок PR](CORE_ADS_RELEASE_TZ_2026-11-24.md) · [Аудит текущего кода](DEVELOPER_AUDIT_2026-11-24.md)

**24 ноября 2026 · готово к разработке поэтапно; реализация и приёмка этим документом не объявляются выполненными.**

Проверенный consumer: `DanilaH/asoc-solitair`, ветка `feat/c8-azur-victory-qa-20261123`, полный code HEAD `c4215e18d54927a5ac73a350876f29852aa36861` ([PR190](https://github.com/DanilaH/asoc-solitair/pull/190)). Действующие инструкции находятся поверх того же кода в PR194, `23f04d32f00ca4cb8bd569e8802a75343e48bd3c`. Перед первым code PR сверить новый HEAD и перенести только остающуюся дельту.

Применяются [новый метод](RESEARCH_METHOD_2026-11-24.md), [решение о выпуске](OWNER_AD_RELEASE_2026-11-24.md) и [матрица продуктовых возможностей](PRODUCT_CAPABILITY_RECHECK_2026-11-24.md). Метод kit закреплён за `06a01d5c1f7af3cdf8013c9ce0f6a691d086af78`, runtime — за прежним `a9325265e87583a4872cf6a158e1e881a0d7508e`. Собственная реализация использует изученный код и архитектуру; точные исходные выдержки остаются в закрытом kit.

## 1. Ответственность и порядок

| Возможность | Source ID / владелец пакета | Текущее состояние | Следующая работа |
| --- | --- | --- | --- |
| Задания дня и награды недели | `azur-daily-tasks` / **P28** | Рабочий адаптированный журнал и четырёхзадачный preview; полного нового исходного расписания нет | Закрыть учёт и общую выдачу; добавить каталог 7×4, составные награды, пять milestones, сохраняемый сундук; подготовить достижимую no-IAP policy |
| Самостоятельная карточная награда дня | `azur-daily-bonus` / **P29** | Отдельная offline-проба; обычный Daily Level уже работает | Реализовать исследованный выбор четырёх призов, раскрытие трёх совпадений, сохранение и однократный claim; подключить свою презентацию |
| Внутрипартийная серия, вариант AZUR | `azur-combo-streak` / **P30** | Старая адаптированная offline-проба; текущая игровая серия имеет другую политику | Восстановить source-domain события и versioned policy; интегрировать в одну способность серии, сохранив происхождение вариантов |
| Существующая игровая серия | `hitapps-ingame-streak` / **P04**, регрессия | Реальные transfer-счётчики и выплаты в engine | Переиспользовать UI/feedback и сохранить существующие попытки; не начислять две серии одновременно |

Последовательность: **R1 — события/ресурсы/сохранения → R2 — Daily Tasks → R3 — Daily Bonus → R4 — AZUR Combo policy**. Независимые исследовательские ветви допускают параллельную работу; отдельные PR завершаются интеграцией с общей конфигурацией из основного релизного ТЗ. QA-presets нужны для доказательства переноса, а не как бессрочная замена пользовательской функции.

Существующие задачи [#184](https://github.com/DanilaH/asoc-solitair/issues/184), [#186](https://github.com/DanilaH/asoc-solitair/issues/186), [#188](https://github.com/DanilaH/asoc-solitair/issues/188), [#191](https://github.com/DanilaH/asoc-solitair/issues/191), [#192](https://github.com/DanilaH/asoc-solitair/issues/192), [#193](https://github.com/DanilaH/asoc-solitair/issues/193) — доказательства и история, не шесть независимых переписываний. P29/P30 берутся из действующей очереди: ранние заголовки P19/P21 или P16/P20 в этих issue не меняют владельца source ID.

Все 115 исходных IDs / 38 пакетов остаются в плане. Это уточнение трёх существующих IDs, не новая система №116. Другие Daily/Unico/Hitapps-варианты не исключаются и не получают автоматически те же правила.

## 2. Что проверено в текущем коде

| Код на `c4215e1` | Подтверждённое поведение | Дельта, которую действительно надо сделать |
| --- | --- | --- |
| [`daily-tasks.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/events/daily-tasks.ts): `TaskKind`, `RewardKind`, `scheduleTasks`, `recordTaskSignal`, `claimTask`, `claimTaskMilestone` | 16 типов задач, 9 типов наград, UTC day/week, дедупликация сигналов, separate claim и медали недели уже есть | Расширить данные и интеграцию; перечисление enum не является реализацией всех живых источников событий |
| Там же: `TaskTarget`, `validTask`, `updatePreviewTasks` | Один `prize`; quantity ограничена 100. Preview — 4 задания с чёт/нечёт вариантом, один порог 5→20 coins | Исходная запись содержит medals **и** bonus; 250-medal задача и большие составные milestones не помещаются. Нужны новая versioned schema и ограничения по ресурсу |
| Там же: `openTaskChest`, `inventory` | Один charge из hints/undos/jokers по хешу chest key; definitions/shuffles лежат в отдельном task inventory | Исходный сундук — три вида из четырёх и 12 charges. Награды должны попадать в реально используемый общий кошелёк, без второго невидимого запаса |
| [`main.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/main.ts): `renderTasks`, обработчик `daily-tasks-open` | Журнал создаётся при первом открытии окна; подписи и weekly UI рассчитаны на preview, порог 5 и id `week` зашиты | Инициализировать доступный календарь независимо от открытия UI; рендерить каталог/награды/пороги из данных |
| [`engine.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/engine.ts): `freshAttempt`; [`campaign.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/campaign.ts): `beginDeal`; [`sessions.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/sessions.ts) | `beginDeal`, `switchMode` и restart уже ставят `verifiedTaskHints=0`, если journal существует. `freshAttempt` сам этого не делает; `acceptedTaskSignals` требует строго 0 | Остаточная дыра — попытка создана **до** первой инициализации задач. Не поручать заново исправление всех Next-переходов; обеспечить учёт подсказок с рождения новой попытки |
| [`meta.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/meta.ts), `meta-ui.ts` | Daily Level, его календарь, серия дней, цикл первых побед и ключи `daily:<day>` работают | Сохранить; карточный Daily Bonus — отдельный loop, его claim нельзя подменять победой Daily Level |
| [`daily-reward-trials.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/tools/content/daily-reward-trials.ts) | AZUR-проба: один выигрышный слот из N, один выбор, 25 coins | Это прежняя PRODUCT_ADAPTED-модель; новый источник доказывает другой алгоритм. Переиспользовать общие guards/ключи, не выдавать эту пробу за готовый перенос |
| [`streak-trials.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/tools/content/streak-trials.ts): `azurComboTrial` | Проба считает transfer, обнуляет любой accepted draw/recycle/undo; порог 4→8 coins | Нужны typed MoveSummary, доказанный приоритет reset и source track; старую пробу оставить явно адаптированной |
| `engine.ts`, [`balance.ts`](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/balance.ts) | В игре own/Hitapps-inspired series: уникальные transfer edges, ступени 4/5/6/7 и coins 2/3/4/5, защита от повторов через Undo | Сохранить текущие права и защиту; источник AZUR не разрешает молча заменить баланс активных попыток |

Это аудит чтением точного кода и источников. Новый запуск Android/SDK или новых игровых тестов в рамках подготовки ТЗ не проводился.

## 3. Источники и границы доказательств

Общая исходная сборка: AZUR `com.solitaire.match.words` **1.3.3.8 / code244**. SHA-256 XAPK `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`; ARM64 `libil2cpp.so` `27eb2e67ba00093ed575e16fc01a876a9e90fff8e53b504338047a4bf2c0d924`; IL2CPP v31 metadata `01ec4a9211a481353c4d660cda2f76fcb842f60e195ab5266d7a0ce4545be0a0`.

| Evidence | Точный закрытый отчёт и артефакты в его каталоге | Контракт |
| --- | --- | --- |
| E1 | [Daily Tasks transaction @11b45e0](https://github.com/DanilaH/mini-games-kit/blob/11b45e036bd73f4815786b1511f97384f1aff3cb/research/games/association-solitaire/2026-11-23-azur-dailytasks-native/README.md), `verify-original-dailytasks.py` | `ClaimTask@0x2677630` / `ClaimMilestone` → `TryCommitClaim@0x2677a88` → host/player save; failed claim reload; day/week progress flush |
| E2 | [28 tasks @6370f4a](https://github.com/DanilaH/mini-games-kit/blob/6370f4ad9be03283e3f148e279aaf39d49dd3360/research/games/association-solitaire/2026-11-23-azur-dailytasks-seven-day/README.md), `28-task-source.json`, `verify-original-week.py`, `verify-original-unlock.py` | `BuildTasksForBalanceDay@0x2678e7c`, 28 tuples, level/day unlock; compiled table and arithmetic |
| E3 | [Milestones/chest @0ff9968](https://github.com/DanilaH/mini-games-kit/blob/0ff9968386703c1e452b9e2ced4c5a086c4889ae/research/games/association-solitaire/2026-11-23-azur-dailytasks-chest/README.md), `evidence.json`, chest/pool/saved-roll verifiers | Five milestone bundles; original pool, partial Fisher–Yates, split; saved subset reused by preview and grant |
| E4 | [Medal writers @18e6dd9](https://github.com/DanilaH/mini-games-kit/blob/18e6dd93c4a9b759ce1c9e1d154dd93be50725cb/research/games/association-solitaire/2026-11-24-azur-medal-award-paths/README.md), `verify-original-medal-awards.py` | Event medals added in task claim; discovered extra writer is DevTools, not verified normal player income |
| E5 | [Daily Bonus claim @6423fc8](https://github.com/DanilaH/mini-games-kit/blob/6423fc846fef26a1cb1719750bb79b15997c3cf5/research/games/association-solitaire/2026-11-23-azur-dailybonus-original/README.md), `verify-original-azur-daily.py` | Day eligibility, combined resource+claimed-day save before notification; separate grant/mark entrypoints not interchangeable |
| E6 | [Daily Bonus generation/resume @ff9cae8](https://github.com/DanilaH/mini-games-kit/blob/ff9cae8fcbb3d188bb24a5c1d27dc5243bd6d5a4/research/games/association-solitaire/2026-11-23-azur-dailybonus-weighted-pool/README.md), `evidence.json`, `verify-original-weighted-daily.py` | 16 weighted rows, four conflict-free prizes/fallback, three same-column reveals, round and pending-win recovery |
| E7 | [Combo track/rewards @d127c0e](https://github.com/DanilaH/mini-games-kit/blob/d127c0e08b518eab4885a76611c6bbccd4cbcfd6/research/games/association-solitaire/2026-11-23-azur-combo-series-original/README.md), `verify-original-combo.py` | Compiled unlock5, slots4..8, five rewards2/4/7/10/15, seven reward kinds, pending Moves |
| E8 | [Typed Combo events @1139017](https://github.com/DanilaH/mini-games-kit/blob/1139017f488c7c3b1993e7be1ee7ec5601c713fc/research/games/association-solitaire/2026-11-24-azur-combo-movesummary-typed-flags/README.md), `verify-original-combo-flags.py` | Exact five bool fields; `HandleMoveExecuted@0x269906c` reset precedence; predicate `@0x26990dc` |

Отчёты фиксируют original-SHA static checks и отдельно собственные арифметические модели. Это **NATIVE_STATIC**, не NATIVE_ISOLATED и не полный ORIGINAL_RUNTIME. При этой проверке прочитаны отчёты, машинные таблицы и соответствующие verifier-фрагменты; приватные исходные бинарники заново не запускались. Python 3 verifier-код закреплён коммитом; версия интерпретатора/дизассемблера старого запуска, если отсутствует в отчёте, остаётся UNKNOWN, а не придумывается.

Для затрагиваемой неподтверждённой ветви дополнить закрытый annex точным tool output, границами/RVA, версией инструмента и source IDs по новому методу. Уже подтверждённые контракты не требуют повторения всего исследования. В публичное ТЗ и код переносятся собственные структуры/алгоритмы и ссылки; vendor-код/ассеты не публикуются.

## 4. R1 — единые события, ресурсы и запись

1. Ввести/переиспользовать один типизированный путь фактов **после успешной доменной операции**: accepted board action, committed helper use, settled coin spend, completed first win, committed Daily Bonus claim. Дедупликация — по устойчивому факту, а не по каждому перерисованному окну. Разделить occurrence day/week и время доставки.
2. `MakePurchase` принимает только подтверждённый order/receipt через существующий `purchaseTaskSignal`. Рекламное earned, бесплатный claim и списание монет не превращаются в MakePurchase. `BuyBoosters`/`BuyExtraMoves` имеют собственные подтверждённые неплатёжные каналы; зафиксировать, какие из coins/earned/free grant засчитываются выбранной policy, не выводить это из одного source enum.
3. Инициализировать журнал/дневной каталог при eligibility/day transition, а не только при открытии окна. Не начислять задним числом неподтверждённые события; заранее определить перенос buffered progress через смену дня/недели. Повтор login одного дня имеет один ключ.
4. Для **новых** попыток вести `verifiedTaskHints` с момента создания и обновлять при фактическом Hint независимо от наличия dailyTasks. Сохранённый счётчик переживает Undo, уход в другой режим и reload. У исторической попытки без доказанного счётчика сохранить UNKNOWN; не приравнивать undefined к нулю. Инициализация в `beginDeal`/`switchMode` уже есть и сохраняется.
5. DailyTasks inventory definitions/shuffles, rewardOffers definitions, купленные charges и игровые helper effects должны использовать общий контракт ресурса. При смене schema сохранить старые начисления и claim keys; не удваивать их переносом между двумя кошельками. Ресурс может быть выдан неплатным путём независимо от storefront/accountId.
6. SaveStore остаётся единственным writer. Progress → eligible → claimed/granted — разные состояния. В одной транзакции сохраняются claim key, новый event snapshot, выбранный reward bundle и wallet/rights. Ошибка/конкурентная запись возвращает authoritative state; UI не показывает «получено» из неподтверждённого промежуточного объекта.

## 5. R2 — полный Daily Tasks candidate

**Архитектура:** versioned catalog и календарь → task-signal adapter → event journal → claim planner → SaveStore/общий ресурсный grant → presentation. Это соответствует E1/E4 разделению service и host, с нашей более строгой атомарностью.

- Добавить source-default preset **7 дней × 4 задачи** из E2 с `kind,target,medals,bonusKind,bonusAmount`. Каждая задача имеет week/day/task/content identity. Сохранённая неделя держит свой каталог/порог/bonus bundle; новая конфигурация не переписывает уже начатую неделю.
- Level gate и event-day gate отдельны. Источник даёт fallback level2/day1; реальный remote и серверный календарь UNKNOWN. Own offline clock policy маркировать PRODUCT_ADAPTED и проверять rollback/timezone; имена `ServerDay` не делают время доверенным.
- Поддержать составные выдачи и типовые валидаторы количества/переполнения. Не просто снять общий cap100: ограничения per-resource должны проверять весь bundle до любого изменения wallet.
- Реализовать все пять source milestones E3: 50 → coins500+hint2; 100 → hint5+undo5; 300 → shuffle7+definition7; 600 → joker3+coins2000; 1000 → coins5000+12 boosters/3 вида+собственная рубашка. Это **SOURCE_COMPILED_DEFAULT QA**, не автоматически утверждённая релизная экономика.
- Сундук выбирает **три различных** вида из `[MoveHint, Undo, Definition, Shuffle]`, не включает Joker в source pool. Partial Fisher–Yates, затем quotient/remainder split: 12/3→4/4/4. Сохранить выбранные виды при создании события; preview/claim/reload используют один результат. Corrupt/missing selection получает явную recovery policy и не может бесплатно reroll через открытие окна.
- Рендерить все предусмотренные kinds, targets, bundles и milestones из конфигурации. Исключить жёсткие `5`, `week`, «Сделать 4 хода» и fallback техническим enum в пользовательских подписях.
- Сохранить фактический claim медалей: завершённая задача без claim не меняет weekly total. Дополнительная награда и claimed flag входят в ту же транзакцию. Наличие `AddMedalsForCheat` в источнике не даёт обычному игроку дополнительный доход.

### No-IAP достижимость

Суммы исходной таблицы независимо пересчитаны при этом аудите: **28 rows, 1210 максимум; без MakePurchase — 960; без всех четырёх Buy/MakePurchase rows — 730**. Это условные максимумы при доступности/выполнении прочих задач, не гарантированный реальный заработок. Не добавлять выдуманные «ещё 40 медалей» как исходную механику.

Релизная no-IAP policy должна иметь достижимые обещанные награды: подготовить сопоставление вариантов **неплатная замещающая задача / отдельно обозначенный earned-источник / адаптация порогов и наград** с расчётом нагрузки и экономики. `MakePurchase` исходного preset не переименовывать в видео; у адаптации собственный task ID/версия. Числа окончательной policy — конкретный балансный результат следующего PR и его приёмки, а не повторное согласование самого направления «без покупок».

Проверить также `CollectDailyBonuses` target2/3: не считать победы обычного Daily Level подходящими лишь по названию. Исходные producer/окно накопления не восстановлены полностью; показать, каким реальным неплатным действием выбранная продуктовая задача выполняется в доступное время. Не обещать достижимость только по сумме 960.

## 6. R3 — карточный Daily Bonus

**Архитектура:** day eligibility → immutable generated round → accepted reveal → persisted winner/pending claim → atomic day+reward grant → visual acknowledgement. Обычный Daily Level/серия дней остаются независимыми; shared wallet и committed-fact adapter переиспользуются.

1. Source preset содержит все **16 rows E6**. Coins100/200/500: weights10/7/3; Hint2/3/5 и Shuffle2/3/5:7/5/2; Undo2/3/5 и Definition2/3/5:10/7/3; Joker1:5. Raw total93 при доступности всех rows — не вероятность выигрыша и не 93%.
2. Eligibility использует максимальную достигнутую прогрессию, а не текущий replay level. Helper unlocks и live overrides не выдумывать. WeightedPick суммирует max(0,weight); при непустом zero-total pool source fallback — последняя row. Пустой pool требует собственного явного безопасного результата.
3. Выбрать четыре призовые колонки с conflict keys: разные количества одного booster-kind конфликтуют; разные номиналы coins могут сосуществовать. Реализовать подтверждённый fallback-to-four отдельно от основного weighted selection; RNG и exact source odds не объявлять совпадающими.
4. Хранить roundId, dayKey+provenance, catalogVersion, columns, slotColumns, revealed, wonColumnIndex, claim identity. Выигрыш — третья открытая карта **той же** колонки; A,B,A,C,B,A завершает A только на шестом действии. Число видимых карточек оригинального prefab UNKNOWN: собственную геометрию/число slots маркировать адаптацией, обеспечить валидный выигрышный раунд.
5. Restore выполняется до генерации. Повторное открытие, reload и third-match crash сохраняют тот же приз/расклад, не запускают WeightedPick снова. Home pending-win recovery использует сохранённые данные. Source network/session/auto-show gates частично известны; продуктовый auto-show не должен воровать фокус у игры, рекламы или другого claim.
6. Claim сам повторно проверяет eligibility и immutable winner. День+награда фиксируются вместе до анимации. Ключ только roundId недостаточен: второй roundId того же дня не должен обходить day ledger. Не сохранять выдачу и claimed-day двумя независимыми вызовами.
7. Девять source RewardKinds сопоставить конкретным ресурсам. EarnCoins/CollectDailyBonuses отправляются только из committed grant и получают один dedup key. Доступность free bonus не зависит от merchant/SDK fill; любые будущие рекламные дополнительные попытки требуют отдельного явного контракта, а не переносятся из Unico автоматически.

## 7. R4 — AZUR Combo как вариант одной серии

**Архитектура:** game transition → typed MoveSummary adapter → versioned combo reducer → durable reward/pendingMoves → presentation queue. Рендер/анимация не определяют, был ли уже выдан ресурс.

- Ввести пять source-domain bool: `IsCardRelocation`, `IsDeckDraw`, `InvolvesWildCard`, `PlacedOnCardOrFoundation`, `SkippedPlayableWasteCard`. Это точные имена E8. Producer mapping наших board actions задаётся отдельно и остаётся PRODUCT_ADAPTED там, где оригинальный caller не восстановлен; `InvolvesWildCard` не равно автоматически только нажатию Joker.
- При unlocked feature сначала `IsDeckDraw && SkippedPlayableWasteCard` → reset; иначе relocation + placed + !wild → +1; иначе neutral. Invalid action имеет отдельный reset. Draw без skip **не** сбрасывает сам по себе; когда productive и reset обе истинны, reset выигрывает. Не сохранять старое безусловное обнуление на любом draw как source-shaped.
- Source preset E7: unlock5, slots4..8, один упорядоченный track rewards2/4/7/10/15 coins, рост slots по ступеням. Активные remote tracks, restart lifecycle и поведение после пятой награды UNKNOWN; не вводить бесконечный повтор15 как доказанный оригинал. Для продолжительной QA-сессии явно задать отдельную adapted after-track policy или остановить source fixture на доказанной границе.
- Сохранять policyVersion, stageIndex/progress/slotCount/currentReward, dedup facts и earned/pending grants в attempt. Новый выбор policy касается новых попыток; старые продолжают свой баланс. Один игровой HUD серии и одна активная policy — не обязательные параллельные Hitapps+AZUR панели и двойной заработок.
- Сохранить все 7 RewardKinds: Coins, Hint, Undo, Definition, Shuffle, Joker, Moves. Coins-only default не удаляет другие варианты из дорожной карты. Moves сначала durable pending, затем отдельный exactly-once commit в актуальную попытку; прерванная анимация не теряет и не дублирует ходы. Взаимодействие с исчерпанием/Revive/Unlimited и Undo проверять на одной согласованной budget policy.
- Own anti-farming по уникальным transfer edges не объявлять доказанным исходным AZUR правилом. Сравнить source event policy и наш устойчивый учёт повторов; зафиксировать адаптацию и replay/Undo-контроли перед включением.

## 8. Приёмка: планируемые проверки, не уже полученный PASS

| Сценарий | Независимый oracle / ожидаемый результат | Уровень |
| --- | --- | --- |
| WinNoHints: journal до/после создания, первая попытка/Next/restart/switchMode, подсказка до UI, old undefined, Undo | Новая доказанно без подсказок засчитывается; реальная Hint исключает; неизвестная историческая попытка не получает ложный credit | Unit + browser по настоящим entrypoints |
| 28 исходных задач и bundles | Exact tuples E2; суммы1210/960/730; каждая medal+bonus выдаётся после claim ровно один раз | Source-derived model, не live economy |
| No-IAP неделя | Пройденный сценарий всех обещанных порогов с разрешёнными действиями, временем/ресурсами и учётом unlocks; MakePurchase не симулируется | Product balance + human playtest |
| Claim task/milestone, отказ записи, retry, double tap, две вкладки, rollover | Нет wallet без claim или claim без wallet; допустимые старые earned claims сохраняют свой catalog; speculative UI откатывается | SaveStore fault tests + browser |
| Сундук | 3/4 разных типов, [4,4,4]; вариации10/3→4/3/3; preview=grant=reload; Joker не входит в source pool | Независимая таблица + deterministic RNG fixtures |
| Daily Bonus pool/conflicts/fallback | 16rows/raw93; отрицательные веса не участвуют; 2×Undo конфликтуют, coins100+500 допустимы; final odds не равны raw weights | Unit/property checks с отдельным oracle |
| Daily Bonus reveal/restore | 1/2 совпадения без выигрыша; третье завершает тот же приз; crash до/после claim без reroll/двойной выдачи; day switch/rollback/offline | Persistence + browser/Android |
| Combo typed flags | Обычная relocation +1; wild neutral; draw alone neutral; draw+skip reset; reset при совпадении с productive; invalid отдельно | Векторы E8, locked/unlocked |
| Combo track/pendingMoves | Пять известных ступеней; retained policy после reload; одна награда; pendingMoves не теряется при pause/crash/Undo/recovery | Domain + SaveStore + интеграция |
| Общая экономика и presentation | Daily/Tasks/Combo не дублируют один earned факт; новые бесплатные ресурсы применимы при выключенном storefront; UI отражает committed wallet | Общая C8-сборка |
| UI 320×568 и390×844, Android | Полные подписи/награды, понятный остаток до milestone, нет raw enum; rapid tap/reduced motion/background; sound/haptic не повторяют grant | Реальная запись и подписанный APK |

Инструментальные проверки source anchors не заменяют target Android. Отсутствие полного original runtime не блокирует само написание и проверку определённой адаптации; конкретные неподтверждённые параметры остаются ограничениями source-parity claim и включения соответствующего варианта.

## 9. Неизвестное и учёт после каждого PR

| Открыто | Что блокирует / следующий шаг |
| --- | --- |
| Реальный source remote/calendar/unlocks, producer CollectDailyBonuses | Точный source runtime и достоверный live balance; исследовать caller/конфиг, независимо зафиксировать достижимую product policy |
| Daily Bonus slot prefab, полный fallback effect, final odds | Exact UI/odds; собственный layout и RNG имеют явную адаптацию, не подделывать вероятность |
| Combo producer flags, Undo/recycle/wild mapping, после пятой ступени | Точный перенос этих ветвей; дополнить закрытые caller-body доказательства, применить различающие тесты |
| Окончательные no-IAP числа | Активацию обещанной недельной экономики; подготовить конкретный вариант, расчёт/плейтест и принимать его как часть общей релизной политики |
| Платёжный провайдер | Только будущий настоящий MakePurchase/paid acquisition; free/tasks/bonus/серии и техническая приёмка продолжаются |

В `ADOPTION_LEDGER` / progress обновить три existing IDs ссылками на E1–E8, exact code PR, выполненные тесты и оставшиеся вопросы. Для `azur-combo-streak` прежнее общее «неизвестны правила и награды» заменить точными остаточными gaps: track/typed-handler уже исследованы, producers/live/late stages ещё нет. Статус IMPLEMENTED/ACCEPTED не повышать от одного нового ТЗ. P28/P29/P30 и старые issue должны ссылаться на этот актуальный handoff без повторного создания конкурирующих моделей.

**KIT IMPACT: REUSE** исследовательской методики и доказательств; runtime API — NONE. Исходные фрагменты остаются private, код/визуальные материалы продукта — собственные.
