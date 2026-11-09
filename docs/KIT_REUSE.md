# Kit selection

Audited commit: `a9325265e87583a4872cf6a158e1e881a0d7508e` (2026-11-08). Read README, AGENTS, API, performance, onboarding and Android ads/lifecycle contracts.

| Mechanism | Decision | Boundary |
|---|---|---|
| GameplayActivityCoordinator, visibility blocker | Use | Aggregate modal/native-background/visibility; no premature resume |
| OneShotPlayer | Use | Bounded original synthesized feedback; phone tuning pending |
| Render density, text sharpness, destroyRenderer | Use | Bounded rendering and deterministic shutdown |
| Touch activation | Use for helper dock | No pointerdown action after a card drag |
| Native banner geometry / receipt queue / interstitial gate | Integrate with native ads stage | No bundled native ad SDK; never claim browser mock as integration |
| JsonStorageRepository / snapshot queue | Not needed for synchronous first-slice save | Single localStorage document written before state publication; no async writers to race |
| Assets/startup tooling | Reassess when raster assets/startup need them | Current cards use original procedural textures and local SVGs |
| Yandex bootstrap, SDK, cloud, Metrica web adapter | Not applicable | RuStore native app, no fictitious web portal |
| Planar depth, noise texture, polyline markers | Not needed | No speculative subsystem without product use |

Native lifecycle follows the audited Arrows baseline in the shared workspace; domain and game presentation are original to this repository. Ads/analytics remain explicit unavailable adapters until native integration and device evidence.
