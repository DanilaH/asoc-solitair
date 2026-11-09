# Rule extensions — development chapter

Version 0.4.0, rules/content/balance 2/3/2. The first twenty ordinary deals in campaign.json remain byte-for-byte unchanged. Six deals are appended from src/content/modifiers.ts; this is a development chapter, not a final release-size bank or approved introduction pacing. Preliminary unlock placements 6/9/13 are superseded for this build by 21/23/25 to protect existing attempts.

| Level | Deal | Mechanic | Cards / columns / slots | Witness / budget |
|---:|---|---|---|---|
| 21 | Место для манёвра | Joker lesson | 6 / 3 / 2 | 6 / 12 |
| 22 | Свободная опора | Joker application, stock | 9 / 3 / 2 | 11 / 17 |
| 23 | По порядку | Days of week 1–7 | 8 / 3 / 2 | 8 / 14 |
| 24 | Круглый год | Months 1–12 | 13 / 3 / 2 | 13 / 19 |
| 25 | Три ключа | Lock lesson | 8 / 4 / 2 | 8 / 14 |
| 26 | За последним замком | Deeper key cards | 11 / 4 / 3 | 11 / 17 |

Every primary witness wins without spending Hint, Undo or Joker. Level 21 also has an optional nine-command Joker witness (eight charged moves plus zero-move placement), validated through dispatch with reload-safe resource ownership. A player with no Joker can always retry and use the ordinary witness.

## Exact semantics

Joker selects an existing nonempty unlocked column. Original cards become blocked at a saved boundary. The support accepts one available packet of any category and accepts no second packet while occupied. The complete held packet is available; once it leaves, support disappears and the original group becomes accessible. There is no new card or foundation. Cancel/invalid target is free; valid placement spends one charge and zero moves. One placement per attempt; Undo restores the board boundary/held group but never refunds the Joker or Undo. Restart retains spent inventory and resets the attempt's once-only placement flag. Initial inventory is one; exchange is 250 coins per charge, without a video offer.

Ordered categories use explicit rank badges and familiar complete sequences. A member group is a contiguous interval; its category leader requires a prefix 1..k. Merging sorts the members by rank and keeps the category card last. Only adjacent intervals may join. Skipped rank refusal names the missing rank and preserves the move budget. Draw/recycle retain the original stock order and the same rank rules.

One column is locked. Exactly three unique key cards start closed in the other columns. Neither source nor destination access to the locked column is allowed. A reveal adds its key once; the third key unlocks and exposes the locked front in the same persisted board transition. Undo restores keys, lock and exposed cards together. No locked+ordered mixed tutorial is supplied.

The solver and hint worker share these legal transitions and include modifiers in state identity. Hints remain manual ghost moves; they never spend or place a Joker. Search timeout/UNKNOWN does not imply unsolvability.

## Compatibility and evidence

The single SaveStore remains the only writer. Compatible old rules-v1/balance-v1 intro content-1 or frozen ordinary content-2 saves migrate with exact attempt, board, Undo, economy, reward and receipt journals intact. The missing initial Joker resource is initialized once; reloading a migrated zero balance never replenishes it. Unknown versions are preserved and refused.

Validation records cover every ordinary witness and independently check card conservation, captions/assets and card bounds. Modifier tests cover charge boundaries, active-support solver continuations, alternate teaching witness, rank interval/prefix failures, stock/Undo, locked access, atomic third key, key rollback/reveal deduplication and legacy receipt migration. Browser scenarios play all six via real touch on Pixel 7 and 360×640, including cancel/reload/Undo and an invalid ordered drop. GIFs are real production-browser recordings in docs/qa/modifier-{joker,ordered,keys}.gif, without sound. See VERIFICATION.md for exact run evidence and hardware limits.

Remaining work: human edit/difficulty/pacing sessions, physical Android touch/audio/haptics and process-kill/upgrade checks, release-size bank, compact meta/daily. Live IDs and production signing are deferred by the user.
