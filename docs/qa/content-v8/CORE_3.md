# Content 8 CORE-3 · levels 16–31 · preview 0.19.6 (37)

This slice builds on [CORE-2 #51](https://github.com/DanilaH/asoc-solitair/pull/51) and source research through [#54](https://github.com/DanilaH/asoc-solitair/pull/54). It publishes sixteen immutable deals, `campaign-c8-wave-016` through `campaign-c8-wave-031`. Next after level 15 opens a four-column deal with 80 total cards and 54 stock cards. Level 26 has 94 cards and 59 in stock. Level 31 has 100 cards and 65 in stock. Both have five tableau columns and five foundations. Existing level IDs, active or parked historical boards, Undo and canonical progress remain resolvable. Levels 32–80 still use the C7 fallback pending their CORE-3 wave.

## Source and product parameters

The [local Hitapps data](hitapps-local-1-31.json) supplies card, category, stock and column counts and the base move budgets. Content 8 uses the observed numeric base budgets at 16, 18–21, 23–26 and 28–31. Product budgets give the three three-column rest levels (17, 22, 27) five additional moves. Chapter labels, the hard/superhard designations, original Russian topics and column-length splits are product authored. Live map override precedence remains unknown.

Fifteen deals use the existing CORE-1 seed distributor. Level 31 uses guided offline ordering of the seed-produced cards after ordinary bounded search did not yield a certified candidate. The last level keeps the reference dimensions and uses a product-authored card order. The same frozen snapshots are used every time a new attempt issues these base deals. DynamicDifficulty's R1 bank applies at 11–15.

The [recipes](core3-recipes.json) give the original topic order, authored counts, seed windows, simulation caps and selected authoring strategy. Adjacent levels share zero topics in this slice, including the 15→16 transition. The content uses four to six word or picture members per category. Each deal includes a category with original existing art for every member. Whole-category illustration choice is independent of AZUR's original art-driven card-count rule, tracked separately in #54.

## Verification

- [Passports](core3-passports.json) record seed, board/witness hashes, opening leaders, forced stock run and count, stock choices, lower moves, recycle count and remaining budget. The independent oracle and production game rules both replay all 16 main paths and 27 recorded alternatives. Primary witnesses keep at least six moves, use at most four consecutive forced stock actions and spend at most 15.7% of the path on forced stock actions.
- Each level has at least one verified branch from a different legal choice with a measured change in actions relative to its published route. This compares two actual winning witnesses. Optimality, unsampled branches and human difficulty remain open. The authoring gate requires at least four moves of slack, no more than nine forced stock actions in a row and a forced stock share of at most 22% on the chosen primary witness.
- The browser test uses the real Next flow at 15→16, then draws from the new stock. On the actual 26/31 boards it verifies touches through the rightmost tableau or foundation, with a 320 CSS px screen and a reserved 60 px banner. The board and its latest Undo remain intact on reload.
- Save validation covers a C7 fallback attempt at level 26 in both active and parked form, followed by starting the new deal without rewriting the archive. Earlier C6/C7/C8 migration checks continue to run.
- Physical Android legibility, pacing and human balance remain open. KIT IMPACT · REUSE.

To reproduce authoring from the recorded recipe, bundle `tools/content/build-c8-wave.ts` with Vite SSR and run the emitted entry. `C8_FIRST` and `C8_LAST` optionally restrict the output. Per-level records and their audit reports go to `.authoring/content8-wave/`. The game loads the frozen `src/content/campaign-v8-wave.json` catalogue.
