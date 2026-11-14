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

## mini-games-kit: task-routed research and kit feedback

Keep ALL existing game-specific rules above authoritative. For a substantial task read docs/kit-guidance/TASK_ROUTER.md and select only the 1–2 applicable studies. If given an original game, video, GIF, screenshot or a reference-feel complaint, follow docs/kit-guidance/REFERENCE_PROTOCOL.md, clearly separating observed behavior from assumptions.

Research guidance snapshot: e2382670fbd5c2aa76462fea688c60de2b067392. Actual runtime mini-games-kit source/vendor/dependency may be pinned to an OLDER commit; never silently upgrade runtime or assume the guidance SHA's exports are installed. Inspect the actual consumer API pin before reusable code.

After a material fix report KIT IMPACT: NONE / REUSE / IMPROVE / CANDIDATE / EXTRACTED (docs/kit-guidance/KIT_FEEDBACK_LOOP.md), with exact reproducible evidence for upstream proposals. No automatic gameplay, product economics, saved-state or store changes.
