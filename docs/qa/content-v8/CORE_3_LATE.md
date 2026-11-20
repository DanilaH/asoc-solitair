# Content 8 through level 80 · 0.19.7 preview (38)

This package builds on [the first CORE-3 wave](https://github.com/DanilaH/asoc-solitair/pull/55). Fresh Content 8 starts use the 80 published Content 8 definitions. Positions 32–80 use immutable `campaign-c8-wave-NNN` identities. Active and parked older attempts still resolve the original definition, including the prior C7 fallback at level 80. Campaign completion and awards keep the canonical level IDs. The production Content 7 bank remains available under its existing build flag. The late vocabulary is loaded by Content 8 and the shared archive dictionary retains its protected hash.

## Chapter structure

Our seven-level chapter uses four geometry profiles. The repeating rhythm adapts the structure observed in AZUR's long catalog. The counts, budgets, tier labels and topic order below are product parameters. Exact Hitapps rows after EN31 are unavailable in the verified dataset.

| Profile | Total cards | Stock | Tableau and foundation columns | Categories | Moves |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rest | 44 | 28 | 3 | 8 | 84 |
| Standard | 64 | 42 | 4 | 11 | 122 |
| Hard | 78 | 54 | 4 | 13 | 158 |
| Peak | 96 | 62 | 5 | 15 | 191 |

Each chapter starts with a rest deal and follows with standard, hard, standard, hard, standard and peak deals. The peaks are levels 38, 45, 52, 59, 66, 73 and 80. Hard and peak boards use guided offline card ordering on top of the seed distributor. Rest and standard boards use ordinary distribution. DynamicDifficulty R1 still issues its verified variants on levels 11–15.

The [late recipes](core3-late-recipes.json) cover 77 topics, including 24 new Russian-language categories. A repeated topic has at least three intervening levels. Each board has four to six members per category and uses original project art for one complete picture category alongside word categories. Native AZUR art preload and localized art-dependent counts remain distinct registry items from [#56](https://github.com/DanilaH/asoc-solitair/pull/56).

## Verification

- [Passports](core3-late-passports.json) record the exact published seed, layout and witness hashes, opening leaders, forced and optional stock, recycle counts and tested alternatives. The game rules and independent rules replay all 49 new primary paths and 82 alternatives. The primary paths retain at least seven moves. Their longest forced-stock run is five actions and the largest forced-stock share is 21.6%. These are measured routes under the published move budgets. Player difficulty and the behaviour of unsampled branches remain open.
- The preview runs the actual Next transition from 31 to 32, exercises the rightmost column or foundation at 320 CSS px, and plays the last move of level 80 through the touch input. The saved campaign completion and menu progress must both reach 80.
- The decoder and save tests verify all 80 current IDs, legacy attempts, an archived C7 level 80 in active and parked modes, and the new definition when deliberately starting level 80. The Content 6, Content 7 and earlier Content 8 archives remain covered by their existing tests.
- The definitions solve under the project rules. Native-device legibility and human pacing remain open. KIT IMPACT · REUSE.

Bundle `tools/content/build-c8-wave.ts` with Vite SSR and run the output with `C8_FIRST=32 C8_LAST=80` to regenerate the per-level reports under `.authoring/content8-wave/`. Published deals live in `src/content/campaign-v8-late.json`.
