# Ритм партий Hitapps → наш Association Solitaire: сравнительный разбор и экспериментальное ТЗ

**17.11.2026. Статус: DRAFT / research proposal, НЕ утверждённое изменение правил.**
Baseline нашего проекта: \`DanilaH/asoc-solitair\` main \`b612420fda4d8677073034a91c944c46573cbf08\`, 0.17.1/code26, rules/content/balance 3/6/3. Продолжение [OPENING_V6.md](OPENING_V6.md), но не отменяет DECISIONS или старые действующие попытки. Не запускать генератор и не изменять экономику этим документом.

## 1. Три разных уровня свидетельств

**A. Публичные таблицы решений конкурента:** каталог [GameAnswer / Solitaire Associations Journey](https://www.gameanswer.net/solitaire-associations-journey/) и выборочная независимая сверка [SolitaireAssociations.net — level 6](https://www.solitaireassociations.net/level/6/), [level 7](https://www.solitaireassociations.net/level/7/). Это данные о **категориях и перечисленных участниках**; они НЕ говорят о скрытых картах, начальных столбцах/stock, live сегментах, действующем лимите ходов или человеческой сложности. Публикуются разные версии словаря и названий; каталог не объявляем зеркалом текущего production-клиента.

**B. Прямая запись владельца:** [S1 Hitapps](https://drive.google.com/file/d/1BLB3aShGKDB1qC0cukvoe-1zHTCX3IfX/view) (15:31, 09.11.2026), [локальный реестр и метод](../research/WORD_SOLITAIRE_VIDEO_SOURCES_2026-11-09.json), [video audit](../research/WORD_SOLITAIRE_VIDEO_ANALYSIS_2026-11-09.md). Видны уровень 48 (128 ходов, около 41 карты в stock в одном кадре, 4 верхних слота, 4 столбца), уровень 49 (в начале 128 ходов, 42 stock и красные замки/ключи). Уровень 48 словарно совпадает с [каталогом](https://www.gameanswer.net/solitaire-associations-journey-level-48/) по Greek/Smuggler/Comfort/Feedback. **Это подтверждает совпадение одного элемента каталога**, не первый unlock ключей (в этой записи ключи есть уже на 49-м), не каждый level-map и не одинаковый seed/penalty.

**C. Нативный XAPK клиент Hitapps 1.26.2/code3742:** [source-pinned DynamicDifficulty](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-difficulty/README.md), [процентный step budget](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-difficulty/PENALTY_TO_STEPS.md), [simulated seed candidate selection](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-17-hitapps-difficulty/SIMULATION_SEED_SELECTION.md), [open gate о feature unlock](https://github.com/DanilaH/mini-games-kit/blob/main/research/games/association-solitaire/2026-11-16-systems/OPEN_GATES.md). Истинные ранние unlock-уровни, конфиги, выигрышность, сохранённый stock/columns остаются UNKNOWN.

## 2. Наблюдаемый 5-уровневый рисунок ОБЪЁМА контента Hitapps

Из первых двадцати опубликованных таблиц ответов, подсчитано число **категорий** (одно имя темы на строку):

\`\`\`text
Level:       1   2   3   4   5 |  6   7   8   9  10 | 11  12  13  14  15 | 16  17  18  19  20
Hitapps:     4   6  10  10  10 | 12   6  10  10  10 | 12   6  10  10  10 | 12   6  10  10  10
Our 0.17.1:  2   2   2   3   3 |  3   3   3   1   2 |  2   2   3   2   3 |  5   4   5   5   5
\`\`\`

После первых вводных появляется повтор \`PEAK → BREATHER → BASE → BASE → BASE\`. Он виден и далее (выборочные страницы): [21: 12 групп](https://www.gameanswer.net/solitaire-associations-journey-level-21/), [22: 6](https://www.gameanswer.net/solitaire-associations-journey-level-22/), [26: 14](https://www.gameanswer.net/solitaire-associations-journey-level-26/), [27: 6](https://www.gameanswer.net/solitaire-associations-journey-level-27/), [31: 15](https://www.gameanswer.net/solitaire-associations-journey-level-31/), [32: 6](https://www.gameanswer.net/solitaire-associations-journey-level-32/), [41: 15](https://www.gameanswer.net/solitaire-associations-journey-level-41/), [42: 6](https://www.gameanswer.net/solitaire-associations-journey-level-42/), [51: 15](https://www.gameanswer.net/solitaire-associations-journey-level-51/), [52: 6](https://www.gameanswer.net/solitaire-associations-journey-level-52/), [61: 15](https://www.gameanswer.net/solitaire-associations-journey-level-61/), [62: 6](https://www.gameanswer.net/solitaire-associations-journey-level-62/), [71: 15](https://www.gameanswer.net/solitaire-associations-journey-level-71/), [72: 6](https://www.gameanswer.net/solitaire-associations-journey-level-72/), [76: 12](https://www.gameanswer.net/solitaire-associations-journey-level-76/), [77: 6](https://www.gameanswer.net/solitaire-associations-journey-level-77/). Не переносить пропущенные уровни по предположению.

**Очень важная оговорка:** PEAK здесь означает *больше категорий/участников*, а не доказанно более сложную головоломку или более высокую долю поражений. Осмысленные решения, доступность скрытых карт, итоговый лимит ходов, fail/restart, callback рекламы и реальные live/config не восстановлены из сайта ответов. Сходство результатов с S1 на уровне 48 повышает доверие к семейству данных, но не снимает этих ограничений.

Дополнительное наблюдение: [level 6](https://www.gameanswer.net/solitaire-associations-journey-level-6/) 12 групп (66 участников +12 лидеров ≈78 физических карт), [level 7](https://www.gameanswer.net/solitaire-associations-journey-level-7/) 6 групп (29 участников +6 лидеров ≈35), [level 11](https://www.gameanswer.net/solitaire-associations-journey-level-11/) 12 групп (68 участников+12 лидеров ≈80), [level 12](https://www.gameanswer.net/solitaire-associations-journey-level-12/) 6 групп (30+6 ≈36). В подсчёте физических карт предполагается **один лидер на категорию**. Нельзя копировать эти значения в нашу геометрию с 1–3 foundation slots.

## 3. Текущий перекос НАШЕЙ кампании: настоящий baseline из JSON

| Уровни | Среднее число физических карт | Путь-свидетель / ходов, среднее | Реальная проблема |
|---|---:|---:|---|
| 1–2 | 7.0 | 9.0 | Обучение; допустимо |
| 3–7 | 9.0 | 9.0 | Длинные текстовые объяснения стратегии вместо развития обычной партии |
| 8–15 | 10.1 | 9.8 | **7 из 8 содержат special** (joker / ordered / keys), вплоть до mixed 15 |
| 16–20 | 25.8 | 42.4 | Резкий скачок объёма: 15→16 = 14→25 карт, 14→39 ходов witness |
| 21–26 | 9.2 | 9.5 | **6 из 6 специальных учебных**, резкое падение масштаба |
| 27–40 | 12.3 | 17.9 | Частые ordered/keys, общая партия короткая |
| 41–60 | 14.8 | 22.6 | Рекурсия специальных шаблонов без ясного нарастания |
| 61–80 | 14.9 | 18.9 | Плоский/местами сокращающийся поздний ритм |

В знаменателе **все** физические карты (лидеры + участники), из \`opening-v6.json\`, \`campaign.json\`, \`modifiers.ts\`, \`expansion.json\`. Путь-свидетель — зафиксированный автором маршрут, НЕ оптимум и НЕ число ходов среднего игрока.

Есть две независимые ошибки композиции:
1. Уровни 8–15 становятся обзором фич, не увлекательным развитием солитёра.
2. Уровни 21–26 **снова** обучают тем же фичам при падении объёма после уровней 16–20.

## 4. Пересмотр предыдущего предложения

| Раньше предлагалось | После сравнения с Hitapps | Решение |
|---|---|---|
| 1–15 core-only | Да, но не все крошечные: быстро растить глубину обычного ядра | **KEEP + expand** |
| Joker вводить обязательной задачей около 18–20 | Джокер — optional helper, его unlock 8 не обязан создавать специальную учебную раздачу | **DECOUPLE unlock/UI tutorial/board use** |
| Ordered около 26 | Точных Hitapps unlock нет; у нас существует полноценный ordered на 30 | **EXPERIMENT: 30**, позже корректировать |
| Keys на 35–37 | Точно не подтверждено. Видео S1 показывает keys на уровне 49. У нас уже есть key-раздача 50 | **EXPERIMENT: 49–50**, убрать ключи до 49 |
| Director сразу поверх content6 | Сначала устранить неровную кампанию, иначе A/B директора будет измерять перегрузку фич | **POSTPONE live director, allow passive metrics** |
| Каждая ступень сложнее предыдущей | В Hitapps важна смена объёма; пиковый уровень ≠ автоматически проигрышный | **ADOPT periodic volume wave** |

**Важно:** все точные наши уровни после ревизии — **предложение для первого набора A/B**, не утверждение, что Hitapps отпирает ordered30 / keys49.

## 5. Proposed v0.18 campaign pacing: 80 уровней, без копирования чужих карт

Основной ритм начиная с уровня 6: каждые пять уровней \`PEAK → REST → BASE → BASE → BASE\`.
- \`PEAK\`: больше карт и категорий, более богатая подготовка/серия открытий, но НЕ обязательно самый жёсткий лимит; полезно дать несколько возможных подходов.
- \`REST\`: меньше карт, быстрое удовлетворительное завершение, знакомые темы, **никаких новых блокировок / многомеханических уроков**. В идеале без обязательных помощников.
- \`BASE\`: содержательные обычные партии, увеличение масштаба по макрокривой главы. Иногда выбранная стратегическая задача (очередность верхнего слота, подготовка группы, открытие карты) без новых правил.
- Уровни 1–2 — адаптивное обучение базовым действиям, исключение из шаблона.

**Нагрузка — предложение диапазонов для авторинга, НЕ copied values:**
| Отрезок | REST | BASE | PEAK |
|---|---|---|---|
| 3–15 | 2–3 темы, 9–14 карт | 3–4 темы, 12–20 карт | 4 темы, 20–26 карт |
| 16–30 | 2–3 темы, 12–18 карт | 3–5 тем, 18–28 карт | 4–5 тем, 26–35 карт |
| 31–50 | 3 темы, 14–20 карт | 4–5 тем, 22–32 карты | 5 тем, 30–38 карт |
| 51–80 | 3–4 темы, 16–22 карты | 4–6 тем, 24–34 карты | 5–6 тем, 32–42 карты |

Диапазоны **исследовательские стартовые, не проверенные engine/touch/phone**. Действующие слоты/правила и semantic bank могут сделать отдельные значения недопустимыми; при отсутствии решения в заданной геометрии отклонять вариант вместо добавления нового механизма. Прежде чем создавать 40-карточные партии, проверить читаемость и время уборки на реальном устройстве. Не увеличивать число категорий только ради числа.

### Feature timeline — сдержанный, не конкурентные факты
- \`Hint\` unlock 3, \`Undo\` unlock 4, \`Joker\` unlock 8 как **существующие helper entitlements** пока не менять. Вводить micro-tutorial контекстно при **первом реальном использовании**, не требовать от игрока применять платную опцию ради прохождения.
- Уровни 1–29 — преимущественно обычная сортировка: текстовые карточки, рисунки, stock/recycle, доступность колонок, prep, очередность слотов, потеря/восстановление; **без карт-ключей и ordered**, если финальный плейтест не даст других оснований.
- Уровень \`~30\`: первое \`ordered\` как **одна новая фича**; дальше отдых, обычные и более содержательные применения, не «обязательные 2 подряд мини-урока».
- Уровень \`~49–50\`: первая \`keys\`/blocked-column карта — чётко видимый эффект и восстановление, затем самостоятельная практика с расстоянием, **без одновременно нового ordered**.
- 51–80: возвращение к знакомым special **не более одного сложного special на стандартный 5-level блок** для первой итерации; комбинации — только после доказанного освоения, вне REST.
- Исключить tutorial-duplicate 21–26 после переназначения; не перемапить старые attempt/parked на новые раскладки.

### Правило качества каждого уровня (не только solvable)
Каждая кандидатная раздача хранит:
\`campaignLevel, contentVariantId, paceRole, decisionSignature, numberOfCategories, totalCards, tableauDepth, stockSize, foundationSlots, targetMoves, verifiedWitnessSteps, slack, distinctMeaningfulDecisions, knownRecoverableWrongChoices, featureFlags, firstUseGate\`.

Проверять:
1. Независимый engine/oracle и минимум один выигрышный путь (в т.ч. без покупки/видео); штатный Hint/Undo/restart/save/Next.
2. Сколько на самом деле **стратегических выборов**, а сколько очевидных переносов/доборов; сколько решений можно исправить; не строить поражения на недоступной информации.
3. \`slack = budget − verifiedWitness\` как **показатель запаса конкретного пути**, не показатель winrate. Не заставлять проигрывать после одной ошибки. Уровень 19 текущего банка с 45/45 — отдельная красная метка.
4. Периодические REST должны быть реально **короче по touch-steps**, а не только иметь меньше категорий.
5. Нельзя менять точный результат уже активной попытки при обновлении банка, рестарте, Undo или возврате из daily; изменение только новой попытки с versioned new deal IDs.

## 6. Имплементационные пакеты и гейты

**P0. Campaign c7, без runtime-директора:** сначала сделать предложения на 1–40 в новых revision-specific ID, сохранить старые 80, все legacy attempts и receipts; версионирование/Next должны выбирать свежую редакцию, reload/parked — старую. В первую очередь убрать перегрузку 8–15, затем разрыв 15–26, затем уточнить 27–40. Никаких новых фич/UI/meta/SDK/магазинных изменений. Старые \`campaign.json\`, \`modifiers.ts\`, \`expansion.json\`, \`opening-v6.json\` не переписывать.
**P1. Расширение кривой 41–80** теми же правилами, а не механическое повторение catalog 18-level с минимальным variance; набрать достаточное число редакторских задач.
**P2. Контроль/A-B:** сравнить оригинальную 0.17.1 и c7 с одинаковыми отчётами реального human-first-play без Hint, типами ошибок, причиной выхода, выигрышем/проигрышем, длительностью и субъективным напряжением. Не объявлять synthetic-agent win rate человеческим. Функции адаптивной сложности из mini-games-kit изучены, но activation только отдельным позже принятым экспериментом.
**P3. Optional adaptive director** (после C7): окно результатов, deterministic candidate pool, budget adjustments, metadata/rewards normalization, fail-safes. Не связывать его скрытую политику с рекламными paywalls.

**Gate до продакшн:** воспроизводимая сверка всех 80, сохранения прошлых версий, ручные проходы пограничных уровней (6→7, 10→11→12, 15→16→17, 20→21→22, 29→30→31→32, 48→49→50→51→52), Android touch/feel, проверка восстановлений, отсутствие forced purchases/videos, проверка экономики наград. Не обещать D1 retention, заработок или пользовательский winrate без живых данных.

**KIT IMPACT:** REUSE существующей методологии content quality / mastery / source-pinned competitor reverse. Никакого изменения reusable API, kit runtime или SDK. Это НЕ permission автоматически внедрить эксперимент.
