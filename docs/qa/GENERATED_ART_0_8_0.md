# Generated art implementation — 0.8.0 / code 11

Implemented and merged in [PR #12](https://github.com/DanilaH/asoc-solitair/pull/12). Exact verified source: `b0ea1e50dac79c4a25823f263ee69f95fa479281`; main merge: `3c28908f41f5f74bed7d869f3b29b8098192c4d4`. The agreed plan's A/B/C presentation work is implemented. Physical-phone and live production-service acceptance remain open.

## Result

- **49 original optimized local sprites, 766,066 bytes**: four card surfaces/backs, twelve UI/effect resources and 33 unique subject illustrations covering all 35 existing image reference paths. Published URLs/IDs, category membership, deal order, rules/content/balance 2/5/3 and the 80+28 bank remain unchanged. Presentation-only resolution is in src/game/art.ts.
- Actual Phaser faces/stock/backs use the material kit; both card widths, both backs/palettes, four deck placements and no-stock teaching layouts remain supported. Darker main text and fewer forced line breaks on short words. Lifted drag shadows remain within existing geometry ownership.
- Matching HUD/helper/home art, coral primary actions, paper secondary controls, common materials across all 11 dialogs, real cosmetic previews, compact settings toggles and rounded close controls. The responsive 0.7.1 screen structure remains authoritative; no new game systems or slots.
- Local pooled completion ribbon/sparks, common coin sprites and matching key/lock/Joker art. Reduced motion, Undo/restart and dialog cleanup retain their contracts. Domain state/reward deduplication never depends on visual completion.
- Source PNGs, normalized generation/edit briefs and exact source SHA/crop records are preserved via docs/art/GENERATED_ART_0_8_0.md. Runtime resources are committed in Git; source bundle identity is `libfile_3cdd278696848191ba22d7c9a5fa8a7a`.

## Problems caught and fixed

The alpha/decode check found white backing in early subject exports; manual small-sprite inspection additionally found diffuse rectangular haze inside other sprite bounds. All affected atlases received built-in cutout edits and were re-exported. Alpha counts are a resource-integrity check, not a substitute for visual inspection.

The actual raster audit also caught a blank static scene after a backing-store/banner resize: a reduced-motion board could sleep in the POST_RENDER turn that cleared its canvas. A bounded two-frame repaint tail now survives screen entry/real resize, then normal idle sleep resumes. Resize clears local decoration. The new regression checks real painted card pixels across repeated viewport/banner changes, without a Phaser debug bridge or a geometry-derived oracle.

Two whole-journey tests exhausted their old 30-second total allowances while advancing ordinary moves/reloads. Their totals are now 60 seconds, with all individual action/scene/reward assertions unchanged. Both pass on focused reruns (intro journey 30.1s; milestone/reload/theme selection 24.5s in the final focused run). These timings describe test execution, not phone frame rate.

## Completed verification

[Exact-source PR CI](https://github.com/DanilaH/asoc-solitair/actions/runs/42882165012), both jobs **PASS**:

- TypeScript, **59 model/platform tests**, all supplied intro/campaign/daily witnesses and four-layout bounds, production build.
- Independent DOM/dialog/rendered-PNG audit: **176 states on seven viewport sizes, 0 violations** (119 field + 21 home + 36 dialog states). Missing painted-card/tab positive controls count as failures.
- **72 browser scenarios PASS**, four deliberate duplicate compact chapter skips. Includes all 80 campaign levels via real touch; complete modifiers/daily/save/helper/result flows; new 49-resource decode/alpha/local-origin checks and static scene repaint checks on both profiles.
- Android debug and unsigned SDK-disabled R8 release compilation, preview signature verification. Version is 0.8.0 / code 11; package/signing policy retained.

Local final focused checks: both profiles' art/repaint checks PASS; intro win/reload/replay and milestone/result/reload/theme selection PASS; full post-fix layout audit PASS. Preliminary interrupted/pre-fix runs are superseded by the complete exact-source CI above.

## Media and APK

Final recordings use the same exact production assets and ordinary touch input. First: fresh level 1, victory and Next. Dense: level 17 fixture reached through its frozen witness, category completion, the next action during the effect tail, Undo and pause. Compact/top-bottom/left-right checks are separate from demonstration capture.

Delivery GIFs retain actual frames at 360×780 / 16fps. The first trims 0.9s of initial loading; the dense clip trims 5.0s of fixture setup/home reload. No gameplay frames are fabricated or replaced by the concept image. The three-screen image is a direct montage of actual home/field/pause captures.

The default-branch artifact run is [42884353271](https://github.com/DanilaH/asoc-solitair/actions/runs/42884353271). The main APK has been downloaded and verified: all 93 game files match; version/package/certificate match the expected 0.8.0 preview identity. It is byte-identical to the checked branch artifact. All four deliverables are saved successfully; exact hashes and stable file identities are recorded in VERIFICATION.md and SESSION_HANDOFF.md.

## Limits

No attached physical Android phone. Browser pixels/touch/compilation do not establish phone readability, native insets/banner delivery, sound/haptics/FPS/thermal behavior, process-kill durability, live ads or analytics arrival. Production IDs, managed release signing and store publication remain deferred. Human content pacing/editorial acceptance is unchanged. Further work should follow phone/user feedback on this implemented version, not restart the static mockup phase.
