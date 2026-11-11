# Casual subject art — 0.9.1 / code 13

The user explicitly approved the simpler drum after rejecting the detailed 0.8.0 illustrations. This applies that direction to **all 33 unique subject sprites**, covering the same 35 published illustration URLs. Existing 16 UI/material resources remain byte-identical. [Per-subject source hashes, exact prompt bases, crop/export metadata and runtime hashes](CASUAL_SUBJECTS_0_9_1.json).

The new subjects use broad matte color masses, soft simple volume and clean silhouettes at 50–65 CSS px. No fine grain, metallic fixtures, repeated stitching or incidental ornament. Objects do not acquire faces. Animals retain simple natural features. Tea has visible amber liquid; the empty cup has a pale empty interior; the boot has a tall shaft. The first rope was rejected as too short/thick (expander-like) and regenerated with a long loose plain cord and short handles against the original subject and approved drum style.

Each subject was generated separately with built-in image generation; the drum reuses the exact approved original PNG. Source PNGs are preserved with alpha, separately from optimized shipping files. The source bundle includes all 33 selected masters, generation prompts, the original rope reference and the exact crop/resize exporter. The exporter crops alpha bounds and resizes to 192×192 with an 8px transparent gutter, WebP quality 92/alpha 100; it does not repaint or remove backgrounds. RGB color outside a source silhouette can look like an aura in a raw preview, but those pixels have alpha 0. Actual RGBA composites and production cards are clean.

Only the 33 canonical `public/art/generated/<subject>.webp` files are replaced. Published subject/card IDs, mappings, orders, categories, definitions, rules/content/balance 2/5/3 and saved attempts are unchanged. All production JS, CSS, HTML and worker files byte-match the verified 0.9.0 build. The changed runtime files are exactly these 33 images. Their total size drops from 517,154 to **262,716 bytes**; this is an asset-size result, not a measured FPS/retention claim.

## Verification

- Versioned `npm run check`: 65 unit/platform tests, every fixed control/80 campaign/28 daily witness, four-layout bounds, typecheck/build PASS.
- Six focused phone/compact browser checks PASS: full art pack decode/alpha/local-reference resolution, static repaint after viewport/banner changes, actual picture inspection and mode exit without spending.
- `tools/record-casual-art.ts`: **33 reachable subjects, 99 real canvas card captures and 66 real reader checks**, 360×780 and 320×568. Every reader shows the correct subject at 192×192; mode exits; board and resources stay unchanged; no runtime errors. Baselines use the same saved state and original assets. Every before/after card visibly changes (minimum 921 changed pixels), ruling out a stale asset cache. These are production-rendered cards, not mockups.
- Full renderer/layout/input code is unchanged. Physical-phone appearance/comfort remains device acceptance.

Reproduce gallery: `npx vite build --ssr tools/record-casual-art.ts --outDir .recording/casual-gallery-source` then `ASOC_QA_DIST=dist node .recording/casual-gallery-source/record-casual-art.js`. Optional `ASOC_ART_BASELINE` points to the original 49 WebP files for paired baseline captures. Local immutable final build is `.recording/casual-091-dist`; card evidence `.recording/casual-art-evidence`.

## Integration and delivered files

[PR #14](https://github.com/DanilaH/asoc-solitair/pull/14) merged at `38ec02095d8ac12cdf24d0026587b18e6e2d9211`; source `55a43cdab89ba0d4b5fa5bee6ecc4a88efbb5d0d`. Source and merge have identical trees. [Source CI](https://github.com/DanilaH/asoc-solitair/actions/runs/43024135024) passes typecheck/unit/content/build, the 191-state rendered layout audit and Android debug/signature plus unsigned SDK-disabled R8 release compilation. Its broad repeated browser gameplay run was still executing at delivery; no full-workflow green status is claimed. The app JS/CSS/HTML/worker bytes are unchanged from 0.9.0, whose complete gameplay CI passed; the changed pictures have the independent focused and full-subject acceptance above.

[Default-branch run](https://github.com/DanilaH/asoc-solitair/actions/runs/43024859543), Android job `130536902862` PASS, artifact `13855839486`, supplies the delivered APK. All 94 production files byte-match the final build and the APK is byte-identical to the checked branch artifact `13856702105`. Binary manifest decode and CI signature verification pass. `com.danilah.asocsolitair.debug`, 0.9.1/code 13, 10,313,440 bytes; SHA256 `7fa5f9a27e7ec0d3ff50e1fed0aafa69d2ff633e707ce1dcdc78ec1d83338547`. Certificate `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e` matches the preceding preview, so it can update that test app without uninstalling it.

Production-touch first win/Next and reachable dense category completion/next action during its tail/Undo/pause recordings PASS with the new artwork. The delivered dense GIF trims the first 1.35s of setup without playback acceleration.

All five persistent writes succeeded and local identity was applied:

- `asoc-0.9.1-card-comparison.png`: `libfile_b30a34588ab8819194aa59a53fd683a5`.
- `asoc-0.9.1-all-cards.png`: `libfile_805e919ec4988191ad8ce07b64610eb3`.
- `asoc-0.9.1-dense.gif`: `libfile_d37b3acfbdbc81919ede2530e7fcb08a`.
- `asoc-solitair-0.9.1-debug.apk`: `libfile_15558f9dcb6c8191a1feea4e73595421`.
- `asoc-solitair-0.9.1-art-sources.zip`: `libfile_b340685148e48191b4d80c5bbc54c08c`.

The source bundle is 30,618,929 bytes and preserves all 33 selected PNG masters, prompts, reference and exporter. Neither raw masters nor APKs/dist are committed into Git. Physical-phone readability/comfort/FPS/audio/haptics/native/live-SDK acceptance and production signing/store publication remain outside this artwork delivery.
