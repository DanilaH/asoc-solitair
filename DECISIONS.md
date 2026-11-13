# Decisions

## 2026-11-13 — Approved board continuity implementation

Implement the owner's five-stage plan as0.11.0/code19. Distinguish slot roles and preserve their surfaces during lift/return, preserve paper during foundation arrival, replace repeated frames with material feedback, use a complete reveal and an explicitly visible new-deal entry, and replace ring/ribbon completion with a bounded slot-owned visual snapshot. The snapshot never owns cards, saves or rewards and yields on reuse/Undo/pause/shutdown. Keep compact geometry/casual art and frozen rules/content/balance3/5/3, old v2 attempts, all bank/economy/SDK/kit contracts. [Scope/verification](docs/qa/BOARD_FEEL_0_11_0.md); verified signed APK and actual-input GIFs are delivered; full exact-input PR CI43390098010 passes146 browser cases and both Android builds. PR#23 merged at7528d8c with identical verified tree; device acceptance remains open.

## 2026-11-13 — Board feel audit scope

[Audit and proposed sequence](docs/qa/BOARD_FEEL_AUDIT_2026-11-13.md): address visual continuity and distinct slot roles before increasing effects. Read-only production-input evidence confirms a missing lift surface, identical slot treatments, an off-target rejection frame, premature foundation-face removal and competing completion layers. Keep the current compact geometry and casual art. The proposed renderer-only packages are not implemented or approved as a broad redesign. Existing error priority is correct; entry/flip/audio hypotheses need separate confirmation. No rule, content-bank, save/economy, SDK or kit change follows from this review.

## 2026-11-09 — initial implementation

1. Preserve supplied specifications verbatim under docs/product and docs/research. Requirements own rules, feel-spec owns presentation. Scope exclusions remain binding.
2. Use TypeScript/Vite/Phaser 4.2.1/Capacitor 8.6.0, matching the inspected, installed portfolio baseline. Pin kit commit `a9325265e87583a4872cf6a158e1e881a0d7508e` and lock all dependencies. This is Android/RuStore; Yandex Games bootstrap is not applicable.
3. The first delivery is one finite-budget control deal, not final campaign level 1. Its 32 moves exercise budget/exhaustion. Actual campaign levels 1–2 must use unlimited moves and event-driven teaching when the 20-deal campaign is added. Hint/Undo are available on this control surface to verify them; configured campaign unlock levels remain future scope.
4. Model state is immutable across command inputs. Board, wallet, reward identity and version fields are serialized into one synchronous localStorage document before publication. A failed write leaves the live state unchanged. This chooses an existing WebView/browser storage surface for the first slice; physical Android kill/relaunch durability remains a device check. Never silently overwrite corrupt/incompatible saves.
5. Undo covers a whole board transaction and budget. Streak, wallet, helper consumption and counted transfer edges survive Undo. Transfer credit uses group IDs plus an undirected source/destination edge, excluding budget/economy; it conservatively denies repeated shuffling between the same places even after unrelated moves. This is the spec's simple anti-farming policy, not sophisticated anti-cheat.
6. Keep a curated winning path and validate replay/invariants. Hint prefers a verified known continuation; otherwise a bounded Worker search can provide a legal move explicitly without a winning promise. UNKNOWN is not UNSOLVABLE. Replaying the current hint does not spend another charge.
7. Production assets/audio are not claimed: original procedural cards and small authored SVGs support a coherent first slice. Synthesized per-event WebAudio is an original starting point; final sound/haptics need phone audition.
8. Native ad/analytics/haptic integrations are unavailable services. No fake currency reward, web portal SDK or mocked native-success path. SDK integration and settings belong to stage 5, without blocking first paint.
9. Renderer uses kit-capped backing-store density and sharp Text. It sleeps after the last rendered animation frame and wakes for input/resize/foreground. Motion density is bounded; optional service startup cannot block play. Three sources were confirmed through Drive; selected source frames already materialized in the workspace were inspected for first-slice styling. No new claim of full audio/video review.
10. Initial Android application ID is `com.danilah.asocsolitair`, version 0.1.0/code 1, portrait orientation. Default CI produces debug and unsigned release; signing requires supplied secrets. Nothing is published to a store automatically.

