# Kit selection

Audited commit: `a9325265e87583a4872cf6a158e1e881a0d7508e` (2026-11-08). Read README, AGENTS, API, performance, onboarding and Android ads/lifecycle contracts.

| Mechanism | Decision | Boundary |
|---|---|---|
| GameplayActivityCoordinator, visibility blocker | Use | Aggregate modal/native-background/visibility; no premature resume |
| OneShotPlayer | Use | Bounded original synthesized feedback; phone tuning pending |
| Render density, text sharpness, destroyRenderer | Use | Bounded rendering and deterministic shutdown |
| Touch activation | Use for helper dock | No pointerdown action after a card drag |
| Native banner geometry / DurableReceiptQueue | Integrated | Consumer SDK bridge, safe slot and atomic game grant before native ack |
| ActionInterstitialGate | Not used | Its request-counting semantics do not implement the specified durable new-win/fullscreen cadence; consumer policy is tested separately |
| JsonStorageRepository | Integrated | One authoritative async SaveStore for commands, settings, receipts and cooldown; native AtomicFile adapter |
| RevisionSnapshotQueue | Not needed | Accepted moves/economy must persist before publication; no independent snapshot writer may overwrite a receipt |
| Assets/startup tooling | Reassess when raster assets/startup need them | Current cards use original procedural textures and local SVGs |
| Yandex bootstrap, SDK, cloud, Metrica web adapter | Not applicable | RuStore native app, no fictitious web portal |
| Planar depth, noise texture, polyline markers | Not needed | No speculative subsystem without product use |

Native lifecycle follows the audited Arrows baseline in the shared workspace; domain and game presentation are original to this repository. Ads, analytics, feedback and storage now have consumer-owned native integrations. Browser mock success is never treated as device evidence. See [native services](platform/NATIVE_SERVICES.md).
