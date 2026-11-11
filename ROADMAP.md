# Roadmap

**Gameplay audit (review only):** [findings and priority plan](docs/qa/GAMEPLAY_PRODUCT_AUDIT_2026-11-11.md). Proposed next package: reliable Hint outcomes, semantic boundaries in the existing reader, then isolated content prototypes/human pilot. Runtime Directors, bank replacement and new meta are not selected. None of these proposed changes is implemented in this audit.

**0.9.1/code 13:** the approved simpler art direction is implemented for all 33 subjects and delivered from main, PR #14. [Native/art evidence and source bundle](docs/art/CASUAL_SUBJECTS_0_9_1.md). Core game code and the frozen bank are unchanged; physical-device acceptance remains open.

The four approved follow-up UI/UX/feel packages are merged and delivered as **0.9.0/code 12**, PR #13. Full exact-source CI passes 65 unit/platform tests, all fixed witnesses, 191 rendered states, 96 browser scenarios and both Android compilations. [Verification and delivery](docs/qa/EXPERIENCE_IMPLEMENTATION_2026-11-11.md) supersedes the historical status below. Physical-device/live SDK acceptance remains open.

The generated art plan is implemented and merged as **0.8.0 / code 11**, PR #12. [Evidence](docs/qa/GENERATED_ART_0_8_0.md): 49 local resources, coherent actual field/HUD/home/dialogs, pooled effects and bounded static-scene repaint. Exact-source PR CI passes 59 model/platform tests, all fixed witnesses, 176 layout states, 72 browser scenarios (four deliberate duplicate skips) and Android debug/release compilation. Physical-device/live service acceptance remains open.

Full agreed v1 remains the target. Checked status is evidence-based, not a claim of release parity.

| Stage | Status | Result / completion condition |
|---|---|---|
| 0. Project / kit / docs / builds | Implemented, CI verified | Version-pinned project, normative docs, contracts, lockfile, web checks, Android source/sync and successful hosted debug/unsigned-release compilation; see VERIFICATION |
| 1. Ordinary pure model | Implemented, tested | Whole packets/leaders, draw/recycle, budget, transactional completion/flip, Undo, reward identity and versioned saves. Reachable-state card invariants and control path pass |
| 2. Complete short party | Implemented on browser | Original cards/images, cascade, drag/tap, flip, reflow, completion/praise, streak coins, per-event audio, manual ghost hint, result/replay/restore. Browser touch and screenshot evidence; phone feel unverified |
| 3. Twenty own campaign deals | Implemented; CI replay / real-touch campaign / Android builds pass | Twenty frozen original deals, 29 topics / 130 used members, local illustrations, exact witnesses/validation records, home/level selection/next/resume, event-driven teaching and Hint 3 / Undo 4. Human difficulty/editorial playtest remains pending; see docs/content/FIRST_CAMPAIGN.md |
| 4a. Rule extensions | Implemented; CI browser / Android compilation pass | Joker support, ordered intervals/prefixes, three-key locked column; six teaching/application deals 21–26. Backward-compatible save migration, full Undo and hint semantics. See docs/content/MODIFIERS.md |
| 4b. Compact meta | Implemented; full CI/browser/native compilation pass | Ten-level milestones, ink palette/diamond back, five-new-win cycle, 28 fixed daily puzzles/calendar streak, left/right deck. Independent saved attempts with shared wallet/receipt ownership. See docs/content/COMPACT_META.md |
| 4c. Candidate bank / UX | Implemented; full CI/browser/native compilation pass | 80 fixed campaign levels, 53 ordinary topics / 255 used member captions, 8 additional SVGs, four level pages, explicit daily training, restart/date replacement protection, short-screen layout. Human pacing/device acceptance remain pending; see docs/content/RELEASE_BANK.md |
| 4d. Content / UX review | Integrated; local check/focused UX and full hosted web/final native checks pass; phone pending | Complete top/bottom × left/right deck placement, full compact guidance, bounded category titles and explicit abandonment consequences. See docs/qa/UX_REVIEW_2026-11-10.md |
| 5. Native services / release | Services implemented and CI compiled; device/live release acceptance pending | Real SDK adapters, native storage/receipt journal, helper economy/continuation, analytics schema, haptics/audio focus and safe-area banner integration are connected. 0.6.1: 58 model/platform checks and 58 browser scenarios pass (four duplicate compact chapter traversals skipped); isolated demo debug and unsigned SDK-disabled R8 compilation/signature checks pass. Physical/live acceptance remains pending. Final generated assets and cached audio are implemented in 0.8.0/0.9.0; physical device/live evidence, production configuration and managed signed release remain pending |

Do not describe one control deal as the first twenty campaign levels. Do not call configured CI a successful native build or call a compiled APK production ready. Do not add excluded systems to rescue scope.

## 0.6.2 casual presentation candidate

Cyan/ivory cards, gold categories and raised controls; shared original reward sprite; staged collection/praise, persistent streak-cell feedback and dialog-layer coins. Production touch recording covers a full first win/Next and dense completion/overlapping action/Undo. PR CI passes 58 model/platform tests, 64 browser scenarios, fixed witnesses/layout bounds and both Android compilations. Physical-device acceptance remains open. See docs/qa/CASUAL_FEEL_2026-11-10.md.

## 0.7.0 selected identity implementation

Home/game/pause implementation is merged as 0.7.0/code 9; see docs/qa/IDENTITY_UI_2026-11-10.md and VERIFICATION.md for passing CI, signed preview APK and production touch recordings. Next acceptance is the redesigned game on a physical phone; live production SDK configuration/signing remain deferred.

## 0.7.1 layout correction

Independent DOM/rendered-PNG audit and responsive correction are merged as 0.7.1/code 10; 176 layout states pass without overlaps. The matched/signed preview APK and touch GIFs are delivered; see docs/qa/LAYOUT_AUDIT_2026-11-10.md and the handoff for exact verification and pending duplicate hosted runs. Next acceptance is the corrected layout on a physical phone.
