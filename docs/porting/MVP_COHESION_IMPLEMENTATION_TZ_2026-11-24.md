# ТЗ разработчику: исправления PR201 и целостность первого выпуска

**Дата:** 24 ноября 2026. **База:** [PR201](https://github.com/DanilaH/asoc-solitair/pull/201), `23e71a898fd69b86b702ce074621637bcf82432e`. **Область:** обычный `c8-release-v1`, Android и его browser test surface. **Основание:** [повторная техническая проверка и продуктовый аудит](PR201_RECHECK_2026-11-24.md).

## 0. Задание и порядок

Довести уже собранную C8-игру до согласованного первого выпуска: исправить подтверждённые ошибки, соединить получение/использование ресурсов, сделать попытки и награды понятными, убрать два лишних входа без потери систем, подготовить проверяемую итоговую сборку. Применить дельту к реальному HEAD, а не повторять B0–B4.

| Этап | Задачи | Результат |
| --- | --- | --- |
| 1. Точечные исправления | F1 ILRD intake, F2 clock acquisition, F3 Daily telemetry | Ошибки воспроизводятся тестом до fix и отсутствуют после; обычные исправленные пути PR201 сохранены |
| 2. Кор и ресурсы | C1 unused Random Joker, C2 Shuffle, C3 retry/lives | У оплаченного/выданного ресурса понятны владение и применение, у проигравшего есть штатный путь новой попытки |
| 3. Награды и интерфейс | U1 Bonus, U2 resource surfaces, U3 Tasks, U4 Home/free bonus, U5 legacy claims | Обычные состояния закончены, готовые права доступны, нет лишних витрин и ложных обещаний |
| 4. Приёмка | V1 точная сборка, targeted regressions, device/ads/human evidence | Один идентифицированный кандидат и честная таблица закрытых/внешних гейтов |

F1–F3 можно делать независимо. C1 и C3 согласовать до тестов новых попыток. U1/U2 используют один Bonus-state selector; U3 и U5 имеют разные claim owners. U4 сначала сохраняет право на бесплатные 10, затем снимает витрину. Scoped PR допустимы, но итоговая проверка относится к общей сборке.

### Не переделывать уже сделанное

Сохранить RevenueOutbox/RevenueDelivery, P25 dispatcher и ordinary signals, общий Definition, Android elapsed clock в обычном успешном сценарии, исправленный Shuffle manifest, генераторы/Rules3, SaveStore, native receipts и действующие proof helpers. Экономическая таблица и witness L1–80 уже есть в [C8_RELEASE_AUDIT_FOLLOWUP](C8_RELEASE_AUDIT_FOLLOWUP.md); дополнять их дельтой и результатами, не создавать заново.

### Решения этого ТЗ

Рабочие продуктовые решения ниже являются **PRODUCT_ADAPTED кандидатами**, заданными для реализации и проверки по результатам аудита, а не установленными правилами референса или уже принятыми live-числами:

- unused Random Joker хранится до успешного применения;
- первый Shuffle доступен через однократный учебный grant; дальнейшие места использования ограничены проверенным набором;
- готовые старые награды остаются доступными;
- существующий free monthly10 начисляется автоматически вместо отдельной витрины;
- убирается только повторный Home-вход в оформление.

Цены, платёжные SKU, рекламная частота, live квоты и веса наград этим ТЗ не перенастраиваются. IAP не подключать. Все 115 ID/38 пакетов/15 commercial families остаются в общей дорожной карте. AdsBreak/Coffee — одна продуктовая пауза; manual/random Joker, stock/moves/lives/Unlimited и free/rewarded не смешивать.

## 1. Общие инженерные ограничения

Перед работой прочитать текущий AGENTS, [метод](RESEARCH_METHOD_2026-11-24.md), [ledger](ADOPTION_LEDGER.json), [queue](DELIVERY_QUEUE.json), соответствующие specs и реальные call sites. При новом HEAD сначала подтвердить, какие пункты уже закрыты.

SaveStore остаётся единственным сериализованным владельцем записи. Debit/grant/claimed marker/attempt identity фиксируются одной согласованной операцией. UI/render не начисляет награды и не создаёт случайный round. Повторный tap, stale state, ошибка записи и ambiguous-write recovery не создают вторую выплату. Native ILRD имеет собственную очередь; её исправление не меняет кошелёк или rewarded receipts.

Сохранить старые save namespace, active/parked attempts, карты, бюджеты и Undo, issuance/provenance, уже earned/consumed права, frozen task/event definitions и настройки. Новым композициям выдавать новые Deal IDs; существующие доски не переписывать. Версионировать изменённый contract в принятом механизме версии политики, не повышать глобальные rules/content/balance без нужды и миграции.

## 2. F1 — надёжный первый приём ILRD

**Проблема:** `SolitaireAdsPlugin.impression` помечает session impressed до записи события. Первая AtomicFile failure оставляет ни pending, ни повторного приёма; повтор callback отбрасывается. После успешного durable receive очередь и backoff уже работают.

**Файлы:** `native/android/app/src/main/java/com/danilah/asocsolitair/{SolitaireAdsPlugin,RevenueDelivery,RevenueOutbox,SolitaireApplication}.java`; existing JVM tests и analytics contract.

### Реализовать

1. Разделить замеченный callback и подтверждённый durable intake. `QUEUED`/`DUPLICATE`, queue-full и I/O failure должны иметь различимые результаты; флаг Session не означает успешную запись до её подтверждения.
2. При временной первой I/O error удерживать исходный нормализованный payload и стабильный deliveryId в ограниченном process-wide intake и повторять запись с backoff. Повтор не зависит от повторного SDK callback, Activity, WebView или незакрытого fullscreen. Banner использует тот же надёжный capture path.
3. Retry сохраняет amount/currency/format/placement/ID; повторная нормализация и новый ID не создают второе событие. После durable acceptance действующая outbox берёт доставку на себя.
4. Ограничить память intake, явно диагностировать full/drop/ошибку. Существующая bounded durable queue сохраняет принятые события. Не блокировать игру/earned выдачу ожиданием аналитики.
5. Не называть SDK handoff серверным подтверждением. Crash после SDK call до local ACK допускает resend с тем же ID. Проверить дедупликацию денежного агрегата по deliveryId в разрешённой выгрузке или принимающем расчёте: наличие ID в параметрах события само по себе не доказывает идемпотентность AppMetrica. Для process death до первой возможной записи зафиксировать предел гарантии, без fake forwarded.

### Приёмка

Первая запись падает один раз, SDK больше callback не повторяет, fullscreen закрыт; диск восстановлен → исходный event durable принят и передан SDK ровно один раз в этом процессе. Дополнительно: callback duplicate до/после intake, Activity destroy, SDK exception, ACK-write failure, pending после process restart, queue full, permanent storage failure. Ни один scenario не создаёт reward или зависимость игрового ввода от telemetry. Сохранить положительные тесты PR201.

## 3. F2 — Unlimited без небезопасного Android fallback

**Проблема:** при отказе `readRecoveryClock` Android factory возвращает page anchor, покупка остаётся разрешена. Через process restart с rollback календаря право может получить добавочное время. Обычный Android-bound elapsedRealtime путь исправлен.

**Файлы:** `src/platform/recovery-clock.ts`, `src/domain/campaign-recovery.ts`, `src/main.ts`, `src/platform/storage.ts`, `SolitaireStoragePlugin.java`.

### Реализовать

- Clock сообщает пригодность native anchor для восстановления после процесса. Перед новым timed debit/grant или расходованием ранее earned timed права на Android требуется пригодный native snapshot.
- При временной недоступности: не списывать монеты, не создавать новое право, не помечать earned entitlement использованным; показать «Не удалось проверить срок. Повторить» и оставить игру доступной. Исходный срок earned права не приостанавливать и не продлевать из-за отказа. После восстановления допустимое действие возможно один раз. Browser page clock остаётся явно ограниченной test/browser политикой.
- Уже сохранённое timed page-bound право на Android при несопоставимой timeline не переякоривать с дополнительным сроком. Для такого неизвестного остатка применять консервативное завершение с восстановлением finite budget/Undo и понятным сообщением. Срок старого indefinite права не придумывать; другие earned ресурсы не отнимать.
- Сохранить atomic debit/right/anchor, same-boot restart, background resample, текущую boot-change политику, won-board protection и remaining duration earned. Цена 120/срок 60sec остаются текущими кандидатами, не новыми принятыми live-параметрами.

### Приёмка

Обязательный regression: native read rejects при wall100000 → покупка 60sec →60real seconds → restart с wall110000 и здоровым native clock. После fix небезопасная покупка не произошла; старый page-bound fixture не получает ещё 50sec. Проверить no-debit/no-consume, recovery повтор, active/parked/Undo, deadline-only legacy, indefinite, won, earned remaining, boot change и save failure. Физический фон/перезапуск/смена часов — V1, после engineering checks.

## 4. F3 — Daily analytics с правильным dayId

**Файлы:** `src/main.ts`, `src/platform/{analytics,telemetry}.ts`, `analytics-contract.json`, native contract generation.

Передавать обязательный string `dayId` из фактической Daily attempt для `daily_start` и подтверждённого Daily completion для `daily_completion`. Не вычислять его заново по текущей дате: ночью может завершаться сохранённая партия. Сохранить существующую семантику first accepted action/start и реального daily reward completion; тренировочный replay не должен изображать ещё один ежедневный claim.

Проверить цепочку actual producer → contract validator → transport на обычном Daily UI. Позитивный тест должен видеть оба Daily events с правильным ID и generic level_start; malformed event по-прежнему отвергается. В рамках продолжения той же сохранённой Daily-партии reload/park/resume/полночь не меняют её ID и не создают новую попытку. Законный запуск следующего Daily остаётся отдельным действием. Если типы уже не позволяют забывать обязательные поля, использовать их; отдельную новую analytics-platform не строить. В итоговом evidence отличать best-effort event transport от durable reward settlement и от подтверждённого AppMetrica приёма.

## 5. C1 — непотраченный случайный Джокер сохраняется до применения

**Сейчас:** `random-joker.ts` списывает 250 и создаёт `attempt.randomJokerAccess`; новая Attempt этот unused grant теряет. Text «в этой партии» появляется после оплаты, общий abandon dialog обещает сохранение помощников.

**Целевой договор этого ТЗ:** купленный отдельный заряд принадлежит сохранённому профилю до успешной вставки на совместимой раздаче. Эффект после применения принадлежит конкретной доске. Ручной Joker не меняется.

### Реализовать

1. Перенести владение unconsumed charge в устойчивое существующее хранилище прав. Не создавать вторую копию wallet. Сохранить id/provenance/consumed и доступность на поддерживаемых раздачах.
2. Мигрировать валидные сохранённые unconsumed grants активной и отложенной попытки идемпотентно; одинаковый grant ID не дублировать. Consumed не восстанавливать. Историю ранее уже потерянных прав без записи не выдумывать.
3. До оплаты объяснить цену, применимость и сохранение unused заряда после restart/смены уровня. До применения сохраняется предупреждение о случайном столбце и очистке Undo.
4. Успешная текущая proof-вставка атомарно расходует ровно одно право и очищает Undo. Отмена, unsupported deal, proof UNKNOWN/timeout, stale revision и failed save заряд не расходуют. На несовместимом уровне запас виден, применение не обещано.
5. Согласовать новый договор с C3 и всеми abandon/restart текстами. Текущую цену не менять, manual stock не пополнять этим grant.

**Приёмка:** купить → отменить вставку → restart → переключить Daily/назад → уйти на несовместимый уровень → вернуться в новую совместимую попытку L16 → reload → применить один раз. Ordinary Random Joker сейчас есть только наL16; расширение его доступности этим ТЗ не задано. Отдельно проверить повтор миграции того же grant и уже импортированный ID, consumed fixture, fail/ambiguous write и двойной tap; не строить заведомо невалидный save с двумя campaign attempts. Карты, кошелёк, право и Undo должны соответствовать одной подтверждённой операции.

## 6. C2 — первое и дальнейшее применение Shuffle

**Сейчас:** заряд 0; обычное применение только L30; свои Tasks не дают Shuffle; Daily Bonus после unlock случайный. Уже полученный сегодняшней датой Bonus не даёт гарантированного первого заряда. После L30 новый loot продолжает обещать ресурс без следующего обычного места использования.

**Файлы:** `src/content/campaign.ts`, candidate bank/issuance, `src/domain/proof-shuffle.ts`, `events/daily-bonus.ts`, common inventory, `c8-release.json`, helpers UI.

### Реализовать

1. При первом достижении unlock L30 выдать **один учебный Shuffle** в общий существующий запас. Это новый собственный candidate grant: отдельный постоянный ключ и versioned policy; он не зависит от даты, Daily Bonus, рекламы и текущего случайного stock. Для старого профиля с достигнутым unlock и отсутствующим intro-marker выдача один раз; прежний stock не заменять. Новое применение/перезапуск не повторяют intro grant.
2. Показать короткое объяснение применения и заранее предупредить об очистке Undo. Приз и intro-marker сохранять вместе; rendering сам grant не выдаёт. Успешный Shuffle расходует 1 существующим owner; UNKNOWN/отмена/ошибка ничего не списывают.
3. Подключить тот же `hidden-pool-r1` proof Shuffle на **L33 «Выбор из колоды», L36 «Верхние слоты», L39 «Передышка»**. Их исходные IDs — `campaign-c8-wave-033/036/039`; обычная композиция не заменяет их special/bonus override. Проверенный initial pool stock+hidden:60/74/41. Точный `canShuffle` допускает 14 исходных/budget/generated вариантов с 1 зарядом; это структурный допуск, **не доказательство успешного shuffle**. В PR перечислить новые IDs всех реально выдаваемых вариантов и выполнить final-board proof при исходном остатке ходов. Если конкретный вариант не проходит, безопасный no-op не выдавать за готовый учебный сценарий: подобрать и аттестовать собственную совместимую композицию того же уровня, не переписывая старые IDs.
4. Сохранить replay совместимых уже открытых уровней как способ использовать имеющийся запас. В Helpers при 0 показать реальное пополнение и его случайность. Нельзя обещать Shuffle на неподдерживаемом текущем поле.
5. Eligibility новых Shuffle rewards связать с этой картой применения: после прохождения последнего совместимого уровня из L30/33/36/39 **не включать Shuffle в новый Daily Bonus pool**. Это изменение eligibility, а не скрытое изменение числовых весов остальных наград; сохранять действующий механизм выбора среди допустимых prizes. Уже созданные rounds с frozen Shuffle prize и весь ранее выданный inventory сохранить. Для их применения оставить replay этих уровней и понятную подпись. До завершения последнего поддерживаемого уровня случайный источник пополнения остаётся.
6. Текущий `shuffleBySource` построен из recovery-обёрток L16/L22/L30. Простого расширения фильтра недостаточно. Новую Shuffle-обёртку применить **после** authored/adaptive/generated selection независимо от recovery; не добавлять L33/36/39 finite recycle, StockRestore или Unlimited только ради Shuffle. Новые композиции/права capability имеют новые immutable IDs; старые L30, running/parked boards и Undo не заменяются при upgrade. Сохранить own proof/seed и legacy stock-only preview отдельно, не менять их молча на оригинальный RNG.

**Приёмка:** fresh profile с нулём случайных Shuffle доходит доL30 и штатно получает/применяет учебный заряд; уже claimed сегодняшний Bonus не мешает. Старый достигший L30 профиль получает intro один раз. На всех перечисленных будущих final boards проверить положительное применение и отрицательные UNKNOWN/timeout/stale/save cases, запас после reboot и неизменность archived deals. Визуальный manifest показывает реальную применимость, не только `active`.

## 7. C3 — понятные повтор, новая попытка и жизнь

**Сейчас:** replay запускает restart той же доски; новый adaptive selector вызывается через вход в уровень. После текущего порога поражений помощь существует, но ordinary loss не даёт столь же ясного доступа.

### Реализовать

- Оставить отдельное действие **«Повторить этот расклад»** с прежними Deal/issuance и правилами.
- Когда текущая политика разрешает новую/облегчённую выдачу, показать на обычном поражении **«Новая попытка»** через существующий `selectCampaignDeal/openLevel` путь. Не использовать старый L11–15 `otherC8Layout` как замену всему L16+ bank.
- Label описывает реальный результат: если отличается только budget, не обещать другую геометрию. По возможности показать разрешённый новый лимит. До порога/в Daily/на unsupported сценарии ложного облегчения нет.
- Creation, carry истории, consumed exhaustion identity, жизнь и issuance фиксируются согласованно через SaveStore. Double tap/reload не дают дополнительной попытки, облегчения или второго списания. Активную и отложенную доску задним числом не адаптировать.
- Перед первым соответствующим действием объяснить: жизнь списывается один раз при старте следующей попытки после исчерпания; выход домой/переход в Daily сам по себе её не тратит. При 0 оставить фактический бесплатный таймер, доступный Daily, coin/RV alternatives. Если Daily ещё не открыт, не обещать вход до его текущего unlock.

**Приёмка:** на подходящем L16+ обычными действиями накопить текущий порог поражений; сравнить fixed replay и новую выдачу по ID, effective budget, истории и lives. Проверить no-fill/zero resources, cancel, repeated tap, restart app, old L11–15, сохранённый Random Joker из C1 и earned recovery. Пороги сложности, 3/5min/50coin lives policy этим заданием не перенастраиваются.

## 8. U1 — законченный Daily Bonus lifecycle

**Сейчас:** при UTC midnight открытый незавершённый round оставляет активные карты, reveal возвращает false. Старый выигранный unclaimed prize домен сохраняет правильно.

Один state selector используется в Home, модальном окне, Helpers/context entry и обработчиках:

| Состояние | Подача и действие |
| --- | --- |
| Раунд отсутствует либо сохранённый round прошлого дня уже claimed | «Открыть бонус дня»; создавать round только действием |
| Сегодняшний незавершённый | «Продолжить бонус»; тот же сохранённый порядок и открытые карты |
| Сегодняшний или старый выигранный, unclaimed | «Забрать приз» по сохранённому round ID, без reroll |
| Сегодня claimed | «Бонус получен» и фактический следующий reset |
| Старый незавершённый | Карты недоступны; «Начался новый день» и «Открыть новый бонус» |
| Сохранённый round позже текущей даты устройства | Понятная недоступность; без reroll/двойного grant/замены будущей записи |

Приоритет selector: сначала сохранённая будущая дата — временная недоступность без изменения записи; затем won/unclaimed — получение прежнего приза; затем остальные состояния. Пересчитывать на open/store change/day refresh/foreground и перед tap. Пересечение полуночи между render и tap не превращает старый tap в случайное действие нового round. Старый выигранный prize сначала атомарно получить, затем показать явную возможность открыть сегодняшний. Сохранить возврат из Helpers в прежний контекст.

**Приёмка:** открытое окно через midnight/background; same-day reload; старый won через несколько дней; duplicate claim; write fail/recovery; rollback даты; совпадающее состояние Home/Helpers. Никакой активной молча неработающей карточки и ни одного потерянного earned prize.

## 9. U2 — запас, адресное пополнение и ясные состояния

### Запас до открытия

Для ранних Hint/Undo/manual Joker сохранить Bonus pool, значения и eligibility использования/покупки/RV. Изменение eligibility Shuffle выполняется только по C2, без скрытого изменения остальных весов. Через существующее окно Helpers дать после L1 clear/L2 read-only доступ к запасу ещё закрытых инструментов. Пример: «Джокер +1. В запасе:2. Откроется на уровне 8»; учитывать стартовый stock, не путать delta с total. Hint/Undo/manual Joker читать из profile, Definition через общий `definitionCount`, Shuffle и отдельные права — из канонических owners.

Проверить отдельные ранние награды Hint/Undo/Joker, reload, отсутствие использования до 3/4/8 и тот же stock после unlock. L1 обучение не перегружать новым popup. Random Joker и timed Unlimited не добавлять к manual Joker count.

### Адресность P25

При shortage сначала показывать запрошенный ресурс и реальные способы его получения. Сейчас 0Definition может выдавать рекомендацию «Бесплатные монеты», хотя coin→Definition покупки нет. Для Definition указать существующий случайный источник Daily Bonus, его фактическую доступность/claimed/reset; не обещать нужный приз. Новую цену/гарантированную выдачу UI сам не создаёт.

Сохранить working0coin/0Hint handlers и durable P25 reservations. Если покупка невозможна, понятный CTA пополнения заменяет disabled тупик; факт не даёт reward и не считается MakePurchase. Повтор/reopen/stale context не порождает новую выдачу.

### Free и RV

Показывать понятные available/free claimed/RV ready/no-fill/unavailable/cooldown/limit states там, где игрок ищет пополнение. Pending request/quote/shown не означают earned: ожидание видео и уже заработанная награда, ожидающая сохранения, имеют разные состояния. Использовать реальные quote/resource/policy owners; не выводить своё предположение из одного feature flag. Free claim не зависит от SDK. Сохранить текущие UTC и rolling24h правила каждого канала и отдельные nonces.

Post-win x3/x5 касается только сохранённой базовой части. Текст должен ясно показывать точную доплату либо явно объяснять базу, без обещания умножить весь результат. Уже зафиксированный victory breakdown не пересчитывать.

**Приёмка:** обычные 0coins/0Hint/0Definition, Bonus ready/claimed, free до/после, RV ready/no-fill/cooldown, pending/failed save и reload. Обещанный UI ресурс соответствует фактической выдаче. QA offer panel и merchant не нужны для этих сценариев.

## 10. U3 — Daily/Tasks/weekly и старые выполненные награды

Названия: **«Ежедневный уровень»**, **«Бонус дня»**, **«Задания»**. Последнее содержит «Сегодня» и «Бонус недели». Это три разных механики; их данные не объединять.

Home Tasks: сначала ready count, иначе сегодняшнее X из 4, после завершения — «Сегодня выполнено» и reset. Weekly до 5 показывает прогресс и 20coin prize; при ready — claim; после — «Бонус недели получен». Можно отдельно показать фактические накопленные медали, но не оставлять незавершённую цель 12/5.

Daily Level сохраняет local day. Bonus/Tasks —00:00UTC; weekly —понедельник 00:00UTC. Показывать соответствующую локальную дату/время пользователя, не менять старые IDs/календарь ради унификации. Проверить UTC и UTC+5, полночь и foreground.

### «Награды прошлых дней» в существующем окне

Показать только сохранённые завершённые unclaimed tasks и ready milestones прошлых недель. Дата, исходное условие, сохранённый prize/bundle, кнопка «Забрать»; от старых к новым. Использовать existing `claimTask/claimTaskMilestone`, original day/week/IDs и frozen amounts. Старые медали поступают своей неделе; после claim последнего нужного task появляется milestone той недели. Текущие награды не дублируются в архиве.

Incomplete/не созданные дни не становятся earned, неизвестную историю не дорисовывать, журнал до безопасного claim не обрезать. Новая наградная валюта/ledger не нужны: реальные domain probes уже подтвердили old task→old week→однократный milestone.

**Приёмка:** вчерашний task после midnight/reload; task прошлой недели и её milestone при новой week0; duplicate taps; incomplete старый task; fail/ambiguous write; empty state; правильный Home ready count. Суммы,4tasks и один weekly milestone остаются текущими; full source28/five milestones остаются дорожной картой.

## 11. U4 — Home, оформление и бесплатный месячный бонус

### Два простых изменения подачи

Убрать только повторную Home-плитку `looks-open`. Milestone, Settings→оформление, примерка, палитры/рубашки/расположение колоды и saved selection сохранить. Поправить DOM bindings/meta-ui, чтобы исчезнувший элемент не ломал render и не оставлял пустую ячейку.

После 80/80 показывать завершённую кампанию, Daily и replay. Сохранить приоритет «Продолжить/Результат», если уже есть текущая попытка. Убрать недостижимые first-clear обещания нового цикла «Пять побед» и месяца; накопленные ledgers не обнулять. Недостающие победы не дарить и replay за first-clear не считать. До 80 достижимость месячной цели считать как `currentMonthClears + remainingFirstClears >= 3`: при 79/80 и текущих 2/3 она ещё достижима. Уже готовые права сначала рассчитать. Статус «Бонус месяца получен» относится к текущему UTC-месяцу; получение готового прошлого месяца само по себе его не включает.

### Вместо самостоятельного «Магазина кампании / Пропуска сезона»

Сохранить существующую бесплатную механику **+10 coins за 3 first campaign clears в UTC-месяц**, начислять автоматически и показывать короткой строкой в обычном прогрессе. После — «Бонус месяца получен». Standalone `campaign-store-open` убрать из ordinary release. Полная Play Pass/commercial family остаётся в roadmap/QA; это не её завершение или исключение. Shop free30, RV30 и остальные рекламные каналы сохраняются независимо.

**Порядок сохранения важен:**

1. Небольшая domain operation принимает сохранённый валидный `storeProgress` не из будущего: `clears>=3 && !freeClaimed` → ровно 10 и `freeClaimed` в той же транзакции. Старый manual claim с current-month check не подходит для готового прошлого месяца.
2. На ordinary boot/resume рассчитать такое ready право через SaveStore до возможной замены record. В одной операции нового first clear: settle прежний ready → record нового clear/month → settle вновь достигнутую цель. Одно значение времени на операцию.
3. `freeClaimed:true` не выдавать снова; прошлый incomplete не превращать в grant. Уже перезаписанную старым кодом неизвестную историю не восстанавливать по общему wins. При rollback календаря будущий record не выдавать и не переписывать.
4. Подтверждение+10 показывать после commit. Не добавлять 10 в win multiplier base и не учитывать как рекламный доход. Premium/piggy fields не менять ради free UI.

**Приёмка:**2→3→4first wins, replay/Daily, ready current/previous month, claimed, old incomplete2, future-period rollback, boot+first-clear race, save failure/recovery. Old ready award не теряется при новом месяце; duplicate не выдаёт повтор. 79/80 и 80/80 с ready prize, active replay и parked campaign; Home после 1/2/10/20wins без двух одинаковых входов в оформление.

## 12. U5 — доступ к уже заработанному в выключенных LiveOps

При наличии готового сохранённого milestone открыть компактный **claim-only** вход «Заработанные награды событий ·N» для allowlist:

- `hitapps-weekend-race`;
- `hitapps-lava-quest`;
- `hitapps-gold-rush-event`.

Читать frozen definitions/amounts из сохранения; не создавать текущие events, не добавлять progress от новых wins и не активировать LIVEOPS_PREVIEW. Claim через existing ledger с повторной проверкой key/allowlist/readiness внутри write. После последнего — «Все награды получены», затем entry исчезает.

**Picture исключён из generic milestone claims.** У него свой `claimPicture` после открытия частей; существующий `PICTURE_PREVIEW || save.picture` gallery/token путь сохранить. Открытие arbitrary `save.events` через общий claim может обойти условия картинки и запрещено.

**Приёмка:** valid old ready старше 4 недель, claimed/incomplete/no records, duplicate/reload/failure, последняя награда. Рядом Picture с накопленными wins, но не всеми частями: generic list его final prize не выдаёт. Fresh profile не получает новые события. Это совместимость старых прав, не запуск большого LiveOps в первом выпуске.

## 13. V1 — что предъявить на приёмку

### Автоматическое и инженерное делает разработчик

- Для F1/F2/F3 — failing-before/fixed-after targeted tests на настоящих production call paths с явно указанными adapters; не тестировать собственную копию алгоритма вместо кода.
- Для C/U — релевантные domain/SaveStore regressions и обычный UI. Переиспользовать текущий QA; не требуется перепроверять все 38 исследовательских пакетов ради каждого текста.
- Upgrade fixtures: active/parked/Undo, старый unused/consumed Random Joker, timed/indefinite/earned Unlimited, Bonus pending prize, old task/week, ready monthly, old LiveOps/Picture, косметика. Wallet/right/claim атомарны при failed и ambiguous writes.
- Новые Shuffle compositions: final-board proof, выбранные IDs и варианты issuance, обычное применение; старые immutable IDs сохранены.
- Финальный integrated C8 browser/DOM/raster отчёт на заявленных portrait-размерах с баннерным резервом. Указать команду и release flags. Стандартный C7 `qa:layout` не подменяет его.
- CI web + Android на точном итоговом HEAD; APK version/package/SDK/profile, SHA-256, fingerprint принятой test identity, embedded payload manifest/hash. Приложить доступные screenshots/GIF видимых изменённых путей, не макеты.
- Обновить [ledger](ADOPTION_LEDGER.json), [progress](DELIVERY_PROGRESS.md) и текущие navigation refs вместе с PR/evidence/остатками. Не повышать до ACCEPTED по docs/model/browser alone. Issue195 сверить с фактической дельтой, не закрывать по одному «CI green».

### Человеческий баланс — на том же кандидате

Использовать готовую economic table/witness; сначала исправить технические и UX разрывы. Провести и записать минимум различимые пути: fresh no-ad/offline; ошибающийся новичок с проигрышами/ожиданием; ad-ready игрок; no-fill; возврат на следующий день и replay после кампании. Фиксировать время, попытки/ошибки, доход/расход, применение ресурсов, ожидание lives, добровольные/принудительные видео и причину прекращения. Witness не считается этим плейтестом.

Проверить first-use понимание спецкарт/помощников, полезность Shuffle, ценность текущего 120/60sec Unlimited, ясность random/manual Joker, replay income/Combo и выбор рекламы. Величины менять только явно версионированным решением после данных. Если приобретение Unlimited не проходит ценность/UX, предложить отдельное решение по его acquisition; не отключать молча исторические/earned права или весь recovery. Для рекламы решение о live rollout и частоте привязывается к фактическому SDK/UX evidence.

### Внешние гейты — подготовить конкретную проверку

Физический Android: Back/insets/touch, фон/kill/reload/upgrade, часы, audio focus/haptic, настоящие banner/fullscreen/rewarded, no-fill/cancel/earned в фоне, отсутствие двойных выдач. Для ILRD: реальный live impression → стабильный deliveryId с amount/currency/placement → разрешённый dashboard/выгрузка/принимающий расчёт и дедупликация денежного агрегата. SDK call сам по себе не равен приёму сервера, ID сам по себе не гарантирует AppMetrica dedup.

Перед участием владельца подготовить установленный или готовый к установке exact APK, исходные состояния и короткий сценарий. Если у разработчика нет физического устройства/разрешённого live доступа, закрыть всю независимую инженерную часть и указать конкретно `NEEDS_DEVICE`/`BLOCKED_EXTERNAL`, необходимый доступ и наблюдаемый критерий. Не перекладывать на владельца сборку тестов, анализ кода или повтор всего аудита. Production artifact требует действующей подписи/package/config; IAP account не является гейтом этого рекламного выпуска.

## 14. Reference → Product: привязка и неизвестные части

Точные source URLs/evidence tiers закреплены в [SOURCE_FEATURES_PINNED](SOURCE_FEATURES_PINNED.json). Расширенные исследования — соответствующие consumer specs и private kit; оригинальные excerpt/build/RVA/tool provenance туда, собственная реализация и ссылки сюда.

| Задачи | Владельцы / source IDs | Что переносим или доводим; что не доказано |
| --- | --- | --- |
| F1, U2 ads | P21 `azur-ad-revenue-attribution`, `hitapps-adbreak`, `unico-coffee-break`; P20 `azur-free-shop-coin-claim`, `azur-win-multiplier`, `hitapps-win-rewarded-offer` | Одна product pause, отдельные earned/free и надёжный ILRD. Live original quotas/revenue не установлены |
| F2 | P19 `azur-unlimited-moves-offer` | Наш versioned timed contract; source lifetime/price/live policy остаются неизвестными |
| C1 | P15 `azur-joker-random-column-insertion` | Случайный столбец/успешная вставка/Undo, отдельное наше unused ownership. Не manual `hitapps-joker` |
| C2 | P16 `azur-shuffle-helper`, `azur-shuffle-animation-controller` | Ordinary уже использует hidden tableau+stock+waste pool и resetWaste с own seed, proof-first и отказом при identity permutation; старый stock-only preview сохранён отдельно. Source RNG/live entitlement и точное runtime parity не доказаны |
| C3 | P06 `hitapps-dynamic-difficulty`, `hitapps-easy-deals`, `unico-redeal-restart`; P31 `hitapps-lives` | Доступный путь существующего selector, immutable replay и наша lives policy; source live коэффициенты/regen не подтверждены |
| F3, U1, U3 | P29 `hitapps-daily-puzzle`, `unico-daily-puzzles`, `azur-daily-bonus`, `hitapps-daily-rewards`, `unico-daily-fortune`; P28 `azur-daily-tasks` | Разные режимы, actual date/state/claims; current own schedule не равен всему source28 и его remote calendar |
| U2 helpers | P04 `azur-locked-helper-discovery`, `hitapps-joker`, `azur-card-dictionary`; P20 `azur-definition-consumable` | Существующие unlock/stock и адресность; новые цены/веса не выводятся из названий источников |
| U2 context, U4 free season | P25 `azur-offer-campaign`, `azur-play-pass` и сохранённые 15families | Ordinary неплатный guidance и компактная free награда; не завершение paid campaigns/pass и не MakePurchase от видео |
| U4 cosmetics/endstate | P04 `azur-cosmetics`, `unico-themes-and-skins`; P30 `hitapps-win-streak`, `unico-win-and-task-streak`, `azur-combo-streak` | Сохранить reward systems, убрать повторный entry/невыполнимое обещание; source full series rules остаются отдельным переносом |
| U5 | P26 ledger infrastructure; P31 `hitapps-weekend-race`, `hitapps-lava-quest`, `hitapps-gold-rush-event`; P27 `hitapps-puzzle-event`, `hitapps-puzzle-gallery` | Только доступ к уже earned в старом save, собственные frozen contracts. Не новые event policies; Picture сохраняет отдельный путь |

Связанные specs: [generation/director](specs/01_GENERATION_DIRECTOR.md), [specials/feel](specs/02_SPECIALS_FEEL.md), [rewards/ads/commerce](specs/03_REWARDS_ADS_COMMERCE.md), [retention](specs/04_RETENTION_LIVEOPS.md), [device/source acceptance](specs/05_SOURCE_DEVICE_ACCEPTANCE.md). При расхождении точного source механизма и нашей политики записать обе стороны и UNKNOWN, не выдумывать оригинальные значения.

## 15. Definition of Done

Работа готова к финальной приёмке, когда F1–F3 закрыты воспроизводимыми проверками; C1–C3 работают через обычные действия; U1–U5 не теряют earned права и имеют конечные состояния; единый C8-кандидат и его evidence доступны; ledger/progress отражают реальность. В отчёте разработчика каждый ID этого ТЗ получает PR/commit, выполненную проверку и статус **done / remaining / external gate**.

Готовность инженерной части не равна разрешению live release. Физический SDK/баланс/production acceptance фиксируются отдельно. Полный перенос всех исследованных систем продолжается по общей очереди и не сокращается этим этапом.

**KIT IMPACT — REUSE.** Runtime pin и source inventory сохранены. Это ТЗ не включает новые vendor assets/source в игру и не меняет её runtime само по себе.
