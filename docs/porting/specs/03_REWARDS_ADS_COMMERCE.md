# Technical Spec 03 — recovery, advertising, monetization and full IAP store

**P01, P18–P25.** Read [source E1/E2 audit](../../qa/content-v8/E1_E2_MONETIZATION_SOURCE_AND_AD_CADENCE_2026-11-21.md), [source E3 41-product catalog and legal path](../../qa/content-v8/E3_IAP_COMMERCE_SOURCE_TO_PRODUCT_2026-11-21.md), [consumer ad-clock issue #80](https://github.com/DanilaH/asoc-solitair/issues/80), [CORE-5 actual-board recovery](../../qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md). This stream is the primary home for **13 E1, five E2 and 18 E3 feature IDs**; no commercial system is dropped because it is not the easiest first implementation.

**Метод исследования и переноса · 24.11.2026:** [текущий метод](../RESEARCH_METHOD_2026-11-24.md) и [шаблон передачи](../RESEARCH_TO_IMPLEMENTATION_BRIEF.template.md) разрешают использовать прочитанный исходный код и архитектуру — в том числе eligibility, состояния предложения, сохранение и порядок callbacks — как основу нашей реализации без clean-room изоляции. Точные релевантные фрагменты вывода инструментов остаются в private mini-games-kit с provenance; псевдокод и наш код обозначаются отдельно. Static, NATIVE_ISOLATED исходных функций, собственная модель и полный Android/SDK-сеанс не взаимозаменяемы. Это не меняет различия free/rewarded/IAP, формулы, правила no-fill, продуктовые решения или условия SDK-приёмки ниже.

## Применимость требований · уточнение 24.11.2026

[Первый выпуск: кор и реклама](../OWNER_AD_RELEASE_2026-11-24.md) снимает зависимость выпуска от live IAP/P24, сохраняя весь будущий коммерческий scope. [Сверка возможностей](../PRODUCT_CAPABILITY_RECHECK_2026-11-24.md) различает source ID, продуктовую возможность и вариант её политики. Разделы P20/P21 ниже заменяют прежние нормы «отдельный surface для каждого коэффициента», «free claim требует earned» и «Unico opt-in Coffee Break как отдельный обязательный placement». Исторические наблюдения и уже написанные адаптации не переписываются в доказанную source parity. Runtime, баланс, source IDs и статусы приёмки этой правкой не меняются.

## P01 · Actual shown clock: historical defect and current code boundary

**Code rechecked at C8 HEAD `c4215e18d54927a5ac73a350876f29852aa36861`:** the beforeShow timestamp defect described below is corrected in this code snapshot. Native `shownJournal` persists the bound `onAdShown` identity separately from the earned journal; `src/platform/ads.ts::recoverShown` delivers it to `src/main.ts::commitShown` and `applyFullscreenShown`. Pre-show checks no longer persist a shown timestamp merely because an ad was requested. This is a code-level correction, not a new claim that issue #80 is closed, merged release acceptance is complete, or real Android SDK/lifecycle tests have passed.

### Historical defect and original acceptance design

The following defect description and numbered design are retained for provenance. Their references to missing callback identity or the old beforeShow writer describe the earlier implementation, not the checked C8 HEAD. Device acceptance and negative regressions remain applicable.

**Primary source ID:** `azur-fullscreen-ads-clock`. **Historical defect recorded in the 21 November source/product audit:** `src/platform/ads.ts createAds.show` calls `options.beforeShow` **before** `native.show`, while `src/main.ts beforeShow` persists `platform.lastFullscreenAt=Date.now()` for rewarded and interstitial **and resets `winsSinceInterstitial=0` for interstitial**. Java `SolitaireAdsPlugin.java` can return `shown=false/outcome=unavailable` (for example SDK initialized but interstitial not loaded), `error` or `cancelled`. Its native callbacks already distinguish `onAdShown → phase=show`, `onAdImpression → phase=impression`, `onRewarded → durable earned receipt`. That historical code could therefore reduce ad cadence after **no ad was shown**. Source original AZUR uses shared *shown* timestamps but its live values are not ours.

### Original engineering design and continuing acceptance criteria

1. Split **pre-show eligibility/continue proof and request lifecycle** from actual `SDK_SHOWN`. Preflight may reject attempted continue before invoking ad; it must **not** update fullscreen timestamp or interstitial win quota. New callback/return contract must carry **per-request identity** (kind, placement, attempt/deal and unique ad session ID) to prevent stale/duplicate `show` events for a different board. Existing `AdEvent {kind,phase}` lacks identity; extend it safely or choose an equally robust verified binding. Do not misattribute two interleaving ads.
2. Move persistence of `lastFullscreenAt` and `winsSinceInterstitial=0` to a real native `onAdShown` event for the exact interstitial, **idempotent under two shown callbacks**. A successfully shown rewarded ad may share the fullscreen cooldown if that product policy remains approved; a rewarded request without show may not. Define whether the durable state must be committed during show vs on outcome, and test process death before/after show. `impression` is a separate SDK event and **must not** be inferred from `shown`; `earned` alone grants reward after native journal and JS SaveStore dedup.
3. Preserve compatibility of existing `PlatformState.lastFullscreenAt` which historically means **attempted** show. On reload/migration do not instantly allow burst ads or permanently lock cadence; use explicit versioning and conservative transition. Repair no-fill logic without changing configured **three wins/120s/level>5** policy without owner decision.
4. Negative controls using injected ready fake bridge: (a) interstitial SDK `unavailable`, (b) rewarded no-fill, (c) sync throw, (d) cancelled before show, (e) onShown then dismissed, (f) onImpression without onShown, (g) repeated/late onShown after new attempt, (h) show and app background/restart, (i) earned after dismiss, (j) duplicate ad receipt. No-show must retain prior timestamp/counter; shown updates them **once**; pre-ad request doesn't grant moves/coins or issue false impressions/revenue.
5. Native signed Android test in ad **test mode** with observed onShow/no-fill and activity pause; a mock browser-only green test is `ENGINEERING_VERIFIED`, not real SDK device acceptance. Do not deploy new in-level ad placements in this bugfix.

**Exit:** source-oriented `#80` closed only with PR, exact-head CI, stored before/after state, repeated/late callbacks, signed debug APK and actual Android evidence or outstanding `NEEDS_DEVICE`. Developer reports current popup and level state unaffected.

## P18 · Current CORE-5 coin/rewarded +10, Undo/replay and loss screen

Primary IDs: `azur-coin-moves`, `azur-rewarded-moves`, `unico-loss-dialog`. Actual product C8 `0.20.3` uses one **verified actual exhausted-board <=10-move continuation**, either **120 coins** or one genuinely **earned rewarded** video, with saved credit for stale receipt and another usable Undo/Restart option when ad is unavailable; source AZUR native local defaults **900 coins/10 moves, 5 rewarded moves** are different and can be remotely overridden, Unico screenshot **1500 coins/10** isn't a live default. Keep product's explicit 120/+10 and 10+RV unless owner retunes after actual play.

**QA**: prove `requiresContinueProof/verifiesContinue` on exact `dealId,attemptId,board,budget,Undo`; 320px/portrait result modal after real exhausted game; no-fill must not leave blank/result closed; background after earned before ack/reopen same attempt or parked campaign; duplicate/stale native receipt cannot credit a second board or double charge. Coin debit and resume in **same SaveStore commit**. No false guaranteed rescue if worker returns UNKNOWN. On extended add moves Undo snapshots must adjust correctly and support replay; invalid/failed coin spend does not mutate. Test real Android ad ready/earned/cancel and compare with original only when P36 available. Further staged E1 commercials P19/P20 never overwrite this recovery contract.

## P19 · Distinct Hitapps stock restore, contextual revive, AZUR Unlimited

**OWNER DIRECTION 22.11.2026 — вариант А:** полная реализация и **условная активация в ОБЫЧНОЙ кампании** всех трёх систем (`RestoreStock`, `Revive`, `Unlimited Moves`) после исследования исходных правил, тестов баланса и совместимости сохранений. Новые кампании получают собственное **реальное ограничение** на бесплатные `recycle`, иначе платное `RestoreStock` не имеет смысла; старые раздачи и saves сохраняют прежние правила и не мигрируют молча. Revive/Unlimited не являются одним и тем же ресурсом и отдельно от P31 Lives. Исторические неизвестные ограничения, цены/сроки и штатные SDK/платежи по-прежнему требуют evidence/owner numeric profile. [Полный owner record](../OWNER_DECISIONS_2026-11-22.md). Повторно спрашивать, включать ли саму систему в обычную кампанию, не надо; текущая offline P19 не равна shipped feature.

Primary IDs: `hitapps-stock-restore`, `hitapps-revive-offers`, `azur-unlimited-moves-offer`.

- Original Hitapps PaidRestoreStock getter: **first cost 0**, subsequently `base + (count−1)*increment`; actual base/increment, reset and eligibility unknown. Our Rules3 currently allows **unbounded recycle for one move**, so a *paid stock restore* cannot be created by charging for the exact same free action. Specify **a separate meaningful rules capability** (e.g. different finite stock rights), versioned in `Deal/Board`, with a saved count and independent legal/invalid actions; do not break archived v3 games.
- Original RevivesMovesOffer fields distinguish payer/nonpayer and minLevel, coins/reward amount coefficient, cooldown, daily cap; active cohort/values unknown. Design configurable, **transparent** chosen product policy with separate coins/rewarded/other offer; persist attempt and offer identity, don't infer an actual payer from absent IAP ledger. Do not create artificial deterministic unwinnable board to force paid rescue.
- AZUR unlimited OutOfMovesPanel has compiled 3s optional restart reveal but no proven original entitlement lifespan/price. Define our own `unlimitedForAttempt / untilTime / paidLifetime` semantics **explicitly**, handle timer and `movesLeft=null`, hint/solver/Undo/win receipts, restart/replay/park, and old save. Paid eligibility depends P23/P24. Never call +10 `Unlimited`.

**Exit:** separate finite-stock, Revive and Unlimited rules/entitlements, verified source-or-adapted parameters, versioned migration and clean negative tests; the owner has approved inclusion and QA-gated activation, but numeric amounts / actual provider billing and Android device remain separate release gates; no forced spending.

## P20 · One post-win offer policy, free/rewarded coin stages, Definition and themes

Primary IDs: `azur-win-multiplier`, `hitapps-win-rewarded-offer`, `unico-rewarded-theme`, `unico-double-reward`, `azur-definition-consumable`, `azur-free-shop-coin-claim`, `azur-remaining-moves-coin-bonus`. All remain mapped; several source IDs may feed one product capability without losing their independent evidence or unknowns.

**Correction dated 24 November:** the earlier separate-surface wording did not establish that every reference name or multiplier must become a separate product placement. The old +200 ad/cap UNKNOWN and video-only AZUR formula notes are superseded for the specific branches recovered in [source free/rewarded issue #160](https://github.com/DanilaH/asoc-solitair/issues/160), [victory base/bonus issue #180](https://github.com/DanilaH/asoc-solitair/issues/180) and [x3/x5 issue #182](https://github.com/DanilaH/asoc-solitair/issues/182). Those findings are authenticated original **NATIVE_STATIC**, not original Android/SDK execution or live remote configuration. [P20 preview record](../P20_REWARD_OFFERS.md) retains the actual earlier product adaptation.

### One post-win opportunity with versioned policy variants

- AZUR x3 and x5 are a selected factor of **one rewarded victory claim**, not two required SDK placements. Its source-compiled fallback schedule selects x3/x3/x5 over qualifying calls with a persisted counter and difficulty gate; active values and original replay semantics remain unknown. Unico x2 is observed UI evidence, while Hitapps win RV configuration is metadata evidence; neither proves the same formula, schedule or callback behavior as AZUR.
- Preserve current own factor2/factor3/factor5/flat variants as versioned policy choices, not four mandatory simultaneous buttons or independent per-factor quotas. The current fixed +20 is a product preview amount, not a recovered Hitapps payout. Use one appropriate selected offer and a canonical once-only grant policy; keep existing historical dedup identities compatible when defining a new revision.
- Keep baseline grant, bonus calculation and presentation separate. For source-shaped AZUR, `rewardedExtra = (selectedFactor - 1) * tierBase`; `movesBonus` is already credited once and is not multiplied. Base50 + movesBonus25 + x3 extra100 =175 overall; multiplying the whole75 to225 is **not** that source formula. The current own trial instead multiplies ordinary base plus remaining-moves reward; it is PRODUCT_ADAPTED and must not be silently relabelled source-exact. Stage/cycle/streak/gold rewards remain separate from either multiplier basis.
- Store the relevant base components, quote, policy revision and result identity before the ad; do not reconstruct an old win from today's balance. Grant only the saved extra on a matching earned receipt, once; ordinary claim/continuation remains available as defined by the selected result flow. No second base grant from a button, animation, replay or ad dismissal.
- Distinguish counters by their actual trigger. Source x5 schedule progresses on eligible victory/UI calls under `IsRewardedAdsAllowed`, **not earned video completions**. A rollback after a later no-fill is not established by that source trace. Product dedup/retry rules may strengthen it but must be declared adaptations. A no-fill grants no reward; that does not establish that every previously advanced eligibility counter must rewind.

### One coin-reward flow with distinct free and rewarded stages

- Source AZUR has a true free claim without an ad, followed by an optional rewarded stage. Verified compiled defaults are free200 once per UTC-date key, then rewarded400 with max10 earned/day and300s post-earn spacing. These are source fixtures, not approved production amounts/quotas. Preserve the original state separation even when choosing our own calibrated values.
- The free action requires its own date/entitlement identity and atomic wallet+claimed commit, **not an earned advertising receipt** and not IAP. The rewarded action requires its own quote, earned receipt and earned-count/cooldown commit. Request, shown, dismiss and no-fill do not grant the rewarded amount. Test UTC rollover, rollback, duplicate/late callbacks and interrupted persistence independently.
- Current `shop-free-coins` +30/rolling24h is actually a rewarded adaptation. It does not implement the source's free first stage, UTC policy or successor quota. Seasonal Pass free coins are another reward and do not substitute for the source shop claim. These may share a resource screen without requiring separate redundant product buttons or a live paid storefront.

### Other rewards retain their own semantic contracts

Definition remains a specific resource/charge distinct from the existing free card reader; do not silently remove basic learning access. A rewarded theme has its own cosmetic entitlement, visibility, expiry and restoration. Helpers, moves, bonus slots and lives may share the ad transport but not their entitlement targets or rules. Free claim, internal-coin exchange, rewarded earned and IAP are different authorizations even when they grant the same kind of resource.

Quantify wallet supply and sinks across baseline wins, remaining moves, tasks, claim stages, selected post-win policy, helpers, recovery and lives. Do not infer income, conversion or retention from compiled defaults, mocks or the existence of an ad button. Real SDK, balance and UX acceptance still gate new live advertising.

## P21 · One in-play advertising-break capability, banner and revenue attribution

Primary IDs: `hitapps-adbreak`, `hitapps-ingame-banner`, `azur-ad-revenue-attribution`, `unico-coffee-break`. Retain the complete owner-approved P21 direction and the conditions of real SDK, balance and UX acceptance. [P21 clarification](../P21_AD_PLACEMENTS.md) and [first-release scope](../OWNER_AD_RELEASE_2026-11-24.md) replace the earlier requirement for a separate mandatory opt-in Coffee Break and independently additive quotas. P24/live purchases are not prerequisites for advertising.

### Evidence and product mapping

Hitapps source supports configurable in-level opportunities with difficulty/level caps; live remote values are unknown. Original Unico footage shows **Daily interruption +3**, with the same board after return; a separate opt-in was not observed. Ad format, consent/skip behavior, exact settlement callback and active cadence remain UNKNOWN. See [source correction #157](https://github.com/DanilaH/asoc-solitair/issues/157). Do not repeat the superseded source label “Unico optional Coffee Break” as a verified fact.

AdsBreak/Coffee map to one product advertising-break capability with declared context/trigger/reward variants and a common fullscreen-frequency policy. Keep context-specific limits when justified by source or chosen product rules, rather than granting another independent ad budget because a reference used another name. Current campaign opt-in +10 and offline +3 trials are PRODUCT_ADAPTED; they do not prove the original callback or require a separate Coffee CTA. Voluntary coins-for-video belong to the rewarded-offer layer. Banner remains its own SDK/layout format.

### Separate event facts, not one automatic grant chain

| Fact | Authority and permitted effect |
| --- | --- |
| Opportunity / request | Eligibility and request lifecycle only; no invented show, reward or revenue |
| Bound native shown | Actual display and declared frequency accounting, once; not proof of impression or earned |
| SDK impression / ILRD | Provider payload plus currency, placement and event identity; independent telemetry, not player reward or proof of payout settlement |
| Rewarded earned | Matching saved entitlement, atomic SaveStore effect/dedup, then native acknowledgement |
| Dismiss / interstitial completion | Return/resume; neither substitutes for earned or independently authorizes coins |

Do not derive an original Unico reward from a generic shown/dismiss callback. A source-shaped +3 variant requires stronger source evidence or a separately declared product settlement contract. No-fill without show must not create shown/earned/revenue or a reward; a real shown followed by an error remains a historical show. Shared transport and cadence must not collapse distinct clocks or receipt purposes.

### Integration and acceptance

Use stable request/session, attempt/deal and placement identities; per-context eligibility and counters follow explicit rules. Never interrupt an unfinished gesture or roll back a committed move. Preserve the exact active/parked board through background, offline, no-fill, cancellation and relaunch. Existing source Daily eligibility remains an evidence gap to model, not automatic permission to turn on new forced Daily ads.

Native ILRD parsing and the current local buffer do not establish completed analytics delivery: transmit actual amount/currency/placement/event identity and check the real SDK/dashboard path. Retain banner safe-area, FontScale, orientation and lifecycle checks. New placements and increased frequency remain default-off until the already accepted SDK/balance/UX gates and actual provider/rate settings pass. IAP unavailability does not block this work.

## P22 · Full offline AZUR commercial catalogue

Primary IDs: `azur-iap-product-catalog`, `azur-iap-helper-ladder`; source verified [41-SKU local aggregate](../../qa/content-v8/e3-source-commerce-matrix.json). **41 distinct source product concepts:** eight coin packs, three Coins Offer series, four helper families each five `Min/Min2/More/NoAds/NoAds+More` variants, two NoAds, one Welcome, three Unlimited, three premium tier bundles, one Gold Pass; **28 consumable/13 nonconsumable/0 subscription in original bundled asset**. All source `storeIDs`/`payouts` arrays empty, source numeric prices have **unknown currency/active listing**. Gold Pass local `ProductType=Consumable` is **not** automatic renewed subscription.

Create own typed `ProductDefinition` with unique **new own SKU**, source concept mapping, product type, explicit benefits, term/expiry, seller/provider availability, entitlement vs repeatable consumed grant, balance version and source evidence. Do not copy proprietary vendor IDs/words/art or expose purchases when no legally supported provider; use `DISABLED_NO_MERCHANT` with QA-only test harness. Create deterministic catalog/cross-family acceptance and negative fixture for inconsistent goods/price/NoAds bundle.

## P23 · IAP verified order ledger separate from native ad receipts

Primary ID: `azur-purchase-receipts` (`METADATA`, no original crash-safe payment proof). The existing `EarnedReceipt` in `src/domain/services.ts` and native `RewardJournal` belong **only to earned advertising**, not real paid invoices.

Create versioned `PurchaseOrder {provider,appId,storeProductId,invoiceId,purchaseId,status,verificationProof,...}` and `Entitlement {productKey,type,grantKey,expiresAt/refund,...}` with authoritative billing-provider confirmation before grant, **exactly once per verified purchase**, write durable SaveStore transaction before provider consumption/ack, later refund/revoke/reinstall restore and pending recovery. Protect against duplicate and re-ordered callbacks, cross-app invoice, mismatched product/currency, tampered client payload, service downtime, offline/grace period, duplicate consumable replay, account switch. Tests must not ship a fake positive IAP bridge in production; avoid putting payment secret keys in APK or GitHub.

**Exit:** offline ledger and synthetic error-path QA can be engineering-verified **without** live payment. True commerce acceptance still P24.

## P24 · Legal merchant/billing API selection and actual checkout

**External gate, no additional primary ID**. As of 21 Nov 2026 [official RuStore notice](https://www.rustore.ru/developer/blog/self-employed): **own Pay SDK disabled for ordinary individual/self-employed non-IP accounts since 1 Feb 2026**; registered **IP on NPD with qualified electronic signature** is documented eligible, not the user's current assumed status. [RuStore app terms](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/requirement-apps) require declaration of any external payment. [NashStore developer offer](https://nashstore.ru/doc/developer_agreement) accepts self-employed sellers but **does not confirm live in-app purchases and payouts** to this account. Ads payout and free APK distribution are separate.

Before actual live billing: collect current official provider docs/contract, permitted KYC for Russian self-employed or lawful IP entity, actual settlement to owner's own authorized account, store declarations, sandbox and live product eligibility, refund/consumer terms and tax receipt obligations. No borrowed identity, fake residency, invented Pay SDK privileges or secret credentials. Only then build provider SDK adapter, verify signed original APK and actual test purchase/restore/refund, update matrix and ledger. **If provider missing:** mark `BLOCKED_EXTERNAL`, complete independent P22/P23/P25 offline work, continue elsewhere.

## P25 · Every E3 source offer family retained, own real entitlement semantics

**OWNER DECISION 22.11.2026 · P25 option A:** Full three-vendor monetization **must** be implemented including all 15 existing source commercial families, P22 41 AZUR catalog concepts and exact-source-tier index of 10 publicly displayed Unico iOS item names including Fail Offer V2 / Hard / Very Hard / Advantage. Staged activation is allowed and required **only after** legal merchant access/payout, approved prices, trusted P23 grants, restore/refund, game balance and UX. Owner did **not** select a permanent or mandated shop+NoAds-only paid launch. New source family identity must be proven before incrementing source count; no live transaction, source-original price or renewal terms can be fabricated from store labels. [Binding decision](../OWNER_DECISIONS_2026-11-22.md) · [unified implementation TZ](../OWNER_SEVEN_DECISIONS_IMPLEMENTATION_TZ_2026-11-22.md). Current models remain offline, no checkout approved yet.

Primary IDs: `hitapps-piggy-bank`, `azur-play-pass`, `hitapps-rotating-offers`, `hitapps-birthday-offer`, `hitapps-decoy-offer`, `hitapps-starter-offer`, `hitapps-inapp-shop`, `azur-offer-campaign`, `unico-vip`, `azur-iap-no-ads`, `azur-iap-coin-packs`, `azur-iap-coin-offer-series`, `azur-iap-premium-bundles`, `azur-iap-welcome-offer`, `azur-iap-unlimited-moves-tiers` — **all 15**, including 9 current live payment blockers under E3.

Design separately versioned and testable family modules:
- **PiggyBank** accumulating earned currency, unlock claim, cap, paid conversion/refund (original video only);
- **PlayPass / VIP** free/premium tracks and time/benefits (AZUR original local Gold Pass consumable, subscription NOT proven; Unico VIP video only), owner-approved entitlements, weekly/season/expired claim; integrate P26–P32 meta;
- **Rotating/Birthday/Decoy/Starter/Welcome/CoinOfferSeries/Campaign offers** each with source UNKNOWN trigger/remote, product-declared eligibility, first-use, duration, progression, fairness, no fake sale/urgency, no private birthdate gathering without need and consent;
- **Shop + 8 coin packs + 4×5 helpers + 3 premium bundles** concrete own benefit and purchase price from verified store, one provider grant ID per actual paid order;
- **NoAds** explicit banner/interstitial scope and whether voluntary rewarded remains available; refund/revoke restores policy; **Unlimited 3 tiers** source title-only, design real duration/expiry/budget/Undo and stacking, never advertise +10 as infinite.

Local models/UX may be delivered feature-flagged/offline without shipping a `Buy` button; live activation of **any** actual purchase must wait for P24 official merchant eligibility, end-to-end P23 verification and explicit owner policy. Do not silently drop commercial task kinds from AZUR DailyTasks; ensure P28 can consume real verified `MakePurchase` *only* when an actual paid verified order exists. Revenue attribution requires provider settlements, not mock sales.

**KIT IMPACT: REUSE** receipt/lifecycle principles, with per-store native adapter outside kit until multi-product API semantics are confirmed. User money, ads and private credentials cannot be treated as QA toys.
