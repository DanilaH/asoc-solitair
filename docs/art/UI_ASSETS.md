# Current art

0.8.0 uses the coherent generated kit documented in [GENERATED_ART_0_8_0.md](GENERATED_ART_0_8_0.md). The entries below preserve historical 0.6.2/0.7.0 provenance; they are not the current resource inventory.

# UI art — 0.6.2

`public/art/ui/reward-emblem.webp` is an original generated reward sprite, used by the category praise and the win result. It is decorative and has no input or domain ownership. The same small asset is reused; no per-frame filters or generated backgrounds are introduced.

Created with the built-in image generation tool on 2026-11-10. Transparent PNG source was inspected and resized to a 384px WebP (27 KB) for the bundled app. Source generation prompt:

> Production asset for a polished casual word solitaire mobile puzzle: a single compact victory emblem, isolated on a genuinely transparent background. A chunky five-point golden star with rounded bevels, warm honey-gold material, luminous cream highlights, a small fan of three ivory playing cards behind it with cyan-blue edges, restrained teal enamel leaves on each side and three tiny golden sparkles. Front-facing orthographic composition, readable at 100px, soft hand-painted 3D casual puzzle rendering, clean silhouette. No letters, numbers, logos, hearts, faces, crowns, trophy cup, banners, text or background.

Cards, helper controls and layout remain editable procedural/vector/CSS artwork. This asset does not replace semantic card illustrations or promise a reward amount.

## 0.7.0 identity assets

- `public/art/ui/linked-cards.webp` is the accepted original emblem from `docs/design/art/linked-cards.webp`, reused byte-for-byte. Provenance and prompt: `docs/design/OWN_CHARACTER_2026-11-10.md`. No new generated art was needed.
- `public/fonts/nunito.ttf` is the variable Nunito font from the Google Fonts `ofl/nunito/Nunito[wght].ttf` source, bundled for offline Cyrillic/Latin rendering. License retained at `public/fonts/OFL-Nunito.txt` (SIL Open Font License 1.1). Source: https://github.com/google/fonts/tree/main/ofl/nunito .
- Card faces, linked-card back motif, foundation title tabs/progress dots and helper icons are local vectors/CSS. No runtime Google Fonts request or competitor screenshot asset is used.
