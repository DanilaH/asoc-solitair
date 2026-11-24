# MVP cohesion · реализация после PR201

24 ноября 2026. Ветка `feat/c8-mvp-cohesion-20261124`. Версия кандидата **0.20.4 / Android code 45**.

Основание: [ТЗ F1–F3, C1–C3, U1–U5, V1](../../porting/MVP_COHESION_IMPLEMENTATION_TZ_2026-11-24.md), [проверенная база PR201](../../porting/PR201_RECHECK_2026-11-24.md), docs PR202 `c85fdc772cfcf07acd6289aa8c1519f55df38e09`. Владелец поручил взять эту реализацию в работу. Это следующий delta в общей интегрированной ветке, без слияния старого PR-стека.

**Статус:** реализация в [PR203](https://github.com/DanilaH/asoc-solitair/pull/203). Первый head `d4b4120762b3fc5f873484b546d8a2408c003971`: [CI run 45404920495](https://github.com/DanilaH/asoc-solitair/actions/runs/45404920495) подтвердил 485 unit tests / 1 skip, 38 UI cases и Android job/JUnit/R8. Следующий delta закрывает дополнительно найденные startup clock, timer, repeated Definition context и bundle-label случаи; Итоговые ссылки на точный CI head, APK, native JUnit и браузерную запись публикуются в PR203 после их фактического выполнения; до этого итоговая приёмка остаётся открытой. Эта запись не означает physical Android, live SDK/AppMetrica, human economy или production release acceptance. Числа обучения и расширение Shuffle остаются PRODUCT_ADAPTED candidates.

## Что изменено

| Пункт | Реальное поведение | Проверяемая граница |
| --- | --- | --- |
| F1 | Нормализованный ILRD payload принимает process-wide bounded intake. Worker повторяет первую durable запись, затем существующий outbox/SDK handoff. Callback не ждёт I/O. | Исходный delivery ID и payload сохраняются при first-write failure и уничтожении Session. Memory capture не объявлен durable; process death до записи может потерять событие. [Отдельное evidence](F1_DELIVERY_IMPLEMENTATION.md). |
| F2 | Новая timed покупка/активация на Android сначала получает свежий native elapsed clock. Нет clock — нет списания/consumption. | Old page-only Android anchors после смены timeline консервативно истекают вместе с retained moves/Undo. Original deadline не продлевается. Старые бессрочные активные права и won не подменяются. |
| F3 | `daily_start` и reward-backed `daily_completion` передают `save.attempt.daily.dayId`. | Park/resume/reload/полночь не заменяют ID сохранённой партии. Generic start и best-effort transport сохраняются. Старый Daily после своей даты не получает фиктивный completion reward. |
| C1 | Неиспользованный Random Joker хранится в `Save.randomJokers.grants`, отдельно от ручных Joker. В предупреждении до оплаты указаны 250 монет, L16 и сохранение права. | Legacy active/parked grants мигрируют идемпотентно. Consumed не возвращается. Отмена, UNKNOWN, stale и failed save не расходуют право. Оплата и размещение — разные действия. |
| C2 | Общий Shuffle inventory получает один intro grant при unlock L30 с постоянным policy marker. Новые immutable wrappers добавляют Shuffle к L33/L36/L39 после выбора варианта. | Нет новой recovery/finite-recycle политики на этих уровнях. Frozen IDs/boards не меняются. Positive proof требует финального replay; UNKNOWN сохраняет заряд. Новый Bonus pool больше не выбирает Shuffle после завершения всех четырёх поддержанных уровней, старые rounds/stock остаются. |
| C3 | Поражение отдельно предлагает прежний расклад и доступную по текущему director новую попытку. Label различает новый budget и изменённую геометрию. | На L16 relief может менять только ходы. Quote, recheck, history, life и issuance коммитятся одной мутацией. Выход домой и Daily не списывают жизнь. |
| U1 | Один Bonus selector обслуживает Home, Helpers, окно и доменные команды. Есть claimed/reset, expired/new, ready/claim и future states. | Old won сначала получает прежний приз, затем возможен сегодняшний round. Midnight не переназначает старый tap новой игре. Возврат из Bonus сохраняет контекст Helpers. |
| U2 | После L1 доступен read-only запас в Helpers, включая закрытые инструменты; применение остаётся на3/4/8. Definition shortage объясняет случайный реальный источник. | Нет coin→Definition обещания. Free/RV показывают реальные quotas, отсутствие видео, cooldown и earned отдельно. Post-win button указывает точную доплату. |
| U3 | Различимы ежедневный уровень, бонус дня и задания. Tasks показывают текущий день/неделю и сохранённые старые completed rewards. | Claim использует исходные day/week/IDs и frozen prize/bundle. Старые медали поступают своей неделе. UTC reset показывается в локальном часовом поясе. Полученная неделя не остаётся целью12/5. |
| U4 | Отдельная плитка оформления убрана; milestone/settings сохраняют доступ. Free monthly 10 coins за 3 first clears начисляется атомарно, включая старое ready право до смены месяца. | Нет магазина ради одной бесплатной награды. Future month не перезаписывается; incomplete old month не получает подарок; достижимость учитывает current clears + оставшиеся first clears. Free shop30coins остаётся независимым каналом. |
| U5 | Обычный Home показывает только готовые сохранённые награды известных трёх LiveOps families. | Claim-only не создаёт новые расписания/прогресс. Generic claim не принимает Picture; его собственные части/жетоны/награда остаются отдельным сценарием. |

## Дополнительная проверка Shuffle

[Полные 15 положительных proof/replay fixtures](../mvp-cohesion-2026-11-24/shuffle-proof.json) включают initial L30: prefix 0 / seed 7, 18 hidden + 44 stock, 66 карт, 124 исходных хода, 113 ходов в решении. Учебный intro проверяется без изменения бюджета и без требования сначала играть до конца. Для 14 новых wrappers есть реальные достижимые позиции, полные production+independent replay и atomic commit/reload.

[Отдельная проверка начального seed 0](../mvp-cohesion-2026-11-24/shuffle-initial-seed0.json) дала 5 SOLVED / 9 bounded UNKNOWN. Это ограничение конкретного bounded поиска/seed, не доказательство неразрешимости. Успех произвольного seed не обещается; при UNKNOWN сохраняются заряд, доска и Undo. Существующий reference-route search применён с finite-safe recycle guard, общий deadline поиска 1,8 секунды не увеличен.

## Дополнительные исправления после независимого review

Неизвестный native sample теперь отличается от подтверждённого reboot. Unused earned право сохраняет исходные clock/until, активная бесконечная доска ждёт native sample, а Home/Daily и конечная игра доступны. Фоновый retry ограничен 1–60 секундами. Обычные telemetry/SaveStore commits не переносят уже назначенный retry; failed expiry write имеет отдельный backoff и не создаёт цикл с задержкой 0 мс. Неуспешный ручной запрос времени виден внутри Helpers.

Повторный запрос при 0 Definition имеет текущий адресный UI-контекст даже после Manual wallet; persistent offer dedup не обходится. Старые LiveOps labels перечисляют все сохранённые coins/hints/undos/jokers, включая helper-only rewards.

## Владение состоянием

Все изменения профиля, прав, активной/отложенной партии и frozen rewards идут через существующий `SaveStore`. Нет второго whole-save writer, второго кошелька или UI-owned grant. Рендеры и state selectors не создают награды. Monthly settlement входит в ту же мутацию first clear; Shuffle grant и marker сохраняются вместе; Random Joker consumption входит в ту же мутацию proof-вставки и очистки Undo.

Существующие canonical campaign reward IDs, Daily local-date IDs, UTC Bonus/Tasks и week IDs сохраняются. За previously overwritten history новые права не выдумываются. Старые неиспользованные ресурсы доступны по сохранённому происхождению; исторические consumed receipts остаются consumed.

## Проверки и артефакты

Постоянные регрессии находятся в `tests/unit/mvp-*.test.ts`, `tests/unit/retention-lifecycle.test.ts`, native `RevenueDeliveryTest.java` и `tests/browser/mvp-cohesion-{core,retention,shuffle}.spec.ts`. Existing integrated tests обновлены под предварительное согласие на покупку Random Joker, сохранённые claimed состояния и адресный Definition context.

Browser fixtures используют настоящие domain APIs и coordinated saves; действия выполняются обычными touch/DOM controls. Нет нового QA runtime endpoint. Проверяются даты UTC и UTC+5, old earned rewards, failed-before/ambiguous-after storage, replay/новая попытка, parked boards и Undo. CI сохраняет реальные видео и screenshots этих сценариев, JUnit/XML/HTML и release manifests.

Локальный production build/typecheck выполнен. Полный повторный C8 unit suite после исправлений: **490 passed, 1 skipped, 0 failed**; это локальная проверка следующего delta, не подмена ожидаемого итогового CI. Первые реальные CI videos осмотрены на компактном портрете: Home, запас L2, Tasks/старые награды и новая попытка без обнаруженного перекрытия кнопок/текста. Chromium в текущем executor завершился до открытия страницы с `socket() failed: Operation not permitted`; локальный browser pass не заявлен. Android SDK/Gradle distribution отсутствуют. Browser и полный Android/JUnit/R8 выполняются обычным GitHub Actions workflow. Локальная Java-проверка F1 использовала явные stubs; она описана отдельно и не заменяет Gradle.

Workflow имеет независимый `cohesion` job с C8 unit suite и обычными UI-регрессиями, а также прежние полный web/archived content/preview и Android gates. Все jobs checkout-ят точный PR head. Debug APK использует принятую signing identity; unsigned release собирается отдельно с SDK disabled. Для обоих APK проверяется совпадение встроенного manifest и каждого файла web payload.

## Неизменённые продуктовые решения

Покупки за реальные деньги выключены. Рекламная пауза остаётся одной AdsBreak/Coffee capability. Shown/request/quote не являются earned. Текущие рекламные квоты, цены помощников, life 3 / 5 min / 50 coins, win multiplier base, Rules3 и старые immutable deals не перенастраиваются этим PR.

115 source features, 38 packets и 15 commercial families остаются в дорожной карте с прежними source tiers. Этот PR улучшает consumer implementation; он не повышает source parity до ORIGINAL_RUNTIME и не создаёт OWNER_EXCLUDED. Полнота переноса будущих семейств не сокращена до текущего кандидата.

## Оставшаяся приёмка

После инженерных gates нужен прогон именно итогового signed APK на физическом Android: сохранение/возврат процесса, фон и clock, читаемость маленького портрета, реальные rewarded/interstitial/banner и native revenue с разрешённой live конфигурацией. SDK handoff сам по себе не подтверждает AppMetrica ingestion, server deduplication или рекламную выплату. Человеческий прогон сложности, темпа наград, цен и рекламных пауз остаётся отдельным результатом.

**KIT IMPACT: REUSE.** Runtime pin `a9325265e87583a4872cf6a158e1e881a0d7508e`, adopted research method pin `06a01d5c1f7af3cdf8013c9ce0f6a691d086af78`. Использованы существующие kit primitives/контракты, новые package exports не предположены. Собственный код/арт сохранены; vendor source/assets в public consumer не добавлены.
