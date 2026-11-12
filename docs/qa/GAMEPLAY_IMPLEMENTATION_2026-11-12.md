# Gameplay follow-up — 0.9.2 / code 14

User approved the four-package plan on 12 November. This change implements trustworthy Hint and category-reader clarity, plus six isolated QA prototypes and a ready human-pilot protocol. It does not replace or reorder campaign/daily content.

## Delivered behavior

- The hint worker returns a discriminated SOLVED/UNKNOWN/UNSOLVABLE/UNAVAILABLE outcome. Only SOLVED has an action and can reach the ordinary charge transition. There is no first-legal fallback. Known-path matching also remaps equivalent upper foundation slots to the player's actual slots. Tableau, locks and Joker coordinates stay exact; the search/state/save identity is unchanged. The existing 4000-node search budget and five-second timeout remain bounded; UNKNOWN never means a deadlock.
- Replies carry request, revision, attempt and deal identity. Duplicate/stale replies cannot spend another charge or release a newer request. Errors/timeouts preserve charges. Known and searched continuations still show an ordinary ghost; repeat is free and the player moves the card.
- A proven failure concerns the current position/budget without helpers. The message keeps the charge and mentions existing Undo when available; it does not promise a helper will solve the position or force a purchase.
- Card inspection uses the full original category name. The utensil/dishes distinction is explained only when both groups are present; selected ambiguous contexts have a short local explanation. Ordered leaders retain their numbered instruction; picture inspection retains its image/name. No permanent field caption or membership change.

## Six isolated prototypes

Sources: `tools/prototypes/`. Catalogue: `deals.json`. Two semantic alternatives use a common property (wings) and a common operating requirement (electricity). They share the control's exact access pattern, stock length, category sizes, two foundations, images on unchanged cards and budget. The changed members are word cards. They are candidate hypotheses, not established improvements.

The other three test a preparatory buffer, a contiguous ordered interval and prioritization of key reveals. Existing rules and the production BoardScene renderer are reused. The standalone driver has no SDK, analytics or ordinary save writer; its attempts exist only in memory. Its outer controls are for testing. Audio is disabled consistently; it is not an Android-feel comparison.

`npm run build` still has only the ordinary production entry. `npm run qa:prototypes:build` creates a separate output under `.recording/prototypes-dist`; prototypes never enter the production catalogue/APK. CI builds and validates this separate entry. Human-test route and acceptance/rejection criteria: [PILOT.md](prototypes-2026-11-12/PILOT.md).

## Compatibility and boundaries

Rules/content/balance remain **2/5/3**. The 80+28 fixed orders, all published card identities/memberships, the asset pack, price/reward values, helper unlocks, SaveStore/native receipts and kit pin are unchanged. The owner-approved Hint eligibility policy supersedes the historical permitted charged fallback in requirements §6.1; no save migration is needed. Package/native version only advances to 0.9.2/code 14.

The audit is merged separately as PR #15. The implementation and test lab are a new reviewable package. Production ad settings/signing/publication are untouched.

## Verification

Completed locally: `npm run check` (71 unit/platform tests, every fixed witness/four-layout bounds, typecheck and production build); initial 28 focused browser checks, then ten final Hint/reader cases after expanding the exact semantic-reader fixture. Actual replay of the level-19 counterexample keeps Hint **3 → 3**, Undo restores nine moves. Full category reader fits 360×780 and 320×568.

Prototype independent replay/transition comparisons and bounded first alternatives: [validation.json](prototypes-2026-11-12/validation.json). Four strategies × four seeds × six variants: [agents.json](prototypes-2026-11-12/agents.json); all 96 simulated runs win. Perfect visible recognition/loop penalties are assumptions, not a human difficulty estimate. Final prototype real-touch evidence is recorded in [browser.json](prototypes-2026-11-12/browser.json); the recording verifies an ordinary-save sentinel stays untouched.

The final local rendered audit passes 191 screens at seven viewports (119 field raster states), zero DOM/raster issues. All six prototypes finish through real touch on 360×780 and 320×568; the ordinary-save sentinel stays unchanged. The level-19 Hint/Undo and full reader fit both sizes. Final-source CI and default-branch APK verification now pass; exact identities are recorded below. A follow-up probe found that moving a category to another free upper slot previously returned UNKNOWN on levels 6/17/19 after roughly 2.6/4.5/5.4 seconds locally. Equivalent-slot matching now returns SOLVED in 0/0/3 ms in the same probe. This is a machine-time sample, not a phone benchmark. A unit check remaps and replays every one of the 108 fixed continuations through reversed foundations. The probe is saved in `prototypes-2026-11-12/hint-slot-probe.json`.

