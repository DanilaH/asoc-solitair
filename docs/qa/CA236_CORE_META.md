# №236 · core and small meta audit · 0.21.7 / 58

Base PR234 HEAD was checked twice against `aeb86300005c368ac19f4e647070a1430ab280c8`, version0.21.6/code57. Branch `fix/236-core-meta`. Issue [236](https://github.com/DanilaH/asoc-solitair/issues/236). KIT IMPACT · REUSE. Runtime kit pin unchanged. This package changes neither Rules4, content, M1 prices/reward weights nor production configuration. Test ads only. No events or meta expansion.

## Reproduction and correction

| ID | Baseline reproduction | Implemented result and regression |
| --- | --- | --- |
| CA-01 | L2 with no scheduled tasks, valid Shuffle2 grant returns false, inventory0. An early frozen ready round cannot be collected. | The canonical DailyTaskJournal may own helper inventory before scheduling any task day. Empty weeks do not unlock Tasks. Old ready Shuffle2/3/5 are granted as saved, including after midnight/reload; new prizes are not substituted. L2–6 and every supported bonus resource tested. L7 retains inventory and grants the existing intro once. |
| CA-02 | L6 two prior losses/restarts, playing layout retry returns a new attempt without director or source slot. | All unfinished same-level retries carry history through the existing `carryCampaignRestart`; only a genuinely new level resets it. Playing retry adds a restart, not a new loss/life debit. Natural L81 exhaustion twice, a move and voluntary retry retain losses2/restarts3/lives3. L6/16/23/39/80/81/150/200, reload and loss retry covered. No threshold change. |
| CA-03 | Eleven independently witnessed off-route boards all return UNKNOWN; 60 more off-route boards return only5 SOLVED. | Rules4 uses the existing progress-first search and exact normative actions. A request-local index proposes certified witness tails, including interchangeable ordinary words, then replays every action against the actual unchanged board and its finite budget. Failed proposals are discarded. AZUR priorities guide ordering, never substitute for proof. All71 proposed full continuations independently replay to WON. Main hint timeout remains5s; directed search stays bounded3.2s/4000 nodes. UNKNOWN/stale cannot spend a Hint. |
| CA-04 | Valid late bonus-tableau receipt for a removed attempt is acknowledged with no board effect or credit. | Eligible matching active/parked board receives its slot. Removed/won/already-open boards instead receive a version1 typed slot credit. The corresponding eligible `+` explicitly offers its use; unrelated boards are not automatically opened. Receipt, credit and board effects settle in one SaveStore transaction. Duplicate, reload, wrong kind, coin-open and failed commit covered. No coins or new ad placement. Native earned validation/ack and independent cooldown path are unchanged. |
| CA-05 | Random raw index includes six empty targets in31 controlled column probes, despite another positive candidate. UI says L16. | Candidate enumeration uses normative `placeJoker` checks for occupied/open/unfrozen/unbound columns, including purchased space. The first choice is uniform over actual candidates, then randomized sampling without replacement under one3.2s worker deadline. Full win proof and revision/attempt checks precede charge/Undo.Clear. UNKNOWN, stale and failed writes preserve rights. Copy says L2. Legacy Rules3 fast direct proof remains compatible. |

The already noted PR234 inventory label wrap is shortened to «Перемешать». The existing helpers/inventory layout is retained.

## Controlled helper comparison

Raw [baseline](ca236/before.json) comes from a separate clean base worktree. [Local corrected output](ca236/after-local.json) records the same deal IDs and prefixes; those identities were compared before summarizing. `tools/qa/audit-ca236.ts` is compiled in each checkout with ordinary `c8-release-v1`. Baseline compatibility branches in this audit harness do not enter the app. 11 selected deviations and60 deterministic randomized off-witness positions are independently witnessed, including12 Daily dates. These are controlled regression samples, not estimates of player win rate or all-state solver completeness.

| Metric | 0.21.6 base | 0.21.7 local |
| --- | --- | --- |
| Selected off-witness Hint | 0/11 SOLVED | 11/11 SOLVED,11 oracle wins |
| Hint median / p95 / max | 2730 /10181 /10181ms | 26 /296 /296ms |
| Additional randomized off-witness Hint | 5/60 SOLVED | 60/60 SOLVED,60 oracle wins |
| Additional median / p95 / max | 3350.5 /12174 /17865ms | 16.5 /137 /147ms |
| Calls exceeding UI5s, selected / additional | 2/11 and16/60 | 0/11 and0/60 |
| Fixed-column Joker proofs, same220ms slice | 16/31 | 24/31 |
| Empty columns among31 probes | 6, rejected after sampling | 6 excluded before sampling |
| Randomized eligible search,8 control states | Single220ms column only | 8/8 full oracle wins |

The eight new selection times were4/30/1080/37/15/13/19/13ms using a deterministic first-index RNG for reproducible fallback. This does not claim the final successful column is uniform when some columns fail proof. Uniformity applies to the first eligible candidate and sampling of remaining candidates. Production uses crypto RNG. Baseline fixed probes are31 attempts rather than31 random player activations. Exact L2 andL6 IDs from the audit are preserved; other controlled deals are listed in raw data.

## Verification and evidence

`tests/unit/ca236.test.ts` covers42 current-profile cases; retained Random Joker test adds one. `tests/browser/ca236.spec.ts` covers all five cases through ordinary UI, with video/screenshot artifacts when `ASOC_CA236_RECORD=1`. Initial compact local run passed5/5. It uses valid saved states to reach audited situations, then real browser touches. It is not an Android SDK recording.

The project CI retains its complete web/archive/ordinary profiles,200-level/400-date independent generator and M1 economy gates, special/Undo/migration/ads checks, two phone viewports, visual regression and signed demo Android build. The ordinary cohesion job now also runs the new unit, helper comparison and touch cases and uploads `.recording/ca236/`. Exact run and APK hashes belong to the resulting PR checks and delivery report; a local test is not represented as completed CI.

Canonical roadmaps115 systems/38 packets/15 commerce families/9 Unico candidates remain. Daily/weekly/streak entries in the adoption ledger now describe actual stages2/3/4 M1 behavior rather than archived80-level assumptions. Larger source variants and source/device gaps remain retained.

## Evidence boundaries and physical demo checklist

The AZUR source is native-static, not an executed original game. Primary [five groups and filters](https://github.com/DanilaH/mini-games-kit/blob/a88b61a55e1bee1a745f281507ffdbb29897863/research/games/association-solitaire/2026-11-21-azur-shuffle-hint-native/HINT_COLUMN_FILTERS_2026-11-21.md), [source/product matrix](content-v8/P16_AZUR_SHUFFLE_AND_GREEDY_HINT_ORIGINAL_NATIVE_2026-11-21.md) and [two Joker predicates](content-v8/P05_ORIGINAL_AZUR_USEFUL_MOVE_JOKER_FILTERS_2026-11-22.md) were consulted. The proven hidden-source/empty-target guard only affects hint search ordering. Unknown compound Joker branches and original remote config remain unknown. The proof-filtered bounded search and category-tail index are explicitly our adaptation, not a claim of native algorithm identity.

Physical Android remains to be run on the supplied signed demo APK. Upgrade without clearing0.21.6 data, compare resources and active/parked boards, claim a pre-L7 ready Shuffle, use it and reachL7. On L81 lose twice, continue/Undo/reload/reroll and check history/lives. Check hint/Joker latency and background/cancel/rotation on a compact low-power phone. With real Yandex test SDK show/earned/close, delay an earned slot across foreground recovery and explicit reroll, then use exactly one saved matching slot after relaunch. Repeat no-fill, cancelled video, duplicate/ack failure and storage failure when reproducible. Confirm actual cooldown, native logs and no false reward. Browser bridge tests do not establish those physical SDK outcomes. Production settings, commercial fill, new events and publication are outside this task.
