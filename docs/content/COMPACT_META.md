# Compact meta — 0.5.0

Rules/content/balance versions: 2/4/3. No card-rule change. Campaign orders and witnesses remain frozen. One wallet and one SaveStore own all commands, meta, purchases, settings and native receipts.

## Rewards

| Source | Rule | Reward | Durable identity |
|---|---|---|---|
| Campaign milestone | Each ten first-cleared levels | 40 coins; palette «Чернила» at 10, back «Ромбы» at 20 | milestone:level |
| Campaign win cycle | Five first-cleared levels without abandoned/restarted campaign attempt | 20 coins + one Hint; reset to 0/5 | cycle:monotonic-cycle |
| Daily completion | First win for the current local date | 20 coins | daily:YYYY-MM-DD |
| Daily streak | Day 3 | 15 coins | daily-streak:date:length |
| Daily streak | Day 7 and each following multiple of 7 | 35 coins + one Undo | daily-streak:date:length |

Normal campaign per-attempt win/move rewards and core-transfer streak remain unchanged. Replaying an old campaign level earns its ordinary attempt reward, without meta progress. A repeated or expired daily is training: neither completion nor core-transfer coins are minted. Already-earned core coins are listed, never credited again on result. All new rewards are automatic, combined in one persisted result with separate reasons and one result coin flight. No claim screen or new currency.

Temporary exhaustion preserves the campaign cycle while Undo/continuation remain a choice. Explicit restart or confirmed replacement of an unfinished campaign finalizes abandonment and resets it. Home, pause, app restart, helpers and mode switching preserve it. Daily never advances or resets the campaign cycle. The home shows the next ten-level milestone; after level 20 its concrete next goal is the end of the supplied 26-level chapter, without inventing a level-26 milestone payout.

## Independent attempts

The active Save.attempt is canonical. Save.parked holds only the other mode's exact attempt, board, budget, Undo, modifier state and telemetry markers. Switching parks one and resumes the other in the same coordinated commit. Shared economy/settings/receipts stay outside board Undo. Mode changes use the existing presentedDealId renderer barrier. An unfinished campaign is not abandoned by opening daily.

A local day uses the device calendar (YYYY-MM-DD). One dated daily id also carries its pool content version. At midnight the running old puzzle can finish as training. Home offers an explicit old-puzzle resume and the new day's puzzle. Selecting a new day's puzzle replaces the previous daily slot; campaign is retained. Completed days remain in the calendar. There is no archive of unlimited old attempts.

Dates cannot pay twice, even after a clock rollback. A backwards date may complete its previously unclaimed date, but cannot advance the forward calendar streak. Missing a day makes the displayed current streak zero; already-paid rewards/cosmetics/campaign survive. Day 3/7 milestones are awarded on completion, never on login. No server time claim, streak rescue purchase or push notification.

## Daily content

28 new fixed ordinary deals are authored offline in src/content/daily-pool.json using original topics/images and 3–4 tableau columns. Each has a full helper-free witness with ten moves of slack. The runtime never shuffles. An epoch-day modulo 28 selects the same ordered pool entry for every local day and daily contentVersion 1. All 28 occur once per 28-day rotation; the pool then repeats. This is not an infinite unique bank. Human difficulty/pacing review and a release-size repetition decision remain pending.

The extracted offline authoring search is shared with campaign authoring; it does not run in production. Validation replays all 28 witnesses, checks conservation/assets/captions and both deck-side layouts. Each deal has a docs/validation record. Known-path hints use the dated deal's exact witness; helpers retain campaign unlock thresholds. Daily does not request interstitials or banners in this build; optional rewarded helpers/continuation retain the native receipt contract with mode=daily.

## Appearance and compatibility

One extra ink palette and one diamond back are earned through campaign; no cosmetic shop/collection. Table appearance changes the existing colors/patterns. Left/right deck placement is free and mirrors stock/waste/foundation positions consistently with pointer coordinates. It changes no card state and consumes no moves/resources. Settings are shared across modes.

Compatible rules-v1/content-1-or-2/balance-1 and rules-v2/content-3/balance-2 saves migrate intact. Missing meta initializes with zero win-cycle marks because earlier session failure history is unavailable. Already-cleared milestones are paid once (40 per ten levels) and cosmetics are unlocked immediately. No historical five-win cycles are invented. Later reloads preserve spent helper stock and grant nothing again. Unknown versions/corrupt active or parked attempts are refused without resetting the stored document.

Model tests cover simultaneous cycle/milestone grants, reload/replay identity, temporary failure vs final restart, independent modes, late native receipts, date rotations/leap dates, same-day replay/training, 3/7/14 milestones, gaps/rollback and failed-write retry. Browser tests exercise both screen sizes and real touches, including mode returns, milestone result, cosmetics and mirrored stock, daily completion/replay/calendar and midnight. QA recordings use valid restored profiles near results to keep GIFs compact; there is no runtime success/test bridge. Hardware/live limitations remain in VERIFICATION.md.
