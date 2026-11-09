/** Starting hypotheses from requirements §11.2; keep changes versioned with BALANCE_VERSION. */
export const BALANCE = {
  initialCoins: 100,
  initialHints: 3,
  initialUndos: 5,
  winCoins: 25,
  coinsPerRemainingMove: 2,
  helperPrices: { hint: 100, undo: 60 },
  rewardedCharges: { hint: 2, undo: 3 },
  continueMoves: 10,
  ads: { bannerFromLevel: 3, interstitialAfterLevel: 5, winsPerInterstitial: 3, fullscreenGapMs: 120_000 },
  streak: [{ count: 4, coins: 2 }, { count: 5, coins: 3 }, { count: 6, coins: 4 }, { count: 7, coins: 5 }],
} as const;
