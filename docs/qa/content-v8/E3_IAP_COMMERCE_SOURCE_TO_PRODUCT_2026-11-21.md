# Content 8 · E3: полный каталог IAP, фактическая реализация и условия законных выплат

**21.11.2026 · INDEPENDENT RESEARCH, NO PAID TRANSACTION.** Действительный игровой код Content 8 0.20.3 на исследовательском потомке [E1/E2 PR #81](https://github.com/DanilaH/asoc-solitair/pull/81). Все **18 E3 IDs** входят в общую программу **114 механизмов**. Никаких исключений, новых SDK покупок, игровых цен, правил, save schema, wallet или фактической монетизации этот отчёт не вводит.

## 1. Подтверждённые оригиналы и границы доказательств

| Источник | Что доказано | Что неизвестно |
| --- | --- | --- |
| [AZUR IAPProductCatalog](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-source-packaging/IAP_CATALOG.md) и [machine evidence](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-source-packaging/iap-catalog-summary.json) | Изначальный AZUR XAPK 1.3.3.8/code244, SHA256 4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4. Unity TextAsset с JSON 12764 байта: **41 уникальных SKU, 28 Consumable, 13 NonConsumable, 0 Subscription** | Не найдены подтверждённые текущие IDs магазина, валюта, реально выставленные товары, выдача благ, реальные платежи, возвраты, выручка |
| [Hitapps SYSTEMS](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-systems/SYSTEMS.md) и [native/static](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-hitapps-static/README.md) | Метаданные Shop, Starter, rotating, Birthday, Decoy, PiggyBank; отдельные системы игрока и LiveOps | Серверные значения, активные офферы, реальные платежи, точная логика выдачи благ |
| [Видео Hitapps/Unico](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-09-reference/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md) | Piggy Bank и VIP как видимые пользовательские поверхности | Покупка/начисление/сроки/возвраты |
| Наша игра: src/domain/services.ts, src/domain/types.ts, src/platform/storage.ts, src/main.ts, native SolitaireAdsPlugin.java | Монеты, мягкий магазин помощников, атомарные игровые покупки за монеты, журнал и выдача **earned-рекламы** | **Нет IAP каталога/проверки invoice, платёжных заказов, nonconsumable entitlement, cancel/refund, No Ads, Paid Pass, VIP, store-billing SDK** |

В исходном AZUR XAPK каталоге у **всех 41 SKU пустые массивы storeIDs и payouts**. Это не означает, что платёжный SDK не используется через другие слои, но **каталог сам по себе не подтверждает живую продажу или право владельца**. Отдельно известны codelessAutoInitialization=false и UGSAutoInitialization=false, но это тоже не признак отсутствия платежей в других native методах.

## 2. Полная экономическая структура локального каталога AZUR

| Товарное семейство | SKU | Поля local googlePrice.num; валюту установить нельзя |
| --- | ---: | --- |
| Coin Packs | 8 | 1.99, 5.99, 8.99, 14.99, 19.99, 30.99, 59.99, 99.99 |
| Coins Offer 1 Time/Next1/Next2 | 3 | 0.99, 4.99, 11.99 |
| Hints | 5 | 0.99, 2.99, 6.99, 7.99, 9.99 |
| Undo | 5 | та же пятёрка |
| Definition | 5 | та же пятёрка |
| Boosters | 5 | та же пятёрка |
| No Ads standalone | 2 | 9.99, 9.99 |
| Welcome | 1 | 0.99 |
| Unlimited Moves / + / ++ | 3 | 0.99, 1.99, 3.99 |
| Silver / Gold / Diamond | 3 | 5.99, 11.99, 23.99 |
| Gold Pass | 1 | 9.99 |
| **Итого** | **41** | **28 расходуемых, 13 нерасходуемых, 0 подписочных SKU** |

Пятиступенчатый шаблон **Min / Min2 / More / NoAds / NoAds+More** встречается независимо для четырёх семейств помощи (всего **4×5=20 SKU**). Это доказательство единой **товарной матрицы на уровне данных**, а не конкретного runtime UI-factory или величины получаемой помощи. У двух standalone No Ads одинаковый default 9.99, но Apple price tiers **10/20**, что дополнительно исключает вывод о едином фактическом мультиплатформенном прайсе. **Gold Pass имеет Consumable=0, не Subscription=2** — его название не доказывает возобновляемую подписку. Имена Coins Offer 1 Time/Next1/Next2 не доказывают порядок показа.

## 3. Все 18 E3 систем: source → продукт → нужные доказательства

| Feature ID | Source tier | Фактический статус и недостающий шаг |
| --- | --- | --- |
| hitapps-piggy-bank | VIDEO_OBSERVED | BLOCKED; реальная покупка, накопление валюты/получение/возврат не восстановлены |
| azur-play-pass | ASSET_VERIFIED | BLOCKED; PlayPass prefab и Gold Pass SKU найдены, правила free/premium прогресса и платного entitlement не доказаны |
| hitapps-rotating-offers | METADATA | ROADMAPPED; неизвестны триггер, ротация, давность, ограничения и grant |
| hitapps-birthday-offer | METADATA | EVIDENCE_GAP; название не доказывает момент появления, не собирать дату рождения без необходимости и согласия |
| hitapps-decoy-offer | METADATA | EVIDENCE_GAP; неизвестны конкретный offer/payout/display, не подменять это собственным обманным предложением |
| hitapps-starter-offer | METADATA | ROADMAPPED; нужен отдельный first-play trigger/expiry и receipt, а не копия других цен |
| hitapps-inapp-shop | METADATA | ROADMAPPED; наш мягкий магазин монет ≠ настоящий IAP |
| azur-offer-campaign | METADATA | ROADMAPPED; remote campaign trigger/range/content неизвестны |
| unico-vip | VIDEO_OBSERVED | BLOCKED; VIP виден на видео, его subscription/benefit/restore и покупка не доказаны |
| azur-purchase-receipts | METADATA | BLOCKED; journal rewarded-рекламы не является журналом оплаченных инвойсов |
| azur-iap-product-catalog | ASSET_VERIFIED | ROADMAPPED; семейства 41 SKU восстановлены, но нет локального issuer/каталога продукта |
| azur-iap-helper-ladder | ASSET_VERIFIED | ROADMAPPED; 20 source helper tiers, неизвестны суммы выдачи и реальные цены |
| azur-iap-no-ads | ASSET_VERIFIED | BLOCKED; две standalone позиции и встроенные bundle-типы, нужен scope рекламы и restore/refund |
| azur-iap-coin-packs | ASSET_VERIFIED | BLOCKED; восемь price tiers, количество монет в товаре и net economics не доказаны |
| azur-iap-coin-offer-series | ASSET_VERIFIED | ROADMAPPED; три названия товара не доказывают очередность/cooldown |
| azur-iap-premium-bundles | ASSET_VERIFIED | BLOCKED; три SKU, точный состав и entitlement неизвестны |
| azur-iap-welcome-offer | ASSET_VERIFIED | BLOCKED; один SKU, не доказано, кто/когда видит и что получает |
| azur-iap-unlimited-moves-tiers | ASSET_VERIFIED | BLOCKED; три SKU, durée/expiry/стэкинг/версионированные правила Unlimited Moves UNKNOWN |

**Итог: 9 BLOCKED, 7 ROADMAPPED, 2 EVIDENCE_GAP, 0 ACCEPTED.** Это все 18 из 114 feature IDs, не новые записи, и BLOCKED обозначает блокер именно для live paid deployment, а не запрет offline-каталога и entitlement-engine. Описание конкретных неразгаданных правил сохраняет тот же source evidence tier, не выдавая метаданные за runtime.

## 4. Фактические платёжные каналы для РФ, проверенные 21.11.2026

### RuStore

[Официальное объяснение 20 января 2026](https://www.rustore.ru/developer/blog/self-employed): с **1 февраля 2026** RuStore BillingClient/Pay SDK, платные приложения и подписки отключены для индивидуальных аккаунтов **физлица и самозанятого без ИП**. Бесплатная публикация и рекламные инструменты остаются доступны при выполнении требований партнёров; **ИП на НПД с УКЭП** официально указан как допустимая форма для монетизации RuStore. [Правила RuStore](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/requirement-apps) требуют **декларировать все** способы оплаты, включая внешние. Возможность конкретного эквайринга/официально совместимого checkout и выплат самозанятому — **НЕ ПОДТВЕРЖДЕНА**, поэтому стороннее решение не считается автоматически разрешённым. Никаких серых KYC и чужих юрлиц.

[Официальный обзор Pay SDK, 10 августа 2026](https://www.rustore.ru/developer/blog/perekhod-s-billingclient-sdk-na-pay-sdk-polnyj-gajd): старый BillingClient перестал обслуживать покупки после **1 августа 2026**, текущая интеграция для правомочного разработчика строится на Pay SDK и новых статусах ProductPurchase/SubscriptionPurchase, invoiceId vs purchaseId, 1-/2-step confirmation, cancel/restore. [Покупка без RuStore installed](https://www.rustore.ru/help/developers/monetization/without-rustore-app) технически поддерживается в Pay SDK, но **не меняет правового статуса продавца**.

### NashStore

[Официальная регистрация разработчика](https://help.nashstore.ru/hc/articles/71/registraciya-razrabotchika-nashstore) и [публичная оферта](https://nashstore.ru/doc/developer_agreement) **прямо принимают самозанятых** для продажи приложений. Опубликованная оферта описывает **продажи самого приложения**, отчёты и перечисления; указанные там условия (в частности 12% маркетплейс-вознаграждение и расчёт после отчёта) не следует трактовать как автоматически действующие условия конкретного аккаунта без сверки с его актуальным договором. **Документально подтверждённого текущего NashStore in-app billing SDK для расходуемых/нерасходуемых товаров и фактически доступной выплаты конкретному самозанятому по таким покупкам в доступных официальных материалах не найдено.** Нельзя переносить claim «можно продавать приложение» на «можно принимать IAP».

### Точный gate по путям

| Канал | Подтверждено сейчас | Что остаётся проверить |
| --- | --- | --- |
| RuStore бесплатный APK и реклама | Publication + alternative ad framework | Платёжные условия конкретной рекламной сети отдельно |
| RuStore Pay SDK при статусе физлицо/самозанятый | **NO** с 01.02.2026 | Не разрабатывать live Pay SDK под невозможный текущий legal form |
| RuStore Pay SDK при законном ИП на НПД + УКЭП | **Officially supported scenario** | Фактическая регистрация, договор, счёт, sandbox, выплаты |
| RuStore внешний заявленный checkout | **UNKNOWN** | Официальная совместимость RuStore и доступный провайдер/вывод на собственный счёт |
| NashStore регистрация самозанятого | **YES** в опубликованных условиях | Действительное подключение/выплата и актуальная редакция |
| NashStore платная загрузка приложения | **CONTRACT EVIDENCE** | Работает ли сейчас для данного аккаунта/расчётного счёта |
| NashStore IAP consumables/nonconsumables | **UNKNOWN** | Официальный текущий SDK, договор, KYC/самозанятый, receipt/grants/refunds |

**Важно:** юридический gate относится к конкретному платёжному маршруту, а не к судьбе 18 исследованных систем. Магазин/entitlements офлайн можно и нужно подготовить независимо от live money processor.

## 5. Разработческая очередь, сохраняющая весь E3 scope

**E3-A · Offline catalog/offer model.** Собственная типизированная структура для всех source-families, в том числе 41 товарной категории и всех 18 source IDs; без чужих vendor SKU/артистических ассетов/названий. Для каждой новой собственной позиции — id, тип Consumable/NonConsumable/Pass/TimedBenefit, content version, eligibility, конкретный список благ, срок, доступность по магазину. Платёжная кнопка выключена без авторизованного провайдера. Цену только из live store product и owner-approved policy.

**E3-B · Purchase ledger / irreversible grant.** Отдельно от ad EarnedReceipt: provider/order/invoice/productId/storePackage/status/consumed/grantedAt/refundedAt/verified entitlement. Persist validated purchase exactly once; pending/timeout/duplicate/store-return/restart/reinstall/refund/revoke/restore. Серверная проверка и последующая выдача должны работать с корректным статусом provider, не по нажатию «Купить» или UI redirect. SaveStore migration C1–C8 + parked Daily. Никаких фальшивых чеков, rewarded-плейсментов для покупки и выдачи монет по незавершённому заказу.

**E3-C · Independent offer lifecycle.** Отдельные Piggy Bank, Starter, rotating, Birthday, Decoy, Welcome, Coins Offer Series, AZUR Offer Campaign, Unico VIP. Реальный источник activation/benefit UNKNOWN; собственные product policies требуют честных условий/отсутствия ложного FOMO, тестов времени и назначения cohort, осмысленного UX.

**E3-D · Store goods & entitlement semantics.** Весь ассортимент: 8 coin packs, 4×5 helpers, two NoAds, three Unlimited Moves, premium bundles, Gold Pass и free/premium track. No Ads должен отдельно определить, отключает ли banner/interstitial и что с добровольным rewarded; Unlimited — срок действия, случай Undo/Hint/+10 и корректность solver и save; Gold Pass type=Consumable в источнике не означает подписку. Все предметы остаются roadmap.

**E3-E · Authorized provider adapters.** Только после проверки одного действительно доступного для правового статуса и сторов эквайринга: provider SDK, sandbox, app signature, payment server verify, receipts/reversals/refunds/settled payouts, legal/consumer terms, declarations and data minimization. Подписки отдельно — не выдумывать у AZUR отсутствие/наличие backend subscription по локальному каталогу.

**E3-F · Device QA & economics.** Android pending/replay/reconnect, duplicate callback/receipt, off-device reinstall/restore, store policy, completed paid vs requests, refund chargebacks, real retention/ad cannibalization, verified net payout. Никаких выводов о конкурентном LTV из локального APK.

Связанные зависимости: E1 winner/rescue/coins, E2 confirmed show/impression ([issue #80](https://github.com/DanilaH/asoc-solitair/issues/80)), B3 Equality/segmentation, D1 boosters, F pass/events, G stage/content and real Android physical P6. ИП/NashStore provider вопрос — точный интеграционный блокер live IAP, но **не разрешение исключить системы**.

## 6. Methodology and result status

Source verification already PASS in mini-games-kit with original XAPK. **This turn did not re-run the XAPK binary**; the source catalog SHA and documented aggregate were independently reconciled against actual consumer ledger and real services code. The bundled [e3-source-commerce-matrix.json](e3-source-commerce-matrix.json) is a **non-proprietary aggregate and feature-ID crosswalk**, not a live store product list; infrastructure QA checks count, source IDs and catalog arithmetic. Source tier/original unknowns remain in the matrix, and actual running APK/store purchase is NOT EXECUTED.

**Следующий блок после E3:** F retention/LiveOps source→consumer audit, затем source-native runtime and actual phone study. **KIT IMPACT:** reuse Reference → Product Porting Framework; eligibility is a per-store dated evidence gate, not a new universal SDK. 114/114 retained, 0 OWNER_EXCLUDED.
