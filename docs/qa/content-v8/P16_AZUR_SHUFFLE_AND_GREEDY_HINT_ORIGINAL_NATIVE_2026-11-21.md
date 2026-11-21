# C8 P16/P04 — AZUR Shuffle original-native algorithm and new five-priority hint contract

**21.11.2026 · kit source PR #96** `dd4a043b2b5a913d48a8dbd85d2fbaa58886682c`, original AZUR 1.3.3.8/code244 SHA256 `4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4`. **Read-only native STATIC, ORIGINAL_ANDROID_NOT_EXECUTED.** Source report [kit #96](https://github.com/DanilaH/mini-games-kit/pull/96) and [permanently pinned native report](https://github.com/DanilaH/mini-games-kit/blob/aa8340cfdec50d66502fbf9234f358ca15ee5921/research/games/association-solitaire/2026-11-21-azur-shuffle-hint-native/README.md). Original verifier passed on the actual owner-provided XAPK: **28 exact RID/RVA, 27 BL, 10 opcode, 1 tail B**; original client still has no actual device trace. No copied original art/code binary.

## New source evidence: not the stock-only P16 interpretation

| Action axis | Authentic AZUR native GameManager Shuffle | Our **actual** current P16 PR #103 |
| --- | --- | --- |
| Eligible tableau | Enumerate **all unrevealed** cards and their exact column/row coordinates, preserve all revealed cards | Does **not** include any tableau card |
| Deck source | Call `Deck.Reset` (Waste→Stock) regardless of ordinary `CanReset` user gate, then copy Stock | Permutes only currently available Stock, Waste unchanged |
| RNG | One descending Fisher–Yates over joint hidden-tableau+Stock+returned Waste with **shared Unity Random.Range** | Deterministic own LCG `1664525*seed+1013904223`, modulo index and forced nonidentity swap |
| Placement | First shuffled cards back into same **hidden slots**, remaining shuffled cards in Stock, hidden; face-up cards unchanged | All tableau and waste remain identical; only Stock order changes |
| Success | Pool count≥1; generic shuffle does nothing when N<2; identity outcome possible and still source success | Requires Stock>1 and **independent proven winning continuation** |
| Undo | `UndoSystem.Clear` on native success | `recordUndo` before committing stock |
| Helper debit | UI `SpendShuffleHint(1)`, then `ShuffleBoard`, **refund `AddShuffleHint(1)` if returns false**, with separate first-unlock branch | One free use per attempt, no Shuffle inventory, no coin/ads |
| Animation | Playing-state controller mutates GameManager state first, then stops hints/starts `ShuffleAnimationController.Play`, cancels old coroutine, fallback refresh | Animate stock after atomic verified SaveStore commit; reduced-motion support |
| Evidence | Original XAPK ARM64 instruction/call-site match, **not real runtime** | Own source/worker/oracle tests, NOT source-exact. Both strategies worth retaining. |

**Very important no-op boundary:** AZUR core can successfully clear Undo and consume the Shuffle charge with **one** eligible card or a randomized identity permutation. No claim this has been shown to a real player (UI may gate), and **do not copy this potentially unfair native policy into consumer by default**. A separately labelled `PRODUCT_ADAPTED_FAIR` variant can refuse/refund no-op. The native original source is sufficiently decoded to specify its core algorithm but active server unlock, source seeded RNG state, exact UI frames and actual original board continue as evidence gaps.

