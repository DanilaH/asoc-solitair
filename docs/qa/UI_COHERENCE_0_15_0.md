# UI coherence —0.15.0/code23,14.11.2026

Owner approved the bounded package from [the independent all-screen audit](ALL_SCREENS_UI_UX_AUDIT_2026-11-14.md). Baseline main dc72b6c797e30754a1157b97d59ca5b786e62948 /runtime0.14. No wholesale redesign.

## Implemented

- Appearance, helpers, calendar, level picker and result keep headings/actions in place. Their contents scroll independently. Home keeps Play/level selection in a fixed action area; short screens reduce the decorative emblem. Short unlock results omit the emblem/miniature first and put Replay/Home alongside each other. Apply-unlock now has a44CSSpx target.
- The already-owned fifth-win receipt remains visible as5/5 and20coins+1Hint. The next0/5 is secondary. Payout/receipt/economy authority unchanged; no new grants or storage schema.
- Eight pooled result coins use a right gutter outside title/amount/CTA. Their start follows the actual panel entrance completion (a transforming dialog temporarily owns fixed-layer coordinates). Close, scroll, resize and activity block invalidate pending/active presentation; none owns durable rewards. Reduced motion skips coins.
- A real pending Hint says «Ищу…» and exposes aria-busy in its existing geometry. Success restores free repeat; stale/modal/error/timeout keeps the existing no-charge policy.
- Startup errors hide/inert the unfinished app, offer «Повторить загрузку» and place raw details in a collapsed section. Retry reloads and reads the existing SaveStore; no reset/remove/default fallback on failure.
- The helper catalog uses neutral purchase actions; the existing focused offer retains its primary action. Existing helper pictures are reused. Shorter helper/cycle/calendar copy retains costs and consequences; no unavailable-video filler.
- Tutorial verification installs its controllable clock before the application, samples actual painted cue phases and verifies hiding/returning. Both real-image network negative controls fail. No tutorial/runtime hand change.

## Verification status

Initial92unit/platform tests and9new UI scenarios pass. Tutorial original wall-clock failure reproduced locally; revised coherent-clock verification passes12 repeated cases across both browser profiles. Two transparent-image negative controls fail as expected. Final-source focused/browser/layout/120-state capture and hosted Android checks are in progress; this document is not a green-CI or phone-feel claim. Final evidence will be appended after those complete.

Normal controls are checked before Playwright auto-scroll, with center/interior taps for rounded shapes. Large-text checks model150%DOM reflow, not native Android font zoom. Recordings use legal prepared saves and actual production input; they are separate browser scenes at original1×timing, not a phone/continuous campaign playthrough.

## Boundaries and kit

Rules/content/balance3/5/3,80+28fixed deals, legacyv2 active/parked attempts, precise Undo, SaveStore, rewards/prices, compact board,33casual subjects, deck/drop geometry, SDK settings and signing identity remain unchanged. Runtime kit a9325265; guidance aab9dc8e.

Selected UX/art roles, Stable Progress initial-action checks and UI Motion Recipes pending/earned/cancel contracts. KIT IMPACT:REUSE of guidance and QA probe; no new runtime export/extraction or kit mutation. The sheets are consumer-owned HTML/CSS, not another generic UI library. Phone comfort, audio/haptics and live SDK remain unmeasured.
