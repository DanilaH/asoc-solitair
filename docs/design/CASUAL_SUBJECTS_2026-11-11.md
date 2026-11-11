# Casual card subjects — 2026-11-11

**Approved and implemented throughout the 33-subject set as [0.9.1/code 13](../art/CASUAL_SUBJECTS_0_9_1.md).** The prototype evidence below is historical.

Latest user feedback after the 0.9.0 recordings: the generated card subjects are too detailed; the drum is the explicit example. Treat this as a direction for a substantially simpler illustration set, preserving the existing card/UI materials and semantic subject identities.

## Visual direction

- One instantly recognizable silhouette, a few broad matte color masses and soft rounded forms.
- At most one broad shade per surface; keep a little volume without realistic rendering.
- Remove fine fixtures, repeated small stitches/ropes, grain, metallic glints and tiny decorative parts.
- Retain only details needed to identify the object at 50–65 CSS px.
- No faces or anthropomorphic props; casual does not require childish characters.
- Match subject scale, transparent padding and lighting across the set. Judge actual cards before large standalone illustrations.

## First direction sample

One drum was edited using built-in image generation: smooth coral body, large ivory drumhead, broad honey rims, chunky plain sticks and a few thick cream bands. The input was the shipped `public/art/generated/drum.webp`. No published content/image identity changed.

Original output: `exec-e2ec61f9-9d30-4e16-b013-32eb329f057e.png`, SHA256 `0f3acf329df2ff5f9f21b0b6caf937ca5374137d8189b6b5168904c03c054f1f`. The generation output is automatically preserved as a generated image. Local optimized candidate: `.recording/casual-subjects/drum-casual-v1.webp` (192×192, 12,338 bytes, alpha 0–255). Export only trims transparent padding and resizes; it does not repaint or remove backgrounds.

Prompt: style-transfer of the supplied drum; make it substantially simpler for a 50–65px casual mobile puzzle card. Single rounded coral cylinder, smooth ivory oval drumhead, broad muted honey rim, three thick cream diagonal bands, two short chunky wooden sticks; a few broad color masses, matte surfaces, one gentle shade per surface. Remove studs, fasteners, lugs, hooks, rope knots, fine lines, wood/fabric grain, metallic highlights, specular glints and ornament. Slight top-down three-quarter view, genuine transparent cutout and padded silhouette. No face, eyes, backdrop, floor shadow, halo, text or watermark.

Comparison `asoc-casual-drum-comparison.png`: `libfile_d50db6f7130881919b2941ce3939c60b`. It shows actual production-rendered cards enlarged ×3, rather than a mock card. Local file: `/workspace/scratch/50187ffca82b/asoc-media/asoc-casual-drum-comparison.png`.

Probe `.recording/casual-subjects/probe.ts` found a reachable open drum in campaign level 12 (`music_2`). It loaded the same saved state for before/after and temporarily intercepted only the drum asset request for the candidate. Actual card and picture reader both render, there are no page errors and the saved board stays unchanged. At the prototype checkpoint no runtime source, mapping, rules, economy or shipped asset had changed; the delivered APK was still 0.9.0. The full set is now delivered in 0.9.1 above. This was a direction sample at that checkpoint; the completed whole-set delivery is linked above.

The existing helicopter and shirt were also visually inspected: metallic highlights/fine hardware and fabric/button/stitch detail are the same problem. Use this simpler direction consistently when replacing subject art; keep the 33 unique semantic subjects and all original reference mappings intact.
