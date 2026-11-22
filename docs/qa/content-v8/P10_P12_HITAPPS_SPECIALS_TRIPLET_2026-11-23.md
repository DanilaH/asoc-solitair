# Hitapps specials — independent cross-system consumer QA (P10/P11/P12)

**23 November 2026 · PRODUCT_ADAPTED only; original Hitapps Android runtime NOT executed.** This test is deliberately *not* a reconstruction of original Frozen / Bound / Scissors / PuzzleTop/PuzzleBottom player rules. It exercises the real consumer's current optional preview modules together as an anti-regression control.

## Source-evidence boundary

Original Hitapps 1.26.2/code3742 source static work establishes Frozen/Bound gates, distinct pattern schemas and status flags, with `FrozenCardData{layers,column,position}`, `BoundCardPattern{boundCards,scissors}` and distinct PuzzleTop(3)/PuzzleBottom(4) types. It **does not** prove source gameplay transitions for ice, scissors, or picture-half joining. Read [kit native gates](https://github.com/DanilaH/mini-games-kit/blob/research/hitapps-native-split-handoff-20261122/research/games/association-solitaire/2026-11-17-hitapps-shuffle-features/README.md); original split extraction remains blocked by 287,832,513-byte XAPK / 256MiB connected download cap [kit #103](https://github.com/DanilaH/mini-games-kit/pull/103).

Product P10 thaws one layer per completed category, P11 cuts a link when the named scissors card enters a foundation, and P12 allows only adjacent `bottom,top` halves moving as a group. These three are **explicitly authored**, not native-source claims.

## New composite positive and negative fixture

`tests/unit/content8-hitapps-specials-triplet.test.ts` constructs a versioned, nine-card own synthetic Deal with four two/three-card categories: the picture bottom is frozen two layers, another card remains bound until scissors are placed, and the top picture half is later drawn from stock. The full 12-action winning path passes through:
- First completed category removes one ice layer, **does not** unbind the other card.
- Drawing scissors leaves the bound card bound, placing scissors to its foundation cuts the bond and completes the second category, removing the final layer.
- Drawing the picture top and joining it to the thawed bottom creates the two-card group, then its leader and assembled halves complete the category.
- Invalid transfer/Joker on frozen or bound card must not mutate state; Undo of scissors placement must **both** restore bond and return one ice layer; serialized SaveStore decode must preserve the same board.
- Every accepted action is replayed through the production Rules3 engine **and separately authored gameplay oracle**; no third-party words/sprites/binaries involved.

**Acceptance:** use exact-head CI and note whether this regression really passes; do not infer source-native parity, mathematical coverage of all combinations, human ease or physical-device feedback. A failure is a concrete engine bug to fix without guessing source rules.

## Additional original evidence surfaced outside APK

Two independent *third-party walkthrough domains* label special original pictures as physically **two pieces across two cards**: GameAnswer.net November-2026 entries describe "(2-piece picture)" and SolitaireAssociations.net uses paired labels `YolkPuzzle1/YolkPuzzle2`, `SunPuzzle1/SunPuzzle2`. They are **THIRD_PARTY_WEB_UNVERIFIED**; this is evidence for a **visual research hypothesis** that the original puzzle halves are image fragments, not proof of native pair validation, packet direction or join animation. Our current P12 example uses **textual "Купол"/"Хвост"**, even though the game author's own labels call them halves; the original *art presentation* is not yet reproduced. Test the visual hypothesis against an original source frame before claiming parity or swapping product content. Other web pages call ordinary leaders "Puzzle Cards" and conflict with IL2CPP PuzzleTop/Bottom; do not promote them to a source rule.

## Source→product next work

Preserve all inventory systems and approved scope. Capture real source native `ApplyFrozenCards`, `ApplyBoundCards`, on-action/reveal/Undo/cost and `DistributePuzzleCards`/type3/type4 move validation when authentic split ARM32+metadata are available. Compare old adapted P10/P11/P12 against original only after captures. Keep current adapted tests, versioned Deal IDs, old active/parked saves intact. If source still blocked, design independent original-art *two-piece* preview as `PRODUCT_ADAPTED` and measure player recognition, not semantic source exactness.

**KIT IMPACT:** REUSE Reference Protocol, no runtime kit API change.
