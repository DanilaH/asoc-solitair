# Content 8 · G1: long-tail campaign, locale, artwork and remote level overrides

**21 November 2026 — independent source/product research, not original live Android proof.** Current consumer game source: Content8 0.20.3, source-research descendant of [F1–F3 PR #83](https://github.com/DanilaH/asoc-solitair/pull/83). This closes the *stage inventory review* through G1, not the 114 systems' actual implementation/acceptance. No game rules/content/SDK, saved Deal identity, budget or Android app behavior was changed.

## 1. Source evidence and original limits

**Original AZUR 1.3.3.8/code244**, owner-supplied XAPK SHA256 4990fa1a5d8dd2974e1105cf4c54fa28fad13a6f5cb197b562dfc10426cb83e4. Primary audited sources:
- [2000-level serialized LevelConfig verification](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-azur-static/README.md), [numeric authentic-source summary](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-azur-static/verified-summary.json), original embedded CSV SHA256 4f3a66091a126fedfba38f09b59898a343739d86feeb42ea05e1bb8b0c9ef2f8.
- [Actual packaged art and 33 local theme banks](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-20-azur-packaged-art-locale/README.md), [numeric-only art evidence](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-20-azur-packaged-art-locale/art-numeric-evidence.json).
- [Native locale-dependent budget and full source caveats](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-20-core-source-proof/README.md); [prepared read-only ARM64 runtime capture oracle](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-20-azur-runtime-oracle/README.md), which has **zero genuine original Android capture samples**.

Original local serialized level configuration has **2000 distinct level rows** and the fields WordsSet, ArtThemes, FoundsNum, ColumnsNum, FirstColumnCards, Moves and Difficulty to show. The last item is a display label, **not a measured difficulty index**, and source row/card-list generation is distinct from an observed seeded final stock/tableau. Source row does not establish active remote overrides.

The original full catalog contains **4539 distinct theme IDs / 16062 theme references**; adjacent levels have zero shared themes in all **1999** pairs, and the smallest interval until any theme ID is reused is **162 levels**. The original structural tuple (FoundsNum, ColumnsNum, FirstColumnCards, display difficulty) repeats at n and n+7 in **1443/1443 comparisons** beginning at level **551**. The *source* 7-position pattern repeats four unique structural tuples with multiplicities **1/2/2/2**; it does **not** show that WordsSet, Moves, ArtThemes, seeds, final deal or win-rate repeat every seven levels. Budget and theme variation are independent dimensions.

## 2. Actual game Content8: independently recomputed from current authored data

Verified the **actual** current fresh campaign by reading the three authored catalog files (dealer levels1–15, wave16–31, late32–80) plus the five special-deal overrides on levels17/18/26/45/66. Old overridden/archived Deal IDs are not counted as new fresh levels; bonus 22/30/40 offer variants keep their base themes. Ordinary deal semantic IDs are the independent topics[].id, while special deals' unique Card.category values are used to normalize authored categorical identity. No proprietary original words/card assets are copied.

| Numeric property | Original AZUR packaged 2000-row source | Product current C8, 80 fresh levels |
| --- | ---: | ---: |
| Levels | **2000** | **80** |
| Unique thematic IDs | **4539** | **78** |
| Theme/category references | **16062** | **862** |
| Minimum repeat distance in source level numbers | **162** | **1** |
| Adjacent-level pairs sharing theme/category IDs | **0/1999** | **3/79** (4→5, 5→6, 10→11) |
| Repeated thematic appearances across those adjacent pairs | 0 | **8** |
| Source seven-step recurring structure | n≥551; **1443/1443** level+7 comparisons | late n=32..73; **42/42** comparisons |

Product **later 49 levels 32–80** have **78 thematic IDs across 574 references**, min repeat distance **6**, zero adjacent overlap. This is *much* more frequent semantic repetition than the original long catalog even though the structure rotates every seven levels. C8 original term pools are intentionally limited; nearby repetition in early tutorials may deliberately aid learning. The difference is a **source-to-product novelty/scale gap** and a testable retention hypothesis, **not proof that player boredom or D1 loss has occurred**. See [P2 content repetition issue #84](https://github.com/DanilaH/asoc-solitair/issues/84) for human-evidence and new-authoring follow-up.

C8 late distribution is **Rest 44 cards/28 stock/3 columns/84 moves: 7**, **Standard 64 cards/42 stock/4 columns/122 moves: 21**, **Hard 78 cards/54 stock/4 columns/158 moves: 14**, **Peak 96 cards/62 stock/5 columns/191 moves: 7**. Our seven-position pattern is Rest/Standard/Hard/Standard/Hard/Standard/Peak = multiplicities **1/3/2/1**, *not exact source AZUR 1/2/2/2* and not the same literal source column/first-column/card-count tuples. It is explicitly PRODUCT_ADAPTED, not exact-copy source geometry. Special/bonus levels can modify rules/offers and the exact representative count is not a human complexity curve. Existing Q1 witness proof and 325 alternative transfer wins do not measure semantic novelty or real player pacing.

### Reproducibility

- New dependency-free source profiler: tools/qa/audit-c8-semantic-reuse.mjs enumerates actual fresh 80 and reports C8_SEMANTIC_REUSE with input SHA256, normalized topic repetition, structural profiles and adjacent-level collisions.
- tests/infrastructure/content8-semantic-reuse.test.mjs includes synthetic negative fixtures and **actual** campaign regression counts, explicitly source-current rather than a mandated permanent ceiling.
- [G1 machine evidence crosswalk](g1-structure-locale-matrix.json) links five exact source feature IDs and pinned evidence tiers, source 2000-row/art SHA, 33 theme vs 36 definitions and C8 measured values. [Coverage test](../../tests/infrastructure/content8-g1-source-locale.test.mjs) re-evaluates actual C8 against that aggregate. If content is authored in new immutable revisions, update the measured baselines and audit IDs; do not fail the new content merely for improving vocabulary diversity.
- No original XAPK was executed anew this research turn. Source-original numeric inputs come from kit reports whose verifier earlier authenticated the XAPK; the product metrics are independently recalculated from GitHub current content definitions.

## 3. Locale: 33 packaged theme dictionaries are not the same as 36 definition bundles

The source XAPK contains **33** packaged locale theme/word banks, each with all **4539** numeric theme IDs. Their **member word-reference counts differ**: comparing EN and RU, **1357/4539 themes** have different member counts; if local entries are enumerated with the fixed WordsSet choices, **1687/2000 authored level rows** would have a different *potential* total card count. This is a **conditional static comparison**, not the number of cards witnessed in the running client. One original English Num CSV field and two Russian values are malformed/non-numeric; the source's behavior for malformed entries remains unknown.

Separately, there are **36-locale/468 definition bundles** in the source Addressables catalog. These represent a **different content family**, not a conflicting count of theme banks. Static Addressables HostingService URLs such as 192.168.64.13 are dev placeholders, **not original production CDN evidence**. No live downloaded content, remote default locale, actual user language switches or network fallback captured.

**Art as a dynamic input:** original packaging has **90** sprite sets, **89** matching both EN and RU text member counts. Exceptional art theme ID **385** has 6 packaged sprites versus 5 text members. If successfully loaded and used as the source-positive override, it contributes one more member card on original levels **44, 884, 1290, 1974**; across the other **1996** source levels the packaged-art count is consistent with text count. The original code checks *loaded positive sprite count*, so absence/zero art count falls back; the asset being packaged does **not** guarantee that asset was loaded in a particular original play session. The numeric LevelConfig field ArtThemes (0–4) is also **not** an array of these sprite theme IDs or a card-count estimate.

**Original native move-budget formula** for eligible positive input at LevelConfigManager.GetAdjustedMovesForCurrentLocale, ARM64 RVA **0x262e4a8**:

\[
M_{\mathrm{new}} = \min(\mathrm{INT32\_MAX},\,5\lceil M L/(5E)\rceil)
\]

where M is authored source moves, E positive English count and L positive localized count. Runtime-active language/config gating and actual loaded-art counts in E/L remain UNKNOWN. Do not silently apply this formula to our **existing frozen Russian-only C8 budgets**; changing a level's card count or budget requires **new immutable Deal IDs**, a separate optional authoring path, independent solver/witness, full Undo/Hint/SaveStore compatibility and appropriate user messaging. Original source uses global Unity RNG with other consumers; a fixed per-level RNG state is **not** proven and would be an explicitly product-authored adaptation.

## 4. All five G1 source IDs and product status

| ID | Pinned source proof | Consumer status | Next evidence/implementation |
| --- | --- | --- | --- |
| **azur-structured-long-campaign** | ASSET_VERIFIED: 2000 source rows, 7-step structural loop from551, 4539 themes | IMPLEMENTED_UNVERIFIED: adaptation to seven C8 chapters 32–80 | Record semantic repetition, human perceived difficulty/novelty, beyond80 original authored vocabulary and immutable content; do not call 80-level adapted sequence source-exact |
| **azur-localized-move-budget** | NATIVE_STATIC: conditional positive-input 5×ceiling formula and art-aware word-count calls | ROADMAPPED: fixed authored RU budget only | Isolated original ARM64 M/E/L and actual flag/traces; build separate optional locale-specific authoring with frozen save/budget |
| **azur-localized-definition-packs** | ASSET_VERIFIED: 33 theme banks/4539 IDs and separate 36-locale/468 definition bundles | ROADMAPPED: our own RU themes and card explanations | Versioned translated word/image asset packs, missing-art and malformed-Num fallbacks, word-length/meaning checks, locale-specific frozen Deal variants |
| **hitapps-language-change-restart** | VIDEO_OBSERVED: RU switch and spent-token persistence, exact native lifecycle unverified | ROADMAPPED: current RU-only campaign/no locale switch | Reconstruct original UI/lifecycle, then product-safe language switch preserving wallet, active/parked attempts and old deals, never silently regenerate on select |
| **azur-remote-level-overrides** | METADATA: ApplyRemoteOverrides/remote setting class identities, no actual config response | EVIDENCE_GAP: immutable offline local C8 | Original captured remote payload/version/precedence and signed product rollout protocol, explicit cache/fallback/old-save pin; no remote re-deal while a party is in progress |

**G1 status = 1 IMPLEMENTED_UNVERIFIED, 3 ROADMAPPED, 1 EVIDENCE_GAP, 0 accepted/excluded.** G1 is five existing source features, not new IDs. All previous B/C/D/E/F source systems and commercial/LiveOps paths remain in the complete 114-feature roadmap.

## 5. G1 implementation and research order

**G1-A: measured authoring and content novelty.** Keep a reproducible semantic pacing report separate from layout/witness difficulty. New post-80 levels should vary structure, topic semantics, card images and budget as distinct dimensions, with original clean-room Russian content; never copy AZUR's proprietary words/sprites. A human first-session/late-session test is needed before mandating a numeric reuse gap; issue #84 is actionable but **not permission to rewrite existing Deal IDs**.

**G1-B: locale-dependent immutable deals.** Build a separate optional authoring model for language-specific dictionary, positive art-count override, actual member count, source move formula under explicit config and independently seeded/shuffled resulting Deal; store effective language, card IDs, configured budget, content version and source history. Older played/parked/daily/Undo states must remain resolvable forever. Source current 33 locale theme words vs 36 definition bundles are independent inputs, not one database.

**G1-C: original live runtime oracle.** Test source AZUR ARM64 in isolated authorized Android (never owner's personal daily phone) using the existing kit Frida scripts with known build/locale/config, actual preloaded art counts, M/E/L/budget and two level load stock/tableau numeric snapshots. Compare observed temporary shuffled **clone** (not generated original allCards) against native Range samples. Zero actual samples now; native static/packaged source is NOT parity.

**G1-D: optional remote bank/language switching.** First recover real override mapping and priority; if adopting as our product, deploy versioned/offline-cached/signed content with transparent install/update state and conflict-free preservation of frozen Deal, Undo, Hint and wallet, plus rollback and cancellation tests. Offline-first product may choose different resilience than source but must label PRODUCT_ADAPTED, not exact AZUR.

**G1-E: mobile P6, growth and acceptance.** On physical Android, compare levels 32–45/53–80 for theme freshness, ease of recognition, whether repeated topics simplify or bore, five-column layout, text density and trust. If using real cohorts, instrument semantic exposure and next-level engagement separately from ad opportunities. Static catalog size and source formula do not prove D1 retention or LTV.

## 6. Status after stage audit

G1 closes the *first-pass source-feature coverage review* across B1/G1 and the dedicated Q1/Q2/Q3 research stages. It does not mean all mechanisms are implemented or accepted. All 114 remain tracked; original Hitapps and AZUR exact final-board runtime traces, source remote configs, human difficulty and actual Android rewarded/coin/no-fill/P6 remain open. Earlier C8 ad-clock [issue #80](https://github.com/DanilaH/asoc-solitair/issues/80) remains a separately actionable consumer defect; semantic content [issue #84](https://github.com/DanilaH/asoc-solitair/issues/84) remains a researched product gap.

**KIT IMPACT: REUSE** Reference → Product Porting Framework and Playability Choice Evidence Ladder. A semantic-pacing metric is a useful general **candidate** for the common QA framework, but no new shared kit runtime API is proposed without multi-game evidence.