## 2026-11-09 — complete native services package

The user requested all platform reuse needed by the final store project now. This supersedes the initial synchronous-storage/unavailable-service choices (4, 8) and default unsigned-release policy (10), without expanding excluded product systems. See [native ownership and recovery](docs/platform/NATIVE_SERVICES.md) and [release acceptance](docs/platform/RELEASE_CHECKLIST.md).

- Use consumer-owned Android adapters from the inspected Arrows/Road Lines recipes, with actual Yandex Mobile Ads/AppMetrica 8.6.0 dependencies, rather than treating kit contracts as a bundled native plugin.
- Single coordinated async SaveStore commits commands/settings/economy/receipts. Android AtomicFile and no-backup receipt/profile lifetime prevent mismatched backup restore; old WebView state imports only after a confirmed empty native read. Ambiguous writes reconcile by exact read-back before later valuable changes.
- Late earned continuation for an abandoned attempt becomes a retained consumable credit. It cannot silently add moves to a different board or be lost on ack. Continuation allowance remains outside Undo and is limited to one per attempt.
- Real ordinal campaign metadata authorizes cadence. The first control deal is not level 1, cannot advance new-level cadence, and has no banner/interstitial. Rewarded helpers and ordinary coin exchange are usable on the control surface.
- Shared analytics schema is prepared into Android assets from one source. Attempt start and outcome markers are saved with commands; custom event delivery remains best-effort. Active time uses a monotonic clock and excludes independent blockers.
- Native system insets are owned once by the root; SDK-measured banner projection uses the kit helper. Vibration cancellation is independent of sound and includes a generation barrier. Audio focus is separate from game visibility.
- Version 0.2.0/code 2, R8/resource shrinking and explicit keep rules. Debug is demo; production requires complete live identifiers and the existing signing identity. The unsigned disabled-SDK CI build is explicitly compile-only and cannot be signed using its bypass. No store publication is performed.

## 2026-11-09 — first campaign package

- Ship twenty fixed ordinary deals as the next development milestone. RulesVersion remains 1; contentVersion is 2. Joker/ordered/keys and campaign win-cycle/milestones/cosmetics/daily are still pending, not implied by the new home screen.
- Campaign completion uses the existing single completedCampaign ledger. The next unlocked level is the first missing contiguous campaign id. Replay earns the documented ordinary per-attempt reward but never creates another first-clear/cadence increment.
- Only one attempt is active. Home/resume preserves its exact state; replacing an unfinished attempt requires an explicit in-app choice. All level transitions use SaveStore and retain profile/settings/native receipts. Legacy content-1 intro saves migrate intact; a completed legacy control deal can advance into campaign 1. Unknown/incompatible deals are preserved and rejected, never silently reset.
- Hint opens on 3 and Undo on 4. The first valid Hint demo at 3 is free, durable and manually executed; repeated ghost playback does not spend another charge. Onboarding observes accepted state, does not lock users into one move order and does not hide a timer.
- A restarted scene owns a presentedDealId. It refuses to draw a newer attempt until its new card views exist; commit observers may otherwise publish the new save before the old scene is torn down. Scene input listeners, gestures, hints and transient effects are reset at each deal boundary.
- Four columns use narrower cards and edited long-word breaks with the exact full word in inspection. Short canvases (including a reserved native banner) use a bounded logical frame and matching input transform. The deck is hidden when both stock and waste are empty.
- Version 0.3.0/code 3. Native configuration/signing remain deferred as requested. Current media and validation are development evidence, not a physical-device performance or live-SDK claim.

## 2026-11-09 — rule extensions package

