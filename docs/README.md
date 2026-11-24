## Действующие метод и состав выпуска · 24.11.2026

[Метод исследования кода и архитектуры](porting/RESEARCH_METHOD_2026-11-24.md) принят владельцем для солитёра по exact kit [`06a01d5c1f7af3cdf8013c9ce0f6a691d086af78`](https://github.com/DanilaH/mini-games-kit/commit/06a01d5c1f7af3cdf8013c9ce0f6a691d086af78). На момент принятия это открытый kit PR #139, не merged `main`; runtime mini-games-kit остаётся `a9325265e87583a4872cf6a158e1e881a0d7508e`. Собственный код может опираться непосредственно на исследованный декомпилированный/native-код и архитектуру. Релевантные точные фрагменты с provenance сохраняются в закрытом mini-games-kit; публичный consumer содержит собственную адаптацию и ссылки. Для UI/video-находки без native фрагмент не выдумывается и не становится обязательным. См. [Reference Protocol](kit-guidance/REFERENCE_PROTOCOL.md), [Task Router](kit-guidance/TASK_ROUTER.md) и [шаблон будущего research → implementation ТЗ](porting/RESEARCH_TO_IMPLEMENTATION_BRIEF.template.md).

[Решение о рекламном выпуске](porting/OWNER_AD_RELEASE_2026-11-24.md) и [матрица source → capability → stage](porting/PRODUCT_CAPABILITY_RECHECK_2026-11-24.md) сохраняют весь реестр **115 IDs / 38 пакетов**, одну продуктовую рекламную паузу и отсутствие зависимости ближайшего выпуска от live IAP. Число источников не задаёт число самостоятельных экранов. Метод, код, включённая конфигурация и приёмка — разные вещи; эта документационная синхронизация не меняет runtime, баланс или статусы. Датированные исследования ниже остаются историческими доказательствами, а их «текущие» цифры относятся к указанной дате/HEAD.

**22.11 original AZUR MoveValidator + Hint divergence:** [source kit PR #98](https://github.com/DanilaH/mini-games-kit/pull/98) · [consumer P04/P05 report](qa/content-v8/P05_ORIGINAL_AZUR_USEFUL_MOVE_JOKER_FILTERS_2026-11-22.md) · [developer issue #123](https://github.com/DanilaH/asoc-solitair/issues/123). Original after DrawCardFromDeck/MoveCard callback occurs when not won + no validator-valid useful actions + still moves, distinct from zero-budget defeat. Hint and Validator Joker filters differ; production solver-backed Hint and phase states remain PRODUCT_ADAPTED. 115 IDs, 38 packages, no original Android runtime.

**P04 original AZUR greedy Hint inner source proof (21.11):** [native 10 opcode/11 BL filter](qa/content-v8/P16_AZUR_SHUFFLE_AND_GREEDY_HINT_ORIGINAL_NATIVE_2026-11-21.md) · [implementation issue #115](https://github.com/DanilaH/asoc-solitair/issues/115). Source tableau→tableau local empty-target suppression and conditional Joker predicate are not consumer solver-backed hints. P04 reopened IN_PROGRESS for isolated offline diagnostic; current production Hint unchanged. 115/115 source IDs, 38 packages.

**21.11 new original source native AZUR Shuffle/Hint — 115/115 source IDs:** [mini-games-kit PR #96](https://github.com/DanilaH/mini-games-kit/pull/96) and [actual P16/P04 source→product audit](qa/content-v8/P16_AZUR_SHUFFLE_AND_GREEDY_HINT_ORIGINAL_NATIVE_2026-11-21.md); [P16 difference/acceptance issue #104](https://github.com/DanilaH/asoc-solitair/issues/104). Original pooled hidden tableau+stock+waste + Undo.Clear and separate Shuffle debit/refund are NOT current stock-only proven-win adapted P16. Native greedy five-stage hints are NOT current solver-backed product hints. Original Android execution still UNKNOWN.

**Актуальная разработка (21.11.2026):** [автономная очередь 38 инженерных пакетов и ТЗ](porting/DELIVERY_QUEUE.md) · [машинный план 115 source IDs](porting/DELIVERY_QUEUE.json) · [журнал выполнения](porting/DELIVERY_PROGRESS.md). Начинать P00, затем автоматически брать следующий независимый пакет; не терять разработку коммерции/meta, не подменять SOURCE_UNKNOWN выдуманной точной копией.

**Content 8 · G1 long-campaign/locale/source parity (21.11):** [all 5 G1 features, 2000 AZUR source rows vs our actual 80-level immutable C8, 33 theme locales vs 36 definition locales, native move budget formula and missing remote/live proof](qa/content-v8/G1_LOCALE_LONG_CAMPAIGN_AND_REMOTE_SOURCE_2026-11-21.md). [Verified semantic pacing issue #84](https://github.com/DanilaH/asoc-solitair/issues/84): C8 unique themes 78, minimum gap 1; source 4539 and gap162. [Machine crosswalk](qa/content-v8/g1-structure-locale-matrix.json); no auto reauthor or source feature exclusions.

**Content 8 · F1–F3 retention/metaprogression (21.11):** [all 23 source event and retention systems, 16 AZUR daily-task types, nine reward classes and source→current game gaps](qa/content-v8/F1_F3_RETENTION_META_SOURCE_TO_PRODUCT_2026-11-21.md). [Full crosswalk](qa/content-v8/f-source-event-matrix.json). 2 implemented-unverified / 15 roadmapped / 6 evidence gaps; no source mechanics excluded.

**Content 8 · E3 commerce audit (21.11):** [all 18 monetization/store families, authentic AZUR 41-product catalog, separate IAP receipts vs ad receipts and current RuStore/NashStore legal eligibility](qa/content-v8/E3_IAP_COMMERCE_SOURCE_TO_PRODUCT_2026-11-21.md). RuStore own Pay SDK unavailable for self-employed without IP since 01.02.2026; NashStore in-app payment flow remains unverified. No real purchase or SDK edits.

**Content 8 · E1/E2 recovery and ads audit (21.11):** [source-native AZUR coin/reward moves vs C8 adaptations, all 13 E1 and 5 E2 source IDs, + failed-show cooldown finding](qa/content-v8/E1_E2_MONETIZATION_SOURCE_AND_AD_CADENCE_2026-11-21.md). [Consumer issue #80](https://github.com/DanilaH/asoc-solitair/issues/80) tracks incorrect attempted-vs-shown ad-clock persistence. No SDK/economy/runtime changes.

**Content 8 · D1 special cards and helpers (21.11):** [all 14 D1 mechanisms audited against actual current Rules3/C8 implementation, source phases, unknown native actions, helper/Undo boundaries and staged adoption](qa/content-v8/D1_SPECIAL_RULES_HELPERS_SOURCE_GAP_2026-11-21.md). Four implemented-unverified; seven roadmapped; three evidence-gap; none permanently excluded.

**Content 8 · Q1c finite-cost reconciliation (21.11):** [parallel Q1b #74 and #75 methods retained; finite-budget 317 winning transfers, 13 of 18 deeper UNKNOWN resolved](qa/content-v8/Q1C_FINITE_COST_DEEP_RECONCILIATION_2026-11-21.md). Prior source CI PASS; combined-head hosted evidence separately required.

**Content 8 · B3 Equality/Paywall (21.11):** [native Hitapps four eligibility gates, Equality late bot failures, three-distinct-stack placement → actual missing C8 issuance, immutable Deal/receipt acceptance contract](qa/content-v8/B3_EQUALITY_PAYWALL_SOURCE_TO_PRODUCT_2026-11-21.md). **Offline model only; no live special Paywall deals issued.**

**Content 8 · B2 director parity audit (21.11):** [source Hitapps lifecycle → actual C8 R1 11–15, ten-outcome policy, EasyDeals/Equality independence and Android evidence gates](qa/content-v8/Q2_DIRECTOR_SOURCE_DELTA_2026-11-21.md). Source-native static, not original running-app parity; all 114 systems remain tracked.

**Content 8 · Q1b (21.11):** [стоимость подтверждённых альтернативных продолжений относительно witness и выборка UNKNOWN](qa/content-v8/Q1B_ROUTE_COST_2026-11-21.md). CI 44899121169 PASS: 325 verified winning alternative transfers, 203 UNKNOWN; witness-relative extra moves are not proven minimum error cost.

**Content 8 · Q5 research reconciliation (21.11):** [пять независимых проверок из разошедшихся PR #67/#69 возвращены в актуальную ветку, CI на audit/c8-* теперь действительно включает Content 8](qa/content-v8/Q5_RESEARCH_BRANCH_RECONCILIATION_2026-11-21.md). Протокол и тесты не доказывают человеческий баланс; итог CI и Android нужно принять отдельно.

**Content 8 · Q2 (21.11):** [человеческий Android-плейтест, контрольные альтернативы и Q1b/Q3 evidence gates](qa/content-v8/Q2_HUMAN_ACCEPTANCE_AND_Q1_FOLLOWUP_2026-11-21.md). **PROTOCOL ONLY: тесты на устройстве и реальные участники ещё не проведены.**

**Content 8 · Q1.** [Аудит выбора ходов на всех 80 уровнях](qa/content-v8/Q1_CAMPAIGN_DECISIONS.md) показывает другие переносы карт, повторные круги колоды и проверенные исходы при исходных лимитах ходов.

**Пресет обучения AZUR (20.11):** [нативная схема CardPresetLayout, отдельные колонки и колода, themeId/wordIndex, отрицательный индекс категории, условия валидации](https://github.com/DanilaH/mini-games-kit/pull/93). Это дополнение к [CORE-ТЗ](qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md), без изменений текущего обучения и сохранений. Политика оригинального валидатора частично неизвестна; исходных Android-снимков 0.

**Коррекция генератора AZUR (20.11):** [исходный ARM64 доказывает перемешивание временной копии карт, а не GameManager.allCards](https://github.com/DanilaH/mini-games-kit/pull/91); [обновлённый CORE-1 runtime-oracle контракт](qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md). Компаратор v2 проверяет порядок столбцов+остатка колоды, исходный `allCards` сохраняется. Реальных оригинальных Android запусков 0; источник 114 систем.

**Runtime-оракул AZUR (20.11):** [source-bound original ABI, Frida numeric board hooks and empty original execution gate](qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md#14-azur-original-android-runtime-oracle-abi-ready-client-not-executed-20-nov-2026) · [mini-games-kit PR #90](https://github.com/DanilaH/mini-games-kit/pull/90). **0 original Android captures**, no claim of exact source dealer parity; current Hitapps C8 implementation continues independently.

**Полное техническое ТЗ по core (20.11):** [источники Hitapps/AZUR/Unico → реальные Rules/C8 → CORE-0..6 и acceptance](qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md). Нативный исследовательский verifier в mini-games-kit PR #78; оригинальные live configs и Unico APK остаются UNKNOWN. Сначала сверить actual C8 HEAD/AGS/SaveStore, не считать документацию готовым runtime.

**Норматив переноса исследованного (19.11):** [Owner reference-adoption policy](porting/PORTING_POLICY.md) · [реестр: 114 исследованных систем, ноль самовольных исключений](porting/ADOPTION_LEDGER.json) · [полная дорожная карта со 114 системами](porting/IMPLEMENTATION_ROADMAP_2026-11-19.md). При анализе исходных игр и планировании переноса сначала читать этот контракт и проверить полноту source→consumer. Исторические C6/C7 запреты на альбом/гонки/Gold/Paywall **не являются действующими запретами дальнейшей разработки**.

Current work: [0.17/content6 opening fifteen](content/OPENING_V6.md). Versioned content, existing-rule pacing, structural/oracle checks and owner playtest; old attempts and0.16UI/audio/performance preserved. Full CI/APK acceptance is still pending.

# Product sources

Current implementation: [0.16 menu, recorded audio, shared wallet and rendering cost](qa/FEEL_WALLET_AUDIO_0_16_0.md). Owner-approved five-point correction; both full source CI runs pass204browser cases and both Android builds. Signed APK/actual-audio MP4/GIF/PNG saved; exact source and identities are in the handoff.

Previous delivery: [0.15 all-screen UI coherence](qa/UI_COHERENCE_0_15_0.md). Approved audit changes implemented; final-source full CI passes192browser cases and both Android builds. Signed APK/actual-touch GIFs are saved; exact identities/status are in the handoff.

Latest independent work: [all-screen UI/UX/feel audit and current kit guidance](qa/ALL_SCREENS_UI_UX_AUDIT_2026-11-14.md).120 canonical states; implementation recommendations, guidance-only adoption; runtime unchanged. Both0.14 exhaustive CI repetitions are now known to have169passes/1tutorial observation failure/4skips, all80 touch wins; see current handoff.

Current preview: [0.14 staged guidance and board motion](qa/BOARD_MOTION_0_14_0.md). PR#26 merged; signed APK/actual-touch GIFs delivered; relevant checks pass. Exhaustive browser catalog remains in progress; see handoff/CI snapshot.


Previous delivered source: [0.13 packet/preview feel](qa/PACKET_FEEL_0_13_0.md). PR#25 merged; full source CI passes162 browser cases and both Android builds. Earlier [0.12 contact/materials](qa/BOARD_MATERIALS_0_12_0.md) and the audit/delivery entries below are historical.

Latest independent follow-up: [0.11.0 board/feel/generation opportunities](qa/BOARD_OPPORTUNITIES_0_11_0_2026-11-13.md).33 fresh touch scenarios; four new visual defects and bounded material/effect proposals. Read-only runtime audit; no new APK or production art is implemented.

Current board implementation: [0.11.0 continuity, slot hierarchy and coherent collection](qa/BOARD_FEEL_0_11_0.md). Approved audit plan implemented; signed APK and actual-touch GIFs delivered. Final-runtime continuity16/16, all80 touch levels, model/content/layout and Android debug/unsigned R8 checks pass. Final exact-input PR CI43390098010 passes146 browser cases +4 deliberate skips and both Android builds. PR#23 merged at7528d8c with identical verified tree; final checkpoint changes documentation/evidence only. Physical-device feel remains open. Rules/bank/saves/economy/art/SDK/kit preserved.

Board review: [microinteraction audit and bounded implementation plan — 2026-11-13](qa/BOARD_FEEL_AUDIT_2026-11-13.md). Historical0.10.0 baseline with production-input evidence; its confirmed findings are implemented in0.11.0 above. Preserve the baseline evidence; fresh-entry/flip behavior is covered in the implementation, physical audio feel remains open.

Historical delivery: [0.10.0 rule/save correction and verified APK/media](qa/RULES_V3_IMPLEMENTATION_2026-11-12.md). [Rules v3](product/RULES_V3.md) supersedes the lower-leader permission for new normal attempts; existing attempts keep v2 independently. Bank orders/budgets and economy are frozen. PR #21 merged; full exact-source CI passes; main/source/saved APKs are verified byte-identical.

Historical rules review: [independent 0.9.4 audit](qa/RULES_AUDIT_2026-11-12.md). Its rule mismatch, reachable 301-command reload error and identified semantic validation gaps are addressed in 0.10.0 above. Preserve the old evidence; use the current v3 verification for present behavior.

Historical board delivery: [0.9.4 slots, stock fan, centered helpers and integrated reader](qa/BOARD_REFINEMENT_0_9_4.md). See its explicit acceptance/delivery status.

Current phone-feedback delivery: [0.9.3 board interaction](qa/BOARD_INTERACTION_2026-11-12.md). See its explicit verification/delivery status.

Current gameplay package: [0.9.2 trustworthy Hint, semantic reader and six isolated test deals](qa/GAMEPLAY_IMPLEMENTATION_2026-11-12.md). Final-source full CI and default-branch APK acceptance pass; the delivered APK, media and laboratory are linked there. The human pilot is prepared, not conducted; campaign changes remain held.

Latest gameplay review: [independent gameplay/content audit and bounded improvement plan](qa/GAMEPLAY_PRODUCT_AUDIT_2026-11-11.md). Review only: 108 deals, four agent policies, independent transition oracle, real-touch counterexamples and a human-test plan. No runtime/bank change; the confirmed Hint fallback issue is proposed work.

Current art delivery: [all 33 casual subject illustrations — 0.9.1/code 13](art/CASUAL_SUBJECTS_0_9_1.md). Approved drum style applied throughout; real-card comparisons, full-subject reader checks, native builds and delivered APK/source bundle are recorded there.

UI/UX base: [four-package UI/UX/feel implementation — 0.9.0/code 12](qa/EXPERIENCE_IMPLEMENTATION_2026-11-11.md). All four packages are merged; exact-source full web/Android CI passes and the default-branch APK/media are delivered. Physical-device acceptance remains open.

Pre-implementation review: [independent full UI/UX/feel pass — 16 opportunities and an implementation order](qa/INDEPENDENT_EXPERIENCE_REVIEW_2026-11-11.md). Findings that led to the implementation above; see its current status.

Latest teaching follow-up: [action-based learning without permanent captions](qa/ACTION_TUTORIAL_2026-11-11.md), based on the verified AZUR recording. Supersedes the proposal to enlarge service captions.

Latest user-feedback follow-up: [compact edge-aligned UI and remaining UX priorities](qa/COMPACT_LAYOUT_2026-11-11.md). Source branch follow-up to the delivered 0.8.0; see its verification/integration status.

Base materials/UI art: [generated art kit — implemented 0.8.0 and passing CI](qa/GENERATED_ART_0_8_0.md), with [resource provenance and source bundle](art/GENERATED_ART_0_8_0.md). Verification and delivery status are explicit in that checkpoint.

Latest presentation research: [cohesive art-system review after 0.7.1](design/ART_SYSTEM_REVIEW_2026-11-10.md). Historical research behind the generated art implementation; see the current 0.8.0 evidence above.

Detailed next-work plan: [art kit, real field, motion, all dialogs and acceptance](design/ART_IMPLEMENTATION_PLAN_2026-11-10.md). Three delivery packages: A — actual field, B — motion/rewards, C — remaining UI and APK. Implemented in 0.8.0; physical-device acceptance remains open.

Resuming after a stopped chat: start at [the continuation checkpoint](SESSION_HANDOFF.md), then use the normative sources below.

1. [Agent handoff](product/WORD_SOLITAIRE_AGENT_HANDOFF_2026-11-09.md)
2. [Normative requirements](product/WORD_SOLITAIRE_REQUIREMENTS_DRAFT_2026-11-09.md)
3. [Feel contract](product/WORD_SOLITAIRE_FEEL_SPEC_V1_2026-11-09.md)
4. [Video observations](research/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md)
5. [Source registry](research/WORD_SOLITAIRE_VIDEO_SOURCES_2026-11-09.json)

Requirements own rules/data/rewards; feel-spec owns presentation/timings. Research does not override either. Imported source documents are preserved verbatim; relative copies and implementation status are indexed here.

Implementation tracking: [roadmap](../ROADMAP.md), [decisions](../DECISIONS.md), [verification](../VERIFICATION.md), [kit reuse](KIT_REUSE.md).

Android integration: [services and ownership](platform/NATIVE_SERVICES.md), [configuration and release acceptance](platform/RELEASE_CHECKLIST.md).

Campaign bank: [authorship, coverage and limits](content/FIRST_CAMPAIGN.md), [validation index](validation/campaign-index.json).

- [Rule extension chapter and compatibility](content/MODIFIERS.md): Joker, ordered categories, three keys, deals 21–26.

- [Compact meta, daily bank, dates and independent saves](content/COMPACT_META.md).

- [80-level release-candidate bank, UX and verification limits](content/RELEASE_BANK.md).

- [Content / UX review — 0.6.1](qa/UX_REVIEW_2026-11-10.md).

- [Casual UI / feel pass — 0.6.2](qa/CASUAL_FEEL_2026-11-10.md).

- [Structural redesign proposal from the user’s Hitapps/AZUR recordings](design/REFERENCE_REBUILD_2026-11-10.md), with an inspectable three-screen prototype. Historical proposal; implemented in 0.7.0 below.

- [Own visual character proposal — blending AZUR and Unico into the accepted structure](design/OWN_CHARACTER_2026-11-10.md), with a separate identity prototype. Implemented in 0.7.0 below.

- [Implementation of the chosen identity UI — 0.7.0](qa/IDENTITY_UI_2026-11-10.md), with production touch recordings and compact layout checks. See the continuation checkpoint for integration and APK status.

- [Independent layout audit and overlap fixes — 0.7.1](qa/LAYOUT_AUDIT_2026-11-10.md): rendered DOM/pixel checks, responsive home, field controls, praise and stack captions. Merged as 0.7.1/code 10; the checkpoint contains the delivered APK and completed/remaining verification.
