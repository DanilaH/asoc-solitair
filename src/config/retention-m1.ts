/** M1 local content policy. Source medal weights are stored separately from prizes. */
export const M1_RETENTION = {
  id: 'azur-m1-week-r1',
  milestones: [
    [50, 15], [100, 0], [300, 25], [600, 30], [1000, 30],
  ],
  daily: [
    [['DailyLogin', 1], ['CollectThemes', 5], ['ExecuteMoves', 35], ['DrawCards', 20]],
    [['DailyLogin', 1], ['CompleteLevels', 1], ['CollectDailyBonuses', 1], ['CollectThemes', 8]],
    [['DailyLogin', 1], ['CollectThemes', 9], ['WinNoHints', 1], ['ExecuteMoves', 65]],
    [['DailyLogin', 1], ['CompleteLevels', 1], ['DrawCards', 35], ['CollectThemes', 11]],
    [['DailyLogin', 1], ['CollectThemes', 11], ['EarnCoins', 75], ['DrawCards', 42]],
    [['DailyLogin', 1], ['CompleteLevels', 1], ['DrawCards', 54], ['CollectThemes', 14]],
    [['DailyLogin', 1], ['CollectThemes', 14], ['DrawCards', 60], ['ExecuteMoves', 105]],
  ],
} as const;
