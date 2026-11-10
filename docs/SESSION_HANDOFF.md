# Continuation checkpoint — 2026-11-10

Project: **Солитёр ассоциаций**, `DanilaH/asoc-solitair`. Resume this game. Main PR #5 is already merged at 0672625. Current work is branch `review/content-ux`, version 0.6.1 / Android code 7; rules/content/balance remain 2/5/3.

The user explicitly authorized normal repository maintenance, push, PR/integration and builds on 2026-11-10: «я разрешаю работать тебе с репозиторием как со своим». This resolves the previous push approval rejection; do not ask again for routine repository work. Production IDs/signing remain deferred. No store publication is authorized by this debug handoff.

Workspace maintenance removed the unpushed old local commits a1a78a0/6e32922 and QA files. Library had no matching recovery files, and GitHub had no such branch/commit. The reviewed implementation, tests and recorder were restored from the conversation over main. The recovered production JS/CSS filenames match the previous verified build (index-OStO9wYJ.js / index-KE6_36hh.css); this supports equivalent built web payload, not recovery of original Git identities. New commits/media receive their own hashes.

Implemented: top/bottom combined with left/right deck placement, full compact guidance, bounded category titles/counts, explicit campaign abandonment consequence and neutral deck/daily wording. No rule/economy/deal changes. Old saves omit deckPosition and retain top placement. SaveStore remains the sole writer; shared settings do not replace either attempt.

Local recovered npm run check passes (58 model/platform tests; control + 80 campaign + 28 daily and four layouts on each path state; build). Browser/hosted Android verification and new QA reconstruction are in progress; see VERIFICATION.md for final exact results. tools/record-review.ts records production settings/touch-drag/Undo after restoring a legitimate level-17 profile. Do not claim physical phone/live SDK evidence from those recordings.

Next: complete branch upload/PR, hosted web and debug/unsigned Android checks, restore QA media, retrieve and verify the actual 0.6.1 debug APK, integrate and deliver. Then phone acceptance: gestures/legibility, sound/haptics, Back/background, process kill/upgrade, insets/banner. Human pacing/content review remains open; editorial priorities in docs/qa/UX_REVIEW_2026-11-10.md.

Previous 0.6.0 evidence remains below for comparison only; its APK is not the new version. Never print binary/base64 bytes; transfer files directly and show GIFs inline via absolute sandbox paths.

---

# Continuation checkpoint — 2026-11-09

## Where the work stands

Repository: DanilaH/asoc-solitair. The current delivery is PR #5, `feature/release-bank-ux` into `main`. Check its live GitHub state before trying to merge or repeat any work. Do not infer its state from the original draft description.

- Version 0.6.0 / Android versionCode 6; rules/content/balance 2/5/3.
- 80 fixed campaign levels, Joker, ordered categories, three-key locks, ten-level milestones, five-new-win cycle, one additional palette/back and independent campaign/daily attempts.
- Daily uses a frozen 28-puzzle date rotation. It is not an unlimited unique-content generator. Training and replacement/restart consequences are explicit.
- Levels 1–26 and daily-v1 orders/date mapping are preserved. Compatible old saves retain attempts, wallet, inventory, rewards, appearance and receipt ownership.
- Scope, rules, architecture and exclusions remain in AGENTS.md, DECISIONS.md and docs/product. Sources/video links are in docs/research. Do not restart genre/engine research or add excluded meta systems.

## Evidence already obtained

Hosted CI: https://github.com/DanilaH/asoc-solitair/actions/runs/42636793465

Tested implementation: `33da76e723c74644670d94888a6a589284daf9b6`. Runtime, dependencies and native source at the recovered `0beee82925ba74360095b20cdfe52a3ab9f6acca` are identical to that implementation. Its additional changes are documentation, QA media and GIF recorder encoding.

- Web and Android jobs pass. 58 model/platform tests; 52 passing browser scenarios, four intentional duplicate compact chapter skips.
- Model replay covers control, all 80 campaign levels and all 28 daily puzzles without helpers. Browser touch traversal covers four successive 20-level chapters with legitimate preceding-clear fixtures; it is not an uninterrupted fresh-profile physical-phone session.
- The previous recovery also repeated the complete local checks and browser suite. Retained logs `/tmp/asoc-handoff-{check,browser,recording}.log` are supporting transient evidence, not the durable source of truth. See VERIFICATION.md for exact details.
- Installable demo debug APK: `asoc-solitaire-0.6.0-debug.apk`, 9,587,433 bytes; SHA256 `90b4355948ee26b591f86ad1866125e933a97fc55f6a2313421443e61dd9ff94`. Already saved as a deliverable; locate it by exact filename before creating duplicates. The embedded web payload was matched to the tested build.
- Android CI archive artifact 13682494047 contains the demo debug and unsigned SDK-disabled compile check. Archive SHA256 `c357d3a80de73f436c71044d9579013c716e58185ea6d6f2a7e5189d8a442568`. The APK hash above is a different identity from the archive hash.
- Three finished production-input GIFs are already committed: [new bank and level pages](qa/release-bank.gif), [rainbow-order finish](qa/release-ordered.gif), [restart/daily protections](qa/release-safety.gif). Supporting PNGs are beside them. Recover these files through ordinary Git; do not regenerate them merely because a chat stopped.

## Immediate next work

Complete PR #5 integration if GitHub still shows it open, then deliver the existing APK and inline GIF previews. The subsequent acceptance step is a real Android phone run: playability/legibility, audio/haptics, Back/background, save/upgrade and native insets/banner. Independent human pacing/content review also remains open. Automated checks do not establish those results.

The user explicitly deferred production keys and signing. Keep that decision; do not block the debug handoff or ask for credentials in chat. Live ad callbacks, AppMetrica dashboard delivery and a signed store build remain pending. Nothing is published to RuStore by this checkpoint.

## Avoid the failed transfer pattern

The last chats stopped while attempting to encode/copy binary QA media as text. This timing is observed; a product failure cause has not been established.

- Never print base64, archive contents or binary chunks in tool output or conversation.
- Use Git for repository files and direct file transfers for APK/archive deliverables; only emit concise metadata.
- Show GIFs inline with Markdown and an absolute sandbox file target.
- Parse/filter API results before printing; keep large responses and bytes outside the model transcript.
- Reuse successful verification while executable sources are unchanged. Rerun checks when changes, failures or a concrete unresolved concern justify it.