## What is deliberately held

No human pilot has been conducted. No new content is promoted into campaign, no level order or budget is changed, and no Director/meta system is introduced. The current next step after delivery is the bounded pilot, not mass production of additional semantic categories. The lab's variants can be rejected if they add ambiguity or do not produce a different satisfying decision.

No physical-phone audio/haptic/performance or live SDK result is claimed. Native compilation and a signed preview artifact are separate from those acceptance gates.

## Reproduce

```sh
npm run check
npm run qa:prototypes:build
npm run qa:prototypes:validate
npx playwright test tests/browser/hint-trust.spec.ts tests/browser/experience.spec.ts
npm run qa:layout
npx vite build --ssr tools/record-hint-fix.ts --outDir .recording/hint-fix-source
node .recording/hint-fix-source/record-hint-fix.js
npx vite build --ssr tools/prototypes/record.ts --outDir .recording/prototypes-recorder
node .recording/prototypes-recorder/record.js
```

Do not re-run `tools/prototypes/build.ts` to reproduce the reviewed frozen catalogue; it is the explicit authoring command. Validation/recording consume the checked-in `deals.json`. It writes only QA files, never campaign or daily.

## Exact-source final verification

[PR #16](https://github.com/DanilaH/asoc-solitair/pull/16) merged at `c6eb626342f238abb99bb97a2c794b4027bed852`. Source `04dfa973c6f12c04e9a82cdc801fc2bae387e1ab`; the merge tree exactly matches. [Source workflow 43173919521](https://github.com/DanilaH/asoc-solitair/actions/runs/43173919521) fully passes: 71 model/platform tests/all fixed witnesses/build, 191 rendered screens, **108 browser scenarios and four deliberate duplicate compact chapter skips**, Android debug/signature and unsigned disabled-SDK R8 release compilation. Full browser run includes all 80 campaign levels through real touch/Next. Local final focused Hint/reader matrix adds 12 passes, including a late error from a terminated worker while a newer request is active.

Source Android artifact `13923038287`: independently decoded manifest confirms `com.danilah.asocsolitair.debug`, 0.9.2/code14. All **94** expected embedded production files byte-match the immutable final local build; the experimental lab is absent. APK 10,314,552 bytes, SHA256 `762e389f7b3c58224930549dddfe9c7888ebfb1780ecddc544e06f9445c21dd4`; signer certificate `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e` matches the preceding preview. It can update 0.9.1 without uninstalling. Default-branch run `43176087204`, Android job `131040560912`, artifact `13923474225` PASS. Its debug APK is **byte-identical** to the source APK and the saved download, with the same manifest, 94-file match and signer. No replacement upload is needed. [Machine-readable delivery proof](prototypes-2026-11-12/delivery.json). The duplicate main web run is still executing at delivery; full final-source web acceptance applies to the identical merge tree.

Saved deliverables, all five succeeded and local identity was applied:

- [Test APK 0.9.2](https://chatgpt.com/library?file_id=libfile_7e7b353437488191a5db6820e2d83ea8&account_id=personal).
- [Real Hint/Undo/category-reader GIF](https://chatgpt.com/library?file_id=libfile_a9cdac5c681881919ef0ce0d74b60e60&account_id=personal).
- [Six actual prototype fields](https://chatgpt.com/library?file_id=libfile_d888fc8382408191af60eefdf04b5402&account_id=personal).
- [Prototype input GIF](https://chatgpt.com/library?file_id=libfile_8ca410ef1c248191bb92fd9144e061bf&account_id=personal).
- [Standalone local prototype web bundle](https://chatgpt.com/library?file_id=libfile_ef7c8e2ad4648191add81fcc868d9e4e&account_id=personal), with server/start instructions. This is QA material, not an additional shipped game mode.

Local media: `/workspace/scratch/50187ffca82b/asoc-media/`. GIFs contain ordinary production touch and explicit restored test fixtures; initial setup remains visible, no speed-up. The source tree has no binaries or signing material. No human enjoyment, retention, physical-phone or live SDK uplift is claimed.
