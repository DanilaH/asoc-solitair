# Content 8 — P04/P05 source→product: useful moves, independent Joker predicates and positive-budget callback

**22 November 2026 · source investigator only, no app runtime changes.** [mini-games-kit original-native study PR #98](https://github.com/DanilaH/mini-games-kit/pull/98), [source report with original 17/19/14 proof](https://github.com/DanilaH/mini-games-kit/blob/5022d48a273c92e40708233f4fc61fadd7b08751/research/games/association-solitaire/2026-11-22-azur-useful-moves/README.md), [consumer follow-up issue #123](https://github.com/DanilaH/asoc-solitair/issues/123). References prior [kit PR #96 Shuffle + greedy hints](https://github.com/DanilaH/mini-games-kit/pull/96), [existing consumer PR #108](https://github.com/DanilaH/asoc-solitair/pull/108), and real current C8 0.20.3 source `src/domain/engine.ts` and `src/domain/hint.ts`.

Original owner-provided **AZUR 1.3.3.8/code244** XAPK SHA256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`, original ARM64 ELF SHA256 `27eb2e67ba00093ed575e16fc01a876a9e90fff8e53b504338047a4bf2c0d924`. **17 original exact IL2CPP RID→native RVAs, 19 ARM64 opcode anchors and 14 BL callers PASS on SHA-authenticated private XAPK.** Actual original Android game was **NOT RUN**, no genuine original player trace, original action outcomes, sound/animations, server eligibility, revenue or remote config observed. Neither original APK nor original code/assets are committed.

## 1. Source topology — these are NOT interchangeable checks

| Native method | Source role | What was verified |
| --- | --- | --- |
| `MoveHintSystem.FindAvailableMove` `0x26a7ec4` | User-facing **candidate hint** decision | Five global classes in order: waste→foundation, tableau→foundation, waste→tableau, tableau→tableau, draw/recycle last; short-circuit first successful class |
| `MoveHintSystem.IsUselessJokerColumnToColumnMove` `0x26a89f8` | Filter within fourth **hint** class for card-kind=2 | Rejects a move if `wouldUncoverHidden=true` and certain other conditions; can permit an alternate-nonJoker-stack/foundation-sensitive candidate |
| `MoveValidator.IsUselessJokerColumnToColumnMove` `0x26aa3ac` | **Separate filter inside `MoveValidator.HasAnyValidMove`**, which enumerates moves independently of hints | Distinct `CountJokersOnBoard()>1` bypass, immediate-below hidden/source hidden and foundation checks; **not same truth table as hint** |
| `GameManager.CheckAvailableMoves` `0x26a2810` | Called from `DrawCardFromDeck` and `MoveCard` | Returns on victory or any validator-valid move, and returns when moves depleted; only when **not won + no validator-valid move + moves remain** invokes optional delegate from `GameManager+0x70` |
| `GameManager.CheckDefeat` `0x26a4090` | **Different path** | Runs separately against `MovesSystem.HasMovesLeft`/`GameBoard.IsVictory`; native `CheckAvailableMoves` is not the same as budget-exhaustion defeat |

The source callback delegate type/subscribers and whether its visible UI is a loss, help, gameover, revive or hint remain **UNKNOWN**. An early *no-useful-move* signal with positive budget must **not** automatically become an ad/paywall or immediate loss.

## 2. Exact bounded Joker predicates from independent original ARM64

The two methods share the same name but have **different inputs and branches**. For valid source indices ≥0, **true** from either means *useless candidate* in its source caller, not the player action being necessarily illegal:

- **Hint variant**: null column OR direct move would uncover a hidden card → useless. When moving packet starts above index0 and source has any hidden card → not useless. If destination top has native kind0, moving the final source card and an alternate movable revealed non-Joker stack exists → not useless. Otherwise index0 or missing preceding card or preceding card kind2 → useless; else useless iff preceding card **cannot** move to any foundation. Actual hint's final `MoveValidator.CanMoveStack` is another independent legality gate.
- **Validator variant**: null column → useless. If `CountJokersOnBoard()>1` then **not useless**. If index>0 and immediately preceding card face-down → **not useless**. If index>0 and source contains any hidden card → **not useless**. If index0 or no preceding card → useless. Otherwise useless iff preceding card **cannot** move to any foundation. This filter is used by `HasAnyValidMove`, after other source checks.

Two native functions can **disagree** on the same synthetic situation. Example: a type2/Joker transfer would uncover a hidden card while the board has one Joker. Hint predicate returns **useless** immediately; validator predicate returns **not useless** from the preceding-hidden/source-hidden check. Another example: two Jokers and an index0 packet → validator bypasses as not useless, while hint does not have such a count override. Neither example proves such a player-visible board was generated; they falsify the proposal of **one universal source filter**.

Exact source verification: `MoveHintSystem` helper sites `0x26a8a30/0x26a8a7c/0x26a8ac4`; `MoveValidator` sites `0x26aa3d4` (`CountJokersOnBoard`), `0x26aa408` (`HasHiddenCardsInColumn`), `0x26aa454` (`CanCardMoveToAnyFoundation`). `GameManager` sites `0x26a2820` victory, `0x26a2834` validator, `0x26a2848` budget, and callers `0x26a2770/0x26a2bb0` draw/move. All exact native SHA identities and [numerical evidence](https://github.com/DanilaH/mini-games-kit/blob/research/azur-joker-movevalidator-no-valid-20261122/research/games/association-solitaire/2026-11-22-azur-useful-moves/useful-moves-evidence.json) remain source static, not original runtime.

## 3. Current consumer game and precise nonparity

At current C8 source `src/domain/engine.ts`, after each accepted board action:
```ts
board.phase = board.collected.length === Object.keys(deal.cards).length
  ? 'won' : board.movesLeft === 0 ? 'exhausted' : 'playing'
```
This is **product policy**: it does **not** fire a dedicated “no source-valid useful moves” event while moves remain. It is also distinct from `src/domain/continuation.ts` which only accepts verified exhausted-board +10, and separate from helper `src/domain/hint.ts.resolveHint` which finds a **certified winning** move rather than an original greedy or `MoveValidator` “useful” move. None of these product adaptations need to be disabled for source research.

Source inventory now has **115 IDs**, two existing rows updated, **no source system added/excluded**: `azur-greedy-hint-order` (D2/P04), `azur-defeat-vs-no-valid-move` (B1/P05). The existing `azur-joker-random-column-insertion` (D1/P15) remains separate and original insertion/Undo reset native evidence unchanged.

## 4. Developer independent work — do not modify user game prematurely

**P04 source diagnostic:** implement two independent pure functions for native Hint's filtered greedy action class and native Validator's useful/Joker criterion. Include structured sources `SOURCE_HINT` vs `SOURCE_VALIDATOR`, do not reuse source DTO or greedily charge from a full-game solver result. Test null source/dest, zero/one/two Jokers, candidate start0/1, hidden just below vs hidden anywhere, destination top kind0, alternate movable nonJoker stack, previous-card kind2 and foundation eligibility. Source class-scoped behavior matters; missing original Android truth table for less-visible candidate ordering stays explicit.

**P05 source diagnostic:** add a separate `checkAvailableMovesSource` signal, with states `AVAILABLE / NO_USEFUL_WITH_MOVES / BUDGET_EMPTY / ALREADY_WON / UNKNOWN`. Query only after accepted draw/move for source-shaped comparison, **do not** alter `Board.phase`, drop a move, claim loss, fire ad, debit coins or close UI. Record exact board+Rule version; compare actual product `legalActions`, source heuristic `usefulActions` and winning route as different sets. A source useful predicate is *not* a math no-win proof; if some legal actions remain, the source's callback may still be true.

**P05 QA constraints:** direct tests for `won`, `positive budget + no useful`, `budget zero + no useful`, `positive budget + source-validator move`, `stock/recycle`, `two Jokers`, `source revealing hidden`, `source card with foundation move`. Keep C1–C8 old deals, current 80-level witnesses, archived Saves, bonus columns, Undo and earned rescue stable. Maintain source callback `+0x70` as **opaque** until P36 authenticated native Android.

**P18/P19:** extra-move/rescue policies may *later* use the discovered signal only under separate owner-approved rules and actual SDK evidence; do not interpret this source callback as approved forced paywall or guaranteed loss.

**P36/source gate:** real original GameManager delegate subscriber, source lobby UI, whether a filtered move leads to an offer/defeat, true original Android on a version-matched isolated ARM64 device. The native original verified control flow does **not** prove original active feature cohort or player win-rate.

## 5. Source pin/ledger/program status

Kit [source PR #98](https://github.com/DanilaH/mini-games-kit/pull/98) updates both existing inventory feature limits, with original v16 revision and Git blob `79a44a8b1c0ec98a6b6bde9b1fbd4071cad1af6d`. This consumer research sync updates the **byte-identical 115-feature source pin**, full ledger/queue refs, P04/P05 next actions and QA spec, leaving **38 developer packages unchanged**; P04 engineering remains IN_PROGRESS for diagnostic, P05 previously engineering-verified dealer remains valid with a newly explicit SOURCE_GAP for the source callback. 0 OWNER_EXCLUDED, 0 full original runtime ACCEPTED.

**KIT IMPACT:** source evidence sync, independently testable model and false-parity warning. No new kit runtime API, no copying proprietary content, no game engine/card rules changed.
