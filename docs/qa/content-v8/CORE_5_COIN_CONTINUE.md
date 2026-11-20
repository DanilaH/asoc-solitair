# CORE-5 · continuation for coins · 0.20.1 preview (42)

A verified lost position in the Content 8 campaign can continue offline for 120 coins. The button states the cost and awards 10 moves on that same attempt. It shares the once-per-attempt limit and exact-board proof with video and the saved credit. A saved credit takes priority. With fewer than 120 coins the button explains the shortfall and available Undo or Restart can be tapped without a charge.

[AZUR original static evidence](https://github.com/DanilaH/mini-games-kit/blob/44e43051a5ac05e82d9a132943b2c42362175b3d/research/games/association-solitaire/2026-11-18-loss-ads-flow/AZUR_NATIVE_PASS_2026-11-18.md) shows current balance and settings, then successful `SpendCoins` before `MovesSystem.BuyMoves`. The compiled AZUR default is 900 coins for 10 moves. The 120-coin playtest amount is a product choice calibrated to two existing 60-coin Undo purchases. Live AZUR configuration and player coin balance after the change remain open.

The existing SaveStore commits the wallet debit, attempt entitlement and extended Undo budgets in one write. A repeated request for the same attempt fails. If the write outcome is unclear, the result dialog lets the player check the save. The exact committed snapshot resumes with 10 moves. A late genuinely earned video reward for an already purchased attempt is banked once for later use. The board allowance still applies at most once.

## Verification

- Level 16 has a reproducible exhausted state with a verified ten-move route. At 320×568, a profile with exactly 120 coins can pay, reload and Undo while retaining the debit and extra budget. A balance of 119 cannot buy and keeps Undo and Restart available.
- Browser tests simulate a lost storage response after a durable write and one failed read-back. The result dialog resolves the write without another charge. The loss with over ten uncollected themes and a failed worker both hide the coin and video offers.
- Unit tests cover invalid or stale proof, exact price, double purchase, credit priority, and idempotent late receipt after purchase. [Initial board proof and reproducible routes](CORE_5_VERIFIED_CONTINUE.md).
- Android handset and actual purchase choice with live video availability remain open. KIT IMPACT · REUSE of SaveStore and the existing continuation solver.
