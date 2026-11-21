# Content 8 — Q1c reconciliation: finite move cost, deeper UNKNOWN, distinct research histories

**21 November 2026; code- and source-evidence integration, not a gameplay release.** Base is Q1b [PR #75](https://github.com/DanilaH/asoc-solitair/pull/75) → B2 [#76](https://github.com/DanilaH/asoc-solitair/pull/76) → B3 [#77](https://github.com/DanilaH/asoc-solitair/pull/77). Additional parallel proof from [Q1b #74](https://github.com/DanilaH/asoc-solitair/pull/74) descended directly from Q5 #72, not from #75; it must be reconciled, not overwritten.

## 1. Two independent *valid* questions, different cost denominators

| Source workflow | Initial sampled transfers | Proven wins | Cost denominator | Verified length results |
| --- | ---: | ---: | ---: | --- |
| #75 [CI 44899121169](https://github.com/DanilaH/asoc-solitair/actions/runs/44899121169), extended report SHA `666db9ad4878fc164f7387359716a22b776c3cf4afdefc1cd0f61f00dcf5b573` | 528 | 325 | All 325 won transfers, including 8 unlimited tutorial routes (route length, not finite-budget cost) | 157 longer / 159 equal / 9 shorter than witness |
| #74 [CI 44898514295](https://github.com/DanilaH/asoc-solitair/actions/runs/44898514295), initial Q1 report SHA `c1a3fc7341863d7a9d4439fe41fa985d38fb34644ad87b2879d4ce363f7b630c` | 528 | 325 | **317 finite-budget** winning transfers; 8 unlimited WIN excluded from spending statistics | **155 longer / 153 equal / 9 shorter** |
| All active-action classes #75 | 889 | 505 | All 505 including 13 unlimited | 214 longer / 272 equal / 19 shorter |
| All active-action classes #74 | 889 | 505 | **492 finite-budget** winning routes, 13 unlimited excluded | **210 longer / 263 equal / 19 shorter** |

Both positive sets are replayed wins against actual Rules3; neither measures globally optimal `regret` or frequency of human moves. **The apparent discrepancy is unlimited-budget treatment, not game change.** `movesLeft=null` must never be silently converted into numeric `0` or actual move-price claims. Source reports have different byte SHA because #75 added witness/action-cost fields; reconcile per deal/step/action and proofs, not by assuming identical JSON.

## 2. Deep source replay results on previously UNKNOWN transfers

PR #74 hosted research [CI 44898514295](https://github.com/DanilaH/asoc-solitair/actions/runs/44898514295) selected **18** of the prior **203 UNKNOWN** main transfer probes, re-created exact published deal/witness board and a transfer, then independently replayed any winner. **13/18 became VERIFIED_WIN; 5/18 remained UNKNOWN_LIMIT**, even after 3200 independent search visits per harder case. The 13 are *within the selected 18*, not an unbiased estimate of overall recoverability.

- Level **15** first other-transfer `t2>t3`: certified win via a route one action shorter than published witness, with 11 moves spare.
- Level **31** at step 39, alternative `t0>t1`: certified win with **21** more found actions than the authored suffix, 8 moves spare. This does not prove the alternative *necessarily* costs 21.
- Exact selected cases on levels **26**, **45** and **70** remain search UNKNOWN at 3200 visits. Never label mathematically unwinnable; select next original-device/human pivots only after source-qualified replay.

## 3. Preservation and integration contract

Source Git SHA copies from #74 preserved on this descendant: `tools/qa/c8-decision-cost.mjs`, `tools/qa/deepen-c8-unknown-transfers.ts`, `tests/infrastructure/content8-decision-cost.test.mjs` and the historical research report `docs/qa/content-v8/Q1B_DECISION_COST_AND_DEEP_SEARCH_2026-11-21.md`. The historical report may retain **pre-CI status**, while this document records independently verified later results. Our #75 `tools/qa/summarize-c8-route-cost.mjs` and its tests remain separately present; neither algorithm replaces the other.

New research scripts `npm run qa:decision-cost` and `npm run qa:decision-deep` are added without changing game output. Q1c hosted CI regenerates both current-source analyzers on the **same** C8 sample, checks new 18-case subset and retains the original JSON + both Q1b artifacts with hashes. **Until that run succeeds**, prior successful #74/#75 runs are source-specific evidence, not proof the combined head is green.

## 4. Product/acceptance boundaries

- 114 discovered Hitapps/AZUR/Unico source systems remain inventoried; no `OWNER_EXCLUDED`, no direct revenue/SDK changes, no new runtime director nor altered published deal IDs.
- Our B3 Equality/Paywall research is independent from this Q1b audit; it remains a conditional offline model with no user-issued special variants.
- Q2 real-human Android and Q3 rewarded/no-fill/SaveStore lifecycle remain separate; neither model search nor green CI establishes retention, human fairness or original competitor runtime equivalence.
- The next **Q1d** hypothesis is not “make all branches easy”: investigate **why** a human chooses a route that becomes costly, distinguish unavoidable bad moves from nonoptimal bot continuation and find minimum recovery only with sound complete-search evidence where feasible.
- Preserve developer [Q2 isolated control positions PR #73](https://github.com/DanilaH/asoc-solitair/pull/73) as a separate UI/testing tool; don't falsely treat it as actual human observations or integrate its QA appId into production.

**KIT IMPACT:** REUSE the Playability Choice Evidence Ladder; this source-specific finite/unlimited accounting detail is an evidence-discipline supplement, not an invented competitor mechanic or a new shared runtime API.
