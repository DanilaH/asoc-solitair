# Technical Spec 03 — recovery, advertising, monetization and full IAP store

**P01, P18–P25.** Read [source E1/E2 audit](../../qa/content-v8/E1_E2_MONETIZATION_SOURCE_AND_AD_CADENCE_2026-11-21.md), [source E3 41-product catalog and legal path](../../qa/content-v8/E3_IAP_COMMERCE_SOURCE_TO_PRODUCT_2026-11-21.md), [consumer ad-clock issue #80](https://github.com/DanilaH/asoc-solitair/issues/80), [CORE-5 actual-board recovery](../../qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md). This stream is the primary home for **13 E1, five E2 and 18 E3 feature IDs**; no commercial system is dropped because it is not the easiest first implementation.

## P01 · P1 fix: fullscreen request is not an actual shown impression

**Primary source ID:** `azur-fullscreen-ads-clock`. **Current confirmed code regression:** `src/platform/ads.ts createAds.show` calls `options.beforeShow` **before** `native.show`, while `src/main.ts beforeShow` persists `platform.lastFullscreenAt=Date.now()` for rewarded and interstitial **and resets `winsSinceInterstitial=0` for interstitial**. Java `SolitaireAdsPlugin.java` can return `shown=false/outcome=unavailable` (for example SDK initialized but interstitial not loaded), `error` or `cancelled`. Its native callbacks already distinguish `onAdShown → phase=show`, `onAdImpression → phase=impression`, `onRewarded → durable earned receipt`. Current source can therefore reduce ad cadence after **no ad was shown**. Source original AZUR uses shared *shown* timestamps but its live values are not ours.

### Required engineering design

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

Primary IDs: `hitapps-stock-restore`, `hitapps-revive-offers`, `azur-unlimited-moves-offer`.

- Original Hitapps PaidRestoreStock getter: **first cost 0**, subsequently `base + (count−1)*increment`; actual base/increment, reset and eligibility unknown. Our Rules3 currently allows **unbounded recycle for one move**, so a *paid stock restore* cannot be created by charging for the exact same free action. Specify **a separate meaningful rules capability** (e.g. different finite stock rights), versioned in `Deal/Board`, with a saved count and independent legal/invalid actions; do not break archived v3 games.
- Original RevivesMovesOffer fields distinguish payer/nonpayer and minLevel, coins/reward amount coefficient, cooldown, daily cap; active cohort/values unknown. Design configurable, **transparent** chosen product policy with separate coins/rewarded/other offer; persist attempt and offer identity, don't infer an actual payer from absent IAP ledger. Do not create artificial deterministic unwinnable board to force paid rescue.
- AZUR unlimited OutOfMovesPanel has compiled 3s optional restart reveal but no proven original entitlement lifespan/price. Define our own `unlimitedForAttempt / untilTime / paidLifetime` semantics **explicitly**, handle timer and `movesLeft=null`, hint/solver/Undo/win receipts, restart/replay/park, and old save. Paid eligibility depends P23/P24. Never call +10 `Unlimited`.

**Exit:** separate rule and offer contracts, native/source UNKNOWN documented, versioned cleanup/disable, no forced spending; owner sign-off required for live paid/finite-stock mechanics.

## P20 · Win rewards, free claim, Definition and theme offers

Primary IDs: `azur-win-multiplier`, `hitapps-win-rewarded-offer`, `unico-rewarded-theme`, `unico-double-reward`, `azur-definition-consumable`, `azur-free-shop-coin-claim`, `azur-remaining-moves-coin-bonus`.

- Keep distinct original evidence: AZUR video **x3 and temporary x5** CTA; Hitapps win RV config metadata; Unico **double** result video; AZUR +200 free shop sample **845→1045** with ad/cap unknown; Definition source viewer and SKU family; rewarded cosmetic «Try Now» badge; AZUR unused-move coin bonus is **inferred ≈5/remaining move** from source videos, our own `coinsPerRemainingMove=2`. None is a verified live reward/payout or recommended price.
- Implement separate opt-in user surfaces **without changing baseline win grant**; context payout receipt ID `(canonical win/economy revision,placement,provider receipt)`, grant bonus delta **once**, persist after verified earned callback; no reissuing at animation, replay, ad dismiss or midnight. Build own product price/amount configuration, include free/coin earned variants explicitly distinct from IAP.
- Define Definition as a specific resource/charge **separate** from existing free card reader; do not remove basic learning UX by silently paywalling it. Keep unique rewarded theme entitlement with visibility/expiry/restoration. Free shop claim has true cooldown and earned evidence, never mint on request. NoAds/bundles reside in P25.
- Quantify wallet supply vs sinks and the effect of multiplier on P18 +10/Undo/replays and level finish. No externally unverified income claims.

## P21 · In-play AdsBreak, banner, revenue, Coffee Break

Primary IDs: `hitapps-adbreak`, `hitapps-ingame-banner`, `azur-ad-revenue-attribution`, `unico-coffee-break`. Depends on fixed P01 event identity and audited P18 receipts.

Original Hitapps `AdsBreakService` uses configurable in-level opportunity and **per difficulty/per-level caps/cooldowns**, active remote numbers UNKNOWN; AZUR shared 120s local default, `OnRevenuePaid` interfaces don't prove ILRD success. Existing product banner available after campaign level≥3, real safe-area/callback unknown. Unico optional Coffee Break +3 sample is VIDEO, no proven transaction.

Build an offer **eligibility engine separate from user-visible actions**, with placements `opportunity→request→native_shown→impression→earned/revenue`, unique request/session ID, per-level/difficulty counters reset on actual source/product-defined rules, background/offline/resume, no in-level ad interrupt behind a live gesture, no effect on daily until explicit policy. True ILRD requires provider revenue payload+currency+placement+event identity, **not** revenue from show-request. Coffee Break must be opt-in with source-known +own amount and earned receipt before coins. Keep native banner safe-area tests, orientation/FontScale and no-fill. **Owner activation needed** to alter advertising intensity and revenue eligibility; build/test controls default-off.

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

Primary IDs: `hitapps-piggy-bank`, `azur-play-pass`, `hitapps-rotating-offers`, `hitapps-birthday-offer`, `hitapps-decoy-offer`, `hitapps-starter-offer`, `hitapps-inapp-shop`, `azur-offer-campaign`, `unico-vip`, `azur-iap-no-ads`, `azur-iap-coin-packs`, `azur-iap-coin-offer-series`, `azur-iap-premium-bundles`, `azur-iap-welcome-offer`, `azur-iap-unlimited-moves-tiers` — **all 15**, including 9 current live payment blockers under E3.

Design separately versioned and testable family modules:
- **PiggyBank** accumulating earned currency, unlock claim, cap, paid conversion/refund (original video only);
- **PlayPass / VIP** free/premium tracks and time/benefits (AZUR original local Gold Pass consumable, subscription NOT proven; Unico VIP video only), owner-approved entitlements, weekly/season/expired claim; integrate P26–P32 meta;
- **Rotating/Birthday/Decoy/Starter/Welcome/CoinOfferSeries/Campaign offers** each with source UNKNOWN trigger/remote, product-declared eligibility, first-use, duration, progression, fairness, no fake sale/urgency, no private birthdate gathering without need and consent;
- **Shop + 8 coin packs + 4×5 helpers + 3 premium bundles** concrete own benefit and purchase price from verified store, one provider grant ID per actual paid order;
- **NoAds** explicit banner/interstitial scope and whether voluntary rewarded remains available; refund/revoke restores policy; **Unlimited 3 tiers** source title-only, design real duration/expiry/budget/Undo and stacking, never advertise +10 as infinite.

Local models/UX may be delivered feature-flagged/offline without shipping a `Buy` button; live activation of **any** actual purchase must wait for P24 official merchant eligibility, end-to-end P23 verification and explicit owner policy. Do not silently drop commercial task kinds from AZUR DailyTasks; ensure P28 can consume real verified `MakePurchase` *only* when an actual paid verified order exists. Revenue attribution requires provider settlements, not mock sales.

**KIT IMPACT: REUSE** receipt/lifecycle principles, with per-store native adapter outside kit until multi-product API semantics are confirmed. User money, ads and private credentials cannot be treated as QA toys.
