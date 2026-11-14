# New Game Repo Setup — минимальная и воспроизводимая инициализация

**Действует:** 14.11.2026. **Принцип:** проект получает доказанный технический baseline своей платформы, короткие инструкции агента, локальную карту выбора исследований и **точный guidance SHA** (а Yandex bootstrap отдельно закрепляет ту же версию runtime-зависимости). Он НЕ получает все игровые механики, директора, рекламную политику или контент только потому, что они существуют в kit.

## 1. Выбрать тип проекта, не смешивая разные хосты

**Yandex Games + Phaser:** использовать существующий проверенный mandatory bootstrap:

    npm run bootstrap:create -- ../my-game --orientation portrait

Это копирует реализацию Yandex SDK, real/mock, lifecycle, startup, sound activity, viewport, TS/Vite/Phaser и CI; генерирует AGENTS, PROJECT_DECISIONS и локальную kit task routing. В новом репозитории выполнить install/build/tests, затем заменить BootstrapScene реальным gameplay. Арт и правила ещё не выбраны.

**RuStore/Android + Phaser/Capacitor:** в mini-games-kit на эту дату **нет** равноценного Android bootstrap, который бы воспроизводимо связывал native SDK, подписанный релиз, тестовый ad mode, актуальный target SDK и миграции. Не притворяться, что Yandex Games web bootstrap можно просто «переключить на Android». Пока начинать с проверенного реального Android consumer/технического scaffold и добавить **только агентский контур**:

    npm run guidance:init -- ../my-android-game --platform android --name my-android-game

