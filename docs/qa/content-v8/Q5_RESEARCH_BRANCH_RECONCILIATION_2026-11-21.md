# Content 8 — Q5: reconciliation of divergent research QA branches

**21 Nov 2026 · independent source/CI inventory; not production acceptance.** Research consumer base [Q2 PR #71](https://github.com/DanilaH/asoc-solitair/pull/71) (`8e71dcb5166f8bde4b5c7260142f64188843fca4`), itself based on [Q1 PR #70](https://github.com/DanilaH/asoc-solitair/pull/70) (`ebe339cd48274f65bc61201019df0026be61ef56`), above [CORE-5 0.20.3 PR #68](https://github.com/DanilaH/asoc-solitair/pull/68) (`b15c075004081ab42828f22012920462f318c782`). Current `main` is a separate older production history; **no C8 launch acceptance is implied**.

## 1. Verified split: research evidence did not flow into later branch

The actual GitHub `compare_commits` endpoint confirms divergent ancestry:
- [PR #67](https://github.com/DanilaH/asoc-solitair/pull/67), head `241e2798bbcc852ecf13c02aba831bc520c9ee61` → Q1 #70: **diverged, 19 ahead / 11 behind**, merge base `ebfa85f45ffd6dc0472e4aed326d9cc753304509`.
- [PR #69](https://github.com/DanilaH/asoc-solitair/pull/69), head `815ef814dbdfc4312244e32a26ea5518e22cf1aa` → Q1 #70: **diverged, 19 ahead / 12 behind**, same merge base.
- CORE-5 #68 → Q1 #70: **direct descendant** (+1 commit). Q1 #70 → Q2 #71: **direct descendant** (+8 commits).

Tree verification confirms **four unique files** present at #67 but missing from #70: independent historical CORE-0…5 report, infrastructure test, transfer-availability test, passport audit CLI. A fifth test (28 bounded transfer continuation probes) from #69 was also missing from #70. Simply merging later numbered PRs would not automatically preserve these five source files. Conversely #67 predates newer CORE-5 loss recovery, AZUR preset authoring and Q1 full-campaign audit; **do not replace current tree with #67's older versions**.

## 2. Reconciled evidence; these datasets measure different things

| Provenance | Tested universe | Result | What it does **NOT** prove |
| --- | --- | --- | --- |
| #67 historical authoring passports | CORE-3 65 baseline layouts 16–80 | 109 selected winning alternatives, **all 109 draw over waste**; 43 shorter than witness; 105 unresolved of 650 authoring probes | No alternative transfer can win in actual fresh CORE-4/5 play |
| #67 independent legal-action availability | 845 sampled states on 65 **fresh 16–80** deals | 623 states with ≥2 distinct transfers; 241 witness draw states with alternative transfer; legal Rules3 transitions | These transfers can still win, or feel like meaningful choices |
| #69 focused recovery test | 14 stratified levels, 13 pivots each, **28** selected transfer probes; 900 search visits per probe | **0 VERIFIED_WIN, 28 UNKNOWN_LIMIT, 0 MODEL_DIVERGENCE** in actual [successful hosted run 44894512101](https://github.com/DanilaH/asoc-solitair/actions/runs/44894512101) | 28 unwinnable positions. A bounded search that saturates is not negative solvability proof |
| #70 full C8 campaign decision audit | 80 active deals, 800 witness states, **889** probes, including 528 transfers | **505 WIN / 384 UNKNOWN / 0 NO_WIN** among all probes; 325 of 528 transfers WIN, **263** without looping back to an equivalent pivot; 203 transfer UNKNOWN | Unprompted humans find these wins, all alternatives are safe, original Hitapps/AZUR parity or exact human difficulty |

**Reason #69 vs #70 is not a contradiction:** #69 picks up to two earliest qualifying transfers per level in a limited stratification and gives its independent solver 900 visits; #70 samples 10 pivots across 80 active campaigns and deliberately selects the first representative action **per action class and phase**, with multiple source-confirmed rejoin/ordinary/oracle continuation routes. Different decision samples and recovery strategies yield different positive evidence. Neither establishes the frequency of real player error. The #69 zero-win result warns **against relying on blind bounded search** as a difficulty classifier. Its test is still valuable as an independent negative-control of proof discipline.

**Source of numeric truth:** Q1 [full report](Q1_CAMPAIGN_DECISIONS.md), Q2 [human protocol](Q2_HUMAN_ACCEPTANCE_AND_Q1_FOLLOWUP_2026-11-21.md), #67 [historical independent audit](INDEPENDENT_CORE_0_5_REVIEW_2026-11-20.md), and CI log above. #70 `npm run qa:campaign-decisions` previously ran outside the normal CI pipeline; a reproducible script and output SHA are in Q1, **but the full JSON report is not committed**. No additional re-run of the 889 probes is asserted here.

## 3. What this PR reconciles

- Preserve all five unique QA/research files from #67/#69 **byte-for-byte** on a descendant of #71. The original historical report remains dated; treat new Q1 as the authoritative **active campaign** result rather than silently replacing old passports or original statements.
- Restore #67's nonblocking `node tools/qa/audit-c8-decision-evidence.mjs` CI step, before dependencies, and retain its six infrastructure tests. `--strict-transfer-coverage` still intentionally fails on the **historical** baseline passport evidence; this is **not** a product release blocker after #70 independently proved transfer wins on active deals.
- Preserve 65-level legal-action Vitest probe and #69 14-level/28-alternative Vitest probe; both run as part of `npm test`. Do not promote `UNKNOWN` to `NO_WIN`; do not convert their selection-biased counts into player-completion percentages.
- **CI preview bug found:** on `audit/c8-*` PRs based on `audit/` or `feat/c8-core-5-*`, existing workflow skipped `tests/browser/content8-core.spec.ts` and built Android with `VITE_CONTENT8_PREVIEW=0` because conditions matched only `feat/c8-*` or the old onboarding base branch. This research PR expands both preview conditions to include `audit/c8-*`. It is a **CI validation-scope correction**, not a runtime change.

## 4. Independent checks/remaining gates

Source inspection verified Git SHA of the five copied files and their preservation at the new head; the same PR's modified CI now evaluates the proper C8 surface. Actual new web/Android CI result must be recorded separately after hosted execution. This report is not an Android runtime observation, live ads evidence, Q2 human session or original-app trace.

### Source → consumer coverage

- Actual 0.20.3 C8 ledger at Q1 #70: **114/114** pinned IDs, status distribution: 39 `IMPLEMENTED_UNVERIFIED`, 5 `IN_PROGRESS`, 47 `ROADMAPPED`, 13 `EVIDENCE_GAP`, 9 `BLOCKED`, 1 `DEFERRED`, 0 `ACCEPTED`, 0 `OWNER_EXCLUDED`. Neither reclassify nor delete systems on this audit.
- **Unmerged runtime:** CORE-0…5 remain nested open PRs. The old `main` has diverged from C8; staged integration must preserve latest source pin and immutable historical C1–C8 deal IDs, older Save/Undo/Hint states, native receipts and content flag.
- **Unmeasured quality:** Q2 novice 1–6, directed pivots 15/21/45/70, five-column 26/31/80, bonus-open and CORE-5 real Android no-fill/earned flows remain not executed.
- **Independent source parity:** Hitapps ARM32 and AZUR ARM64 original native execution remains 0. Their prepared capture scripts require an isolated authorized Android environment; Unico still lacks an inspected original APK. No source-exact parity inferred from our oracle.
- **Q1b targeted research:** deepen the **203 UNKNOWN transfer** cases, especially 106 transfer-instead-of-stock and 87 other-transfer, without treating solver limits as traps. Audit additional high-cost wrong choices and lost-move penalties after human observation; avoid an unjustified global campaign reauthoring.

### Acceptance boundary

The correct integration order for research material is **#68 runtime → #70 Q1 audit → #71 Q2 plan → this reconciliation PR**, while #67/#69 remain preserved as historical PRs and their unique research files explicitly merged here. There is no need to merge older #67 branch metadata or old `docs/README.md` over current C8 docs. The developer must still reconcile product CORE branches and review real Android/release evidence. All 114 inventoried gameplay, assist, monetization, retention and meta systems remain in the roadmap; there is no self-authorized `OWNER_EXCLUDED`.

**KIT IMPACT:** REUSE [mini-games-kit Playability Choice Evidence Ladder](https://github.com/DanilaH/mini-games-kit/blob/da551cc2f6108af5f9818a9947f570221c8f8763/docs/agent-workflows/PLAYABILITY_CHOICE_EVIDENCE_LADDER.md). No new shared runtime/export, no original copyrighted code or assets.
