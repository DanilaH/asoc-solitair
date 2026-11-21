# Association Solitaire — project context

The authoritative decision log is [DECISIONS.md](../DECISIONS.md); current delivery and evidence are in [SESSION_HANDOFF.md](SESSION_HANDOFF.md). This file is a navigation bridge, not another decision history.

- Platform: portrait Android/RuStore; browser is the development/audit surface.
- Main baseline: game0.17.1/code26, rules/content/balance3/6/3. Content7 feature candidate:0.18.0/code27,3/7/3, eighty new immutable IDs; original80, C6 fifteen and daily28 remain addressable for historical attempts/Undo. See the Content7 acceptance file, not historical CI claims below.
- **Active but unmerged C8 development (21 November):** 0.20.3/code44 on [PR #68](https://github.com/DanilaH/asoc-solitair/pull/68), Q1 campaign audit on [PR #70](https://github.com/DanilaH/asoc-solitair/pull/70); [Q2 acceptance protocol](qa/content-v8/Q2_HUMAN_ACCEPTANCE_AND_Q1_FOLLOWUP_2026-11-21.md) is not a completed phone test. Distinguish this from the accepted 0.17.1 main baseline. All 114 source IDs still belong to the roadmap; ledger statuses on Q1 are 39 implemented-unverified, 5 in-progress, 47 roadmapped, 13 evidence-gap, 9 blocked, 1 deferred, 0 accepted.
- Runtime kit SHA: a9325265e87583a4872cf6a158e1e881a0d7508e.
- Guidance snapshot SHA: aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0, reviewed/adopted2026-11-14. This updates agent navigation/verification, not runtime API.
- Approved identity: compact edge-aligned board, simple subject illustrations, category members consistently words or pictures, full-screen gesture tracking and both drop anchors.
- Latest all-screen audit: [UI/UX/feel findings](qa/ALL_SCREENS_UI_UX_AUDIT_2026-11-14.md). Findings/proposals do not authorize wholesale art/rule/economy or native SDK changes.

For UI use the local [Task Router](kit-guidance/TASK_ROUTER.md) and its exact guidance-revision links. Do not import absent exports such as newer getTierProgress from the current installed runtime; the existing cyclical reward policy remains game-owned.

Current content batch: [opening fifteen / content6](content/OPENING_V6.md). Preserve0.16 compact UI, recorded sounds, wallet and performance fixes.

Content6 and final wallet-settlement follow-up are merged:0.17.1/code26, rules/content/balance3/6/3. Both full source CI pass242browser cases and80touch wins. Human challenge/enjoyment and physical-device testing remain separate from structural/model verification; see the current handoff.

Content7 candidate: [implementation, exact80-level curve and separate human acceptance](qa/content-v7/README.md). No runtime director/RNG, economy, SDK or approved visual-direction change.
