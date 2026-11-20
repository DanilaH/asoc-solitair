# AZUR tutorial preset authoring

Run `npm run content:azur-preset` to build `.authoring/azur-preset/authoring-azur-preset-001-r1.json`. The command reports the card counts, witness length, budget and SHA-256. It writes the versioned deal after the engine and independent gameplay oracle agree on every move and both reach `won`. The web CI job also runs this command.

The Russian sample has 14 cards, three tableau columns of 2, 3 and 4 cards, and five stock cards. Its Rules 3 witness takes 19 of 50 moves. The first stock draw is `tea-2`, the last entry in the authored deck. Sample themes, wording, layout and budget are authored for this project.

The parser takes an explicit tutorial flag, level, tableau settings, theme catalog and optional preset. References use an integer `themeId` and an integer `wordIndex`. Any negative index resolves to the category card. Columns are ordered bottom to top and their last card starts face up. `deckCards` is authored separately. The sample builder reverses the authored deck when it creates Rules 3 stock, whose first entry is drawn next.

| Condition | Authoring result |
| --- | --- |
| Level 1, tutorial enabled, valid enabled preset | Authored layout with zero RNG calls |
| Other level, disabled tutorial, absent or disabled preset | Ordinary AZUR dealer with a reason for the fallback |
| Invalid preset flag or layout, unknown reference, duplicate or incomplete partition | Ordinary AZUR dealer with `invalid-preset` |
| Ambiguous card catalog or invalid ordinary geometry | Error before drawing RNG |

An ordinary 14-card deal makes exactly 13 injected RNG calls. The exact card partition, nonempty columns and uniqueness checks are product authoring rules. The original source confirms the dispatcher, item schema and placement semantics. Full native validation, actual original preset values and first-level Android behavior remain open. [Pinned mini-games-kit evidence](https://github.com/DanilaH/mini-games-kit/blob/a5c246d9935474d7fe662da95fb657c61c245c0a/research/games/association-solitaire/2026-11-20-azur-preset-schema/README.md)

This package is offline. Activation in the first-run campaign needs an owner decision and a new published deal identity so existing saves and Undo can resume with their own definitions. KIT IMPACT is REUSE. The package uses the pinned research and the existing offline AZUR dealer.
