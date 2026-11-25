# Консолидация source research · 25.11.2026

Docs only on [PR208](https://github.com/DanilaH/asoc-solitair/pull/208), `b3180bbe2f2f39b5428e664c19a6c56cde63aed2`. [Kit PR151](https://github.com/DanilaH/mini-games-kit/pull/151), [CURRENT](https://github.com/DanilaH/mini-games-kit/blob/af6a6b1ac7a363164be38c7b7b2a78c2d8d3723a/research/games/association-solitaire/CURRENT.md), [115 exact source rows](https://github.com/DanilaH/mini-games-kit/blob/af6a6b1ac7a363164be38c7b7b2a78c2d8d3723a/research/games/association-solitaire/porting/SOURCE_FEATURES.json), blob `29ddea6086c46c5581702cb0001536e6666b7626`. Previous `adb0657facebf8b5e3ed22369305ba509c988626` / `79a44a8b1c0ec98a6b6bde9b1fbd4071cad1af6d` remains historical. Runtime kit `a9325265e87583a4872cf6a158e1e881a0d7508e` unchanged.

| Source ID | Actual C8 | Remaining original evidence |
| --- | --- | --- |
| azur-daily-bonus | [main](https://github.com/DanilaH/asoc-solitair/blob/b3180bbe2f2f39b5428e664c19a6c56cde63aed2/src/main.ts#L1984-L2005): ordinary offline-r1 saved round/reveal/claim, separate source catalog. | Helper thresholds, server day, RNG, odds and device. |
| azur-combo-streak | [engine](https://github.com/DanilaH/asoc-solitair/blob/b3180bbe2f2f39b5428e664c19a6c56cde63aed2/src/domain/engine.ts#L225-L265): own typed producers, five stages, dedupe, finite stage end. | Original producers, pending Moves, wildcard/recycle/Undo, stage-after-fifth. |
| azur-win-multiplier | [reward-offers](https://github.com/DanilaH/asoc-solitair/blob/b3180bbe2f2f39b5428e664c19a6c56cde63aed2/src/domain/reward-offers.ts#L88-L143): persisted base and extra=(factor-1)*base, own offer-authorization schedule. | Native eligible-win schedule vs own prepare-time, actual SDK and balance. |
| azur-daily-tasks | Ordinary/legacy journal, source28 retained. | Exact chest pool/saved roll source evidence integrated; other medals/remote/day, no-IAP attainability. |
| Hitapps specials | Existing adapted full-size Frozen/Bound/Puzzle; native narrow predicates #125/129. | Actual transitions, cost, Undo, combination and device. |
| unico-coffee-break | One ordinary AdsBreak/Coffee capability per owner, coffeePreview excludes releaseProfile. | Source trigger/type/award, SDK and ILRD. |
| unico-magnet-helper | Isolated adapted trial, not ordinary source parity. | Trusted signer and exact original behavior. |

12 consumer rows reconciled, two statuses updated to IMPLEMENTED_UNVERIFIED; no ACCEPTED or OWNER_EXCLUDED additions. Counts: {"IMPLEMENTED_UNVERIFIED":66,"IN_PROGRESS":7,"ROADMAPPED":23,"BLOCKED":9,"EVIDENCE_GAP":10}. All 38 packet owners/states and 115 IDs retained. Remaining P29/P30 source gaps are not a reason to rebuild existing mechanisms.

Continue [kit #150](https://github.com/DanilaH/mini-games-kit/issues/150): recovery/lives/Unlimited, Combo producers/pending Moves, Hitapps specials, Unico, original runtime/generation, meta/events and commerce. IAP remains off in first release. Original native/device, our Android/live SDK and human acceptance are different gates.

Initial kit CI [45594363530](https://github.com/DanilaH/mini-games-kit/actions/runs/45594363530) had no runner/zero steps. Source pin is an immutable draft, not merged main. No new native or Android run claimed. This PR changes documentation only.
