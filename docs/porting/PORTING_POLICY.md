# Association Solitaire — обязательное покрытие исследований конкурентных игр

**Действующая продуктовая установка владельца · 19 ноября 2026.** Применяется к исследованиям и разработке по Hitapps, AZUR, Unico и новым референсам. **Приоритетнее исторических предложений scope в C6/C7 и устаревших запретов в `AGENTS.md`**; не изменяет правила/экономику/сохранения автоматически.

## 1. Что просил владелец

Разобрать успешные игры максимально предметно — правила, баланс и генераторы, рекламу, монетизацию, помощников, сложность, события, удержание, интерфейс, звук и прогрессию — **для дальнейшего использования в нашем солитёре**.

Задача исследователя не ограничивается составлением красивой подборки или минимального MVP. Каждый исследованный механизм должен либо:
- попасть в реализуемую, версионированную дорожную карту;
- быть уже внедрён с конкретной версией и приёмкой;
- остаться явно `EVIDENCE_GAP/DEFERRED/BLOCKED` с техническим объяснением, как вернуться к нему.

**Исследователь/агент не вправе самостоятельно объявлять механизм навсегда исключённым** только потому, что он дорогой, монетизационный, сложный или «не вписывается в маленькую игру». Приоритизация этапов — обязанность агента; исключение из продукта — решение владельца. **Код не добавлять без установленного scope/контроля совместимости; roadmap coverage не равно немедленное включение всей системы.**

Неполная эквивалентность оригиналу = отдельный evidence gate, не тайный отказ. Честно различать нативный source, видимую сцену, исходный конфиг, синтетическую модель и реальный production runtime. Не переносить сторонние copyright-ассеты и код.

## 2. Где хранится нормативный статус

