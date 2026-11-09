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

- The first twenty ordinary deals (contentVersion 2) are frozen under src/content/campaign.json. Read docs/content/FIRST_CAMPAIGN.md before changing a deal. Current rules/content/balance versions are 2/4/3. Keep rules-v1/content-1-or-2 saves and all old in-progress attempts compatible. Home/level changes must keep SaveStore ownership, unlock bounds, tutorial charges and the presentedDealId scene barrier.

- Show QA GIFs inline in chat with Markdown image syntax and an absolute sandbox path, so the user gets a preview. Use actual production input recordings.
