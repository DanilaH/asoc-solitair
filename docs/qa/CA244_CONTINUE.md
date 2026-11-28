# CA-06 — bounded, proof-bearing coin Continue

Issue [244](https://github.com/DanilaH/asoc-solitair/issues/244), E0 of [246](https://github.com/DanilaH/asoc-solitair/issues/246). Base PR237 `1ef3db5b4d86227b95451de68a5a857f0687d8f4`, 0.21.7/code58. Candidate 0.21.8/code59, branch `fix/244-directed-continue`. This is a separate ordinary-build correction, before the isolated campaign experiment.

## Source and reproduction

Pilot6 [project CI46134064192](https://github.com/DanilaH/asoc-solitair/actions/runs/46134064192), checkout `c2fb1061253bf7bba4eefb979e04388b1afd32a2`, recovery job140945339964, research PR243. Exact numeric results at [kit d81eb07](https://github.com/DanilaH/mini-games-kit/blob/d81eb07cb60dc90f9185183f90ad0c5cad456d5f/research/games/association-solitaire/2026-11-28-campaign-economy-pilot/pilot6-results.json). Pilot5 source artifacts were downloaded with their API SHA256 digests verified, then reconstructed with `study-238-recovery.ts` from that exact research checkout. Layout hashes, policy exhaustion and action counts were asserted before freezing.

`tests/fixtures/ca244-continue.json` permanently retains 28 distinct full states, complete own deal definitions, prior statuses, paths, costs and state hashes. It contains our vocabulary and layouts, no vendor words/art/code. Five current-bank states include two positive ordinary L200 states. Most additional states are research layouts; budgets/policies can share a layout, so this is not 28 independent human games. `tests/unit/ca244.test.ts` verifies the hash chain, all eleven expected positives, independent Rules4 oracle, actual debit, duplicate denial, wallet and stale/closed/timeout cases. `tools/qa/audit-ca244.ts` reruns the original BFS strategy and current strategy at equal limits, producing `.recording/ca244/comparison.json` in ordinary project CI.

On the pre-change local replay: baseline5/28, directed11/28, six added, none lost; eight exact prior states0→4. Added costs3/3/5/8/9/9. Local max baseline1419ms / directed1400ms; scheduler overhead is recorded, not represented as Android latency. CI regenerates timings and exact checkout. A retained sound remaining-category lower bound can still return UNSOLVABLE; pruned Rules4 search exhaustion cannot.

## Implementation and preserved contracts

The exact known continuation and sound category lower bound remain first. Rules4 then uses the already implemented directed full-board search and request-local verified continuation index. AZUR priorities order exploration only. The worker still receives 3000 nodes and one absolute 1400ms deadline, including index construction and traversal; UI watchdog remains2400ms. No second search gets a fresh allowance. Every returned route is replayed on the actual finite +10 board before exposure and again before spending. Command count does not replace finite transition accounting. Legacy BFS keeps its exact negative semantics and now also passes final verification.

Lost-life and already-continued attempts fail verification; the UI closes their worker. Existing request identity, worker termination, SaveStore and transaction-time proof replay prevent stale callbacks from spending. Paid Continue remains900/+10 under M1, once per attempt. Earned-video Continue remains +10 without a route gate; late rewards, credit ownership, Undo, reload and exact-once receipts retain their current contracts. No content, rule, economy, cadence, stock, life, FTUE, SDK, production configuration or runtime pin change.

Browser cases use actual ordinary L200 definitions, worker, touch purchase and storage, covering both retained positives,899 balance and worker load failure. The full project workflow includes all old unit/browser/native and 200-level/Daily400 checks plus these cases. Research-only PR243 workflow guards were not imported.

## Acceptance boundary

The signed ordinary APK and exact-head CI are delivered separately from the next experimental campaign profiles. Physical Android worker latency on weak hardware, background/foreground timing, real test-ad earned/no-fill/late callback and SDK presentation still require a phone. Browser workers, an independent oracle and simulated receipts do not replace those checks. No publication or new revive amount approved. KIT IMPACT: REUSE; all115 source IDs /38 packets /15 commerce families /9 Unico candidates remain.
