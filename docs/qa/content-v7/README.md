# Content7 — implementation and acceptance

Baseline: `main b612420fda4d8677073034a91c944c46573cbf08`,0.17.1. Research source: `8ca270d8f58fad2fff3d66cf700131fa74eada9b`. Owner implementation request approves the exact supplied specification/80-row plan; the original DRAFT research files remain verbatim. Candidate:0.18.0/code27, content7, rules3/balance3. Feature branch and [draft PR33](https://github.com/DanilaH/asoc-solitair/pull/33); no main merge/store submission yet.

## Implemented

- Exactly80 new frozen IDs campaign-c7-001..080, literal offline layouts, no runtime search/dealing/shuffle/director. Existing dictionary/art builders are reused; no new semantic topics, artwork, currency, meta system, rule or paywall.
- The approved roles are exact:15PEAK/15REST/48BASE/2TUTORIAL. First two unlimited. Every REST is at most75% of its preceding PEAK by both physical cards and accepted reference-route actions. All finite budgets leave at least4 moves. Four-move-floor outliers on short routes are declared per passport.
- Ordered30/34/39/44/59/69/79; keys49/54/64/74; all PEAK/REST and80 ordinary. Hint3/Undo4/Joker8 unchanged. Ordered/keys instructions use actual encounter/seen flags even for veterans. C7 Joker explains itself only when pressed, without arming, spending or changing a board.
- Every original80 definition, C6 fifteen, intro, daily28 and legacy rules witness stays available. Frozen source SHA256 checks protect the baseline. Save envelopes migrate6→7 without replacing active/parked attempt, Undo, spending, telemetry markers, receipts or settings. Restart retains the historical deal; the existing policy that new restarted attempts use current rules remains unchanged. Menu/Next select C7; canonical campaign-NNN identities retain reward ownership.
- Current UI geometry/art/audio/wallet-settlement/performance/native SDK behavior are retained. Runtime changes cover catalog, content version, compatible decoding and contextual rule teaching. One narrow input repair delays card inspection until the opening board click has completed: on compact screens the old pointer-down opening let the same finger close the newly opened dialog. Both old-source negative controls fail and both final-source phone/compact held-touch and real-picture controls pass; geometry and game rules stay unchanged. The runtime kit stays at a9325265; KIT IMPACT: REUSE.

## Actual authoring findings

The initial solvable drafts were not accepted merely for having a route.20 and29 initially permitted routine direct play without the intended preparation. They were rebuilt around a visible access cycle.29 postpones putting the leader upstairs: its lower move first supplies a buffer. It does not disable or delay the existing automatic completion of a ready upper category.

18 now records a meaningful one-recycle route, with lower parking available as an alternative.38 and40 have0-recycle authored routes versus1 recycle/+7 actions for the supplied simple strategy;55 saves1 recycle/+5 actions. This is a verified strategy contrast, not a predicted human error or win rate.

The former39 layout admitted an immediate irreversible interval choice even without a budget. It was replaced before freeze with a visible buffer. The current sampled alternatives recover within budget.74 now requires ordinary lower preparation before revealing keys, rather than duplicating64's sequential-key pattern.42 was shortened after its reference route exceeded the REST ratio.

Many categories are intentionally familiar. The bank uses52 existing semantic topics plus4 existing sequences.49 ordinary topics appear by20 and all52 by30; later novelty is primarily access/space/stock timing and ordered/keys, not a stream of new association riddles. All80 topic combinations and normalized layouts differ, but this is not evidence that all80 feel distinct. Human intellectual interest remains an acceptance question.

The supplied simple policy still wins32/80 levels in at least one of17 tie orders, including all intentional RESTs and ordinary PEAK31/66. In the first15 it wins1/2/5/7/10/12;9 other levels independently require lower preparation within the supplied budget. This is not a bot-loss objective.31/66 intentionally allow several efficient orders; they are high-priority human checks for an overly procedural peak. Among other levels,42 budgeted graphs prove the selected no-lower restriction insufficient,6 remain UNKNOWN under the node limit, and32 have a route without lower moves. UNKNOWN is not a no-lower necessity claim.

## Machine gates

| Gate | Observed status |
|---|---|
| npm run check | PASS:193 unit/platform tests, content validation and web build |
| All80 helper-free witnesses | PASS, production and separate oracle agree |
| Independent search and recorded recoveries | PASS80; bounded restrictions keep UNKNOWN explicit |
| qa:rules | PASS203 definitions/311 current+legacy paths/363742 command comparisons, including refused commands |
| Archived qa:opening | PASS340 exact baseline outcomes/paths,255 C6 diagnostic runs,9822 replayed oracle transitions |
| Prototype compatibility | PASS96/96 attempts across6 existing prototypes |
| Rendered layout audit | PASS147 field states,0DOM/0raster issues,7 sizes320×480..520×700,4 deck configurations, modeled banner/safe-height reservations |
| Final campaign UI records | PASS 80/80 exact-source victories via touchscreen and visible Next; each transition compared with the expected state |
| Full browser sweep | Local PASS on phone and compact profiles. 252 cases passed with four intentional compact campaign skips. Hosted status in [run 44315807948](https://github.com/DanilaH/asoc-solitair/actions/runs/44315807948). |
| Native sync | PASS, exact existing SDK/plugin configuration retained |
| Android debug/release compilation | PASS local and hosted44315807948 debug/signature and SDK-disabled unsigned release; physical device remains untested |
| Same-signer test APK | PASS hosted code27, original0335 signer;208 packaged web files identical, DEX test ads/empty analytics verified; available for playtest |
| Human balance, interest and physical-phone feel | UNKNOWN; see separate acceptance checklist |

[Exact UI records](ui-evidence.json), [Full80 curve](CURVE.md), [passports](passports.json), [independent analysis](independent-analysis.json), [all-rule comparisons](full-rules.json), [authoring provenance](design.json), [dependency access](INFRASTRUCTURE.md), [recordings](media.json). UI evidence requires both initial-board and witness SHA to match exactly; earlier draft wins do not satisfy this gate. Successful scripted input is not blind human play.

The known routes contain1795 accepted actions across80 levels. An additional independent survey replays296 distinct alternatives at78 sampled decision states; all sampled routes recover within budget. The verifier replays15069 route transitions including these examples. This is sampled coverage, not an exhaustive no-deadlock proof. See [branch survey](branch-survey.json). Structural choice/routine counts in the passports follow an explicit action-availability classifier; neither class is human ground truth. Restricted searches are finite/bounded diagnostics. Sampled recoverability does not prove every possible move is safe or all states recover. Equal-cost winning alternatives are retained as valid plans, not mislabeled mistakes. No shortest-route, human success, D1 or retention claim.

## Reproduce

Install through `node tools/install-dependencies.mjs`; the exact private kit pin is asserted. Hosted CI successfully restores the accepted exact-pin default-main cache in offline mode. A cold/expired cache needs the read-only MINI_GAMES_KIT_READ_TOKEN secret; see infrastructure evidence. Never publish private kit source or export the preview signing key.

`npm run content:author7` reconstructs offline drafts under .authoring. `C7_FREEZE=1 npm run content:author7` writes the complete bank/design only; it must never be used to overwrite an already released revision. `npm run qa:content7:research` recomputes bounded independent diagnostics. Promote those reviewed diagnostics into independent-analysis.json, then run `npm run qa:content7` to replay/fingerprint all routes and generate the curve/passports. The gate verifies the actual source/dictionary archives and provenance, not its own previous PASS labels.

Run check, qa:rules, archived qa:opening, prototype gates, layout, browser suite and native builds. Build the web output before browser checks; do not clean/rebuild the same dist while live tests/recordings serve it. The first browser sweep exposed a root404 from such a concurrent build, separately from three outdated content assumptions; retry them against one stable output.

## Installation and remaining conditions

For cold/expired-cache installation, Actions secret MINI_GAMES_KIT_READ_TOKEN must grant Contents:read only for the selected mini-games-kit repository. Its value belongs in GitHub settings, not chat. The delivered preview is code27, signed with the same preview certificate as 0.17.1. Install it over 0.17.1 to exercise save migration. The device installation and balance session remain pending.


## APK source proof

[Packaged binary verification](source-apk.json) records the downloaded CI artifact, exact source81bf223, APK checksum, original signer and decoded DEX configuration. All208 runtime files match the final browser build; the only extra public files are2 empty Cordova shims. Test APK11759357bytes versus11737005 for0.17.1 (+22352bytes); this is a package-size observation, not an Android memory/FPS claim. `tools/qa/verify-content7-apk.py` reproduces signature/package/DEX and byte comparisons against dist. Local compile-only details are separate in [native-build.json](native-build.json).