**Action for developer: [P16 source-parity issue #104](https://github.com/DanilaH/asoc-solitair/issues/104).** Keep published preview Deal `campaign-c8-shuffle-029-r1` and current stock-only win-guaranteed adaptation untouched. New standalone independent optional `AZUR_SOURCE_SHAPED` offline authoring/model should preserve hidden coordinates and face-ups, pool Stock+Waste via Reset, inject deterministic RNG *labelled adapted*, model success1/Undo.Clear and separate charge/refund/first-unlock branch, plus own honest no-op policy under another explicit flag. Because native Undo wipe is destructive and potentially monetized, **owner policy required before player activation**. Validate permanent immutable deal IDs, C1–C8 migration, stock/recycle/Undo, missing helper inventory, device/320px, atomic SaveStore after model proof when configured.

## New **115th source feature**: AZUR greedy local hint priority, separate from solver-backed consumer hints

`Solitaire.MoveHintSystem.FindAvailableMove` original native RVA `0x26a7ec4`, with five BL sites and first-success short-circuit:
1. `CheckWasteToFoundation` `0x26a7ee8→0x26a7fc8`
2. `CheckColumnsToFoundation` `0x26a7f0c→0x26a8174`
3. `CheckWasteToColumns` `0x26a7f30→0x26a83bc`
4. `CheckColumnsToColumns` `0x26a7f54→0x26a8580`
5. `CheckDrawFromStock` `0x26a7f78→0x26a8860`, checks `Deck.HasNextCard` then `Deck.CanReset`.

**Internal `CheckColumnsToColumns` still uses filters such as useless-Joker transfer suppression, so an arbitrary first legal option of a category may not be the original full priority.** Local action eligibility is **not** proof of a future winning route. Current consumer `src/domain/hint.ts.resolveHint` runs `knownContinuation/solve/findReferenceRoute` and consumes Hint only when chosen hint fits the board — a separate **win-safe PRODUCT_ADAPTED** method. Do not overwrite it, because blindly mimicking greedy native order could make hints less helpful.

New source ID `azur-greedy-hint-order` belongs **D2 / P04**. Engineer can separately build a source-shaped pure selection policy in a diagnostic harness, compare on a controlled board where AZUR greedy suggestion is legal but not winning and consumer solver-backed suggestion is, test first-found short-circuit/draw→recycle fallback, and *recommend* the better user policy without claiming source exact. Functional original runtime and observed hint choices P36 still open.

## Deeper original column-to-column hint filter proof (21.11; SAME 115th feature)

[Authenticated native ARM64 follow-up](https://github.com/DanilaH/mini-games-kit/blob/a88b61a55e1bee1a745f281507ffdbb29897863/research/games/association-solitaire/2026-11-21-azur-shuffle-hint-native/HINT_COLUMN_FILTERS_2026-11-21.md) and its original-XAPK read-only verifier independently matched **10 exact instruction words and 11 BL targets**. The original `CheckColumnsToColumns` (RVA `0x26a8580`) enumerates nonempty source tableau, **revealed** start cards and `Column.CanTakeCardsFrom`, then applies at `0x26a8730–38` the local branch `sourceHasHidden || wouldUncoverHidden || !destinationIsEmpty`. In particular **no hidden source + empty destination** is filtered even if an arbitrary `CanMoveStack` might be legal. When the moving card's native kind is **2**, source invokes `IsUselessJokerColumnToColumnMove` and skips on true; this *conditional* function uses other checks of hidden cards, alternate movable non-Joker stacks and foundation availability, but its full compound rule remains UNKNOWN. Finally it requires `MoveValidator.CanMoveStack` true before returning candidate.

This **refines** the earlier “first legal local move” summary: AZUR selects the first **source-filtered local move**, not any legal move and not a certified winning route. Current C8 solver-backed Hint is a separate PRODUCT_ADAPTED default. [P04 follow-up issue #115](https://github.com/DanilaH/asoc-solitair/issues/115) records a required standalone diagnostic/negative fixtures; earlier P04 UX PR #91 did not implement this **newly discovered** source ID, so P04 engineering needs follow-up *in addition to* physical-device approval. No runtime user Hint changed. Still total **115 source IDs**, 38 packages, original Android not executed.

## Source-pin/queue/ledger synchronization

mini-games-kit source inventory revision `2026-11-21-azur-shuffle-hint-native-v15`, source inventory Git blob `2e9a91890fbf5f1b3add67ff6a0fa2164c799227` (same exact bytes pinned in consumer). **114→115** entries total: B1 8, B2 3, B3 5, C1 4, C2 5, D1 14, **D2 12**, E1 13, E2 5, E3 18, F1 12, F2 6, F3 5, G1 5. Source `azur-shuffle-helper` evidence now **NATIVE_STATIC** (previously VIDEO); `azur-shuffle-animation-controller` now **NATIVE_STATIC** (previously METADATA). Third `azur-greedy-hint-order` **NATIVE_STATIC NEW**. Still all future systems covered, no permanent owner exclusions, **38** autonomous developer packets unchanged and exactly one primary owner per source ID (new → P04). Source review PR #96 research only, no original source APK or assets committed.

**No app runtime edits in this consumer research sync.** Existing developer P16 remains a valid PRODUCT_ADAPTED preview; do not mark original shuffled card effect ACCEPTED. New platform ledger status for hint `ROADMAPPED`, Shuffle and animation stay `IMPLEMENTED_UNVERIFIED` only for actual adapted current implementations. Original source active helper unlock, purchase and Android remains UNKNOWN.

**KIT IMPACT:** original source proof/read-only verifier in mini-games-kit PR #96; consumer adoption/QA crosswalk here. No modification to pinned mini-games-kit runtime package SHA.
