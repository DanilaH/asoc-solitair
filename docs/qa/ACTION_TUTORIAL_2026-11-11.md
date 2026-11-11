# Action-based teaching, without permanent captions — 2026-11-11

The user rejected small service captions entirely and requested learning borrowed from an actual game. This follow-up replaces the preceding suggestion to enlarge secondary captions. It builds on the compact-edge layout in the same PR; it does not describe a delivered APK.

## Reference actually reviewed

Re-downloaded and hash-verified the user's AZUR **Word Solitaire: Categories** recording, S2 in `docs/research/WORD_SOLITAIRE_VIDEO_SOURCES_2026-11-09.json`:

- [Original recording](https://drive.google.com/file/d/1i3a71rYs9Ja9ETa0eyqGEpSjYh83zKEE/view), 144,070,644 bytes.
- SHA256 `671b8403bdc25a248817cdda3990f4d08d42d2a0acaa8f0901daaec111271fe2`.
- Reviewed the first 100 seconds at 5-second intervals, then 00:20–00:54 at one-second intervals. The first deal demonstrates category placement, grouping and drawing stock separately, with a hand on the field and instruction changes following play.
- AZUR also uses sizeable bottom text panels. We deliberately borrow its action/hand/progression pattern and omit those paragraphs. The hand SVG is original code-native artwork, not extracted competitor art.

## Implemented scope

- Removed the permanent bottom goal, every-move prose and recurring ordered/key/Joker paragraphs. Removed home filler such as “Начните с простых связей” and the available-daily explanation. Meaningful card/button names, resource/progress/date/status values and requested menu explanations remain.
- Only short contextual notices appear after an error or exceptional outcome, then clear automatically. Hint no longer repeats the manual-drag instruction. Training remains explicitly labelled in its mode/entry/result instead of occupying a permanent bottom line.
- First two unfinished campaign deals show one legal action at a time: source and destination outlines plus a hand travelling between them; stock uses a tap gesture. A real accepted move selects the next action from current board state. No automatic command, forced-move blocker, hint charge or new persisted teaching state is introduced. Already completed deals do not replay the beginner guide.
- Existing first-use helper attention is now a hand at the real Hint/Undo/Joker control. The established unlocks, free Hint demonstration and resource rules remain unchanged.
- Guide yields to input, inspect mode, pause, background and resize. It reappears after cancelling inspection/unblocking and uses recalculated geometry after resize. Reduced motion paints a static source/target/hand cue with no travelling animation.
- A renderer sleep-order issue was caught visually: waking before adding the delayed guide could paint no cue. Teaching and regular Hint now wake after their visuals/tweens exist. The browser test counts the original hand cuff pixels in actual screenshots, rather than trusting a debug state.
- Kept the bounded feedback/praise gutter so removing paragraphs cannot grow/shrink the field on every message. No rules, deal data, economy, SaveStore/native ownership, kit version or Android release identity changed.

## Verification and limits

Production build/typecheck and **61 unit/platform tests** pass, including read-only valid teaching over both published beginner witnesses and the absence of a free guide stream on ordinary/modifier levels. All **30 final-source phone/compact browser scenarios** pass: actual painted guide pixels, action progression, inspect cancellation, pause, no resource charge, static reduced motion, feel, first-use Hint, bottom-deck full wins and ordinary ordered play without a caption. The final independent seven-viewport layout audit passes all **176 states (119 field, 21 home, 36 dialog), with zero DOM/raster violations**. A wider preliminary teaching run separately completes all 80 campaign levels through actual touch/Next; the final-source focused tests and full-source CI remain distinct evidence.

Production-touch evidence uses an untouched fresh first campaign deal, then Next, and a reachable dense state with collection/next action/Undo/pause. The first two recorded moves pause briefly so the teaching cue is visible. No test bridge performs recorded game actions.

This pass covers beginner actions and the existing helper introductions. It does not claim a newly designed illustrated onboarding sequence for every modifier. Ordered ranks, key/lock counters, immediate rejection feedback and helper descriptions remain functional; dedicated first-encounter visual lessons for these can be assessed separately without returning persistent paragraphs to the field.

No new APK, native-device readability/FPS/sound/haptic/inset check or production SDK delivery is claimed here. CI and integration status are independent from local evidence.

## Saved actual-game evidence

- Production-touch teaching/first win/Next GIF: `libfile_0a557479a4d081919a606e1f2760a4a7`.
- Actual first-step screenshot: `libfile_7e021f2cfcdc819180b8fddf015c3804`.

GIF and screenshot use the final runtime build, not a design concept. The GIF trims only 1.2s of initial loading/entry.

Repository follow-up is [PR #13](https://github.com/DanilaH/asoc-solitair/pull/13). Local checks above pass; the updated PR CI and Android builds are pending, and this source has not been delivered as a new APK.

Final regression follow-up: the broader preliminary run finished 51 passes, four deliberate duplicate compact chapter skips and one compact Joker test failure. Its former wait on the removed hint caption became an immediate empty-string assertion and no longer waited for the asynchronous hint. The three affected tests now wait for Hint to become enabled again. All six exact-runtime phone/compact reruns pass (free Hint, Joker/Undo/reload, both-side bottom deck). Gameplay assertions and timeouts were preserved; no runtime change was needed.
