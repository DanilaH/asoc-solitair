/** Starting hypotheses from requirements §11.2; keep changes versioned with BALANCE_VERSION. */
export const BALANCE = {
  initialCoins: 100,
  initialHints: 3,
  initialUndos: 5,
  winCoins: 25,
  coinsPerRemainingMove: 2,
  streak: [{ count: 4, coins: 2 }, { count: 5, coins: 3 }, { count: 6, coins: 4 }, { count: 7, coins: 5 }],
} as const;
