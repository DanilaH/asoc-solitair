# Content 7: dependency access checkpoint

Base: `b612420fda4d8677073034a91c944c46573cbf08`. The owner approved implementation of the exact research specification and 80-row plan on 2026-11-18. Research source: `research/hitapps-party-pacing-comparison-20261117` / `8ca270d8f58fad2fff3d66cf700131fa74eada9b`. The original DRAFT documents are preserved verbatim; the explicit implementation request supplies approval.

## Confirmed cause

The kit repository is private; the consumer repository is public. A clean original `npm ci` fails while requesting `ssh://git@github.com/DanilaH/mini-games-kit.git`. Merely changing the lock URL does not repair access: npm11.9's GitFetcher normalizes GitHub git dependencies to SSH and also needs authorization for the private repository.

`tools/install-dependencies.mjs` runs ordinary `npm ci` with command-local Git configuration. It rewrites only the kit's two SSH URL forms to HTTPS. An optional `MINI_GAMES_KIT_READ_TOKEN` supplies an HTTP header scoped to this kit path; it is absent from URLs and never written to git/global configuration. The exact existing `a9325265e87583a4872cf6a158e1e881a0d7508e` revision is asserted in both manifests. No SDK/runtime upgrade, new registry or vendored private source is introduced.

Four dependency-free Node tests pass: accepted-cache offline mode versus explicit credentials, inherited Git configuration is retained, credentials are URL/path scoped and removed from the named child environment variable, and pin/transport mismatches are rejected.

## Hosted CI prerequisite

Configure Actions secret **MINI_GAMES_KIT_READ_TOKEN** in `DanilaH/asoc-solitair`. Use a fine-grained token with only the selected `DanilaH/mini-games-kit` repository and **Contents: read**. Do not put its value in chat, source, `.npmrc` or the dependency URL. The consumer's default GITHUB_TOKEN is repository-scoped and cannot authorize the other private repository. Fork PRs must not be given secrets; no `pull_request_target` workaround is introduced.

The connected GitHub tools can read kit source but do not expose creation of Actions secrets/deploy keys. The available browser is signed out. Cold hosted access is therefore **PENDING CONFIGURATION**. The verified accepted-cache route below restores this delivery without claiming a new credential exists.

## Local verification, separate from hosted access

The authorized connector supplied the exact 200 tracked files and original signed Git commit into an ignored local directory. Every blob, tree `ba301f7cc0dc2a17e6d7a245ccb4adb252649bbe`, and commit object `a9325265…` was reconstructed and hash-verified. A shallow local Git mirror supplies that exact revision to npm. The local install succeeded from an empty npm cache with SSH explicitly disabled: 161 packages installed. This permits local implementation/testing; it does not manufacture hosted credentials or claim hosted CI success. The mirror and all private kit code remain under `.recording/` and must never be committed to this public repository.

KIT IMPACT: REUSE. The infrastructure wrapper is consumer-owned; no private kit source/API or production service setting is changed.

## Restore-only bridge under verification

The first bridge attempt44315345529 used a cache from the old feature branch and missed because that cache is not available in the new branch. The accepted default-main build43563944144 (commit dc72b6c) saved `node-cache-Linux-x64-npm-a4df24577ed48de6d871f0577006637c44d25e4ee405b275d4a7b579b77d534b` on2026-11-14. Its entire dependency graph matches this candidate; only root version and kit transport differ, with the exact same pinned commit. CI now attempts only that accepted main cache with `actions/cache/restore`; it never saves private kit source into a new cache. Without a configured read credential the installer uses npm offline mode, so a miss fails rather than changing the revision or fabricating credentials. A credential selects the normal authenticated HTTPS path. Run44315807948 confirms both hosted jobs restored this exact main cache and completed the offline pinned install. Android compilation/signature and artifact upload PASS; web integration is still running at this checkpoint. The same installer route is applied to the manual release workflow without changing or invoking its live service configuration. This bridge is expiring infrastructure; a cold install still requires authorized read access.

The existing preview signing key is mandatory. CI must fail if its accepted cache is unavailable or the APK certificate differs from `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e`; it must not silently generate an incompatible update. Local debug and SDK-disabled unsigned release compilation both passed on the final reader-input source. The local debug certificate is different and that APK is not offered as an update. No production configuration or signing key is changed/exported.
