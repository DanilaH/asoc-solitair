# Release-candidate bank and UX pass — 0.6.0

The candidate now supplies 80 campaign puzzles and retains the same 28-day daily pool/version. This is a concrete first release-size choice, not evidence that 80 is an optimal retention target. Independent human difficulty/pacing review, phone feel and signed/live acceptance remain open.

## Composition

- Levels 1–26 retain their exact ids, initial orders, rules, witnesses and content. Existing attempts and parked dailies remain compatible.
- Levels 27–80 append 54 new fixed orders: 33 ordinary, 11 ordered and 10 three-key locks. They use only the already implemented mechanics. There is no additional mixed lock/ordered rule.
- The editorial bank grows from 29 to 53 ordinary topics. Added material includes pets, sea animals, reptiles, forest berries, nuts, spices, grains, dairy, cutlery, appliances, portable/computer equipment, bathroom items, building materials/house parts, jobs, gems/metals, clothing materials, musical genres/dances, street objects, sports games and literary forms.
- The actual campaign uses **255 distinct member captions**. New familiar ordered sequences include rainbow colors, seasons from winter/January, numbers and Roman numerals; weekday/month sequences also recur in new arrangements. Explicit rank badges and explanations own the order.
- Eight additional authored SVG illustrations extend the same offline visual system: cat, octopus, turtle, vacuum, keyboard, soap, brick and book. Long Russian captions receive edited line breaks; full inspection text is preserved.

Every added puzzle has a stored helper-free witness, at most one stock recycle, and 8–12 moves of slack. No Joker/Hint/Undo/video purchase is needed for the recorded win. Authoring rejects failed/overlong candidates rather than publishing an unproved shuffle. The terminal level 80 uses three keys; the ten-level reward ledger naturally supports all milestones through 80, with the same single extra palette/back rather than another collection system.

## Frozen sources and repeatability

src/content/campaign.json and src/content/modifiers.ts are unchanged. New orders/witnesses/seeds are in src/content/expansion.json, loaded without runtime shuffle. The original daily-pool.json and daily contentVersion 1 remain unchanged, so a date's deal does not move after this update. Rules/content/balance are 2/5/3. Compatible content-v4 saves migrate versions without changing wallet, attempts, parked mode, receipt/reward journals, cosmetics or spent inventory.

The offline search now retains tableau column identity when a locked column is present. Ordinary unlocked columns may still use symmetry. Replaying a witness uses the production pure model; independent multiset, captions/assets and layout checks are separate, and do not prove optimality or human difficulty.

Reauthor with `npm run content:expansion` only before shipping a new version. Never regenerate an already published bank in place. The accepted authoring pass for 54 candidates took about **35.7 seconds of machine time** in this environment, excluding manual topic/explanation/art editing, browser play and human playtesting. This is not a measured end-to-end content cost or a claim of cheap unlimited human-quality puzzles.

Validation records live under docs/validation/campaign-027.json through campaign-080.json; release-bank.json reports the exact composition, uniqueness and witness limits. Content validation replays control + 80 campaign + 28 daily deals and the alternate Joker witness, checking both deck-side layouts.

## UX fixes

- Home exposes the campaign in four bounded 20-level pages with a range/name and previous/next controls. It initially opens the current attempt's page, keeps future levels locked, and lets users return to earlier levels without rendering an 80-button wall. Browsing does not mutate progress or consume a resource.
- Daily replay explicitly says it is training. Current/expired unrewarded attempts display «ТРЕНИРОВКА» in the persistent header and state that helpers still cost charges. Midnight/input refresh updates the label independently of a new board move.
- Restarting a started unfinished attempt requires a concrete in-app confirmation describing resource/cycle consequences. Cancelling preserves the exact board/attempt/profile. The result's replay remains a deliberate one-step action.
- Replacing an unfinished dated daily with the new date also asks explicitly; cancel retains both modes. The old-date resume remains available as training. Campaign is never replaced by that choice.
- 320×568 no longer inherits a 600px app minimum that clipped the dock. Short-screen chrome is compact; board/input still share the bounded logical transform. This is viewport evidence, not a physical-device/native-banner legibility claim.
- The lock counter is one readable numeric line under a separate title. Undo from temporary exhaustion reopens the telemetry outcome marker so a later win can be reported; it does not reset meta or spend another charge.

## Acceptance boundaries

Automated browser traversal is divided into four consecutive 20-level chapters, each using a valid preceding first-clear profile, real touches and ordinary Next transitions. It does not claim one uninterrupted fresh-profile phone session. A separate model test traverses all 80 from a fresh save. Compact scenarios exercise both screen sizes and the 320×568 case. See VERIFICATION.md for final exact CI/source evidence.

This pass does not invent player retention, playtime, puzzle difficulty, real ad inventory, audio/haptic quality or device process-kill results. It does not configure production keys or sign/publish to RuStore. Those remain explicit release gates.
