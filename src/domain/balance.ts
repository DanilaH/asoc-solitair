/** Starting hypotheses from requirements §11.2; keep changes versioned with BALANCE_VERSION. */
export const BALANCE = {
  initialCoins: 100,
  initialHints: 3,
  initialUndos: 5,
  initialJokers: 1,
  winCoins: 25,
  coinsPerRemainingMove: 2,
  helperPrices: { hint: 100, undo: 60, joker: 250 },
  rewardedCharges: { hint: 2, undo: 3 },
  continueMoves: 10,
  meta: { milestoneCoins: 40, cycleCoins: 20, cycleHints: 1, dailyCoins: 20, day3Coins: 15, day7Coins: 35, day7Undos: 1 },
  ads: { bannerFromLevel: 3, interstitialAfterLevel: 5, winsPerInterstitial: 3, fullscreenGapMs: 120_000 },
  streak: [{ count: 4, coins: 2 }, { count: 5, coins: 3 }, { count: 6, coins: 4 }, { count: 7, coins: 5 }],
} as const;
