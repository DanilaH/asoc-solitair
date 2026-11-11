# UI/UX/feel implementation — 0.9.0 / code 12

The user approved all four packages with «давай, приступай». All four are implemented. The compact left-aligned layout, existing generated materials and absence of permanent service captions remain accepted. This supersedes the review-only status in the earlier independent review; that review is preserved as the before-state.

| Package | Result |
|---|---|
| 1 · Readability and context | Short presentation aliases with a readable title floor; real local picture preview and mode exit; focused offers for the empty helper; purchase returns to the same board without applying it; actual credit/Undo/replay recovery priority; route-dependent labels. |
| 2 · Input and feedback | Packet lifted 30 CSS px above contact with top-bound clamp and packet count; 12 CSS px drag tolerance only for a single nearby target; direct tap unchanged; local acceptance/rejection/Undo feedback; Hint clones the actual card face and repeats without a second charge; 44px ordinary controls and four-column narrow level grid. |
| 3 · Teaching and entry | Category/match/stock skills recorded only after accepted real actions; seen actions yield a 6s independent interval and all three skills end the course; visual first-use Joker/order/keys examples with durable dismissal and no spending; bounded helper attention; fresh profile goes to the first deal; daily appears after two wins while existing daily access is retained. |
| 4 · Rewards and hierarchy | Actual unlocked palette/back preview and immediate saved apply; one clear result amount, Next before collapsed details; three main pause actions with expandable preferences; active saved level marker; cached paper/bell/chord audio with bounded voices and existing lifecycle ownership. |

## Boundaries

Rules/content/balance remain **2/5/3**. The complete frozen 80-level campaign and 28 daily deals, card identities/membership/orders, prices, reward values and pinned kit are unchanged. Presentation aliases never rename category IDs. Near-drop tolerance does not select a legal target for the player: it considers geometry first and the ordinary engine still validates the move. No new helper is introduced.

SaveStore remains the single writer. Learning flags use the existing tutorial metadata; no save schema migration. Cosmetic apply changes settings only; the shown total includes already earned streak coins without granting them twice. Native receipt/effect/ack, background/audio focus and optional-service ownership are preserved. Production identifiers, release signing and store publication are outside this package.

## Verification and integration

All four packages are integrated. [PR #13](https://github.com/DanilaH/asoc-solitair/pull/13) merged at `5d45b2013af259bcee7ecb84f1640d1faaf07ae6`; verified runtime source `16d8ee3301bdae4e4bafb26f0585fad592fe8da0`. Main merge has the same tree as that source.

- Final versioned `npm run check`: typecheck, **65 unit/platform tests**, all control/80 campaign/28 daily fixed witnesses, four-layout bounds and production build PASS.
- Final versioned targeted browser run: **22 PASS**, including actual teaching/lifecycle cleanup, durable rule demos, near drop, focused purchase and preview/apply.
- Full local browser run of the combined pre-version build: **96 PASS, four deliberate duplicate compact chapter skips**; all 80 levels completed via production touch/Next.
- Combined focused browser run: **46 phone/compact scenarios PASS**, covering actual preview, focused purchase/unchanged board, recovery/earned credit, real 8px accepted near drop and 28px cancelled miss, free Hint repeat, finite teaching pixels/reduced motion, durable rule introductions, cosmetic apply/reload/no duplicate payout, pause and saved replay marker, save/ad failures and daily/date/reward paths.
- Final versioned independent rendered audit: **191 states**, comprising 119 fields, 21 homes and 51 dialog states at seven viewport sizes from 320×480 through 520×700; **0 DOM/raster issues**. Dialog coverage includes expanded preferences/reward details and all three actual rule introductions. This checks bounds, actual hit centres and decoded field pixels rather than trusting the layout function.
- Final production-touch recording PASS: unseeded first deal → win → Next; separately a state reached through level 17's frozen witness → category completion → next action during its effect → Undo → pause. Recordings use real input and assert the saved board against the engine, without a runtime test bridge. Initial setup trimmed 1.2s / 1.35s, playback not accelerated.
- [Exact-source CI 42990409658](https://github.com/DanilaH/asoc-solitair/actions/runs/42990409658): **fully PASS** — 65 unit/platform tests, all fixed witnesses/four-layout bounds/build, rendered audit, **96 browser scenarios** plus four deliberate duplicate compact chapter skips, Android debug/signature and SDK-disabled unsigned R8 release compilation.
- Branch Android artifact `13841473457`: manifest independently decoded as `com.danilah.asocsolitair.debug`, 0.9.0/code 12. All **94** production web files match the final local build byte-for-byte. Preview certificate remains `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e`. Branch APK: 10,567,872 bytes, SHA256 `8b8c4c596bb95ac8fe2fed72931c1acda5696e741b72641a4fa1c7eb67cd665b`.

## Delivered APK and media

[Default-branch run 42993165713](https://github.com/DanilaH/asoc-solitair/actions/runs/42993165713), Android job `130430688147` PASS, artifact `13842966512`. Delivered APK is byte-identical to the checked branch APK and all 94 expected production web files match the final local build byte-for-byte. Manifest was independently decoded; CI verifies the signature. Package `com.danilah.asocsolitair.debug`, 0.9.0/code 12, 10,567,872 bytes; SHA256 `8b8c4c596bb95ac8fe2fed72931c1acda5696e741b72641a4fa1c7eb67cd665b`. Preview certificate `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e` matches 0.8.0, allowing an update without uninstalling the existing test app.

Persistent deliverables, all saved successfully with local identity applied:

- `asoc-0.9.0-first.gif`: `libfile_b6123bd4bf0c819191cf708a1afe8f8b`.
- `asoc-0.9.0-dense.gif`: `libfile_85c9d3da45148191bde17c388aab10ef`.
- `asoc-0.9.0-preview.png`: `libfile_efd0a032023c8191a6229e8e02c8ab96`.
- `asoc-solitair-0.9.0-debug.apk`: `libfile_7d7057cbf95481918b492ad8661b2926`.

The duplicate main web/browser run was still executing at delivery; no separate green result is claimed for it. Complete exact-source PR evidence applies to the byte-identical delivered runtime. No physical-phone readability/gesture comfort/FPS/sound/haptics/native insets/live SDK acceptance is claimed. These are implemented UX choices, not measured retention improvements.

Reproduce with `npm run check`, `npm run qa:layout`, `npm run test:browser` and `npm run qa:feel`. Immutable local final build: `.recording/ux-0.9.0-dist`; final layout evidence: `.recording/ux-090-layout`; final touch source captures: `.recording/feel-evidence`.
