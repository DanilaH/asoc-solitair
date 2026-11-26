# P07 · Офлайн-фазы Equality

> 26.11.2026: [new unified brief](HITAPPS_GENERATOR_AND_SPECIALS_TZ_2026-11-26.md). Old `PAIR_TRANSFORM_UNKNOWN` is accurate for historical manifests only; the positive native pair exchange and strategy predicates are now recovered. Implement new versioned records; keep old archive and independent product proof. Unresolved source cases explicit, server values nonblocking for local development. No release activation by this note.


[Исходный аудит B3](../qa/content-v8/B3_EQUALITY_PAYWALL_SOURCE_TO_PRODUCT_2026-11-21.md) сверили с текущим дилером, SaveStore и независимым oracle. `prepareEqualityPlan` принимает указанную версию конфигурации, положительный исходный seed, допустимый уровень, лимит и известный синтетический сегмент. Unknown-сегмент отклоняется, даже если он есть в whitelist.

- Equality выбирает три разных индекса из того же продвинутого EmbeddedRandom. Priority и None этот шаг пропускают. Проверены 3, 4 и 5 столбцов.
- Shuffle подготавливает вход ботам. Final применяется только выбранному кандидату. Сохраняются номера запроса и кандидата, запрошенный и фактический seed, индексы, лимит, applied/failed и дайджесты afterShuffle/final.
- В новом контракте два ID с одинаковыми путями отклоняются. WIN, UNKNOWN и поражение до 80% бюджета также отклоняются. Поздний LOST воспроизводится независимой моделью. Трасса хранит действия, шаги, выход и хэш каждого пути. Старый низкоуровневый синтетический контроль фиксирует различие режимов.
- `PAIR_TRANSFORM_UNKNOWN` остаётся у всех контрольных кандидатов. Выбор трёх индексов доказан отдельно от перестановки самих пар. Кандидат имеет статус PRODUCT_MODEL. Исходные данные реальных сегментов, трансформацию пар и фактическую раскладку проверяет P36.

P08 использует отдельное доказательство победы для опциональной выдачи; право на +10 по-прежнему зависит от реально исчерпанной партии. Все пять назначенных source IDs и остальные механики находятся в реестре.
