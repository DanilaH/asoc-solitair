# ТЗ: единый кор C8 для выпуска с рекламой

[Общее поручение и порядок PR](CORE_ADS_RELEASE_TZ_2026-11-24.md) · [Аудит текущего кода](DEVELOPER_AUDIT_2026-11-24.md)

**24 ноября 2026 · задание разработчику; не акт приёмки и не заявление о готовом релизе.**

База проверки: [PR #190](https://github.com/DanilaH/asoc-solitair/pull/190), игровой HEAD **`c4215e18d54927a5ac73a350876f29852aa36861`**, версия 0.20.3/code44. Метод и решения: [PR #194](https://github.com/DanilaH/asoc-solitair/pull/194), HEAD **`23f04d32f00ca4cb8bd569e8802a75343e48bd3c`** поверх того же игрового кода. Перед первым изменением сверить HEAD повторно; при новых коммитах обновить только обнаруженную дельту. `main` не является этой интегрированной игровой веткой.

Применять [метод исследования](RESEARCH_METHOD_2026-11-24.md), [решение о выпуске](OWNER_AD_RELEASE_2026-11-24.md), [семь решений владельца](OWNER_DECISIONS_2026-11-22.md) и [матрицу source → capability](PRODUCT_CAPABILITY_RECHECK_2026-11-24.md). P06 A, P08 B, P15 A, P19 A и обычные campaign Lives уже утверждены; повторное согласование направлений не требуется. Новая численная политика должна иметь собственную версию, обоснование и приёмку. Runtime kit остаётся `a9325265e87583a4872cf6a158e1e881a0d7508e`.

## 1. Результат для игрока

Одна обычная кампания C8 в одном сохраняемом профиле: выдача и адаптивная сложность, согласованные спецкарты, помощники, восстановление и жизни работают совместно. Для доступа к этим возможностям не нужно переключать тестовую сборку, выполнять диагностическую команду или подключать денежный checkout. Система сохраняет объяснимые правила и ресурсы при Undo, перезапуске, переходе в daily и возобновлении приложения.

Это работа поверх существующего ядра, с конкретными изменениями интеграции и продуктовых контрактов ниже. Весь реестр **115 source IDs / 38 пакетов** остаётся в дорожной карте. P17 Magnet, нераскрытые исходные алгоритмы и будущие P33–P35 не исчезают из неё; для их текущих пробелов указан следующий этап. Источник и собственная адаптация принимаются раздельно.

## 2. Что действительно есть на проверенном HEAD

Все перечисленные runtime-пути проверены по дереву `23f04d3` и относятся к коду `c4215e1`; для кешированных файлов нормализован только лишний конечный перевод строки. Дополнительно прочитаны актуальные Equality, pipeline и профильные unit-тесты. Ниже — проверка кода и существующих контрактов; новые тесты/Android в этом исследовательском проходе не запускались.

| Возможность | Уже реализовано | Оставшаяся дельта |
| --- | --- | --- |
| Кампания C8 | `src/content/campaign.ts`, `campaign-v8-dealer.ts`: каталог 1–80, архивные раздачи и разрешение старых Deal ID. `types.ts` выбирает Content8 отдельным флагом. | Release по умолчанию ещё Content7; общий профиль и сборку задаёт основное релизное ТЗ. Состав C8 должен быть явным и проверяться в фактически собранном APK. |
| Генерация и P06 | `tools/content/hitapps-pipeline.ts::authorHitappsCandidate`: fresh/priority/equality, SHA входа, бюджет, feature phases, проверка конечного поля. Четыре `campaign-v8-hitapps-*.json` содержат **116** записей. `difficulty.ts` и `campaign-v8-adaptive.ts` сохраняют историю и выбирают будущие варианты. | Полная поздняя выдача и source-shaped история доступны через `generation`/`director` preview. Общий профиль обязан использовать их вместе с другими принятыми системами; банк не выдавать за полный оригинальный runtime-генератор. |
| Equality | `equality-attestation.ts`, `equality-issuance.ts`: аттестация поля/бюджета/маршрута/ботов и учёт исходов. Есть **один** аттестованный кандидат L31: seed 38, база 199, penalty +10%, budget 219, путь 213. | `loadEqualityPreviewPolicy()` задаёт `controlled-fixture`, NonPayer, `maxIssued:1`. Это QA-выдача, а не настоящая сегментация, наполненный продуктовый банк или доказанная честность для человека. |
| Спецкарты | Engine, отдельные модули правил и `campaign-v8-hitapps-specials.ts`: Ordered, Keys, Frozen, Bound/Scissors, Puzzle; Golden и starter-эффекты; верхний/нижний бонусный слот. PR #177 добавил один ключ и комбинированную картинку, #181 исправил соответствующее обучение. | Часть вариантов включается отдельными флагами, `specials` заменяет отдельные уровни маленькими QA-сценами. Нужны согласованный каталог и композиция, без переноса маленькой диагностической сцены в прогрессию по умолчанию. |
| Hint / Undo / ручной Joker | `hint.ts::resolveHint` даёт шаг проверенного продолжения; UNKNOWN не расходует подсказку. Engine проводит Undo и ручной буферный Joker. FTUE сохраняет выученные действия. | Переиспользовать; проверить на итоговых сочетаниях. Greedy Hint оригинала остаётся отдельной диагностикой/политикой, не замещает безопасную подсказку автоматически. |
| Случайный Joker | `random-joker.ts`: отдельная открытая карта, предупреждение в `main.ts`, проверка пути и очистка Undo только после успешного commit. | Только отдельный профиль и вариант L16. `settleRandomJoker` не списывает никакой ресурс; unit-тест прямо сохраняет `profile` неизменным. Нужны релизный допуск и явное право/списание, согласованные с экономическим ТЗ. |
| Shuffle | `proof-shuffle.ts`: одна stock-only перестановка, проверенный путь, защита от устаревшего запроса; `main.ts` анимирует после commit. | Это PRODUCT_ADAPTED trial, а не исходный пул закрытых tableau+stock+resetWaste. Нужны выбранный контракт единственной способности, правило Undo, ресурс и область доступности. |
| Continue / Revive / StockRestore / Unlimited | `continuation.ts`, `services.ts`, `campaign-recovery.ts`: +10 только по проверенному продолжению, отдельный restore stock, retained finite budget и expiry Unlimited в активной/припаркованной партии. | Finite recovery привязан к отдельному L16. В combined `acceptance` Unlimited получает право из платного заказа; отдельный recovery QA бесплатно даёт 120 с. В выпуске без IAP нужен самостоятельный non-IAP grant-контракт; не использовать поддельный purchase receipt. |
| Жизни | `campaign-lives.ts`: обязательный gate новой кампании, однократная потеря, время/coins/earned, сохранение невостребованного earned как кредита. | Только `lives`/`acceptance` preview. Включить в общий профиль отдельно от storefront, проверить resume и все способы начать/перезапустить попытку. |
| Отклик и обучение | PR #185/#187: подтверждённые cues спецкарт, списание кошелька и прогресс. PR #189: отдельный AZUR feel; PR #190: отдельная экономика победы. | Сохранить готовое. `VITE_AZUR_FEEL_QA` всё ещё выбирает часть звука/вибрации/последовательности; перенести выбранный контракт в общий профиль. Экономику победы задаёт рекламно-экономическое ТЗ. |

## 3. Исходные доказательства и архитектура

| Evidence | Точный источник и уровень | Что использовать; что остаётся открытым |
| --- | --- | --- |
| K1 · P05–P08 | [Hitapps causal audit @b9ed5e0](https://github.com/DanilaH/mini-games-kit/blob/b9ed5e0871941d1c5ebba43b575a5caaa1e30972/research/games/association-solitaire/2026-11-22-hitapps-full-generator-audit/README.md). Hitapps 1.26.2/code3742; XAPK SHA `22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0`; ARM32 ELF SHA `f25d9a988f6fa61eb201879f72c556a5875a4ac2c5f541670950589afbb51e26`. NATIVE_STATIC + own-model. | Десять проходов shuffle, структура fresh и simulated путей, Priority/EasyDeals, int32→float32 budget, окно исходов, Equality ≥80% bot-loss. Исходные боты, pair transform, live routing/remote/segment неизвестны; 752 совпадения моделей не являются исполнением оригинала. |
| K2 · P10 | [Frozen positive predicate @b77af51](https://github.com/DanilaH/mini-games-kit/blob/b77af51259a85b8f6302c8ee3a5f7a5405bab954/research/games/association-solitaire/2026-11-23-hitapps-frozen-positive/README.md), тот же оригинальный ELF; `IsPositiveMove` RVA `0x1c81458`, SHA-bound branch verifier. NATIVE_STATIC. | First mover Joker→false; StarterBooster→boosterSpendsMove; прочие ветви зависят от event discriminator, preceding card и placeOnJokerPositive. Numeric 2/3 ещё не названы UI-направлениями; полная Update→MeltOneLayer последовательность неизвестна. Не объявлять «каждая собранная категория тает всё» исходным правилом. |
| K3 · P09–P12 | [Consumer source boundary @c4215e1](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/docs/porting/P09_P12_HITAPPS_SPECIALS_PREVIEW.md), [kit #125](https://github.com/DanilaH/mini-games-kit/pull/125), [исчерпывающий контрпример #175](https://github.com/DanilaH/asoc-solitair/pull/175). | Раздельные Scissors status 0/1/2/other, Puzzle equal nonzero UInt16 tag; текущие consumer Frozen/Bound/Puzzle — собственная адаптация. Исходные target/Unbound/cost/caller ещё не доказаны полностью. |
| K4 · P04/P16 | [AZUR Shuffle/Hint @adb0657](https://github.com/DanilaH/mini-games-kit/blob/adb0657facebf8b5e3ed22369305ba509c988626/research/games/association-solitaire/2026-11-21-azur-shuffle-hint-native/README.md), [два Joker-фильтра](https://github.com/DanilaH/mini-games-kit/blob/adb0657facebf8b5e3ed22369305ba509c988626/research/games/association-solitaire/2026-11-22-azur-useful-moves/README.md). AZUR 1.3.3.8/code244; ELF SHA `27eb2e67ba00093ed575e16fc01a876a9e90fff8e53b504338047a4bf2c0d924`; NATIVE_STATIC. | ShuffleClosedCards RVA `0x26a4398`: closed tableau+stock после resetWaste, одна permutation, неизменные открытые позиции, Undo.Clear; отдельный spend/refund. Hint пять групп, свой Joker filter; Validator другой. Исходные RNG state, touch и активная политика не подтверждены. Позднее восстановление no-valid offer contexts учитывать по текущему рекламному ТЗ. |
| K5 · Проверенная собственная интеграция | [Generation acceptance @c4215e1](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/docs/qa/content-v8/HITAPPS_GENERATION_ACCEPTANCE_2026-11-22.md), PR #166–#172/#176, #177/#181/#185/#187/#189/#190. | Переиспользовать реализованные проверки и исходные fixtures. Исторические unit/browser отчёты относятся к указанным HEAD. Физический Android и слепой баланс не следуют из них. |

Нативные source-функции, на которые опирается новая реализация, открыть вместе с соответствующим verifier и точными границами. Для недостающих выдержек дополнить закрытое приложение kit с tool/version/RVA/hash, не публиковать оригинальные фрагменты здесь. Уже написанный собственный код и свидетельства выше доступны для интеграции; отсутствие полного оригинального Android не блокирует её целиком. Не приписывать этому ТЗ новые оригинальные запуски.

Архитектура K1: level inputs → вычисление effective budget из истории → fresh Initial/Shuffle/Final **либо** simulated кандидаты со Shuffle callback → Priority/Equality → Final → проверка конечного поля. У нас authoring строит сертифицированные варианты заранее; runtime выбирает соответствующий immutable Deal и создаёт Attempt через SaveStore. P06 history и P08 segmentation — разные входы. Спецэффекты/слоты/recovery меняют конечный контракт поля; их нельзя навешивать после выданной аттестации без повторной проверки.

Архитектура исполнения: request/quote с attemptId+dealId+revision → проверка допуска и права → вычисление результата/доказательство → **одна** запись SaveStore поля, ресурса и dedup → UI/звук/вибрация. Worker или анимация не владеют балансом. Не создавать параллельный whole-save writer. При отмене/ошибке записи никакой эффект не считается выданным.

## 4. Порядок разработки и точные изменения

### C1. Совместная выдача и конфигурация

**P00/P05/P06/P08/P09–P19/P31; доменная часть первого общего пакета B0.** C1 и B0 из [основного ТЗ](CORE_ADS_RELEASE_TZ_2026-11-24.md) — одна задача: здесь композиция поля/состояния, там сборка и manifest. Не создавать повторный PR на тот же контракт. После неё core-поток продолжает C2–C5; диагностические профили могут остаться для воспроизведения старых QA.

1. Разделить допуски generation/director/Equality/randomJoker/recovery/lives/specials и storefront. Один строковый `VITE_C8_OWNER_PREVIEW` больше не определяет взаимоисключающий состав продукта. Профиль не должен автоматически включать недопущенную Equality или настоящий SDK без своих условий.
2. Убрать продуктовую зависимость от ранних `return recoveryDeal` / `return randomJokerDeal` в `selectCampaignDeal`: сейчас оба варианта претендуют на L16 и обходят дальнейший director. Явно сформировать версионированный конечный Deal: выбранная основа/бюджет/спецправила/слоты/recovery → проверка совместимости и witness → commit новой попытки. Для неизменных полей переиспользовать существующие определения.
3. Если сочетание требует нового Deal ID, сохранить старое определение в `findDeal`; не переименовывать старую попытку, не менять её бюджет, структуру, права или Undo. Ключ награды за канонический уровень не должен дублироваться от новой ревизии.
4. Архивные, active и parked попытки продолжаются по своему договору даже после выключения выдачи нового варианта. Откат профиля прекращает новые назначения, но не отнимает уже полученное право.
5. Представить таблицу совместимости итогового каталога: base/генерируемый/Equality × Ordered/Keys/Frozen/Bound/Puzzle/Golden/starter × slots/recovery/Joker/Shuffle. Не требуется полный искусственный декартов набор; перечислить реально выпускаемые сочетания, запреты с технической причиной и следующий этап.

**Приёмка C1:** один и тот же build/SaveStore проходит L15→генерируемый L16, восстановление, ручной и случайный Joker на разрешённых состояниях, спецкарты и lives без переключения профиля. Включение одной возможности не отключает другую. Проверяется фактический новый Deal/manifest, а не только наличие кнопки.

### C2. Генерация, P06 и сохранённая P08-выдача

**Source IDs:** `hitapps-stock-dealer`, `hitapps-candidate-priority`, `hitapps-negative-seed-request-path`, `hitapps-initial-shuffle-final-pipeline`, `hitapps-feature-seed-one-time-reshuffle`, `hitapps-dynamic-difficulty`, `hitapps-easy-deals`, `unico-redeal-restart`, `hitapps-equality-paywall`, `hitapps-paywall-segmentation`, `hitapps-equality-three-stack-pair-placement`.

1. Переиспользовать `authorHitappsCandidate`, input hash, actual seed, final-board binding и bank verifier. Для каждого нового продукта назначения сохранять policy/config revision, base/effective budget, provenance и конечный Deal ID. Runtime не должен синхронно зависать на тяжёлом поиске; допустим заверенный bundled bank с явным fallback или ограниченный worker с тем же контрактом результата.
2. Довести P06 до общего профиля: запрос продолжения, повторный старт, победа обновляют соответствующие поля ровно один раз. `ContinueRequested` исходной истории — запрос, а не earned; не использовать его для выплаты. Restart имеет приоритет над ExtraSteps; history window/penalty сохраняются. Переключение режима и reload не создают новый исход.
3. Отдельно провести выбор EasyDeals после исчерпаний и обычную двухстороннюю коррекцию. Изменения относятся только к новой явно создаваемой попытке. Внутренний Restart уже начатой раздачи сохраняет договор; новый расклад — отдельное действие/ID.
4. Не считать текущую P08-конфигурацию настоящей сегментацией. Подключить проверяемый источник segment/provenance/config, явную `unknown` ветвь и выбранный non-IAP вариант политики. Отсутствие платежей само по себе не даёт права пометить всех как доказанных NonPayer оригинальной системы. `controlled-fixture` остаётся QA. Повторно не спрашивать, делать ли Equality вообще.
5. Расширить/подтвердить candidate bank под фактические используемые бюджеты и сочетания; не обещать квоту кандидатов, если поиск её не дал. Отказ аттестации, пустой банк, неизвестная когорта или неподходящий budget дают обычную проверенную выдачу; журнал фиксирует причину. Счётчики eligible/attempted/selected/issued/lost/completed не объединять.
6. Equality candidate допускается после двух различимых компетентных bot traces, ordinary-board controls, победного маршрута **на финальном поле** и независимого replay. Поздний проигрыш бота/UNKNOWN solver не является доказательством математической нерешаемости. Текущий L31 с запасом 6 ходов и одна UNKNOWN-ветвь требуют измерения человеческой сложности, а не молчаливой массовой активации.

**Приёмка C2:** положительная и отрицательная история меняют только будущее назначение; сохранены исходные C8/R1/R2/seed47/attested ID; банку нельзя подложить чужой бюджет/feature config/маршрут. В отчёте отделить успешную собственную адаптацию от невосстановленных исходных bot/pair/remote алгоритмов.

### C3. Спецкарты, слоты и помощники

**Source IDs:** `hitapps-ordered-category`, `hitapps-lockers`, `azur-extra-foundation`, `azur-bonus-lower-column`, `hitapps-frozen`, `hitapps-bound`, `hitapps-bound-scissors-pattern`, `hitapps-puzzle-top-bottom-cards`, `hitapps-golden-cards`, `hitapps-magnet-hammer`, `hitapps-joker`, `azur-joker-random-column-insertion`, `azur-shuffle-helper`, `azur-shuffle-animation-controller`, `azur-greedy-hint-order`, `hitapps-ghost-hint`, `unico-magnet-helper`.

1. Включить существующие версии Ordered/Keys/slots и собственные Frozen/Bound/Puzzle/Golden/starter правила в конечный каталог с доказанной решаемостью. Отделить маленькие tutorial/test fixtures от последовательности обычных полноценных уровней. Проверить unlock/обучение по фактической первой встрече, включая один и три ключа, совместное Puzzle+Ordered и несколько зависимостей.
2. Сохранить независимый cross-system oracle и контрпример Frozen–Scissors cycle. Для новой раздачи проверять наличие победы после **всех** размещений/Final эффектов; расход ходов, разблокировка, число физических карт и Undo должны совпадать с её сохранённой версией.
3. В source track Frozen добавить подтверждённую K2 truth table отдельно от `replayFrozenTransition`, где результат сейчас приходит как наблюдение. Нераскрытые entity/discriminator mapping и full melt schedule отметить явно. Не заменять действующее размораживание частичным предикатом. Scissors dispatch и Puzzle assembly аналогично не объявлять полными исходными правилами.
4. Ручной и случайный Joker оставить самостоятельными действиями. Для случайного определить обычный допуск и источник права/заряда в экономическом ТЗ; commit в одной транзакции списывает разрешённый ресурс, вставляет карту, отмечает использование и чистит Undo. Warning виден **до** согласия/списания. No proof, stale quote, отказ и ошибка записи сохраняют ресурс и Undo. Имеющийся ручной Joker сохраняет свой контракт отмены.
5. Для одной способности Shuffle подготовить source-derived вариант K4: общий pool скрытых tableau + stock после resetWaste, открытые позиции не трогать, исходные данные о charge/refund и очистке Undo учитывать явно. Не выпускать stock-only trial под именем точной копии AZUR и не плодить второй обязательный пользовательский Shuffle.
6. Перед принятием нового Shuffle-контракта показать warning об изменении Undo, явный grant/charge и результат независимого solver на собственном финальном поле. Рекомендуемая PRODUCT_ADAPTED политика no-op: не списывать ресурс за отсутствие изменения; исходный success при pool из 1 карты и identity permutation сохраняется в сравнительных fixtures. Старый stock-only Deal и его Undo остаются воспроизводимыми. RNG/стоимость/лимит являются версионированной политикой, не выдуманными live данными оригинала.
7. Safe Hint остаётся опорой для пользователя. Исходный five-stage greedy Hint и отдельный Validator тестировать как самостоятельные политики; не склеивать их Joker predicates и не превращать no-useful-move с положительным budget в автоматический проигрыш. Контекстные предложения по такому сигналу проходят отдельный контракт рекламного ТЗ.
8. **P17 Unico Magnet:** пока нет подтверждённого эффекта, не подменять его Hitapps starter Magnet или AZUR Shuffle. Следующий шаг — уточнить source effect/selection/charge и затем выпустить отдельную дельту; механизм остаётся в реестре. Это конкретный evidence gap, а не исключение из продукта.

**Приёмка C3:** одна реальная кампания демонстрирует выбранные способности; доказательства включают invalid transfer, Undo, отмену worker, reload и сочетания. Отдельно зафиксировать какие source rules адаптированы, какие подтверждены и какие остаются неизвестными.

### C4. Recovery, Unlimited и обычные жизни

**Source IDs:** `azur-coin-moves`, `azur-rewarded-moves`, `unico-loss-dialog`, `hitapps-revive-offers`, `hitapps-stock-restore`, `azur-unlimited-moves-offer`, `hitapps-lives`. Неплатные права и SDK-выдача описаны в [рекламно-экономическом ТЗ](ADS_ECONOMY_IMPLEMENTATION_TZ_2026-11-24.md). Здесь владелец доменного эффекта, Undo и expiry; там приобретение/выдача права. Это один согласованный контракт, не два конкурирующих обработчика.

1. Continue/Revive — одна способность продолжить исчерпанную попытку. Сохранить текущий proven-tail +10 контракт и каналы coins/earned; название Revive не создаёт вторую независимую выдачу или возможность удвоить continuation. `continued`/receipt и quote защищают один и тот же результат.
2. Расширить finite recycle/restore на предназначенные новые Deal, вместо единственного QA L16. Бесплатное первое восстановление и последующие coin quotes учитывать по конкретной версии политики; restore stock не означает добавление ходов. Старые unlimited recycle не ограничивать задним числом.
3. Unlimited использует существующие retainedMoves/expiry, но получает самостоятельное неплатное право с id, scope, issuedAt/deadline и основанием выдачи. Подключить его без `storefront.accountId`/paid order. Бесплатные 120 с trial не считать утверждённой наградой. Позднее платное право может использовать тот же effect, сохраняя собственный purchase provenance.
4. Истечение/отзыв Unlimited корректно восстанавливает конечный бюджет в active, parked и Undo snapshots; уже выигранное поле не превращается в проигрыш. Время назад не продлевает право. Повторный receipt/повторная кнопка не создают второе право.
5. Lives включаются отдельно от магазина. Сохранить однократный `lostLife` и явный gate нового начала; проверить Next, level menu, Restart, redeal, запуск приложения, возврат из daily и обе parked попытки. Возобновление уже принадлежащей игроку партии не должно внезапно стать новой оплачиваемой попыткой.
6. Если жизнь восстановилась таймером, пока шла реклама, earned сохраняется как кредит, а не теряется и не превышает cap. При no-fill ни списания, ни гранта; clocks и изменения попадают в тот же SaveStore. Параметры 3 жизни / 5 минут / 50 монет являются текущими preview значениями, не доказанным балансом оригинала.

**Приёмка C4:** все четыре разных ресурса — ходы, recycle, Unlimited и lives — проверяются отдельно; purchase-провайдер отсутствует, но предусмотренные coins/free/RV пути остаются достижимы.

### C5. Обучение, обратная связь и состав готового кора

**P04 source IDs:** `azur-action-ftue`, `azur-difficulty-label`, `azur-locked-helper-discovery`, `ui-motion-audio-coin`, `azur-card-dictionary`, `azur-stock-side-setting`, `azur-card-animation-controller`, `azur-coin-flight-animator`, `azur-victory-reward-sequencer`, `azur-button-haptic-feedback`, `hitapps-invalid-transfer-feedback`. Серии/косметика связаны с отдельными ТЗ своего потока, не заменяются этим перечнем.

Сохранить `tutorial.ts::ruleIntroMarker`, обучение на подтверждённом действии, `specialCardCues` и готовый wallet feedback. В общий профиль включить выбранные AZUR draw/invalid/coin-landing эффекты из PR #189 без зависимости состояния от длительности анимации. Проверить первый экран без автоскролла, 320×568 и 390×844, три/четыре/пять столбцов, все позиции колоды, баннерный inset, быстрые нажатия, reduced motion и background во время перелёта. Изменение экономики победы и счётчиков рекламы выполняется по своему ТЗ, а не через анимационный callback.

## 5. Соответствие существующей очереди

| Пакет | Работа этого ТЗ | Граница с остальной очередью |
| --- | --- | --- |
| P00 | C1: совместные настройки и конечная выдача | Release workflow, подпись и проверка собранного manifest — основное ТЗ. |
| P04 | C3: safe Hint/source diagnostic; C5: FTUE/feel | Серии и косметические награды остаются в своём потоке. |
| P05 | C1/C2: вход/фазы/бюджет/конечное поле | AZUR generation и native no-valid diagnostic не объявляются точным Hitapps dealer. |
| P06 | C2: два направления будущей сложности и EasyDeals | Новые численные условия проходят собственную баланс-приёмку. |
| P07/P08 | C2: кандидатная архитектура, аттестация и настоящая выдача | Source bot/pair gaps и provenance сегмента остаются явными. |
| P09–P14 | C3: версия правил, состав уровня, независимая решаемость | Заработок Golden и приобретение слотов согласуются с общей экономикой. |
| P15 | C3: отдельный случайный Joker и атомарное применение | Acquisition/charge — рекламно-экономическое ТЗ. |
| P16 | C3: единый Shuffle с явно выбранными правилами | Исходный и старый stock-only контракты не смешиваются при миграции. |
| P17 | C3: конкретный evidence gap и следующий source-шаг | Механизм остаётся в roadmap до собственного подтверждённого переноса. |
| P18/P19 | C4: продолжение, stock restore, Unlimited | Grant/SDK и предложение игроку — общий экономический контракт. |
| P31 | C4: lives gate обычной кампании | WeekendRace/Lava/GoldRush сохраняют отдельную приёмку в потоке событий. |
| P33–P35 | Совместимость выдачи и сохранения существующих вариантов | Длинная кампания, локализация и remote delivery остаются самостоятельными задачами общей очереди. |
| P02/P37 | Полный кандидат после C1–C5 | Физический Android, человеческий баланс и релизная сдача — основное ТЗ. |

## 6. Проверки для сдачи каждого изменения

| Риск / сценарий | Независимый критерий результата | Переиспользовать и дополнить |
| --- | --- | --- |
| Состав и выдача | Один manifest/build показывает совместную работу принятых систем; initial/final board и budget совпадают с сохраняемым Deal. Рекламный/магазинный флаг не меняет выбранный кор. | Catalog selection + integrated browser smoke; existing content8/history fixtures. |
| Генерация после Final | Победный witness полностью проходит engine и отдельный `tools/qa/gameplay-oracle.ts`; испорченная фаза/feature/seed отвергается. | `tests/unit/hitapps-pipeline.test.ts`, `hitapps-authoring.test.ts`, `hitapps-director-bank.test.ts`; profile run reports. |
| P06/P08 | Проверки 10 слотов, ExtraSteps vs Restart, two-step sign crossing, int32/float32 ties, wrong segment/budget/config/hash, duplicate issuance. Ordinary controls отличают слабого бота от селектора. | `difficulty-source-slot.test.ts`, `difficulty-director.test.ts`, `equality-issuance.test.ts`, `equality-counterfactual-bots.test.ts`, `qa:hitapps-balance`. |
| Спецзависимости | Известный цикл действительно не имеет решения по исчерпывающему графу; исправленный и выпускаемые сочетания имеют независимый путь. | `content8-special-authoring-cycle.test.ts`, `content8-hitapps-specials-triplet.test.ts`, `hitapps-special-transitions.test.ts`. |
| Ресурсные операции | Stale/double action, save reject и replay не меняют кошелёк/право дважды; нет списания на отмене/no proof. | `random-joker-game.test.ts`, `content8-shuffle.test.ts`, `campaign-recovery.test.ts`, `campaign-lives.test.ts` + новые cross-feature cases. |
| Сохранение | C1–C8/старые R1/R2/Equality, active+parked, Undo и уже earned права читаются до/после обновления и после отката выдачи. | Текущий codec/SaveStore suite; actual persisted input, не искусственный reset профиля. |
| Человек и устройство | Уровни проходят касанием; видны цены, предупреждения и эффект. Отдельный слепой playtest сложных веток измеряет попытки/ошибки/подсказки, не подменяется bot win. | Signed exact-head APK, запись реального input/GIF, данные QA; особое внимание 11 уровням с малым запасом ходов и Equality L31. |

Проверки выбираются по затронутой дельте, существующие suite не переписывать для зеркалирования реализации. На интеграционном кандидате обязательны общая регрессия правил/архивных раздач/SaveStore и профильный browser/Android прогон. Ни зелёный CI, ни наличие native-static фрагмента не означает original-runtime parity или принятый баланс.

## 7. Параметры и ещё открытые части

| Вопрос | Текущая граница | Следующий конкретный результат |
| --- | --- | --- |
| Баланс P06 / lives / recovery / помощников | Текущие 70/90, −5/+10, 3 поражения; lives 3 / 5 минут / 50; restore 0, затем 60+30; continue +10/120; Unlimited 120 с — разные собственные preview контракты. | Таблица версии релизной экономики с обоснованием, численным прогоном и человеческой приёмкой; не объявлять эти числа значениями оригинала. |
| Equality segment и live policy | Одна controlled fixture не закрывает происхождение сегмента и продуктовый rollout. | Проверяемый provider/собственная явно названная политика, bank coverage и human acceptance; до этого ordinary fallback, работа по остальному кору продолжается. |
| Исходные Frozen/Scissors/Puzzle и pair transform | Часть source helpers подтверждена, полная последовательность не восстановлена. | Закрытые native evidence/контроли для названных функций; независимая приёмка текущей PRODUCT_ADAPTED версии отдельно. |
| Исходный Shuffle RNG / native feel | Исторический статический контракт не даёт живое RNG state и физические тайминги. | Собственный детерминированный контракт+oracle и device UX; exact-source результаты отдельно по фактически исполненным оригинальным функциям. |
| Unico Magnet | Полный эффект/расход неизвестен. | Исходное доказательство и самостоятельный перенос; не скрывать gap за другим помощником. |

После каждого scoped PR обновлять ledger/progress по реальным source IDs и результатам: **написано → включено → проверено на устройстве → принято** — отдельные факты. Указывать тесты, точный HEAD, APK, демонстрацию и открытые вопросы. Не пересоздавать уже реализованные #164/#174/#179/#180; использовать их как ancestry/evidence, а новые изменения оформлять как оставшуюся интеграцию и исправления этого ТЗ.

**KIT IMPACT: REUSE** исследовательского метода, source proofs и существующего runtime; новый API kit этим ТЗ не требуется.
