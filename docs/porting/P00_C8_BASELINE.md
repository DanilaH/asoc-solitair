# P00 · интеграционная база Content8

Приёмочная база — [PR #86](https://github.com/DanilaH/asoc-solitair/pull/86), `ba445805568d22fa62fff5b3527fb97fe5eb7f71`. В этой ревизии проверено предковство #68 → #70 → #71 → #72 → #75 → #76 → #77 → #78 → #79 → #81 → #82 → #83 → #85 → #86. `main` остаётся на C7.

## Что вошло в базу

- Отчёт и машинная проверка доступности трансферов #67, 28 проверенных веток #69 и оба независимых метода разбора альтернатив #74/#75 сохранены в потомках #72/#78. Q2-лаунчер [#73](https://github.com/DanilaH/asoc-solitair/pull/73) имеет отдельный Android package ID и отдельные сохранения.
- `git diff b15c075 ba44580 -- src native index.html package-lock.json capacitor.config.ts` пустой. Сохраняются Rules v1/v2/v3, C1–C8 Deal IDs, прежние активные и припаркованные партии, Undo, 28 ежедневных раздач, журнал заработанных наград, balance3 и kit `a9325265e87583a4872cf6a158e1e881a0d7508e`.
- Реестр сверили с закреплённым mini-games-kit `a5c246d9935474d7fe662da95fb657c61c245c0a`, blob `72efdad46077213e1ce68475b004544fe9dfec75`. В очереди 38 пакетов, 114/114 ID на дорожной карте, 0 исключённых. P00 не меняет статусы исходных механик.

## Доказательства

- [CI #44925229086](https://github.com/DanilaH/asoc-solitair/actions/runs/44925229086) на `ba44580`. Успешны Web, C8 touch Playwright и Android в режиме `VITE_CONTENT8_PREVIEW=1`. Локально пройдены проверка реестра и очереди, 48 инфраструктурных тестов и `npm run check` (287 unit-тестов и сборка).
- [APK из CI](https://github.com/DanilaH/asoc-solitair/actions/runs/44925229086/artifacts/14714998236) — `com.danilah.asocsolitair.debug`, 0.20.3 (44), `AD_MODE=test`, SHA-256 APK `eb50765858f9fa47727f32f4fb413d40eefac4331bd96595d97d163914ee3106`. Подпись проверена `apksigner`, SHA-256 сертификата `0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e`. Все 210 веб-файлов побайтово совпали с обычным C8 APK [#68](https://github.com/DanilaH/asoc-solitair/actions/runs/44797333679/artifacts/14658629738), два Cordova shim-файла пусты.
- Этот PR фиксирует эквивалентную базу по [ТЗ P00](specs/00_FOUNDATION_QA.md). Меняются документы приёмки. Физический Android, реальные колбэки SDK и плейтест идут по P02. Поведение оригиналов на устройстве остаётся за P36.
