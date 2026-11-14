# UI coherence —0.15.0/code23,14.11.2026

Owner approved the bounded package from [the independent all-screen audit](ALL_SCREENS_UI_UX_AUDIT_2026-11-14.md). Baseline main dc72b6c797e30754a1157b97d59ca5b786e62948 /runtime0.14. No wholesale redesign.

## Implemented

- Appearance, helpers, calendar, level picker and result keep headings/actions in place. Their contents scroll independently. Home keeps Play/level selection in a fixed action area; short screens reduce the decorative emblem. Short unlock results omit the emblem/miniature first and put Replay/Home alongside each other. Apply-unlock now has a44CSSpx target.
- The already-owned fifth-win receipt remains visible as5/5 and20coins+1Hint. The next0/5 is secondary. Payout/receipt/economy authority unchanged; no new grants or storage schema.
- Eight pooled result coins use a right gutter outside title/amount/CTA. Their start follows the actual panel entrance completion (a transforming dialog temporarily owns fixed-layer coordinates). Close, scroll, viewport/text geometry changes and activity block invalidate pending/active presentation; none owns durable rewards. Reduced motion skips coins.
- A real pending Hint says «Ищу…» and exposes aria-busy in its existing geometry. Success restores free repeat; stale/modal/error/timeout keeps the existing no-charge policy.
- Startup errors hide/inert the unfinished app, offer «Повторить загрузку» and place raw details in a collapsed section. Retry reloads and reads the existing SaveStore; no reset/remove/default fallback on failure.
- The helper catalog uses neutral purchase actions; the existing focused offer retains its primary action. Existing helper pictures are reused. Shorter helper/cycle/calendar copy retains costs and consequences; no unavailable-video filler.
- Tutorial verification installs its controllable clock before the application, samples actual painted cue phases and verifies hiding/returning. Both real-image network negative controls fail. No tutorial/runtime hand change.

## Verification status

Initial source0d29019c; final source **fe3dd9093e25d492ef21b8fadb2b24a74f30a7ca**, treebc70d9ae4b4fb5d5c60199aa5253468f72d6d9b9, PR#28. Text-reflow stress exposed stale coin coordinates during live font changes; the follow-up observes actual result/title/amount geometry and synchronously removes cancelled coins. Old callback completion cannot hide a reused token. Local26focused cases pass; final6coin/reflow/receipt cases pass after synchronous cleanup. Initial24focused cases also pass across both browser profiles;92unit/platform pass. All120screens captured with0page errors;119independent layout/raster states have0issues. Eight transition/text-reflow probes and two actual SaveStore failure-injection cases complete without normal pageerrors. Coin title overlap0/97sampled frames (baseline15/98); targeted tests also protect amount/CTA, normal/reduced and short unlock result. Fifth-win Hint is owned3→4 and explicitly shown; pending Hint3→2 only after a valid reply. Recovery preserves the profile/attempt.

The same five new UI checks fail on the frozen0.14 baseline for their intended defects. Both actual missing-image tutorial controls fail;12coherent-clock repeats pass. One early local parallel invocation shared its output directory with another test run and built while captures were active, causing missing trace artifacts/transient load failures; it is discarded, not counted as product acceptance. Final focused/capture runs use separate evidence locations and an unchanged production build.

Final-source Android debug/signature and unsigned SDK-disabled R8 checks pass in43612510838. Signed preview0.15/code23:11,557,289bytes, SHA2560f2ef1442ee524e0110d8e7545cafa808b9b1e220f435a17ee0f28a6fcbac6e8. Same certificate0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e; all191game web files match final recordings/build, plus two empty Capacitor-generated Cordova files. DEX verification confirms AD_MODE=test and an empty analytics key. [Proof](ui-coherence-0_15_0/source-apk.json), [checks](ui-coherence-0_15_0/checks.json), [saved APK/GIF/PNG identities](ui-coherence-0_15_0/media.json). All4files saved/version0/metadata applied; never repeat these creates. Prior intermediate APK/source0d29019c was not delivered.

**Final sourcefe3dd909 full PR CI43612510838 passes192browser cases/4deliberate skips,92unit/platform tests,108deals/216current+legacy paths,253244rule comparisons,96prototype attempts and119layout states with0DOM/raster issues. Both Android builds/signature pass.** [CI snapshot](ui-coherence-0_15_0/ci.json). The duplicate push run43612507087 was still running at this acceptance checkpoint; no second-pass claim. Earlier source0d29019c passes both full runs43611405455/43611400979 with190browser cases. Source/runtime is frozen; no further rebuild/upload is needed for documentation changes. Phone feel remains unmeasured. On320×480 only the optional Helpers entry inside expanded settings requires internal scrolling; Continue/close stay visible. Locked/disabled Undo is not an inaccessible-action defect.

Normal controls are checked before Playwright auto-scroll, with center/interior taps for rounded shapes. Large-text checks model150%DOM reflow, not native Android font zoom. Recordings use legal prepared saves and actual production input; they are separate browser scenes at original1×timing, not a phone/continuous campaign playthrough.

## Boundaries and kit

Rules/content/balance3/5/3,80+28fixed deals, legacyv2 active/parked attempts, precise Undo, SaveStore, rewards/prices, compact board,33casual subjects, deck/drop geometry, SDK settings and signing identity remain unchanged. Runtime kit a9325265; guidance aab9dc8e.

Selected UX/art roles, Stable Progress initial-action checks and UI Motion Recipes pending/earned/cancel contracts. KIT IMPACT:REUSE of guidance and QA probe; no new runtime export/extraction or kit mutation. The sheets are consumer-owned HTML/CSS, not another generic UI library. Phone comfort, audio/haptics and live SDK remain unmeasured.
