# CORE-4 · independent AZUR bonus slots · 0.19.9 preview (40)

| Level | Upper foundation | Lower tableau |
| ---: | --- | --- |
| 22 | Fourth slot, 100 coins or earned video | — |
| 30 | — | Fifth column, 60 coins or earned video |
| 40 | Fifth slot, 100 coins or earned video | Fifth column, 60 coins or earned video |

The immutable `campaign-c8-bonus-NNN` deals extend the existing wave shapes with independent offers. Each offer requires three or four regular slots in its own row. A closed offer reserves its board position and has no legal card target. Opening appends an empty pile to the appropriate row. The upper pile starts a category with its leader and collects it under Rules v3. The lower pile uses the ordinary rules for temporarily holding cards or groups. Both positions are optional. The previous `campaign-c8-wave-NNN` definitions, initial cards, winning routes, budgets and canonical level IDs stay addressable.

The selected prices, reserved geometry, level placement and attempt lifetime are product adaptation choices. [AZUR source research](https://github.com/DanilaH/mini-games-kit/pull/81) proves separate regular-count, start-level, enable and prefab gates plus type-specific coin, rewarded and saved unlock branches. The original live start levels, prices, visual geometry and device callback behavior remain open. The authored offer records eligibility for this build. The video option uses the game's existing rewarded provider and durable receipt queue with a placement per row.

The wallet debit and opened pile enter SaveStore together. Video load, error and dismissal leave the board alone. The earned receipt can match only the exact campaign attempt and deal, including a parked campaign. If an attempt has been discarded the receipt is recorded without changing a different board. Undo restores card positions and keeps purchased space. No slot consumes a move when opened. Restart returns to the locked offers. The optional first-use prompt marks practice after a player transfer into the new space.

## Verification

- Replay the three regular routes and three routes using the available slots with independent rule checking. Upper placement can remap the existing winning route. A group temporarily parked in the lower space can rejoin an authored route through a legal move and receive a verified Hint.
- Check that simultaneous purchases charge once, failed writes leave both wallet and board unchanged, and stale or duplicate earned receipts cannot open another slot. Check storage decoding, parked campaign restore, mixed Undo snapshot refusal and archive IDs.
- Use the real UI at 320×568 with space reserved for a native banner. Test Next to level 22, a declined lower offer on level 30, both independent rightmost offers with the deck below on level 40, first-use placement, reload, Undo and restart.
- Device playtest, live ad fill/earned behavior and human economy acceptance remain open. KIT IMPACT · REUSE of the existing SaveStore, durable receipts and completed-touch activation.