1. **Актуальные исследовательские источники:** [114 source feature IDs](https://github.com/DanilaH/mini-games-kit/blob/1c2d12621ba47f7f164a418dab84781c025ee855/research/games/association-solitaire/porting/SOURCE_FEATURES.json), exact source Git blob SHA `9a740783e79f0613ce6cccf9de281e2a5b3dc930`. Prior kit original Hitapps/AZUR/Unico reports #78–#86 are preserved as source-bound history; [kit PR #88](https://github.com/DanilaH/mini-games-kit/pull/88) proves 90 packaged original AZUR Sprite sets, 33 theme locale banks and the preload/locale-count native call chain. Research SHA is separate from runtime kit dependency. Packaged evidence is not original device-preload success.
2. **Наша обязательная матрица:** [ADOPTION_LEDGER.json](ADOPTION_LEDGER.json). Каждый source feature ID имеет ровно одну строку, текущую реализацию, следующий этап и ссылку на исходное исследование. Машинные статусы не подменяют реальную проверку.
3. **Методология:** [Reference → Product Porting Framework](https://github.com/DanilaH/mini-games-kit/blob/899869a19e64245c024dc02bebc36420f81f5487/docs/agent-workflows/REFERENCE_PORTING_FRAMEWORK.md). Старые [Reference Protocol](../kit-guidance/REFERENCE_PROTOCOL.md) и [Task Router](../kit-guidance/TASK_ROUTER.md) остаются полезны, но **полный adoption-проект не должен обрезаться до 1–2 маршрутов или 1–2 систем**.
4. **Текущая ветка:** [Content8 PR #41](https://github.com/DanilaH/asoc-solitair/pull/41) (активный development, ещё не принят/слит в game main), [Equality/+10 spec #42](https://github.com/DanilaH/asoc-solitair/pull/42) (docs only), [game governance #43/#44](https://github.com/DanilaH/asoc-solitair/pull/44) (слиты в активную C8, не в C6 main), [исправление аудита #45](https://github.com/DanilaH/asoc-solitair/pull/45) (слит в C8), [game-main instructions #46](https://github.com/DanilaH/asoc-solitair/pull/46) (docs-only). Kit framework #73, full source audit #74, catalog #75 и критический recheck #76 слиты в kit main. Старые kit #68/#70/#72 сохранены побайтно в #74 и закрыты как superseded, **не отвергнутые**.
5. **Реальные ограничения:** `AGENTS.md`, product decisions, сохранить старые C1–C8 сохранения/attempt IDs, Rules v3, Undo/Hint, native receipts, package/signing, revenue attribution, Android lifecycle. Не переписывать старые preview-definition IDs задним числом.

## 3. Обязательный рабочий цикл агента

**При конкурентном анализе:** добавить в source inventory и coverage отчёт ВСЕ обнаруженные системы, в том числе потенциально ненужные/дорогие. Выделить статус доказательства и источник `build + hash / frame / native address`. Если источник не читался — `NOT_INSPECTED`.

**При предложении roadmap:** сверить inventory с нашим ledger и настоящими PR/кодом; показать `source feature → current behavior → delta → dependencies → scope/cost → next check`. Развести “я не советую делать прямо сейчас” и “владелец запрещает”. Никаких permanent REJECT от агента.

**При реализации:** указать изменяемые feature IDs в PR; после завершения обновить ledger, acceptance и ссылки на build/tests. Никогда не использовать зелёный CI как доказательство удовольствия, монетизации или активности удалённых функций оригинала. Когда пользователь сообщает об ошибке исходной гипотезы — пересмотреть ТЗ, агентские запреты, adoption ledger и граф последовательности в одном пакете.

**При новых механиках** требовать собственные чистые реализации (не proprietary binary/art/audio), независимые тесты/фактические Android states, versioned-save migration и честный статус `SOURCE_PARITY/DEVICE_UNKNOWN`. Совместимость рекламы и юридических условий площадок проверять до включения в store, но не использовать неопределённость как основание забыть найденную систему.

**При следующем старте разработчика:** читать сначала `AGENTS.md`, затем этот документ и ledger, затем соответствующие source/PR. Пробелы in ledger = работа для исследования, а не молчаливое “не нужно”.

## 4. Gate полноты

Клонированный/доступный соседний `mini-games-kit` той же исследовательской ревизии:
```bash
python3 ../mini-games-kit/tools/verify-reference-porting.py \
  --inventory ../mini-games-kit/research/games/association-solitaire/porting/SOURCE_FEATURES.json \
  --ledger docs/porting/ADOPTION_LEDGER.json
```

Проверка должна выявлять **все отсутствующие ID**, а `OWNER_EXCLUDED` требовать прямое решение владельца. Если kit checkout не доступен, агент обязан запросить/получить exact source inventory и провести ту же сверку; никакой ложный PASS. Документ `SOURCE_FEATURES.json` на стороне кита — исследовательский список из известных отчётов, **не обещание изучить все версии игры и все серверные настройки**. Его нужно дополнять при новых находках.

**Нормальный объём работы:** не нужно каждую CSS-правку превращать в повторный APK-реверс. Этот gate обязателен только для задач *«исследуй / повтори конкурентную механику / внедри найденные системы / проверь, что забыли»* и связанных масштабных PR.

## 5. Почему текущие старые запреты неверны

Исторический `AGENTS.md` говорил `Do not add excluded systems: races, VIP, albums, piggy bank, energy, Gold timers, shuffle, magnet or an extra foundation helper.` Это был ранний **агентский выбор ограниченного first slice**, не новое решение владельца запретить всю дальнейшую работу. Оно заменено этим policy. Все названные системы остаются в ledger в статусе исследования/roadmap/deferred/blocker, пока их статус не будет уточнён при конкретном PR.

При **одновременном изменении AGENTS и игрового контента** выбор верного HEAD и согласование PR обязательны; не перезаписывать новые изменения старым `main`.

**KIT IMPACT:** новая методология принятия исследований и контроль полноты, без новых runtime export/SDK/config.

## 6. Независимая исправленная ревизия и реальный consumer CI gate

[Независимая фальсификация первого реестра](https://github.com/DanilaH/mini-games-kit/blob/7f91abfd824162780a6567c6823b95864142957c/research/games/association-solitaire/porting/INDEPENDENT_RECHECK_2026-11-19.md): один стартовый IAPProductCatalog (41 SKU) и 22 другие подмеханики были отсутствующими отдельными ID. Общий реестр расширен **76 → 99**; у оригинальной Hitapps Daily puzzle отсутствует достоверное доказательство и её статус EVIDENCE_GAP. Неверная метка NATIVE_STATIC у AZUR UI/feel исправлена на METADATA. Ранние оценки DONE не равны точной native-паритетности.

Настоящая проверка продукта — `npm run qa:porting`, в game CI она запускается **до установки зависимостей**. Для воспроизводимой проверки `docs/porting/SOURCE_FEATURES_PINNED.json` является побайтным снимком исследовательского источника, а не вторым авторским реестром. CI вычисляет его **Git blob SHA**, сравнивает с `ADOPTION_LEDGER.sourceInventoryBlob`, проверяет 114/114 после source sync, статусы, стадии, исключения владельца и каждую строку дорожной карты. Обновления research inventory требуют синхронного обновления снимка и ledger. Это **offline pinned-source check**: не доказывает, что новые механики в не закреплённой ветке кита будут обнаружены автоматически; для этого нужен отдельный source revision sync.

## 6. Полная дорожная карта после независимого аудита

[IMPLEMENTATION_ROADMAP_2026-11-19.md](IMPLEMENTATION_ROADMAP_2026-11-19.md) — 114 идентификаторов со стадиями B1–G1, проверяемыми зависимостями и владельческим управлением scope. На каждый новой находке обновлять эту карту и обе копии реестров. `EVIDENCE_GAP` не означает отказ; `BLOCKED` на IAP означает отсутствие подтверждённой платформенной инфраструктуры, а не запрет на такую систему.

## 7. Core source-to-product development order (20.11.2026)

[CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md](../qa/CORE_REFERENCE_IMPLEMENTATION_SPEC_2026-11-20.md) — обязательное инженерное ТЗ по Rules/draw/recycle/solver, источнику уровня, RNG, `Priority/EasyDeals/DynamicDifficulty/Equality`, стадиям специальных карт, Frozen/Bound/scissors/Golden/Magnet, полноценной C8 кампании16–80, 5 колонкам, функции отсутствия ходов, gifted +10 и независимой проверке. Core пакеты CORE-0..6 **не** заменяют/не исключают commercial/meta системы из общего roadmap. Настоящие native original Android traces ещё `UNKNOWN`.

**Historical evidence-tier correction:** [kit PR #79](https://github.com/DanilaH/mini-games-kit/pull/79) downgrades AZUR `BonusColumn` and `GenerateCards` source rows from native behavior to `METADATA` with verified ARM64 pointers, because method identity ≠ recovered method body. Source snapshot has the same 110 IDs and the new Git blob SHA, now merged in kit commit `57bffb395e06200dc9f147c6f52f0128b4a4d370`.

**Current source evidence after PR #82:** Previous PR79 downgrades were appropriate at that time. The original native bodies were subsequently recovered by kit PR80/81, advancing scoped dealer/bonus source proof to NATIVE_STATIC; PR82 additionally proves tutorial-only level-one preset gating/fallback, retaining explicit UNKNOWN original RNG state and live client board. The current authoritative pin is 111/111 as declared in section 2, not the historical PR79 source blob.

**Latest P0 source clarification (PR #84):** AZUR native random-column Joker is a distinct registered gameplay helper vs Hitapps Joker. Original Unity Random.Range is used by dealer, daily bonus, combo track and Joker, but actual execution order/global Unity state/live SDK remains UNKNOWN. Do not couple deterministic product authoring to UI/meta random draws; an isolated RNG is a product adaptation, not original-runtime parity. All 112 IDs remain governed by the same owner porting policy.

**Current PR #86 source boundary:** art availability controls effective per-theme word-card count in ordinary AZUR GenerateCards, which cycles source word references if requested count exceeds dictionary words. This is **not** permission to silently change existing Hitapps C8 deal definitions or assume art-dependent native cards were observed live. All 113 systems remain mapped.

**Current original-source evidence after kit PR #88:** source asset availability is separate from real loaded-art state; per-theme word-card counts and locale move-budget input may depend on positive loaded Sprite counts. AZUR source game packages 90 art sets/490 sprites; English/Russian use different member counts on 1357 themes. The product can author/freeze independent optional AZUR deals, but source research cannot mutate already accepted Hitapps C8 content/Undo/receipts. All 114 IDs remain mapped.
