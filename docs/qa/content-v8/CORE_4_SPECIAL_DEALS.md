# CORE-4 · ordered cards and three-key locks · 0.19.8 preview (39)

This package publishes the first five special Content 8 deals on top of the [80-level campaign](CORE_3_LATE.md). Each has a new `campaign-c8-special-NNN` ID. Older Content 8 starts, active and parked saves, their boards and Undo histories keep the original `campaign-c8-wave-NNN` definitions. Canonical completion and rewards still use the same level IDs.

| Level | Rule | First-use practice | Primary moves / budget |
| ---: | --- | --- | ---: |
| 17 | Weekdays in order | Move the theme to a foundation, then place Monday as card №1 | 60 / 68 |
| 18 | Three keys | Follow three revealing transfers until the second tableau column opens | 113 / 123 |
| 26 | Three keys | Open the fourth column on a five-column board | 156 / 180 |
| 45 | Weekdays in order | Use the sequence on a five-column board | 159 / 191 |
| 66 | Three keys | Open the rightmost column on a five-column board | 163 / 191 |

Level 17 and 18 practice records completion only after the actual player move. After an interruption the guide resumes from the saved board. The third revealed key opens the column and its front card in the same board transition. Undo restores the earlier keys and column state. The practice completion marker is a learned skill and survives Undo, like the original Content 8 exercises.

## Provenance

[Hitapps source-phase evidence](https://github.com/DanilaH/mini-games-kit/blob/1c2d12621ba47f7f164a418dab84781c025ee855/research/games/association-solitaire/2026-11-17-hitapps-final-phase/README.md) identifies Ordered in Initial and Lockers in Shuffle. The [Shuffle analysis](https://github.com/DanilaH/mini-games-kit/blob/1c2d12621ba47f7f164a418dab84781c025ee855/research/games/association-solitaire/2026-11-17-hitapps-shuffle-features/README.md) documents its indexed configuration. This preview uses the project's existing rank and three-key rules, original Russian cards, and authored positions on the already seeded Content 8 layouts. The level placements, sequence identity and key locations are product choices. Original client unlock schedule, active config and runtime deals remain open. Frozen, Bound, Golden Cards, bonus upper and lower slots and the remaining helpers retain their registry entries for separate implementation.

## Verification

- The production transition and independent model replay five primary witnesses and eight alternatives. The level 45 alternate uses a temporary empty column and adds one move. Each initial hint resolves to a legal step on a certified route.
- Unit checks cover a premature ranked move, both directions of locked-column refusal, the exact two-to-three-key transition, Undo, restart and resuming the older deal by ID.
- Browser scenarios at 320 CSS px use real taps through the Next transition, first ranked transfer, mid-lesson reload, third-key unlock and Undo back to two keys. The level 66 scenario opens and uses the fifth column through taps.
- Device playtest and balance remain open. KIT IMPACT · REUSE.

Bundle `tools/content/build-c8-special.ts` with Vite SSR and run the output to reproduce `.authoring/c8-special/deals.json`. The published bank is `src/content/campaign-v8-special.json`.
