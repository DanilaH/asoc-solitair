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

Integration/native compilation and final persistent artifact identities are still pending at this source checkpoint; do not mistake the earlier 0.9.0 APK for the new artwork.
