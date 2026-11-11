# Generated art kit — 0.8.0

The 33 subject illustrations described here are superseded by the approved [simpler 0.9.1 set](CASUAL_SUBJECTS_0_9_1.md). The 16 UI/material resources remain in use. Keep this page as provenance for the original kit, not as the current subject style brief.

All new artwork was produced using built-in image generation on 2026-11-10. Existing linked-card emblem and the proposed concept board are style references; competitor screenshots are not shipped assets. Normalized production briefs are recorded below. The original generation PNGs and per-cell export metadata are preserved separately as the source bundle below. Only optimized `public/art/generated/*.webp` files ship in the app.

Source bundle: `libfile_3cdd278696848191ba22d7c9a5fa8a7a`, `asoc-solitair-0.8.0-art-sources.zip` . It preserves all nine final source PNG outputs, including alpha, the export script and crop/SHA metadata. Non-shipping WebP previews under docs/art/masters are intentionally ignored; the source PNG archive is authoritative. Runtime sprites and export metadata are committed in Git.

## Common direction / prompt constraints

Production raster assets for Russian word-association solitaire. Polished softly painted tactile casual puzzle; warm ivory paper, periwinkle, petrol teal, coral ribbon, honey highlights. Upper-left light and short local shadows, recognizable silhouettes at 50–80px. No writing/numbers/logos/UI screenshots. Genuinely transparent background with padded independent silhouettes. Stable sprite-atlas cells; no cell borders or labels. Text/counters/controls are independent runtime layers.

| Source PNG | Atlas / contents |
| --- | --- |
| exec-287ef323-5754-46af-ad1c-50f812b332cd.png | 2×1: classic periwinkle linked-card back with coral ribbon; indigo diamond back with the same construction |
| exec-b4ac097d-6e13-4ce6-a9cc-6de3c8c19b4e.png | 2×1: blank ivory/periwinkle face; blank ivory/honey category face; uncluttered central paper |
| exec-fe00c46c-a41f-445d-9700-c4025de87ad6.png | 4×3: lightbulb, undo arrow, joker cards, coin / calendar, win-cycle cards, appearance cards, gem / key, lock, sparkle, ribbon |
| exec-1758d77f-a401-4e00-910a-0c89194d1728.png | 4×2: cat, owl, octopus, turtle / pike, spruce, tulip, apple |
| exec-0e8ef890-82c0-41b1-b866-4973fb889a99.png | 4×2: carrot, bagel, lollipop, tea / empty cup, shirt, boot, cap |
| exec-eed83bba-3c8c-4fbc-9c8b-e8c0f01111cc.png | 4×2: wardrobe, candle, vacuum, keyboard / soap, brick, book, eraser |
| exec-40a231b9-19c6-4286-89e5-4c705a79d258.png | 4×2: drum, skipping rope, bus, sailboat / helicopter, storm, triangle, hammer |
| exec-ed4dd894-b8d7-4137-a7cd-ee7edfb102f9.png | Single ripe yellow-green pear with stem and leaf |

| exec-c259a508-086f-4c37-997e-214aedb51e19.png | Final transparent rope cutout; overrides the rope cell of the drum atlas |

## Prompt briefs by resource

- **Backs:** exactly two equal portrait cells in a landscape atlas, front-facing 0.75 width/height ratio. Warm ivory rim, restrained repeating embossed arcs, a bold linked-pair sign and one coral ribbon. Second back uses indigo and honey diamonds. Both readable at 65px. No card face or letters.
- **Surfaces:** two identical blank rounded faces, clean nearly white ivory center with subtle paper grain; narrow periwinkle bevel on normal face, restrained honey/apricot bevel on category. Central 85% empty for dark text. No aged paper, writing, icons, tabs or illustrations.
- **UI atlas:** exact 4×3 equal-cell grid. Icons centered separately, no backplates. Blue glass/honey lightbulb; thick lavender counterclockwise arrow; ivory cards/honey star; round honey coin/glint. Coral/ivory calendar; cards/star/ribbon win-cycle; periwinkle/ivory linked appearance cards; honey gem. Gold key; indigo lock; warm four-point spark; short shallow-S coral ribbon. Shared lighting/material, no emoji or text.
- **Illustration atlases:** exact 4×2 equal square cells, listed row-major above. Match the initial animal/plant atlas: warm rich painted volume, recognizable semantic silhouettes, no surroundings or writing, no anthropomorphic object faces. All objects inside their own cell with transparent gutters. The pike has a pointed snout/spots; wardrobe has two doors; keyboard has no letter legends; cup is empty; tea is amber; rope has two handles; triangle is a plain clear geometric shape.
- **Pear:** single natural golden-green pear with wide rounded bottom, narrow neck, stem/leaf, no extra fruit. Same upper-left lighting and painted material. Transparent outside, readable at 50px.

## Export and runtime ownership

`tools/export-art.mjs` only slices rectangular atlas cells, finds padded alpha bounds and exports WebP; it does not redraw artwork or synthesize/remove backgrounds. Cell rectangles and original PNG SHA256 are in `docs/art/masters/*.webp.json`. Card masters export at 384×512; icon/subject exports at 192×192 with transparent padding. Preserve alpha. The two logical card widths are 124 and 138 for height 166; geometry remains owned by the existing layout. The same frame material scales with the card rather than changing hit bounds.

`src/game/art.ts` maps existing published illustration URLs to presentation resources. All 35 SVG reference paths remain unchanged in domain/content files; repeated legacy owl/hammer images share the new matching subject. There are 33 unique subject sprites and 16 UI/material sprites, 49 runtime files total. Existing SVG originals remain in place for content compatibility/provenance, but the current renderer resolves every supplied illustration through the generated kit.

Decorative ribbon/sparks/keys are pooled Phaser images. Monies use the same coin sprite in HUD and flights. Domain state and deduplicated rewards do not depend on the sprites, animations, or sounds. Both palette and back selections keep their existing save identities/unlocks. Reduced motion suppresses decorative travel. No runtime network font/image generator call exists.

## Alpha correction

The decode/alpha acceptance check caught white or near-opaque backing in 17 early subject exports. The animal/plant and household atlases and the rope were edited with built-in image generation, preserving silhouettes/materials/order while removing backdrop, floor shadows, pale haze and white backing to genuine alpha-zero gutters. The final PNGs listed above supersede those early exports. The rope standalone export supersedes its original cell in the drum atlas.

Correction prompt: background-extraction of the supplied edit target; preserve all existing objects in the same grid locations, scale, colors and details; remove ONLY the entire background, floor/backdrop shadows, white backing plates, haze/glow/fog outside the silhouettes; genuine RGBA alpha zero outside objects and in empty gaps/rope-coil holes; retain white/cream pixels that belong to objects; no fake checkerboard or solid background; do not invent/replace objects or alter atlas aspect ratio.

Final small-sprite inspection also identified tinted rectangular haze behind seven transport/tool subjects from the original drum atlas. That atlas received the same strict cutout edit; all seven final sprites were re-exported. Food/pear/UI sprites were inspected separately. Alpha-count tests establish resource/gutter integrity, while visual inspection remains necessary to detect diffuse backing within an exported bounding rectangle.