- User authorized Joker, ordered categories and three keys as the next package. Append six own teaching/application deals 21–26; freeze all old twenty records and exact card orders. These development chapter positions supersede the preliminary 6/9/13 introduction hypothesis for this build only; final release pacing needs human review. No ordered+lock mixture in the first proofs.
- Version 0.4.0/code 4; rules/content/balance 2/3/2. Explicit migration accepts only compatible rules-v1/balance-v1 intro content-1 and ordinary content-2 saves. Preserve attempts, boards, Undo, wallet, rewards and native receipt state; add the missing initial Joker charge once. Unknown versions still fail without destructive reset.
- Joker is board support metadata at a boundary in an existing nonempty unlocked column, never a transferable domain card. Cover the original packet, accept one available packet, remove support when it leaves. Placement costs zero moves and at most one charge per attempt. jokerUsed and consumable spending stay outside board Undo. Give one initial charge; coin exchange costs 250; no rewarded Joker placement. All 26 primary witnesses require zero helpers, including after a retry with no Joker.
- Ordered cards have explicit rank 1..N; a packet is a normalized contiguous interval. A category/foundation needs a prefix starting at one. Adjacent intervals may merge in either direction; skipped ranks have a specific refusal and do not spend a move.
- Exactly three unique keys start on closed cards in other columns. Revealing a key, collecting it, unlocking at 3/3 and exposing the locked front are one board transaction. Undo rolls that transaction back. Solver identity includes keys and Joker; hints never place or consume another Joker.
- Presentation uses existing code-native graphics, a bounded three-flight key pool, rank counters, a gold support and distinct synthesized sounds. Existing native haptic cues map to key/unlock/Joker events. No native SDK/config/signing changes; device and live-service acceptance remain separate.

## 2026-11-09 — compact meta package

- Implement the agreed bounded meta: ten-level milestones, one additional palette/back, five new-win cycle, one dated daily/calendar and free deck-side setting. No race/event hub, additional currency or excluded systems.
- Version 0.5.0/code 5, rules/content/balance 2/4/3. Card rules and every frozen campaign order/witness stay unchanged. Compatible saves retain both old profile/attempt ownership and native receipts. Initialize missing meta with zero cycle marks; pay already-earned ten-level milestones once without fabricating past five-win streaks.
- Current campaign ordinary reward remains per new attempt. Daily completion is once per local day; duplicate/expired daily is training without new core or daily coins. Day 3/7/14 milestones use date-specific identities. Backwards time cannot advance streak; no server clock guarantee is made.
- Keep the active attempt canonical and park only the other mode. A mode switch never abandons a campaign. Temporary exhaustion preserves the cycle; deliberate restart/confirmed replacement finalizes abandonment. The single writer commits boards, shared inventory, progress and reasons together before any result animation.
- Author 28 new ordinary daily puzzles offline, freeze orders and witnesses, use a versioned epoch-day rotation. Repeat every 28 days; do not promise unique daily content indefinitely. Physical/human difficulty and release-bank size remain open acceptance work.
- Cosmetics reuse the established procedural cards and background. Free left/right stock placement mirrors foundations/waste with the same input transform. No image-generation asset pipeline or kit upgrade is required for this code-native variation.

## 2026-11-09 — release-candidate bank and UX package

- Choose 80 as a concrete initial campaign bank for the candidate build, not a validated optimal retention size. Preserve the existing 26 deals and the exact daily pool/date mapping; append 54 new authored/verified puzzles with 24 new ordinary topics, four additional familiar ordered sequences and eight matching SVGs.
- Version 0.6.0/code 6, rules/content/balance 2/5/3. Content-v4 migration only advances versions and retains the whole active/parked/profile/receipt state. No additional cosmetic tiers or excluded mechanics.
- Bound level navigation to 20 buttons per page. Keep ordinary progression and ten-level rewards through 80. Explain daily training before resource spending, and confirm explicit restart/old-daily replacement with exact cancel preservation.
- Fix short-screen dock clipping, narrow lock counter wrapping and the Undo-after-exhaustion telemetry marker. Keep board rules/economy unchanged.
- Candidate generation takes 35.7s of machine time after manual preparation; do not equate it with measured editorial cost or human puzzle quality. Frozen witnesses, semantic self-edit, browser execution and independent human pacing review are distinct evidence levels.

