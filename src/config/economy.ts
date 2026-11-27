import { releaseProfile } from './profile';

export const M1_ID = 'e4-m1-r1';
export const E4_M1 = releaseProfile?.policies.campaignEconomy === M1_ID &&
  import.meta.env?.VITE_ASOC_ARCHIVE_227 !== '1' && import.meta.env?.VITE_ASOC_ARCHIVE_229 !== '1';

// AZUR supplies the victory table, 900-step purchase and video amounts.
// M1 calibrates the coin sinks and free supply for an offline game without IAP.
export const M1 = Object.freeze({
  version: 4, initialCoins: 100, helperPrices: { hint: 300, undo: 200, joker: 800 },
  continueCoinPrice: 900, life: 100, randomJoker: 300, unlimited: 800,
  lowerSlot: 500, upperSlot: 500, restoreBase: 100, restoreStep: 50,
  freeWallet: 100, videoWallet: 400, videoWalletGapMs: 300_000, videoLevel: 3,
  meta: { milestoneCoins: 100, cycleCoins: 100, cycleHints: 1, dailyCoins: 100,
    day3Coins: 50, day7Coins: 100, day7Undos: 1 },
  monthly: 100, taskCoins: 25, weekly: 100,
});
