# Реклама и экономика общего C8-выпуска · ТЗ разработчику

[Общее поручение и порядок PR](CORE_ADS_RELEASE_TZ_2026-11-24.md) · [Аудит текущего кода](DEVELOPER_AUDIT_2026-11-24.md)

**24 ноября 2026 · IMPLEMENTATION BRIEF, не отчёт о готовом релизе.** Основание: [решение о коре и рекламе](OWNER_AD_RELEASE_2026-11-24.md), [группировка продуктовых возможностей](PRODUCT_CAPABILITY_RECHECK_2026-11-24.md), [принятый метод исследования](RESEARCH_METHOD_2026-11-24.md). Проверенный код: [PR #190, `c4215e18d54927a5ac73a350876f29852aa36861`](https://github.com/DanilaH/asoc-solitair/tree/c4215e18d54927a5ac73a350876f29852aa36861); новые инструкции: PR #194, `23f04d32f00ca4cb8bd569e8802a75343e48bd3c`. При начале реализации перепроверить HEAD. Runtime kit остаётся `a9325265e87583a4872cf6a158e1e881a0d7508e`, research-method pin — `06a01d5c1f7af3cdf8013c9ce0f6a691d086af78`.

**Результат:** в одной принятой C8-конфигурации игрок получает работающие рекламные предложения, бесплатные награды и возможность расходовать игровые монеты; недоступный денежный checkout не участвует в этих маршрутах. Одна рекламная пауза объединяет AdsBreak/Coffee. Все 115 source IDs / 38 пакетов и 15 коммерческих семейств остаются в общей дорожной карте. Числовые параметры ниже различают текущую адаптацию, исходные defaults и ещё не принятый релизный баланс.

## 1. Учёт источников и границы задачи

| Пакет | Source IDs / связь с этим ТЗ |
| --- | --- |
| P01 | `azur-fullscreen-ads-clock`: общий учёт фактических fullscreen-показов |
| P20 | `azur-win-multiplier`, `hitapps-win-rewarded-offer`, `unico-double-reward`, `azur-free-shop-coin-claim`, `unico-rewarded-theme`, `azur-definition-consumable`, `azur-remaining-moves-coin-bonus` |
| P21 | `hitapps-adbreak`, `unico-coffee-break`, `hitapps-ingame-banner`, `azur-ad-revenue-attribution` |
| P25: независимые неплатные части | `azur-offer-campaign`, `hitapps-inapp-shop`, `azur-play-pass`, `hitapps-piggy-bank`, `azur-iap-no-ads`, `azur-iap-unlimited-moves-tiers`: диспетчер, бесплатный прогресс и существующие права отделяются от checkout; это не разрешение нового бесплатного выкупа/премиального права |
| P25: остальные семейства сохраняются | `hitapps-rotating-offers`, `hitapps-birthday-offer`, `hitapps-decoy-offer`, `hitapps-starter-offer`, `unico-vip`, `azur-iap-coin-packs`, `azur-iap-coin-offer-series`, `azur-iap-premium-bundles`, `azur-iap-welcome-offer`; платные каналы ждут собственного P24, доступные неплатные компоненты проверяются отдельно |
| P22/P23/P24 | `azur-iap-product-catalog`, `azur-iap-helper-ladder`, `azur-purchase-receipts`; готовые каталог/граница покупки сохраняются, реальные покупки не входят в этот выпуск. P24 не получает нового рекламного запрета |
| Смежный кор | P09 `azur-extra-foundation`, `azur-bonus-lower-column`; P15 `azur-joker-random-column-insertion`; P18 `azur-coin-moves`, `azur-rewarded-moves`, `unico-loss-dialog`; P19 `hitapps-stock-restore`, `hitapps-revive-offers`, `azur-unlimited-moves-offer`; P31 `hitapps-lives`. Кор отвечает за эффект, этот документ — за получение права/рекламу/кошелёк |

Награды за IAP не заменять видео, `MakePurchase` остаётся событием настоящей покупки. Ручной и случайный Joker различаются по решению владельца. Continue/Revive — одна возможность продолжения исчерпанной попытки; lives, stock и Unlimited меняют другие ресурсы.

## 2. Что проверено в текущем коде

38 файлов рекламного/коммерческого среза сверены по Git blob SHA с деревом проверенного HEAD. Данные ниже — инспекция кода; локальная проверка конкретной функции описана в §4.1. Новый Android/SDK-прогон в рамках составления ТЗ не выполнялся.

| Уже сделано | Фактическая граница / оставшаяся дельта |
| --- | --- |
| `src/platform/ads.ts::createAds`, `SolitaireAdsPlugin.java`, `RewardJournal.java`: настоящий native bridge, activity coordinator, раздельные earned/shown журналы, `DurableReceiptQueue` | Переиспользовать. Новый дефект находится в привязке P20 shown к попытке, а не в отсутствии механизма shown вообще |
| `src/domain/services.ts`: сохранённые выдачи Hint/Undo, Continue credit, coin recovery, бонусные слоты, дедупликация | Подключить к общему составу и проверить совместно. Запрос/закрытие не являются выдачей; поздняя награда не должна менять другую партию |
| `reward-offers.ts`: pending quotes, один `settledWins` для вариантов победного бонуса, +30 RV монет, сукно на сутки | `main.ts::renderRewardOffers/requestRewardOffer` требуют `ads.status.mode === 'test'`; native `testOffer` имеет ту же блокировку. Это не готовые live P20-сценарии |
| `azur-victory-reward.ts` и PR #190: таблица баз, бонус ходов, отдельный сохранённый QA-профиль, раздельное отображение суммы | `rewardOffersEnabled = REWARD_OFFER_PREVIEW && !AZUR_VICTORY_QA`: формула AZUR и P20 намеренно разобщены. Общий релиз должен использовать одну версию экономики и сохранённые компоненты победы |
| `campaign-advertising.ts::eligibleAdBreak`, вызов после принятого хода/idle в `main.ts` | In-party interstitial подключён под разрешением. Отдельная старая Coffee-кнопка с +10 RV ещё существует; привести к принятой одной паузе и общим rewarded-предложениям |
| `commerce/offer-campaigns.ts`: восемь триггеров, priority/ordinal, builtin Welcome, именные presenters/fallback, SaveStore | Диспетчер готов. `app/offer-campaign-preview.ts` подаёт только ручные QA-события 0/5/6 с `qa-azur-context-offers`; реальных контекстных событий игры и неплатных предложений ещё нет |
| `commerce/storefront.ts`: бесплатная дорожка, прогресс сезона/копилки; `offer-policy.ts`: отдельные NoAds scopes | `recordStoreClear`, доступ к экрану и часть ресурсов зависят от `STOREFRONT_PREVIEW`. Отделить бесплатную экономику и расход монет от включения paid storefront |
| Native `recordImpression` разбирает сумму SDK в micros и валюту; `recordAdRevenue` хранит последние 128 событий | `main.ts` отправляет только `ad_event {format,phase}`. Сумма/валюта/точка не доставляются в AppMetrica; локальный список не является доставленной ILRD-аналитикой |

Кодовые опоры на проверенном HEAD: [main](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/main.ts), [reward offers](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/reward-offers.ts), [services](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/services.ts), [native ads](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/native/android/app/src/main/java/com/danilah/asocsolitair/SolitaireAdsPlugin.java), [dispatcher](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/commerce/offer-campaigns.ts), [QA formula](https://github.com/DanilaH/asoc-solitair/blob/c4215e18d54927a5ac73a350876f29852aa36861/src/domain/azur-victory-reward.ts).

## 3. Источники, архитектура и пределы вывода

AZUR: `com.solitaire.match.words` 1.3.3.8/code244, XAPK SHA-256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`, ARM64 `27eb2e67ba00093ed575e16fc01a876a9e90fff8e53b504338047a4bf2c0d924`, metadata `01ec4a9211a481353c4d660cda2f76fcb842f60e195ab5266d7a0ce4545be0a0`. Изучены перечисленные отчёты и связанная дельта consumer; исходные функции/SDK в этом аудите заново не исполнялись.

| Evidence | Проверенный архитектурный контракт | Предел / задача передачи |
| --- | --- | --- |
| [E1: x3/x5, exact `eaad152`](https://github.com/DanilaH/mini-games-kit/blob/eaad152b2cd26b0829e097e3adfc146761bfef5a/research/games/association-solitaire/2026-11-23-azur-victory-claim-multipliers/README.md) | `GameController` выдаёт базу+бонус; UI получает их отдельно. `VictoryClaimX5Schedule.RegisterVictory@0x25fa7e4` сохраняет счётчик; `OnX3Rewarded@0x25b603c` добавляет `(factor−1)×tierBase`. Earned, closed и визуальное завершение — отдельные состояния | NATIVE_STATIC; живые remote/повтор уровня/SDK UNKNOWN. Отчёт содержит RVA/opcode anchors и verifier; релевантные exact tool output / tool version при дополнении хранить в private annex |
| [E2: free→RV, exact `681e00d`](https://github.com/DanilaH/mini-games-kit/blob/681e00d1cdb62fa3a0ddd9b0cd843c086ea6a707/research/games/association-solitaire/2026-11-22-azur-native-free-vs-rewarded/README.md) | `RewardedAdButton.ClaimFreeCoins@0x2704658`, `ComputeState@0x2705230`, `OnRewarded@0x2704d3c`: бесплатный этап, rewarded, cooldown, limit; UTC-день и счётчик earned | NATIVE_STATIC плюс S2 ~513.8–516s: free +200 и смена tile на video400; +400 фактически не просмотрен. Порядок source counter→grant не доказывает crash-atomicity |
| [E3: NoAds, exact `8bc099e`](https://github.com/DanilaH/mini-games-kit/blob/8bc099ee47ef6bffaffa314132b01388e2d5d008/research/games/association-solitaire/2026-11-23-azur-noads-native/README.md) | Сохранённый AdsRemoved участвует в ordinary banner/interstitial gate; `IsRewardedAdsAllowed@0x25c9518` — отдельная проверка | NATIVE_STATIC. Наличие NoAds не гарантирует доступность RV; исходные реальные покупки/возвраты не проверены |
| [E4: presenters, exact `e70a23b`](https://github.com/DanilaH/mini-games-kit/blob/e70a23baabf3df356d84ee7a09fb73fe2fdcc7ef/research/games/association-solitaire/2026-11-23-azur-offer-presenter-ids/README.md), [consumer P25](P25_AZUR_CONTEXT_CAMPAIGNS.md) | Три case-sensitive windowId → handlers; текущая собственная реализация уже сохраняет отбор, fallback и committed presenter | NATIVE_STATIC: окно принято presenter ≠ отрисовано ≠ SDK impression ≠ покупка. Установка live SKU/цен из этих строк не следует |
| [E5: P21](P21_AD_PLACEMENTS.md), [исправление Unico #157](https://github.com/DanilaH/asoc-solitair/issues/157) | Hitapps guards и Unico наблюдение относятся к одной продуктовой паузе с общей fullscreen-координацией | Unico Daily +3 не доказывает opt-in, SDK-тип, earned или таймер. Новый необоснованный +3 после dismiss не вводить |

Собственный pipeline: **событие игры → policy/quote → сохранённый request → SDK → durable shown/earned → единая SaveStore-мутация → acknowledge → необязательный feedback**. Конкретный reward quote владеет суммой/правом и версией; renderer не начисляет ресурс. ILRD — отдельный аналитический поток. Точный исходный код остаётся в закрытом kit; публичное ТЗ содержит собственную адаптацию и ссылки. Не называть чтение source или исполнение собственной функции NATIVE_ISOLATED оригинала.

## 4. Изменения в порядке реализации

### 4.1. Исправить P20 shown identity и объединить частоту

**Подтверждённый дефект интеграции:** `main.ts::requestRewardOffer` (строка 1074 проверенного HEAD) передаёт `attempt: offer.id`. `services.ts::applyFullscreenShown` (43–47) принимает только `save.attempt.id`, кроме отдельного life-refill. Поэтому настоящая notice P20 с nonce quote отклоняется, `lastFullscreenAt` не меняется. Наличие рабочего shownJournal этого пути не закрывает.

Локально исполнено неизменённое тело `applyFullscreenShown` и `platformState` в Node с удалением только TS-сигнатур. Вход: current attempt `game-attempt-1`, pending quote `offer-nonce-1`, одинаковый deal, shownAt=10000. P20 `win-triple/offer-nonce-1` → `already-applied`, lastFullscreenAt=0; контроль `hint/game-attempt-1` → `applied`, lastFullscreenAt=10000. Ветки life/adbreak не исполнялись; их stubs не участвовали. Это узкая проверка продукта, не Android.

- Добавить проверяемую durable связь request nonce → игровой attempt/deal/mode/placement. Она должна пережить earned settlement, который сейчас удаляет pending quote, иначе порядок earned→shown снова потеряет cadence.
- Проверять shown по этой связи, сохраняя проверку старой обычной identity и life-refill. Произвольный nonce не разрешать. Сохранение cadence и дедупликации — до acknowledgement shown.
- Общий floor после фактического fullscreen действует на межуровневый interstitial и единую паузу, включая preceding RV. No-fill без shown его не обновляет; ошибка после shown не отменяет реальный показ.
- Регрессии: P20 shown→earned, earned→shown, duplicate shown, late shown после перехода экрана, relaunch между журналами, неизвестный nonce; RV→Next и RV→in-party pause раньше/позже общего интервала. Кошелёк от shown не меняется.

### 4.2. Соединить выплату победы и один post-win rewarded offer

Переиспользовать `azur-victory-reward.ts`, сохранённые выплаты `win:<attemptId>`, existing pending/settledOffers и готовый reward-flight UX из #179/#190. Не вводить четыре параллельные кнопки/квоты.

- Сохранять на победе immutable reward breakdown: reward key, attempt/deal/content/balance/policy revision, tier provenance, `tierBase`, `movesBonus`, прочие награды отдельно. Quote доплаты ссылается на этот snapshot, а не на текущий глобальный BALANCE после обновления.
- Для source-shaped AZUR x3/x5: `extra=(selectedFactor−1)×tierBase`, итог `tierBase+movesBonus+extra`. Пример oracle: 50+25, x3 →175 всего; x5 →275. Значения 225/375 — ошибка для этого исходного контракта.
- Добавить сохраняемую политику выбора factor: source compiled defaults x3, x5 каждый третий подходящий вызов, максимум Hard, wait0. Типы/выбор UI и eligibility проверить до продвижения schedule; собственная защита от повторного открытия одной победы обозначается PRODUCT_ADAPTED.
- **Уточнение старого #182:** source schedule меняется при подходящем вызове предложения, до earned. Последующий SDK no-fill сам по себе не доказывает исходный rollback schedule. Закрепить правило продукта и тестировать отдельно; счётчики eligible offer, shown, earned не объединять.
- «Забрать» доступно независимо от рекламы. UI показывает выбранный factor/точную доплату; callback earned применяет только доплату. Смена экрана, reduced motion, фон или прерывание прилёта не меняют начисление.
- x2 и flat остаются доступными версиями продуктовой политики; не объявлять их исходную формулу доказанной AZUR. Устаревшие quotes разрешаются по сохранённой версии; общую базу старых побед не пересчитывать.

### 4.3. Бесплатная выдача → монеты за видео

`shop-free-coins` сейчас фактически RV+30, не бесплатный claim. Создать одну наградную поверхность с отдельными состояниями **бесплатно / доступно видео / cooldown / дневной лимит / SDK недоступен**. Бесплатная стадия не требует SDK, merchant session или просмотра.

- Сохранённая policy описывает free amount, rewarded amount, период UTC-day, дневной лимит earned и интервал после earned; source fixture — 200/400, 10/day, 300s. Это исходные defaults для проверки, не автоматически принятые live-константы.
- Free: в одной SaveStore-транзакции проверить day/claim identity, выдать монеты и отметить claim. Повтор после записи/перезапуска ничего не добавляет. RV: сохранить quote до SDK, применить amount+earned count+last earned+dedup атомарно.
- На no-fill/dismiss-only нет RV-награды и расхода earned quota. Проверить часы: новый UTC-день через 20 секунд, rollback, reward на границе дня, cooldown 299/300, counts 0/1/9/10. День учёта позднего earned должен быть явным правилом версии quote, не случайным временем рендера.
- Старые pending +30/rolling24h и права сукна доживают по собственной версии; при миграции не выдавать повторную награду и не погашать старый earned. Free seasonal Pass — отдельный источник, его нельзя засчитать этой выдачей.

### 4.4. Довести live-разрешение и все рекламные поверхности

| Поверхность | Необходимая дельта и приёмка |
| --- | --- |
| Hint/Undo, Continue/Revive | Переиспользовать готовую выдачу; явно различать покупку за coins и earned. Продолжение применимо к доказанному исходному attempt, позднее earned сохраняет доступное право вместо изменения другой партии |
| Верхний foundation / нижняя колонка | Общий C8-контент должен предъявлять существующий бонус в правильной последовательности; earned относится к конкретному active/parked campaign attempt, а не к случайно открытому новому уровню |
| Lives | Сохранить отдельную nonce/settlement модель `life-refill`. Исправление P20 identity не должно ломать её. Потеря жизни, её возврат и ходовые ресурсы остаются разными эффектами |
| Post-win / coins / cosmetic theme | Убрать зависимость функциональности от `mode==='test'` в TS и native через явные feature-capabilities. QA test mode проверяет те же маршруты; live включается только после соответствующих SDK/balance/UX gates |
| Баннер | Проверить существующий NativeBanner, фактический impression, safe area, fullscreen/modal/background/rotation и возврат. NoAds scope должен применяться при каждом обновлении; banner не расходует fullscreen cooldown |
| Межуровневый interstitial | Проверить победа→Next/replay, completed level, общий interval, NoAds, повторы/фон/no-fill. Принятый результат и переход не должны теряться из-за отсутствия рекламы |
| Одна пауза AdsBreak/Coffee | Оставить один coordinator/entrypoint, source-informed guards, безопасный момент после commit и завершения жеста. У старой Coffee-кнопки не возникает отдельной обязательной квоты. Монеты за добровольное видео переходят на общую RV-поверхность |

В `SolitaireAdsPlugin.show` синхронизировать whitelist с TS contract для ровно поддерживаемых placements. Разрешения тестовых сборок отделить от признака готовности live-релиза, чтобы native новые сценарии можно было проверить test units до live-включения. Это не обход rollout gate. Публичная сборка не должна показывать тестовые кнопки, hardcoded QA event IDs или неработающий paid checkout.

При объединении Coffee сохранить settlement уже выданных `coffee-break` запросов и их +10 snapshot; новые запросы идут по выбранной общей RV-политике. Нельзя удалить старый parser/pending state и потерять earned пользователя. Observed Unico +3 не превращается в награду за interstitial shown/close.

### 4.5. Подключить готовый диспетчер к настоящим событиям

`createOfferCampaignDispatcher` уже реализован: не переписывать priority/fallback/journal. Создать product adapter для реальных событий и неплатных presenters. Использовать устойчивую локальную identity профиля для бесплатных/coins/RV контекстов; она не выдаёт себя за платёжный аккаунт. P23 сохраняет свой независимый account/provider binding.

- `SessionStarted`, `LevelStarted`, `LevelCompleted` — подтверждённые переходы; последний содержит завершённый уровень, не следующий unlocked. `LevelFailed` — результат; `NoValidMoves` — отдельно диагностированный positive-budget контекст, не синоним поражения и не эвристика «Hint не найден».
- `OutOfCoins` и `OutOfBooster` привязать к действительной попытке действия с его resource/revision; различать Hint и Definition. Повторный render не создаёт новое событие. `Manual` остаётся явным ручным продуктовым запросом; наличие enum не доказывает исходный автоматический вызов.
- Предложение содержит тип действия: free claim / coin spend / rewarded / unavailable-paid. Для этого выпуска недоступный paid CTA не показывается. Сам триггер не выдаёт ресурс и не изменяет сложность/решаемость, чтобы вынудить просмотр.
- Named presenter acceptance, durable display reservation, фактическая видимость окна, SDK shown и earned — разные события. Учесть уже документированный crash после commit перед reveal; повтор не должен расходовать квоту второй раз или называться подтверждённым impression.
- Старые #161/#163 о merchant как условии **любой** рекламы заменяются решением 24 ноября. Checkout/SKU/реальные paid receipts остаются будущим блокером только денежного канала. Готовые Welcome/coin/hint source handlers сохраняются; их paid варианты не включать автоматически.

### 4.6. Неплатные права и независимая экономика

Разделить `storeProgress/free claims/coin purchases` и `paid storefront`. `recordStoreClear` должен получать подтверждённую первую победу в нужном режиме независимо от `STOREFRONT_PREVIEW`; free track доступен без merchant. Сохранить существующие paid права, их scope и безопасную обработку восстановления/отзыва, не создавая новые покупки.

**Общий владелец ресурсов:** `events/daily-tasks.ts::grant/useTaskCharge` сейчас ведёт Definition/Shuffle в `dailyTasks.inventory`, а применяемый Definition использует `rewardOffers.definitions` через `revealRelatedWord`. Перед включением retention-наград свести выдачу и расход к одному каноническому resource/grant contract с миграцией существующих остатков; не суммировать один и тот же grant дважды. Tasks/Daily Bonus/Combo и рекламные/coin маршруты вызывают этот контракт, а не создают собственные кошельки помощников. Принятый игроком заряд должен быть видим и применим без paid storefront. Retention ТЗ отвечает за источник награды/claim, этот блок — за общий учёт и доступность ресурса.

Для **random Joker и Unlimited** нужен явный versioned acquisition contract: `grantId`, тип/источник права (`free`/`coins`/`rewarded`), policy revision, profile/attempt scope, quantity или expiry, state `available→consumed/expired`, request/earned identity при RV. Канал и численные параметры конкретного релизного предложения должны быть записаны в candidate policy и приняты по балансу; это ТЗ их не выдумывает. Тип ресурса случайного Joker отличать от ручного, даже если UI использует общий раздел.

- `random-joker.ts::settleRandomJoker` сейчас ставит карту/очищает Undo и отмечает `randomJokerUsed`, но не проверяет/списывает ресурс кошелька: это бесплатный QA-путь. В коре добавить проверку и однократное потребление отдельного права **в той же транзакции**, что успешная вставка. При отказе proof/ревизии/сохранения право остаётся; предупреждение об Undo показывается до согласия.
- `main.ts` в acceptance получает Unlimited через `quotePurchasedUnlimited`; бесплатные 120 секунд существуют только в `RECOVERY_PREVIEW`. Общий выпуск использует отдельный non-IAP grant→use контракт с областью попытки/сроком действия, сохраняя `beginUnlimited/expireUnlimited` и доменные проверки. RV не формирует фиктивный PurchaseOrder.
- NoAds, VIP, premium Pass и выкуп копилки не становятся бесплатными или рекламными автоматически. Существующий `noAdsEligibility/adFree` различает ordinary ads и rewarded; NoAds не отменяет добровольный RV и не доказывает готовность SDK.
- Экономический отчёт сводит победы/остаток ходов/серии/задачи/free/RV и расходы на помощников/lives/recovery. Для каждого включённого ограничивающего ресурса проверить no-IAP и no-fill сценарий продолжения через предусмотренный кором restart/ожидание/заработок; не создавать вечный тупик из недоступного checkout.
- `MakePurchase` не засчитывать за видео. У исходной таблицы 28 Daily Tasks без покупок может оказаться 960 при пороге1000; это проблема буквального переноса исследованной таблицы, не доказанная блокировка текущих собственных задач. Достижимость общей release-policy проверяется вместе с retention ТЗ.

### 4.7. Доставка ILRD и понятная диагностика

Переиспользовать native разбор `ImpressionData`; не изобретать сумму из request/shown/earned. Расширить общий `analytics-contract.json`, TS bridge и native transport согласованной версией `ad_impression_revenue`: event id, format, placement/context, amount micros, currency, provider/SDK provenance и policy/build. Идентификатор приложения — собственный delivery id; не называть его выданным рекламной сетью impression ID.

- Сохранить событие до потери WebView/listener, затем передать через bounded durable outbox с повтором и дедупликацией. Уже пересланное событие не удваивает агрегат; ненадёжная аналитика не блокирует ход/кошелёк.
- Текущий ring buffer последних128 записей можно оставить диагностикой, но он не заменяет очередь ещё не доставленных событий. Определить её лимит/retention, метрику потерь и retry; не заявлять exactly-once на сервере без подтверждённого backend idempotency.
- AppMetrica `reportEvent`/успешный вызов bridge — стадия передачи SDK, не доказательство приёма аналитическим сервисом. Приёмка требует видимого тестового события с той же валютой/суммой/точкой в разрешённой аналитике. Callback ILRD не доказывает выплату денег рекламной сетью.
- Обособить opportunity, request, shown, impression, earned, grant, forwarded/revenue. Запретить смешивание test/live и разных валют в одной денежной сумме. Не сохранять сырые SDK payloads или пользовательские идентификаторы без необходимости.

## 5. Параметры, сохранения и включение

| Набор | Подтверждённый статус | Действие |
| --- | --- | --- |
| Текущий BALANCE: win25/+2, Hint100/Undo60/Joker250, Continue10 за120; P20 +30/24h и flat20, theme24h | Собственные текущие настройки, не точные исходные | Сохранить для старых quotes/attempts. Изменение общего candidate баланса версионировать и обосновать расчётом/плейтестом |
| AZUR win25/50/100/200, fallback100, gated +5/remaining; x3/x5/frequency3/maxHard/wait0; free200/RV400/cap10/gap300 | SOURCE_COMPILED_DEFAULT; difficulty mapping нашего QA — PRODUCT_ADAPTED | Воспроизводимые исходные fixtures. Для live нужна зафиксированная единая product policy, не смешение произвольных constants из разных источников |
| Текущий banner L3, межуровневый послеL5/3wins/120s; AdsBreak L16/180s/неsuperhard/>10moves; Coffee+10 | Собственные действующие/preview правила, оригинальные live значения не подтверждены | Свести частоты в одну политику и проверить совместно. Этот документ не увеличивает частоту и не утверждает +10/лимиты как финальные |
| Новые non-IAP права, daily policy, экономика источников/расходов | Конкретные размеры/цены/сроки ещё не приняты | Реализовать контракт, собрать тестируемую candidate-конфигурацию и отчёт баланса. Семь уже одобренных направлений повторно не согласовывать |

Миграция сохраняет старые C1–C8 deal IDs, active/parked attempts, исторические выплаты, earned/shown journals и уже полученные права. Политика quote заморожена до завершения; действие Undo не откатывает receipt/entitlement/wallet. Не импортировать QA-профиль как будто это пользовательское production-сохранение. Rollback отключает новые запросы, но продолжает завершать ранее подтверждённые earned и сохраняет права.

Готовность SDK определяется фактически настроенными рекламными units/провайдером, их доступностью и проверенными callback. Отсутствие IAP merchant не блокирует эту работу. Наличие/отсутствие аккаунта выплат в этом аудите не проверялось; это конкретный внешний gate, а не основание объявить рекламу заранее невозможной. Новые точки и частота включаются после принятой SDK, balance, UX и signed Android проверки.

## 6. Приёмка и порядок сдачи

| Проверка | Ожидаемый результат / независимая опора | Среда и статус сейчас |
| --- | --- | --- |
| P20 shown nonce и контроль обычного hint | Дефект из §4.1 воспроизведён; после исправления оба допустимых shown меняют cadence один раз, неизвестный nonce нет | Узкая actual product function проверка выполнена; исправление и регрессии PLANNED |
| Victory formula/schedule | 50+25+x3=175, x5=275; base/moves разделены; x3,x3,x5 на подходящих вызовах, Extreme/повтор/disable отдельно; no-fill не выдаёт ресурс | Source E1 + численный oracle; unit и общий UI PLANNED |
| Free/RV | Бесплатная выдача без SDK, отдельные earned quota/cooldown, UTC boundary и rollback; старые quotes завершаются один раз | Source E2, SaveStore failure injection и relaunch PLANNED |
| Callback order и запись | earned→shown, shown→earned, close без earned, duplicate/late, write failure, ack failure, kill; нет потери выданного права или повторного начисления | Unit/native harness + настоящий Android SDK PLANNED |
| Контекстные offers | Реальные игровые события, completed level, positive-budget no-valid отдельно от failed; no merchant не мешает free/coins/RV; failed presenter не расходует новую квоту | Готовый dispatcher + UI/game integration PLANNED |
| NoAds/баннер/пауза | Два ordinary scopes, независимый RV; один in-party break; блокировка на gesture/modal; поле/scroll и платёжные права сохраняются после фона/rotation | UI320×568 и390×844 + signed Android PLANNED |
| ILRD | Только реальный SDK payload; одинаковые id/amount/currency/placement от capture до аналитики; duplicate/offline/relaunch и test/live разделены | Native/transport tests + наблюдение в аналитике PLANNED |
| Полная экономика | Все включённые награды/расходы и права достижимы без IAP, no-fill не создаёт вечный тупик; источник каждого grant обозначен | Воспроизводимый economy report + человеческий плейтест PLANNED |

Сдавать последовательными scoped PR: **(1)** identity/cadence и общие сохранённые reward/grant contracts; **(2)** единая victory/free→RV policy и реальные CTA; **(3)** placements/одна пауза/неплатный dispatcher и отвязка бесплатного прогресса; **(4)** ILRD transport и общий signed Android acceptance. Базовую C8-интеграцию вести с core ТЗ; не заводить новую взаимно исключающую QA-ветку вместо проверки общего состава. Части без внешней зависимости продолжать автономно.

Для каждого PR указать фактические source IDs, код/флаг/тестовый build, выполненные проверки, source fidelity и конкретный оставшийся gate. Обновить ledger/progress и связанные #160/#182/#183/#161/#163 по действительному результату. Настоящие исходные runtime-неизвестные не закрываются CI; отсутствие полного оригинального Android не запрещает проверенную PRODUCT_ADAPTED реализацию, если её собственный контракт определён. Само это ТЗ не переводит ни одну строку в ACCEPTED.

**KIT IMPACT: REUSE** текущих SaveStore/receipt/activity/analytics contracts и исследовательского метода; новых общих runtime API это ТЗ не требует.