## 2026-11-10 — complete deck placement and UX review (0.6.1)

Complete the agreed top/bottom placement as an optional shared setting, defaulting old saves to top. SaveStore remains the sole writer; no rules/content/balance or frozen-deal change. Rendering, hints and touch use one geometry; no-deck deals retain their layout. Protect complete compact guidance and bound category titles separately from counts. Make abandonment consequences explicit and deck wording independent of earned backs.

The user explicitly authorized full repository maintenance on 2026-11-10, including the pending push/PR/integration/build workflow. Production keys/signing remain deferred. Workspace maintenance removed the unpushed local branch; restore the reviewed changes from the conversation over confirmed main, reverify and push them. Do not claim previous local commit/media hashes for the restored artifacts. Review findings and limitations: docs/qa/UX_REVIEW_2026-11-10.md.

## 2026-11-10 — isolate previews and fix ineffective debug-key caching

Actual 0.6.0 and first 0.6.1 APK signatures differed. Both hosted jobs logged a cache miss followed by `Path Validation Error` for `~/.android/debug.keystore`; the intended key was never cached. The old ephemeral key is unavailable and cannot be reconstructed from an APK.

Debug now installs as `com.danilah.asocsolitair.debug`, labelled «Ассоциации · тест», alongside old canonical-package previews. It has separate app storage; it does not migrate or erase their progress. Canonical release identity stays `com.danilah.asocsolitair`, with the existing explicit production-signing gate. This avoids asking the user to uninstall the old app and lose its data.

CI explicitly creates/restores a standard development-only key at a runner-temp path and passes that same path to Gradle. The cached file is verified to exist before build and the APK signature is checked afterward. Deliver previews from the default-branch build so future branches can restore the default-branch cache; PR caches are ref-scoped. Cache is not a durable production signing vault: compare signer identity on future handoffs, and require the managed production identity for store builds. No signing key is committed or exported as an artifact.

## 2026-11-11 — four-package UI/UX/feel follow-up, 0.9.0

1. Keep compact edge-aligned groups and the existing generated material system. Improve presentation aliases and actual local-image inspection without changing category IDs, published content or dictionaries.
2. Forgive drag misses within 12 CSS px only when geometry identifies exactly one nearby target; engine legality remains authoritative. Lift the whole packet 30 CSS px with a top-bound clamp. Tap semantics and helper prices/charges are unchanged.
3. Teach category/match/stock through accepted player actions using existing tutorial metadata. Yield independent time after familiar actions and end the course once all three are learned. Show bounded, dismissible visual introductions to Joker/order/keys; never force spending. Fresh profiles enter the first deal; reveal daily after two wins while retaining existing daily access.
4. Show helper offers in the initiating context and return after purchase without applying the helper. Use actual earned continuation credit/available Undo before replay at failure. Results show the already canonical total and real cosmetic preview/apply; no extra payout.
5. Pause prioritizes continue/restart/home and expands preferences separately. Cached material/bell/chord sounds reuse the existing audio lifecycle and four-voice limit. Browser evidence does not establish physical-phone feel or live SDK acceptance.

## 2026-11-11 — approved simplified subject set, 0.9.1

Apply the user-approved drum's broad matte shapes and low detail consistently across all 33 card subjects. Keep all published semantic identities/reference URLs, the 16 UI/material sprites and the renderer/domain code unchanged. Validate actual card-sized RGBA composites and every normal picture reader, rather than judging only large source previews; alpha-zero source RGB can look like an aura in preview. Preserve selected original PNGs, exact prompt bases and crop/hash metadata in a source bundle. The jump rope retains a long loose cord and short handles to avoid confusion with an expander. Package/native release 0.9.1/code 13 only; rules/content/balance remain 2/5/3.

