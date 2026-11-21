# Content 8 · E1/E2: source-based recovery, rewarded offers and advertising cadence audit

**21 November 2026 · INDEPENDENT RESEARCH / CONSUMER CODE AUDIT ONLY.** C8 0.20.3 CORE-5 actual product code on open staged PR history; the 114-source-feature consumer inventory remains authoritative. References: Hitapps `1.26.2/code3742` XAPK SHA256 `22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0`, AZUR `1.3.3.8/code244` XAPK SHA256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`; Unico video only. **Zero original running Android device captures**, no active remote offer configs, no original earnings or original session-level win conversion measured. Old research-agent HOLD/REJECT statements are **historical recommendations**, not a veto of the owner's full porting scope.

Source provenance: [Hitapps/AZUR loss and ads comparative audit](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-loss-ads-flow/README.md), [original AZUR ARM64 local constants and actual coin/reward branches](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-18-loss-ads-flow/AZUR_NATIVE_PASS_2026-11-18.md), [Hitapps static source](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-hitapps-static/README.md), [systems ad/offer map](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-systems/SYSTEMS.md), [original user-video evidence](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-09-reference/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md). Current product actual `src/{main,domain/balance,domain/services,domain/continuation,platform/ads}.ts`, native `SolitaireAdsPlugin.java`, tests and `docs/qa/content-v8/CORE_5_*.md`.

## 1. E1: source → consumer mapping of all 13 recovery / rewarded / shop systems

| Original feature ID | Source tier and actual original evidence | Current game / precise missing proof |
| --- | --- | --- |
| `hitapps-stock-restore` | **NATIVE_STATIC**: first restoration free (cost 0 when paid restore count=0), later `base+(count-1)*increment` with unknown live values/reset | **DEFERRED**: current Rules3 `recycle` is unlimited and costs one move. Cannot start charging for an identical action without explicit product rule/version migration. Keep free/paid restore as a separate future capability |
| `hitapps-revive-offers` | **METADATA**: segment-specific coin/rewarded choice, cooldown, cap, move-amount fields; no original live activation trace | **ROADMAPPED**: current one +10 verified rescue, Undo and replay, not complete source segmented contextual offers |
| `azur-coin-moves` | **NATIVE_STATIC**: local **900 coins for +10 moves** and actual positive `SpendCoins` success before `MovesSystem.BuyMoves`; compiled values can be overridden | **IMPLEMENTED_UNVERIFIED / adaptation**: +10 for **120** internal coins on a **proved exhausted-board continuation**, save+debit, not the source 900 coin live policy. Original provider price and human fairness not captured |
| `azur-rewarded-moves` | **NATIVE_STATIC**: local default **5 moves**, earned callback records watched then invokes `BuyMoves`, not merely UI click. Original daily cap `-1` means no local cap under that field but other gates exist | **IMPLEMENTED_UNVERIFIED / adaptation**: one *earned* +10/attempt with durable receipt and actual-board proof; real Android SDK earned/no-fill/device timings and original activation missing |
| `azur-win-multiplier` | **VIDEO_OBSERVED**: x3, temporary x5 offer shown; no confirmed earned callback or actual payout | **ROADMAPPED**: ordinary win only. Future explicit optional post-win multiplier needs separate receipt identity and economy acceptance; never assert x5 is deployed |
| `hitapps-win-rewarded-offer` | **METADATA**: WinScreenRvRewardConfig present; original activation, value and formula unknown | **ROADMAPPED**: distinct from AZUR x3/x5 and Unico double; author separate trigger/award model |
| `azur-unlimited-moves-offer` | **NATIVE_STATIC**: OutOfMovesPanel unlimited action/optional 3s delay local default; entitlement lifetime, actual price/config not traced | **ROADMAPPED**: only one earned/coin +10 currently; must define expiry/restart/rules/SaveStore compatibility before showing offer |
| `unico-rewarded-theme` | **VIDEO_OBSERVED**: “Try Now” with video badge, no confirmed entitlement callback | **ROADMAPPED**: cosmetics exist, but no video-granted seasonal theme. Verify scope/duration/reward receipt |
| `unico-double-reward` | **VIDEO_OBSERVED**: result CTA, no witnessed full ad → grant | **ROADMAPPED**: separate from AZUR x3 and Hitapps win RV; define payment once on settled result |
| `unico-loss-dialog` | **VIDEO_OBSERVED**: +10 for **1500 coins** or video in sample; not source universal price | **IMPLEMENTED_UNVERIFIED / adaptation**: C8 0.20.3 restores usable Undo/Replay after no-fill and the exact exhausted attempt after background; original UI device parity unavailable |
| `azur-definition-consumable` | **VIDEO_OBSERVED**: card explanation reader and finite/intro unlimited accesses, original Definition SKU family | **ROADMAPPED**: current reader accessible free; no separately purchased Definition charges. Separate semantic reader from future resource limits |
| `azur-free-shop-coin-claim` | **VIDEO_OBSERVED**: 845→1045 (+200) after shop action; ad watched, cooldown, per-day offer conditions UNKNOWN | **ROADMAPPED**: win/milestone coins only, no separately claimed +200 shop item. Implement source-inspired optional claim only with proved receipt |
| `azur-remaining-moves-coin-bonus` | **VIDEO_OBSERVED/INFERRED**: sample arithmetic suggests 5 coins per unused move, **not a recovered native formula** | **IMPLEMENTED_UNVERIFIED/adaptation**: `coinsPerRemainingMove=2`. Record economy effect before considering 5 or any other coefficient |

**Do not mix original game economies.** AZUR original compiled **900/10** coin offer and **5 rewarded moves** are different source actions; our **120/10 coin, 10 rewarded moves** are explicit preview policies. Unico video **1500/10** is yet another source snapshot. No inferred “correct market price” or engagement/revenue advantage follows. This study must not alter our prices, reward amounts or ad opportunities by itself.

## 2. E2: all five advertising and interstitial systems, plus a reproducible consumer discrepancy

| Feature ID | Native/reference claim | Current implementation/evidence gate |
| --- | --- | --- |
| `hitapps-adbreak` | NATIVE_STATIC: configurable in-level placements, difficulty-specific caps and per-level counter with reset on level change; active remote values UNKNOWN | ROADMAPPED; current interstitial only after selected wins, not in-level ad breaks |
| `hitapps-ingame-banner` | VIDEO_OBSERVED | IMPLEMENTED_UNVERIFIED: native campaign banner level ≥3; real Android safe-area/fill/visibility and original placement need QA |
| `azur-fullscreen-ads-clock` | NATIVE_STATIC: local 120s interstitial start/delay; **`MarkInterstitialShown` and `OnRewardedAdShown`** write shared timestamp after their respective original callbacks | IMPLEMENTED_UNVERIFIED: product 120s cooldown, but **commits timestamp at request before SDK show**, not actual shown; P1 issue #80 |
| `azur-ad-revenue-attribution` | METADATA: OnRevenuePaid interfaces, no live ILRD payout or currency evidence | ROADMAPPED: native ad event API exists, no verified provider revenue callback attributed to session/placement |
| `unico-coffee-break` | VIDEO_OBSERVED: in-level Coffee Break optional +3-coin context | ROADMAPPED: no in-level break or its earned coin-flow; original actual grant and native callback UNKNOWN |

### P1 concrete product finding: attempted show is persisted as shown

**Current exact code path:**
1. `src/platform/ads.ts createAds.show` first checks `status[kind]`, then invokes `await options.beforeShow(request)`, **then** `await native.show(request)`. A native response `{shown:false,outcome:'unavailable'|'error'|'cancelled'}` has **no rollback** of `beforeShow`.
2. `src/main.ts beforeShow` unconditionally performs one SaveStore mutation: `platformState(next).lastFullscreenAt = Date.now()`; for `interstitial` also `winsSinceInterstitial=0`. That SaveStore mutation is durable even if native never showed an ad.
3. `src/domain/services.ts interstitialEligible` requires both **3 new counted wins** and **120s since `lastFullscreenAt`**. Therefore an **interstitial no-fill** can consume the three-win threshold and a **rewarded no-fill** can consume shared fullscreen cooldown, although no SDK show happened.
4. `SolitaireAdsPlugin.java` separately emits **actual** `onAdShown` → `event(kind, 'show')`, `onAdImpression` → `impression`, and `onAdFailedToShow`; an interstitial can return `unavailable` if `interstitial == null` despite SDK initialized. No physical-device frequency is inferred from this real executable branch.

**Disposition:** [issue #80](https://github.com/DanilaH/asoc-solitair/issues/80) tracks a **possible user-impacting ad fairness/accounting defect**; source inspection confirms the branch, while how frequently a real Android device experiences no-fill is unmeasured. An earlier kit report flagged this on 18 November; it still exists in C8 CORE-5. Do **not** interpret `lastFullscreenAt` as actual shown count in analytics.

**Necessary developer regression acceptance:** independent `requested`, `shown`, `impression`, `earned` state; cooldown and win-cadence only changed on declared actual-shown policy; no reward on show/dismiss; no-fill/error/cancel leaves board/wallet/credit/cadence unchanged; repeat shown callback idempotent; save/reload/foreground callback and real test Android; old save migration respects previous attempted timestamp semantics. This is a **bugfix-specific implementation packet**, not approval to increase ad frequency.

## 3. E1/E2 developer ordering and remaining dependencies

| Next package | Concrete product result | Evidence needed for acceptance |
| --- | --- | --- |
| **E1-A**: safeguard actual CORE-5 recovery | Existing +10/coin/Undo/replay preserves exact saved attempt and proof on no-fill, earned callback, duplicate late reward | Physical Android with real SDK earned/no-fill/foreground; original AZUR/Unico price comparison remains separate |
| **E2-A P1**: fix attempt-vs-shown cadence | Provider callback-driven, SaveStore-safe fullscreen clock and interstitial win counter; no fake impression or revenue | Simulated bridge unit tests, reload/duplicate/bkg/timeout, actual Android; [issue #80](https://github.com/DanilaH/asoc-solitair/issues/80) |
| **E1-B**: post-win opt-in bonuses / Definition / free shop claim / rewarded theme | Independent controls with versioned entitlement and idempotent grant, clearly explained price vs reward | Original missing source traces + own economy A/B, no money benefit assumed |
| **E1-C**: segmented revive and true stock-restore | Separate native conditional offer and stock rules, not the same free recycle action; source config UNKNOWN preserved | New rules/deal ID/Undo/receipt persistence, correct coins/RV/segments/cap, phone acceptance |
| **E1-D**: unlimited moves | Full duration/expiry/restore/SaveStore and billing if purchase-backed | Account/store provider verification, native entitlement migration and age/legal platform checks |
| **E2-B**: in-game AdsBreak / revenue attribution / Coffee Break | Optional placement clocks, explicit opportunity vs shown/earned/impression/revenue and distinct balance policy | Authentic original activation or declared product policy, truthful SDK ILRD, user-consent/privacy constraints |

**E3 commercial store purchases are not omitted:** 18 E3 feature IDs (premium offers/pass/piggy bank/VIP/No Ads/IAP catalog and SKU families) remain mapped in `ADOPTION_LEDGER.json`, subject to supported local RuStore or other lawful target-store billing and payout verification. No payment account/legal route is invented, and any historic agent HOLD is not a permanent exclusion.

## 4. Evidence and regression discipline

- `GAME_MODEL_PASS` on browser ad mocks is **not** real Android ad fill, original server activation, earned-provider callback in the wild, revenue paid, D1 retention or player fairness.
- A successful displayed SDK full-screen still is not equal to an `impression` or `earned`: keep these distinct. Native `show_request` may be a useful diagnostic but cannot debit or grant a reward by itself.
- Coin +moves is an atomic SaveStore debit/continuation under the current product; do not mix with the original AZUR spend-first branch or infer original crash atomicity.
- No revenue uplift or retention effect is claimed for any extra offer; only actual eligible → requested → shown → earned → resumed → won vs quit cohorts can establish that.
- **114/114** source systems remain in product roadmap, zero owner-excluded. No new gameplay, ad policy, SDK, spending, billing, or source code was implemented in this research package.

**KIT IMPACT:** REUSE Reference → Product Porting Framework and existing native receipt/callback study. No shared runtime API change. Source-vs-product P1 discrepancy belongs to consumer issue #80 until fixed and independently verified.