Команда не устанавливает Phaser/Capacitor, Яндекс мобильную рекламу, Android signing, работу с банковскими и store аккаунтами. Она создаёт AGENTS.md, docs/PROJECT_DECISIONS.md и локальные docs/kit-guidance/ с ссылками на exact kit SHA. Затем отдельно провести android startup, ads, save, UI, native acceptance по [Android Ads](https://github.com/DanilaH/mini-games-kit/blob/aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0/docs/android/ADS_AND_LIFECYCLE.md) и [Android Release](https://github.com/DanilaH/mini-games-kit/blob/aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0/docs/ANDROID_RELEASE_ACCEPTANCE.md). **Будущий android-phaser bootstrap — самостоятельная работа** после сравнения не менее двух реальных Android consumers и проверки полного package lifecycle. Не добавлять недоказанную сборку.

**Существующий репозиторий:** guidance:init намеренно **не переписывает существующий AGENTS.md и docs/PROJECT_DECISIONS.md**. Если они уже существуют, выполнить безопасное дополняющее подключение:

    npm run guidance:adopt -- ../existing-game --kit-ref <exact-research-sha>

Команда **сохраняет оригинальный AGENTS.md** и добавляет короткий раздел + локальные guides; повторное применение отклоняется. Проверить diff перед коммитом. Не уничтожать source-of-truth из работающего приложения. Можно вручную copy/link только нужные docs к закреплённому SHA.

## 2. Что создаёт guidance:init, а чего не создаёт

Создаётся:
- AGENTS.md — краткие **обязательные постоянные правила** и указатели на локальный Task Router;
- docs/PROJECT_DECISIONS.md — проектные факты, baseline, kit adoption decisions, accepted reference deviations;
- docs/kit-guidance/TASK_ROUTER.md — локальная карта триггеров и research docs, чьи ссылки переписаны на **pinned commit**;
- docs/kit-guidance/REFERENCE_PROTOCOL.md — покадровый разбор gameplay/input/motion/layout/feel, если задача с референсом;
- docs/kit-guidance/KIT_FEEDBACK_LOOP.md — обратная связь с kit в финальных отчётах, не автоматический upstream;
- docs/kit-guidance/NEW_PROJECT_SETUP.md — этот контракт для новых consumers.

Не создаются: код и ассеты из чужой игры, release keys, production ad IDs, store assets, gameplay policy, общий analytics/backend, исторические копии всех научных файлов, обязательные тысячи строк test harness. Полные research docs доступны на GitHub под **проверенным pinned SHA** по ссылкам в маршрутизаторе.

**UI с первой задачи:** локальный Task Router содержит прямые pinned-ссылки на [UX & Art System](https://github.com/DanilaH/mini-games-kit/blob/aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0/docs/visual-preproduction/UX_AND_ART_SYSTEM.md), [Stable Progress UI](https://github.com/DanilaH/mini-games-kit/blob/aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0/docs/layout/STABLE_PROGRESS_UI.md) и [UI Motion Recipes](https://github.com/DanilaH/mini-games-kit/blob/aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0/docs/feel/UI_MOTION_RECIPES.md). AGENTS требует выбирать подходящий маршрут до реализации UI и проверять затронутые состояния. PROJECT_DECISIONS содержит место для профиля конкретной игры: компоненты/токены, основные действия, движение, отмена/reduced motion и осознанные исключения. Заполнять только принятые решения; существующая Art Bible может оставаться их источником. Эти документы не устанавливают новый UI runtime или общую тему.

## 3. Перед первым gameplay implementation

1. Проверить, что origin boilerplate соответствует платформе и поддерживает реальные game start/stop/save/SDK ошибки. Завести CI, минимум unit/build и хотя бы один реальный gesture/viewport smoke до релиза.
2. Из local Task Router выбрать реальную задачу: core prototype, input/UX, reference reproduction, asset production, release и т.д. Не читать каждый архивный research paper на каждый баг.
3. Открыть [Kit public API](https://github.com/DanilaH/mini-games-kit/blob/aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0/docs/API.md) закреплённого SHA и сделать явный **adoption matrix**: REUSE (импорт и тест), NOT APPLICABLE, LOCAL POLICY (почему не в kit), MISSING (доказанный недостающий контракт). Для часто нужных ресурсов смотреть storage, durable receipts, activity coordinator, audio, layout, haptics, loading/asset formatting.
4. Не копировать готовый экспорт в исходники ради удобства: использовать dependency/совместимый path, pin/upgrade review. На React/DOM/Phaser/Android распространять только подходящий runtime contract; Yandex SDK web отличается от Yandex Mobile Ads Android.
5. Зафиксировать game-specific source of truth: правила/состояния, RNG, версии сохранения, ориентации, основное действие, onboarding, платформу, эстетический выбор и ограничения.
6. Для конкретного референса открыть Reference Protocol, снять наблюдаемые transition/gestures и составить gap matrix. Для нового арт направления до массового производства — отдельный Visual Preproduction/owner approval.
7. После каждого существенного изменения сообщать KIT IMPACT: NONE / REUSE / IMPROVE / CANDIDATE / EXTRACTED. Не обещать автоматическое обновление общего репозитория без upstream PR.

## 4. Почему pin важнее «всегда самая свежая версия»

Новый проект должен иметь воспроизводимое исполнение и знание о том, какую документацию и контракт он использовал. Task Router копируется локально, но полные ссылки на research docs строятся на конкретном **guidance snapshot** kit commit, а не main. **В существующем проекте runtime dependency pin может быть старее guidance pin**: перед импортом API сверить конкретный runtime SHA в package.json/vendor и его контракт. Обновление исследовательских правил не обновляет код автоматически.

Для сравнения с **текущим** kit при рефакторинге допускается посмотреть main, но разница между pinned и new обязательно документируется. Upgrade — отдельный намеренный шаг с тестами. Нельзя ссылаться на новые API в main и тихо считать их доступными старому потребителю.

**Если доступ к pinned GitHub закрыт:** писать NOT READ / UNKNOWN, использовать уже локально собранный код/отчёты, не придумывать содержание исследования. Возможность скачать полный архив заранее для offline работы — отдельный ручной action, не обязательная дублирующая часть bootstrap.

## 5. Проверка целостности агентских инструкций

Новые проекты получают короткий CLAUDE.md-мост для Claude Code и основной AGENTS.md для Codex/Copilot. Для уже существующих репозиториев не перезаписывать чужой CLAUDE.md; если он используется, вручную связать его с AGENTS.md и локальным Task Router после review.

Команды из рабочего mini-games-kit:

    npm run guidance:doctor -- ../my-android-game --strict
    npm run guidance:doctor -- ../existing-game --expected-kit-ref <new-approved-kit-sha>

Doctor только читает файлы: наличие local router/reference/kit feedback, согласованность ссылок на точный SHA, pinned ревизии в AGENTS и видимую установленную runtime-зависимость. Флаг --json выводит JSON, --strict возвращает ошибку при нарушении обязательных инвариантов. --expected-kit-ref сообщает о возможном устаревании исследовательских материалов, но никогда не переписывает runtime/pins/проектные решения.

В `uiRoutes` doctor отдельно показывает найденные и отсутствующие прямые UI-ссылки на текущем guidance SHA. Название файла или голый URL не заменяют Markdown-маршрут. Для старого consumer отсутствие нового маршрута даёт `UI_ROUTES_MISSING` warning, не ошибку `--strict`; несовместимые SHA остаются ошибкой. `bootstrap:check` требует все три маршрута в новых init/create/adopt результатах и проверяет испорченные пути/пины. `bootstrap:smoke` проверяет маршруты перед сборкой созданного Yandex-проекта. Это проверка файлов и ссылок, не поведения модели и не доступности GitHub из её среды.

Две независимые проверки:
- File check: doctor доказывает, что необходимые документы и ссылки есть и согласованы.
- Actual harness smoke: в новой агентской сессии попросить назвать реально загруженные instructions, выбранный Task Router route и guidance SHA, а перед импортом API — отдельный runtime SHA. Doctor не доказывает, что модель прочла файлы.

По официальным документам Codex загружает AGENTS.md при старте сессии, Claude Code загружает CLAUDE.md; Copilot использует AGENTS.md и/или отдельные репозиторные инструкции в зависимости от режима. Не создавать конфликтующих копий. Источники: [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Claude](https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts), [Copilot](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions).

**Обновление текущего проекта:** новый research SHA — сигнал для отдельного review diff, не основание тихо менять pinned runtime. В существующем проекте AGENTS/PROJECT_DECISIONS могли редактироваться; команды автоматического безопасного overwrite старых инструкций нет.

Для подключения обновлённых UI-правил в уже подключённой игре:

1. Взять актуальную рабочую ветку и сохранить более свежую работу/решения владельца, включая выключенные фичи. Проверить отдельно guidance и npm/vendor runtime pins.
2. Сравнить прежние local guides с новой закреплённой ревизией. Можно создать временный guidance-only проект через `guidance:init -- <temporary-empty-dir> --kit-ref <approved-sha>` из checkout **этого же SHA**, затем перенести проверенный diff `docs/kit-guidance/`. Не запускать `guidance:adopt` повторно поверх уже установленных guides.
3. Согласованно обновить guidance SHA и ссылки, короткое UI-требование в существующем AGENTS и проектный UI-профиль там, где он нужен. Проверить, что CLAUDE-мост ссылается на AGENTS/Task Router; не дублировать в нём UI-правила. Не заменять проектные инструкции шаблоном, не менять runtime pin ради чтения документации.
4. Выполнить `guidance:doctor -- <game> --expected-kit-ref <approved-sha> --strict --json`, убедиться в отсутствии ошибок, предупреждения об устаревшем SHA и пропущенных UI-маршрутов. Проверить diff; doctor сам файлы не меняет.
5. В целевой агентской сессии применить один нужный UI-маршрут и предъявить фактическую проверку изменённого состояния. Достаточный отчёт: что применено, что уже соответствовало, осознанное исключение и кадр/запись. Установка правил сама по себе не полирует игру.

## 6. Назначение AGENTS.md и отличие платформ

У Codex, GitHub Copilot и Claude Code есть поддержка проектных инструкций, но **конкретный loader и precedence зависят от агента/harness**. Краткий repo-root AGENTS — наиболее переносимый общий минимум; в Codex инструкции автоматически читаются при старте, nested AGENTS в подпапках применяются к своим областям; у Copilot/Claude может потребоваться собственная конфигурация/проверка. Проверить реально loaded instructions на целевой среде, не обещать магическое 100% выполнение по Markdown.

Если агент регулярно игнорирует правило, добавить **автоматический тест/CI проверку**, либо специализированный навык/skill при доказанной необходимости, а не ещё абзацы в root AGENTS.

## 7. Первое техническое подтверждение готовности

**Yandex Phaser:** complete npm install, npm run typecheck, npm test, npm run build, npm run release:check, smoke input/lifecycle real/mock, hosted DRAFT только при реальной нужде. CI в kit проверяет создание проекта и его compile/test/audit.

**Android Phaser:** до начала массового контента должны пройти реальный Gradle/debug build, trusted and mocked SDK routes, Android Back/rotation/foreground, save/restoration, portrait/landscape, banner safe-area, no-fill/ads state. До release — подписанный artifact/version, disclosure, device QA и отдельно owner approval на публикацию.

**Success:** агент начинает писать настоящую механику из корректного baseline, по задаче выбирает нужные знания, не повторяет готовые SDK/contracts и своевременно замечает upstream improvement. Не количество созданных папок.
