# Project contract

Read [the product index](docs/README.md), the handoff, requirements and feel spec before work.

- Target: portrait Android/RuStore, Russian content, offline campaign. Browser is the development/test surface. This is not a Yandex Games project.
- Follow the exact packet, stock/recycle, budget, hint and Undo rules. Rules/content/balance are versioned. Revalidate supplied deals after any rule change.
- Domain state, economy and reward deduplication never depend on Phaser, animation completion, sound or ad dismissal. Persist the full coordinated profile/attempt before presenting an accepted transition.
- Keep the exact kit SHA pinned. Start reuse discovery at its docs/API.md; use real exports. Native SDKs are not included in the kit.
- First delivery is a complete short playable slice with card feel, not a static board. Then create twenty edited and validated campaign deals. Twenty is not an approved release-bank size.
- Do not add excluded systems: races, VIP, albums, piggy bank, energy, Gold timers, shuffle, magnet or an extra foundation helper.
- Joker, ordered and keys are implemented in the six-deal teaching chapter (docs/content/MODIFIERS.md). Compact campaign/daily meta is implemented; see docs/content/COMPACT_META.md for reward, date, migration and parked-attempt ownership. Never silently mark pending features done through placeholders.
- Browser tests/builds do not establish Android device feel, native ads or analytics delivery. Unconfigured ads must never give fake rewards.
- Keep decisions, roadmap and verification honest and current. Native changes require Android compilation where available and explicit device limitations.
- Do not commit signing keys, SDK paths, node_modules, generated web assets or APKs. No changes to other portfolio projects or kit without need.

- Native services are integrated; read docs/platform/NATIVE_SERVICES.md before modifying saves, ads or lifecycle. SaveStore is the single authoritative async writer; active Save.attempt is canonical and Save.parked contains only the other mode; never reintroduce independent whole-save writes. Keep native receipt/effect/dedup ordering and optional-service startup independent of playability. Production release requires live configuration and the existing signing identity.

- The first twenty ordinary deals (contentVersion 2) are frozen under src/content/campaign.json. Read docs/content/FIRST_CAMPAIGN.md before changing a deal. Current rules/content/balance versions are 3/5/3; read docs/product/RULES_V3.md. Board.rulesVersion pins active/parked attempts and all Undo snapshots independently; old attempts remain v2, new ordinary attempts use v3. Never change rules through Undo or reload. Current witnesses overlay frozen originals in rules-v3-paths.json; original orders, budgets and daily rotation stay frozen. Keep rules-v1/content-1-or-2 and content-v3/v4/v5 saves compatible. Home/level changes must keep SaveStore ownership, unlock bounds, tutorial charges and the presentedDealId scene barrier.

- Show QA GIFs inline in chat with Markdown image syntax and an absolute sandbox path, so the user gets a preview. Use actual production input recordings.

- Resume at [the continuation checkpoint](docs/SESSION_HANDOFF.md). Keep binary files out of tool/chat text: never print GIF/APK/archive bytes, base64, or encoded chunks. Transfer bytes directly between files using ordinary Git/download/upload paths; show only paths, sizes, hashes and concise status. Filter large API responses before returning them to the conversation. Earlier chats stopped during binary encoding; the exact cause is unconfirmed, so do not repeat that workflow.

## Task routing and UI verification

Guidance snapshot pin: aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0. Runtime dependency stays a9325265e87583a4872cf6a158e1e881a0d7508e; newer guidance does not grant access to newer exports.

- Before material work read [project context](docs/PROJECT_DECISIONS.md) and choose relevant routes in [TASK_ROUTER.md](docs/kit-guidance/TASK_ROUTER.md). For UI, use the routed UX/art, stable progress and motion recipes while retaining the approved compact board and casual art.
- For a supplied reference follow [REFERENCE_PROTOCOL.md](docs/kit-guidance/REFERENCE_PROTOCOL.md); distinguish observed footage from inference and unavailable originals.
- Check essential actions on the initial viewport before test auto-scroll, rapid input/cancel, pending/error and reduced motion as relevant. A rounded button's bounding-box corner is not necessarily part of its real hit shape; compare actual interior taps before calling it occluded.
- Report KIT IMPACT using [KIT_FEEDBACK_LOOP.md](docs/kit-guidance/KIT_FEEDBACK_LOOP.md). Keep domain/economy/SDK authority outside optional presentation. Do not add kit features solely because the newer docs mention them.