## 2026-11-11 — gameplay audit scope and recommendation, not implementation

User requested independent assessment before large changes. [Audit](docs/qa/GAMEPLAY_PRODUCT_AUDIT_2026-11-11.md) selects offline semantic/strategic novelty assessment and bounded experimentation; it rejects scope expansion into runtime Directors/new meta. A paid Hint fallback in a known UNSOLVABLE state is reproduced and proposed as the first P1 fix. These are recommendations awaiting the next implementation instruction. Preserve compact layout, casual art, 80+28 fixed bank, versions 2/5/3, SaveStore and SDK settings. Agent play/simulation is not human enjoyment or retention evidence.

## 2026-11-12 — approved Hint eligibility and isolated content test

The owner approved implementation of the concrete follow-up plan. A charge requires a found winning continuation; UNKNOWN/UNSOLVABLE/error/timeout never charge or fall back to an arbitrary legal action. This supersedes requirements §6.1's old paid heuristic policy without changing numerical balance or saved card rules. Restore full names and narrow semantic boundaries in the existing reader, preserving field aliases. Test six separate QA-only deals with the production renderer and no ordinary profile writes/SDK; do not promote them or reorder campaign before the human-pilot decision. [Scope/status](docs/qa/GAMEPLAY_IMPLEMENTATION_2026-11-12.md).


## 2026-11-12 — Physical card handling after phone feedback

Use one viewport render surface with compact board coordinates and native single-pointer capture. The visible card and the finger are both drop anchors; domain legality remains authoritative. The local Aa inspection zone returns the original packet for free and never enters the command/economy path. Keep occupied source slots visually clean. Pause preferences replace inner content within fixed bounds. Category artwork is presentation-only and homogeneous; abstract/ambiguous topics remain entirely words. Frozen card definitions, initial orders, budgets, IDs, saves and kit SHA are unchanged.


## 2026-11-12 — Board refinement from direct user feedback

Empty destinations use a recessed card silhouette, with no contour behind occupied cards. The first stock draw lands next to the pile; draws two/three expand away while preserving older positions, mirrored for a left stock. Keep the previous face during flight until the new card covers it. Merge Aa into the moves tile with the whole tile as its hit area. Center the bottom helper group, retaining compact tableau placement. The existing per-category word/picture resolver already satisfies the clarified request; preserve it and demonstrate both formats on ordinary deals. No content-bank or rule change.

## 2026-11-12 — Rules audit after the disputed flashlight move

The owner states a member must not be placed on its category card in the lower tableau. Actual 0.9.4 does allow this, matching our chosen §4.2 rather than a proven reference edge case. Treat it as an unresolved design mismatch; do not declare it correct because the engine, solver and oracle agree. Upper collection of matching members remains necessary. [Audit](docs/qa/RULES_AUDIT_2026-11-12.md) records 73 affected witnesses, a same-budget strict alternative for level 6, the reachable 301-command save-loader failure and a separate defensive-validation gap. This is an audit delivery without runtime changes. Future rule correction needs explicit version/active+parked compatibility and all-deal revalidation; bounded history needs recovery of already written valid long attempts. No arbitrary bank regeneration, economy change or production SDK action is part of this request.

## 2026-11-12 — Approved implementation of rules v3 and save recovery

Implement the user's prohibition only for member → lower leader, including a group containing that leader. Preserve upper collection and the distinct reverse direction. [Rules v3](docs/product/RULES_V3.md) pins a version to every board/Undo; old active and parked attempts retain v2, normal new/restarted attempts use v3. Keep original published orders, budgets, IDs, paths and daily schedule, supplying separately checked v3 witnesses. Bound history at 300 and recover valid old long histories only after full validation; preserve resources and ownership. Strengthen semantic loading without replacing corrupt originals. Version 0.10.0/code18, rules/content/balance 3/5/3; no numerical economy, art/layout, SDK or kit change. [Implementation/verification](docs/qa/RULES_V3_IMPLEMENTATION_2026-11-12.md).
