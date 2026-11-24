# ТЗ разработчику: единый кор C8 и рекламный выпуск

**24 ноября 2026 · действующее поручение по результатам [аудита кода](DEVELOPER_AUDIT_2026-11-24.md).** Пользователь: «давай. Проверь чё там сделано и составляй тз для разраба».

## 1. Результат работы

Подготовить **одну обычную игровую конфигурацию C8**: совместно работающий согласованный кор, монеты, recovery и жизни, полный согласованный рекламный контур, достижимая экономика без live IAP, сохранения и измерения. Сдать подписанный Android-кандидат именно этого состава с воспроизводимыми проверками. Отключённая демонстрация одного эффекта не закрывает его интеграцию в выбранный состав.

Исходная база кода — [PR190 / `c4215e18d54927a5ac73a350876f29852aa36861`](https://github.com/DanilaH/asoc-solitair/pull/190), 0.20.3/code44. [PR194](https://github.com/DanilaH/asoc-solitair/pull/194) содержит действующие решения и новые ТЗ поверх этого кода. Перед началом сверить remote HEAD и перечислить, какие изменения появились после аудита. Сохранить существующую последовательность коммитов; не сливать повторно все старые ветки пакетов и не начинать от исторического `main` 0.17.1.

Работа разбита на проверяемые PR по зависимостям. После инженерной приёмки одного брать следующий доступный без запроса «продолжать?». Конкретный внешний блокер останавливает только зависящую от него приёмку/активацию.

## 2. Обязательные решения и источники

- Применять [решение о выпуске](OWNER_AD_RELEASE_2026-11-24.md), [семь утверждённых направлений](OWNER_DECISIONS_2026-11-22.md), [матрицу source → capability](PRODUCT_CAPABILITY_RECHECK_2026-11-24.md), актуальные AGENTS и [метод исследования](RESEARCH_METHOD_2026-11-24.md). Ничего не исключать из полной дорожной карты по собственному решению.
- Одна рекламная пауза AdsBreak/Coffee; optional video coins — обычный rewarded offer. Одна возможность post-win bonus с вариантами расчёта; одна способность Continue/Revive при исчерпании ходов. Ручной и случайный Joker, lives/stock/moves/Unlimited, free/earned/IAP и shown/earned/ILRD различаются.
- Денежные покупки недоступны и не являются зависимостью рекламного выпуска. Убрать недоступные действия оплаты из релизного UI, сохранив модели и исторические права. Бесплатный прогресс, монеты и реклама не получают merchant gate из-за принадлежности к коммерческому семейству.
- Runtime kit остаётся `a9325265e87583a4872cf6a158e1e881a0d7508e`; source inventory — `adb0657facebf8b5e3ed22369305ba509c988626`; research method — `06a01d5c1f7af3cdf8013c9ce0f6a691d086af78` (открытый kit PR139 при принятии). Это разные версии. Новый метод не требует смены runtime зависимости.
- Применять исследованный исходный код и архитектуру как доказательную основу своей реализации. Exact tool output хранить в закрытом kit; публичный consumer содержит собственный код, объяснение адаптации и точные ссылки. Source-static, своя модель, исполнение исходных функций, полный оригинальный runtime и приёмка нашего продукта учитываются отдельно.

## 3. Пакеты следующей разработки

| Порядок | Пакет / документ | Конкретный результат |
| --- | --- | --- |
| B0 | Единая конфигурация и сборка — §4 этого ТЗ | Версионированный состав C8, общий save-контракт, явные build inputs, отсутствие выбора функций через имя ветки. |
| B1 | [Кор и обычная кампания, C2–C5](CORE_RELEASE_IMPLEMENTATION_TZ_2026-11-24.md) | После общей композиции C1: director/Equality с реальным provenance, спецкарты, помощники, recovery/lives, FTUE и feedback; сохранение готовых реализаций. |
| B2 | [Реклама и экономика](ADS_ECONOMY_IMPLEMENTATION_TZ_2026-11-24.md) | Все согласованные placement, исправленный shown cooldown, free→RV, post-win policy, неплатные права, контекстные предложения и ILRD. |
| B3 | [Новые retention-данные и точечные исправления](RETENTION_SOURCE_DELTA_TZ_2026-11-24.md) | Дефект WinNoHints в точной границе; DailyTasks, DailyBonus и Combo по новым доказательствам. Сначала исправления включённого прогресса и no-IAP-достижимость, затем самостоятельные source-policy пакеты. |
| B4 | Общая экономика, устройство и выпуск — §5–7 | Проверки одной сборки, баланс и no-fill, реальные callbacks, миграции, отчёт и подписанный кандидат. |

**B0 включает C1 кор-ТЗ как одну общую задачу:** §4 этого документа задаёт сборку и manifest, C1 — доменную композицию. Повторный PR на тот же контракт не нужен. B1 продолжает C2–C5. В B0 проверяются общий профиль и совместимость уже готовых возможностей; окончательный сценарий со всеми доработанными правами и настоящим SDK принимается в B4.

B1 и B2 могут идти параллельно после фиксации общего save/config/grant-контракта B0. В B3 независимые модели и тесты не ждут рекламного аккаунта. Каждая переносимая source-policy остаётся в общей очереди; существование нескольких источников не требует нескольких одинаковых интерфейсов. Если конкретный вариант ещё не включён в выбранный состав, зафиксировать его этап и следующий шаг; не удалять его из продукта и не подменять им готовую функцию.

### Что повторно делать не нужно

Сохранить работающие SaveStore и native earned/shown journals, C8 authoring/проверки финального поля, аттестованный Equality example, manual/random Joker engines, recovery/lives, proof-first Shuffle, P25 dispatcher/presenters, UX #181/#185/#187 и QA-реализации #179/#180. Новые PR должны показывать **дельту относительно actual HEAD**, а не повторять названия уже написанных систем.

## 4. B0 — один состав и воспроизводимая сборка

### 4.1. Причина

`CONTENT_VERSION` сейчас зависит от `VITE_CONTENT8_PREVIEW`; обычный release workflow не задаёт флаг и собирает C7. `VITE_C8_OWNER_PREVIEW` выбирает взаимоисключающие наборы, а CI native configuration зависит от префикса ветки. Включение одного preview может обходить другую политику выдачи. Состав нельзя подтвердить одним зелёным запуском тестов нескольких разных сборок.

### 4.2. Изменения

1. Ввести один явный версионированный product/release profile, из которого читаются политика выдачи, доступные эффекты/каналы получения, economy version, ad policy и неплатные поверхности. Техническое имя модуля выбрать по существующей архитектуре. Не хранить один и тот же смысл одновременно в нескольких независимых наборах булевых флагов.
2. Отделить режим провайдера `disabled/test/live` от состава игры. Один и тот же состав должен проходить disabled/no-fill, test SDK и настроенный live SDK. Наличие test-mode не должно скрывать инженерно готовую product-функцию из обычного кода.
3. QA fixtures оставить для диагностики. Их L16 forced deals, стартовые 120 секунд Unlimited и демонстрационные grant не становятся безусловными правилами обычной кампании.
4. Согласовать в одном SaveStore transaction: выбор и фиксацию новой раздачи, историю director, аттестацию Equality, расход life, стартовые права и события прогресса. Старые active/parked attempts и Undo сохраняют собственные deal/rules/policy версии; новая конфигурация применяется к следующим подходящим попыткам.
5. Исправить `.github/workflows/release.yml` и относящиеся native/web шаги CI: один явный input/profile для `check`, web build, `android:sync` и APK. Не выбирать релизные возможности по имени ветки. Зафиксировать собранный manifest рядом с результатом QA.
6. Manifest результата должен содержать actual commit, game/build version, runtime pin, content/rules/save/balance/policy версии, активные capability, SDK mode, package ID и SHA web payload. Секреты, токены, приватный исходный код kit и платёжные данные в него не включать.
7. Старые отключённые или несовместимые профили не мигрировать неявно. Если тестовые save namespace остаются отдельными, назвать их в отчёте и отдельно проверить upgrade настоящего пользовательского профиля.

### 4.3. Приёмка B0

- Из чистого checkout получить web и Android с одним manifest; smoke через обычные меню подтверждает C8 и согласованный состав без URL/dev кнопок и без переключения профиля между сценариями.
- На одной кампании воспроизвести совместимость уже готовых доменных возможностей: выдача → ход/добор → спецкарта → доступный helper/recovery → завершение → награда → следующая раздача; отдельный путь проверить на исчерпании ходов/жизней. Для механики, ещё ожидающей реализации/своего gate, manifest честно указывает состояние. Новые права, итоговый баланс и реальные SDK-сценарии принимаются после B1/B2 в B4.
- Старое сохранение C7 и архивные active/parked попытки переживают upgrade, Undo/restart не изменяют зафиксированную раздачу/бюджет/права. Уже полученная награда не выдаётся повторно.
- Исправление build profile само по себе не включает непроверенную рекламу и не меняет экономические числа. Проверяется состав, а SDK/баланс принимаются своими пакетами.

## 5. Общая экономика без денежных покупок

Создать проверяемую таблицу релизной политики: **действие → право/условие → стоимость или доход → срок/квота → событие расхода/выдачи → источник значения → версия**. Начать с реально существующих собственных значений; изменения и исходные compiled defaults пометить отдельно. Не переносить числа 25/50/100/200, 200/400, 120 секунд, x3/x5 и рекламные интервалы в release только потому, что они есть в исследовании или QA.

Обязательные строки: победа и move bonus; выбранный post-win RV; бесплатные/рекламные монеты; Hint/Undo/Joker/Shuffle и доступные starter effects; Continue/Revive; StockRestore; Unlimited; верхний/нижний bonus slot; жизни и refill; темы; серии и задания; неплатные дорожки событий/предложений. Неизвестные права и числа требуют конкретной policy-кандидата и проверки, а не фиктивного IAP receipt.

Для каждой возможности описать доступность при нуле монет, no-fill, офлайн, исчерпанной квоте и возврате после паузы. Не каждый helper обязан быть бесплатным, но предусмотренная кором возможность вернуться к игре не должна превращаться в вечный тупик из-за недоступной оплаты/рекламы.

Для включённого набора заданий проверить максимальный достижимый результат без MakePurchase, а также без fill. События покупки не заменять просмотром рекламы; coin BuyBoosters/BuyExtraMoves определять по фактическому расходу игровых монет. Исходная таблица 28 задач остаётся контрольным исследовательским набором; релизная конфигурация требует собственной явно названной адаптации там, где её порог недостижим без IAP.

Выход: таблица значений и источников, расчёт доходов/расходов по ранней/средней/поздней игре, сценарии no-fill и отчёт человеческого плейтеста. Уже утверждённые семь направлений не согласовывать заново; пока не принятые новые числа и границы включения представить конкретным проверенным кандидатом.

## 6. Приёмка общего состава

| Риск / сценарий | Требуемое наблюдение и oracle |
| --- | --- |
| Выдача и сложность | Фактическое финальное поле и бюджет, независимый legality/solvability witness, history/segment provenance. UNKNOWN solver не засчитывается проигрышем; late-loss бота не доказывает нерешаемость. |
| Спецкарты/помощники | Комбинации эффектов, неверная цель, отмена, Undo/restart; один расход за подтверждённый эффект. Источник эффекта и собственные отличия названы. |
| Реклама | На том же APK пройти banner, межуровневую рекламу, одну внутрипартийную паузу и каждый включённый rewarded effect. Shown/earned/ILRD независимы; no-fill/cancel без earned ничего не выдают. |
| Порядок callbacks | shown-before-earned и earned-before-shown; дубли, запоздавший callback, смена attempt/mode, конец timed right; cooldown и права остаются корректными. |
| Сохранения | Ошибка write, kill после native receipt / после game commit / до ack / после ack; повтор доставки, повтор claim, restart/Undo, старый профиль и parked mode. Единственный authoritative writer — SaveStore. |
| Игровой момент | Fullscreen не прерывает незавершённый жест или commit, не откатывает принятую карту. Banner не перекрывает действия. Результат и переход после награды не зависят от завершения optional animation для сохранения права. |
| Метрика | Реальные callback-события доходят до выбранной аналитики с корректной валютой/placement и без PII; ILRD не объявляется фактической выплатой сети. |
| UX | Обычная игра без QA controls; 320×568 и 390×844 как воспроизводимые web регрессии, плюс фактический Android/insets/banner/Back/фон/возврат. Звук, вибрация, обучение и читаемость проверены людьми на устройстве. |
| Достижимость | Прогресс и задачи выбранной конфигурации доступны без реальных покупок; честно разделены возможный бонус, обязательная цель и будущая платная дорожка. |

Использовать существующие `npm run check`, `qa:rules`, `qa:content7`, `qa:content8`, `qa:campaign-decisions`, `qa:hitapps-equality`, `qa:porting`, unit/browser/layout и Android сборку по затронутым рискам. Для изменённого контракта добавить тест, различающий прежнюю ошибку и исправление; не создавать тест, который просто повторяет новую реализацию. Общий smoke должен проверять именно release profile. Не пересобирать обслуживаемый browser-тестами `dist` параллельно.

## 7. Сдача и внешние условия

Каждый scoped PR: source IDs/Pxx и ссылка на раздел ТЗ; actual parent/head; переиспользованный код и конкретная дельта; версии схем/политик и миграция; выполненные проверки и ограничения; APK/GIF для видимого результата; изменения ledger/progress по фактам. Код, включение и приёмку учитывать раздельно.

Финальный кандидат: exact-head CI, подписанный APK/AAB с SHA256 и отпечатком публичного сертификата, manifest общего состава, Android/SDK протокол, human balance/UX отчёт, live analytics evidence и [release checklist](../platform/RELEASE_CHECKLIST.md). Сохранить текущую production signing identity и package; не заменять ключ новой локальной подписью. Статус рекламных unit/аккаунта/выплат установить по доступной конфигурации, не угадывать наличие и не выводить секреты.

Недоступность рекламного аккаунта, устройства или неизвестный исходный контракт фиксировать с точной проверкой/следующим действием. Продолжать независимые задачи. Merchant/KYC/платёжная песочница не являются gate рекламного выпуска. Подготовка кандидата не является автоматической отправкой в магазин.

После инженерной сдачи обновить реальные строки ledger, progress и относящиеся source evidence; само это ТЗ не повышает статусы. Все 115 IDs / 38 пакетов / 15 коммерческих семейств сохраняются, 0 OWNER_EXCLUDED. Карта дальнейших пакетов приведена ниже; стадия задаёт порядок, а не удаление из продукта.

## 8. Полное покрытие пакетов и следующий шаг

Все IDs ниже взяты из действующей `DELIVERY_QUEUE.json` без изменения владельца. Пустое поле IDs означает инфраструктурный пакет, а не пропуск источника. Это план следующей работы; прежний implementation/evidence status хранится в ledger и данным списком не повышается.

| Пакет | Source IDs | Стадия | Следующий результат |
| --- | --- | --- | --- |
| P00 | — | B0 | Явный общий профиль C8 и manifest web/native. |
| P01 | `azur-fullscreen-ads-clock` | B2 → B4 | Расширить готовый shown-контракт на quote nonce; проверить SDK cadence. |
| P02 | — | B4 | Физический Android и человеческий плейтест общего состава. |
| P03 | — | B1 → B4 | Переиспользовать аудит альтернатив; проверить новые финальные сочетания и баланс. |
| P04 | `azur-action-ftue`, `azur-difficulty-label`, `azur-locked-helper-discovery`, `hitapps-joker`, `hitapps-ghost-hint`, `ui-motion-audio-coin`, `hitapps-ingame-streak`, `azur-card-dictionary`, `azur-stock-side-setting`, `azur-card-animation-controller`, `azur-coin-flight-animator`, `azur-victory-reward-sequencer`, `azur-button-haptic-feedback`, `hitapps-invalid-transfer-feedback`, `azur-cosmetics`, `unico-themes-and-skins`, `azur-greedy-hint-order` | B1 / B2 / B3 | Общее FTUE/feel; Definition/cosmetics через экономику, серия через свой policy-контракт. |
| P05 | `hitapps-stock-dealer`, `hitapps-candidate-priority`, `azur-deck-draw-and-recycle`, `azur-defeat-vs-no-valid-move`, `azur-generate-deal-entrypoints`, `hitapps-negative-seed-request-path`, `azur-tutorial-preset-deal` | B1 | Объединить готовые входы/фазы/выдачу; source неизвестное остаётся отдельным исследованием. |
| P06 | `hitapps-dynamic-difficulty`, `hitapps-easy-deals`, `unico-redeal-restart` | B1 | Будущая адаптивная выдача, история и баланс без переписывания активной попытки. |
| P07 | `hitapps-equality-paywall`, `hitapps-paywall-segmentation`, `hitapps-equality-three-stack-pair-placement`, `hitapps-feature-seed-one-time-reshuffle`, `hitapps-initial-shuffle-final-pipeline` | B1 + source follow-up | Использовать source-shaped phases; исходные pair/bot/remote пробелы не объявлять закрытыми. |
| P08 | — | B1 | Банк/аттестация/segment provenance и обычный fallback; не controlled fixture для всех. |
| P09 | `azur-extra-foundation`, `hitapps-ordered-category`, `hitapps-lockers`, `azur-bonus-lower-column` | B1 + B2 | Состав каталога и оплачиваемый монетами/earned верхний и нижний слот. |
| P10 | `hitapps-frozen` | B1 + source follow-up | Композиция Frozen; отдельная truth table и восстановление полного исходного melt. |
| P11 | `hitapps-bound`, `hitapps-bound-scissors-pattern` | B1 + source follow-up | Bound/Scissors, совместимость и проверенный путь; неизвестные target/cost уточнить. |
| P12 | `hitapps-puzzle-top-bottom-cards` | B1 + source follow-up | Puzzle в реальной кампании; сохранять физические карты и own/source границы. |
| P13 | `hitapps-golden-cards` | B1 | Golden в Final, ресурсный эффект и решаемость итогового поля. |
| P14 | `hitapps-magnet-hammer` | B1 + source follow-up | Переиспользовать starter adaptation; отдельно восстановить исходные Magnet/Hammer эффекты. |
| P15 | `azur-joker-random-column-insertion` | B1 + B2 | Отдельный random Joker с warning, реальным grant/расходом и atomic Undo clear. |
| P16 | `azur-shuffle-helper`, `azur-shuffle-animation-controller` | B1 + B2 | Один Shuffle: выбранная source-derived policy, oracle, ресурс и миграция старого trial. |
| P17 | `unico-magnet-helper` | Следующий source → implementation пакет | Получить исходный Magnet effect/target/cost; затем уточнить собственную реализацию. Не исключён. |
| P18 | `azur-coin-moves`, `azur-rewarded-moves`, `unico-loss-dialog` | B1 + B2 | Одна способность Continue/Revive; coin/earned пути и tail proof. |
| P19 | `hitapps-stock-restore`, `hitapps-revive-offers`, `azur-unlimited-moves-offer` | B1 + B2 | StockRestore и Unlimited с определённым неплатным правом; separate expiry/stock/moves. |
| P20 | `azur-win-multiplier`, `hitapps-win-rewarded-offer`, `unico-rewarded-theme`, `unico-double-reward`, `azur-definition-consumable`, `azur-free-shop-coin-claim`, `azur-remaining-moves-coin-bonus` | B2 | Полный согласованный live RV, free→RV, post-win components/policy и consumables/themes. |
| P21 | `hitapps-adbreak`, `hitapps-ingame-banner`, `azur-ad-revenue-attribution`, `unico-coffee-break` | B2 → B4 | Banner, межуровневые показы, одна пауза, общая частота и доставка ILRD. |
| P22 | `azur-iap-product-catalog`, `azur-iap-helper-ladder` | B2; денежный канал — последующий этап | Переиспользовать каталог/tiers для независимых прав и своей экономики; не показывать неработающий checkout. |
| P23 | `azur-purchase-receipts` | B2; IAP — последующий этап | Общие rights/grants отделить от подтверждённого purchase; сохранить IAP/возвраты/миграции. |
| P24 | — | Последующая активация IAP | Вернуться к провайдеру/merchant при доступности реальных покупок. Рекламу не блокирует. |
| P25 | `hitapps-piggy-bank`, `azur-play-pass`, `hitapps-rotating-offers`, `hitapps-birthday-offer`, `hitapps-decoy-offer`, `hitapps-starter-offer`, `hitapps-inapp-shop`, `azur-offer-campaign`, `unico-vip`, `azur-iap-no-ads`, `azur-iap-coin-packs`, `azur-iap-coin-offer-series`, `azur-iap-premium-bundles`, `azur-iap-welcome-offer`, `azur-iap-unlimited-moves-tiers` | B2 + дальнейшие коммерческие пакеты | Реальные контексты, бесплатный прогресс и права сейчас; все 15 семейств и их денежные каналы остаются в roadmap. |
| P26 | — | B3 / общий grant contract | Переиспользовать scheduler/claim ledger; независимое создание событий и идемпотентная выдача. |
| P27 | `hitapps-puzzle-event`, `hitapps-puzzle-gallery`, `hitapps-win-multiresource-payout` | B3 / следующая meta-интеграция | Проверить включённый gallery/progress и multi-resource payout; расширять PuzzleEvent отдельной дельтой. |
| P28 | `azur-daily-tasks` | B3 R1–R2 | Точная WinNoHints-граница, composite rewards, исходный каталог и достижимая no-IAP policy. |
| P29 | `azur-daily-bonus`, `hitapps-daily-rewards`, `unico-daily-fortune`, `hitapps-daily-puzzle`, `unico-daily-puzzles` | B3 R3; остальные варианты — следующие пакеты | AZUR карточный бонус; сохранять обычный Daily Level и Hitapps/Unico различия, для них продолжить contract/claim QA. |
| P30 | `hitapps-win-streak`, `unico-win-and-task-streak`, `azur-combo-streak` | B3 R4; win/task streak — следующие пакеты | Одна внутрипартийная способность с versioned policy; отдельно довести consecutive-win/task события и reset/claim. |
| P31 | `hitapps-weekend-race`, `hitapps-lava-quest`, `hitapps-lives`, `hitapps-gold-rush-event`, `hitapps-meta-prewarm` | B1 lives + дальнейшие event-пакеты | Ordinary lives сейчас; WeekendRace/Lava/GoldRush/prewarm сохраняются с собственными schedule/reward/device шагами. |
| P32 | `hitapps-meta-regions`, `hitapps-cascade-events`, `hitapps-digging-event`, `hitapps-lucky-wheel`, `hitapps-endless-treasure` | Следующие meta-пакеты | Regions/Cascade/Digging/Wheel/Treasure: переиспользовать модели, уточнить activation/rewards и интегрировать поэтапно. |
| P33 | `hitapps-level-wave`, `azur-topic-rotation`, `azur-variable-category-sizes`, `hitapps-mixed-word-image-cards`, `azur-structured-long-campaign` | B1 качество; дальнейшее расширение | Принять реальный C8 каталог и семантическое разнообразие; продолжать длинную кампанию без искусственного потолка 80. |
| P34 | `azur-art-sprite-wordcount-override`, `azur-async-theme-art-preload`, `azur-localized-move-budget`, `hitapps-language-change-restart`, `azur-localized-definition-packs` | B1 совместимость; дальнейшая localization/art-интеграция | Проверить текущие RU inputs и ресурсы; source counts/preload/locale budget вводить версионированно, без замены архивных Deal. |
| P35 | `azur-remote-level-overrides` | Следующий content-delivery пакет | Remote overrides/cache: определить версию, валидацию/доверие, offline fallback и наблюдаемую загрузку. |
| P36 | — | Параллельное исследование | Точные source gaps и независимые original-function/full-runtime доказательства; не общий запрет продуктовой разработки. |
| P37 | — | B4 | Общий кандидат, honest ledger, exact-head CI/SDK/device/баланс и дальнейшая очередь. |

**KIT IMPACT: REUSE** метода Reference → Product Porting и существующего pinned runtime API; нового изменения kit этим ТЗ не требуется.
