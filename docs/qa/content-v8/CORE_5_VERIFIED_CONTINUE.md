# CORE-5 · verified +10 continuation · 0.20.0 preview (41)

When a Content 8 campaign attempt hits zero moves, the result screen checks whether the actual exhausted board can be won in at most ten further moves. It uses the exact saved stock order, waste, tableau, collections, keys, Joker, bonus slots and board rules. The worker looks for a matching authored route and then runs a bounded search through Rules v3. Before a continuation is offered or applied, the winning route is replayed against the attempt. Finishing more than ten uncollected themes requires more than ten moves. A search limit or worker failure is reported as unconfirmed.

A verified result can use a saved credit or request the existing rewarded video. The result screen keeps Undo and Replay available as applicable while the check runs. Earned receipts are deduplicated using SaveStore. A receipt can continue the exact matching exhausted board if its proof is available. After an interrupted request or restart, an earned receipt without an applicable proof gives a stored credit, available through the same check on an eligible board. Undo retains the earned move budget. The C8 campaign preview scopes this policy to C8 deal IDs. Archived attempts and Daily use their existing continuation path.

## Reproduction

| C8 level | Exact route to exhaustion | Verification |
| ---: | --- | --- |
| 16 | 128 authored moves and 18 reversible parking pairs consume the original 164 moves | A legal ten-move suffix wins on the last extra move |
| 38 | Draw and recycle through the original budget without completing themes | The remaining theme count proves ten moves insufficient |

The Playwright scenarios tap the last losing move, reload the exhausted board, apply a stored credit and reach the win by touch. The negative case holds the saved credit and returns to a one-move state using Undo. The unit suite checks original-budget and independent oracle replays, search-limit distinction, invalid proof and exact attempt, receipt idempotency, and Undo's retained budget.

## Source boundary

This is the product's actual-state `ContinueConvertible` check specified in [PR #42](https://github.com/DanilaH/asoc-solitair/pull/42). Hitapps Equality remains a distinct selection strategy. Original monetization, +10 efficacy in human play, phone SDK callbacks and physical-device feel remain open. Grant timing, coin-based moves and unlimited moves are tracked independently in the same roadmap.

The CORE-4 golden-card feature stays in the roadmap. [Native Final-phase evidence](https://github.com/DanilaH/mini-games-kit/blob/44e43051a5ac05e82d9a132943b2c42362175b3d/research/games/association-solitaire/2026-11-17-hitapps-final-phase/README.md) proves post-selection and Gold Rush gates. [The gameplay trace](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-09-reference/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md) shows a prompt to move a highlighted regular card quickly. The time/turn limit, pause and expiry behavior, and final reward attribution need further proof.

KIT IMPACT · REUSE of SaveStore, durable receipt handling and existing board solver.
