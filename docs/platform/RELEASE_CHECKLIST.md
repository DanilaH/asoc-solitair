# Native configuration and release acceptance

## Configuration

| Input | Purpose | Repository value |
|---|---|---|
| ASOC_AD_MODE | disabled / test / live | Debug defaults to test; release must be explicit |
| YANDEX_BANNER_AD_UNIT_ID | Separate native sticky banner | Environment / Actions secret only |
| YANDEX_INTERSTITIAL_AD_UNIT_ID | Separate native interstitial | Environment / Actions secret only |
| YANDEX_REWARDED_AD_UNIT_ID | Separate native rewarded | Environment / Actions secret only |
| APPMETRICA_API_KEY | This game's production analytics app | Environment / Actions secret only |
| APPMETRICA_DEBUG_API_KEY | Optional separate debug analytics app | Environment only; production key is never used by default |
| ASOC_STORE_BASE64 / ASOC_STORE_PASSWORD / ASOC_KEY_ALIAS / ASOC_KEY_PASSWORD | Existing production signing identity | Actions secrets only; never generate a substitute |

Test mode uses official `demo-banner-yandex`, `demo-interstitial-yandex`, `demo-rewarded-yandex`. Live configuration rejects missing/demo units and a missing AppMetrica key without printing values. Default/local unsigned release is blocked. CI may set `ASOC_AD_MODE=disabled ASOC_UNSIGNED_CHECK=1` solely to compile an unsigned, SDK-disabled R8 payload; it cannot combine this bypass with signing. That artifact is not a store candidate. The manual signed workflow uses live mode and a private ephemeral keystore with cleanup. No publishing step is authorized or automated.

Debug: `npm ci && npm run android:sync`, then `ASOC_AD_MODE=test native/android/gradlew -p native/android assembleDebug` with JDK21/SDK36. Production: run the configured signed workflow, retaining the mapping and APK/AAB identity.

## App behavior implemented

- Versioned local profile/attempt/settings, no mandatory login/server/network for core play.
- Native banner/fullscreen/receipt bridge; fake rewards absent from production.
- Independent visibility/background/modal/ad ownership, audio focus, Back and haptic settings.
- Shrinking enabled; Capacitor entry points retained explicitly.
- Shared native/web custom-event schema; deterministic asset preparation.

## Required before store submission — NOT automatically passed by this document

- Configure this application's three ad units, AppMetrica app and signing identity through the private environment/Actions secrets. Do not reuse another app's identifiers silently.
- Host a public privacy policy and provide a real developer support contact. In-app disclosure and the RuStore data form must reflect the actual SDK payload, permissions and purposes. Do not assert that no technical/device data is collected merely because custom events omit personal fields.
- Review the merged release manifest and SDK notices. App permissions requested directly here: INTERNET, ACCESS_NETWORK_STATE, VIBRATE; SDK manifests may add permissions/queries including advertising ID. No contacts/camera/microphone/location runtime permission, notification permission, push SDK, account, payment SDK or cloud account is introduced.
- Verify real native banner dimensions/visibility against the dock, system bars and cutout; no-fill/offline, font enlargement, dialogs, background/return and resized WebView.
- Verify native interstitial after eligible new wins and only on a deliberate post-win transition. Verify first-level grace, 120s fullscreen interval, rewarded deferral, restarts and clock rollback.
- Verify earned +2 Hint / +3 Undo / +10 move continuation, cancel without reward, duplicate callbacks, process kill after native receipt, after game commit and before/after ack, failed ack plus spending and late receipt after restart.
- Verify Back cancels drag, closes modal and opens settings without a move; force-stop/relaunch and app upgrade retain the exact profile/attempt. Confirm the intended data-deletion/backup behavior on the target Android versions.
- Listen to sound and check distinct vibration on a physical Android phone, focus interruption, background, ad return, mute persistence and no burst of stale effects.
- Confirm this game's custom events and active-play durations in its AppMetrica dashboard using a separate debug app where appropriate.
- Verify the actual signed R8 APK: stable application ID/signing certificate, versionCode, manifest, SDK mode, embedded web payload, native bridges and all ad paths. Record APK SHA256, size and public signer fingerprint. Compilation alone is insufficient.
- Finish and human-playtest the agreed release-size content bank; compact meta is implemented with a finite 28-puzzle daily rotation; the 80-level candidate bank is machine-validated; independent human difficulty/pacing and physical-device acceptance are not established by its size. Verify Joker selection/Back, spent charge across Undo/restart/upgrade, ordered refusal and third-key unlock/Undo/process-kill on a physical phone.

- Verify mode switching, parked daily/campaign durability across native force-stop/upgrade, same-date reward deduplication and local midnight on target devices. Verify ink/back appearance and free mirrored deck geometry with actual native insets/banner.

## Preview identity — 0.6.1

Debug uses package `com.danilah.asocsolitair.debug` and label «Ассоциации · тест». It installs alongside the old `com.danilah.asocsolitair` debug APK, with separate progress. It is not an in-place update of that old APK. Canonical release package/signing remains unchanged and gated on the configured production identity.

The prior implicit keystore cache path did not exist; CI now uses one explicitly generated/restored runner-temp keystore and passes it to Gradle. Deliver the default-branch artifact, verify its signature/package/version and matched web payload, and compare signer fingerprints on subsequent updates. Cache loss can still invalidate development update continuity; it must not be treated as managed production key storage.
