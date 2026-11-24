# F1 · первый приём ILRD и повтор сохранения

24 ноября 2026. Основание: [MVP cohesion, F1](../../porting/MVP_COHESION_IMPLEMENTATION_TZ_2026-11-24.md). База реализации — PR202 `c85fdc772cfcf07acd6289aa8c1519f55df38e09`, проверенный runtime до изменения — PR201 `23e71a898fd69b86b702ce074621637bcf82432e`.

**Статус этого документа:** реализован и локально проверен собственный native pipeline. Полный Android Gradle/JUnit/R8 run на итоговом commit, физический SDK и поступление в AppMetrica здесь не объявлены выполненными. CI-ссылку и идентичность итогового APK нужно приложить после реального прогона общей сборки.

## Исправленная граница

В PR201 `Session.impressed` выставлялся до первой записи в `RevenueOutbox`. При I/O failure событие не сохранялось, а повтор SDK callback отбрасывался. Надёжный retry уже принятой outbox не мог восстановить отсутствующее событие.

Теперь `RevenueDelivery.receive(id, payload)` принимает исходный нормализованный payload в ограниченный процессный intake: максимум64 события, до4096 символов payload и128 символов ID. Он не ждёт диск или AppMetrica на SDK callback. Результаты `CAPTURED`/`DUPLICATE_PENDING` означают владение событием **в памяти**, `INTAKE_FULL`/`INVALID` — диагностированный отказ. Они не являются durable receipt, earned или серверным подтверждением.

Один worker выполняет первую запись и повторы с задержками1,2,4,8,16,32,60секунд, затем не более одного повтора в60секунд. Исходные deliveryId/сумма/валюта/format/placement не меняются. При `QUEUED`/`DUPLICATE` intake удаляет запись и передаёт ответственность существующей `RevenueOutbox`; при full durable queue отказ считается отдельно. Существующие256 pending/1024 forwarded, AtomicFile, SDK retry и защита ACK в том же процессе сохранены.

`SolitaireAdsPlugin` хранит отдельный результат memory capture вместо ложного durable-флага. Banner использует тот же capture path. Worker не держит Session, Activity, View или JS callback. Он сохраняет intake даже до включения analytics; SDK handoff остаётся разрешён только после включения analytics. Runtime/SDK release-флаги, рекламные квоты и rewarded receipts не менялись.

## Диагностика

Native `status().revenueProcess` содержит только процессные числовые counters: `intakePending`, `intakeErrors`, `intakeDropped`, `queueDropped`, `durableAccepted`, `durableDuplicates`. Они сбрасываются при новом процессе и не заменяют persisted outbox. Ошибки/full дополнительно попадают в `SolitaireRevenue` log без payload, user IDs или суммы. Необязательный diagnostic sink не может блокировать capture/delivery.

Фаза `revenue_intake_pending` означает ожидание первой durable записи; она не выдаёт награду и не считается денежным доходом. TS `AdEvent.phase` уже строковый, а native status допускает дополнительные поля; изменение JS bridge или analytics schema для этих диагностических данных не требуется.

## Выполненная локальная проверка

Java21.0.13, `jdk.compiler`. Исполнены реальные production `RevenueOutbox`/`RevenueDelivery` и настоящие методы `RevenueOutboxTest`/`RevenueDeliveryTest`: **14 методов прошли**, включая3 прежних и11 новых. Использованы явные Android/provider stubs и assertion-compatible harness; это **не результат Gradle `testDebugUnitTest`**.

Покрытые случаи:

- первый write failure → storage восстановлен → retry без повторного SDK callback;
- duplicate до/после приёма, сохранение первого payload, ambiguous first write;
- сохранение без готовой analytics и отправка durable pending новым экземпляром;
- bounded memory intake, full durable queue и диагностика отказа;
- постоянный storage failure с ограниченным backoff и без ложного durable success;
- исключение SDK, ACK-write failure без второго send в том же процессе;
- новый capture во время drain; ошибка diagnostic sink;
- честная невосстанавливаемость memory-only события после process death.

Отдельная source-anchored проверка исполнила извлечённые **неизменённые тела** `impression`/`recordImpression` из текущего plugin: первый callback → first write failure → Session уничтожена → storage восстановлен → один handoff с теми же ID/micros/currency/placement. JSON parsing и Android/provider в этой узкой проверке заменены controlled fixtures. Это проверка собственной реализации, не ORIGINAL_RUNTIME/NATIVE_ISOLATED сторонней игры.

`git diff --check -- native` прошёл. Во время этой проверки общие web build/dist и runtime flags не менялись.

### Provenance проверенного кода

SHA-256 относится к содержимому файлов реализации до итогового общего commit:

| Файл | SHA-256 |
| --- | --- |
| `RevenueDelivery.java` | `084b73d2d279350b19402a55421950e72c4164380690325778285076c9d11b98` |
| `SolitaireAdsPlugin.java` | `5d6f8e5059e00c762837093f515b5eb067d9cbed3eac33d4f0341b2eae5a092f` |
| `RevenueDeliveryTest.java` | `23996526d7d662dfc064e44f2e58b0aa276e2a736e43a98a7a6756a7400d4712` |
| Неизменённый `RevenueOutbox.java` | `fa7588622d48e8b2295014c541caaf1b57b6c0489b6d54ae3519d2355794fd67` |
| Неизменённый `RevenueOutboxTest.java` | `313adcfce50f4e1dca9c4bdd2ac15250c47a9a8d14b7d0769c3bbdc0c17c249f` |

## Воспроизводимая приёмка в Android build environment

Требуются полный JDK21, Android SDK36/build-tools36.0.0, Gradle wrapper8.14.3 и подготовленные Capacitor projects. После `android:sync` на отдельном/финальном candidate выполнить из корня:

```sh
ASOC_AD_MODE=test native/android/gradlew -p native/android --no-daemon testDebugUnitTest --tests 'com.danilah.asocsolitair.RevenueDeliveryTest' --tests 'com.danilah.asocsolitair.RevenueOutboxTest'
```

Общий PR workflow уже вызывает `testDebugUnitTest assembleDebug` и затем R8 `assembleRelease` с SDK disabled. Сохранить XML/HTML native test results, логи, APK manifests/hashes и fingerprint принятой debug identity. Тестовый APK не включает live ILRD; он подтверждает compilation/обычный тестовый advertising path, а не настоящую отправку денежного события.

В локальной среде реализации отсутствовали полный SDK, `android.jar`, `sdkmanager`, `adb` и Gradle wrapper distribution. Частичные Gradle caches и наличие Java compiler module не объявляются рабочей Android-средой. Новые SDK/зависимости ради локального отчёта не устанавливались.

## Оставшиеся физические и внешние проверки

На разрешённом live candidate: фактический SDK impression, фон/закрытие Activity, новый процесс с уже durable pending, то же ID/amount/currency/placement в разрешённой выгрузке. Отдельно проверить дедупликацию денежного агрегата по `deliveryId`; само наличие этого поля не делает `reportEvent` идемпотентным на сервере.

**Пределы:** memory capture асинхронен и может быть потерян при process death до первой успешной записи. Постоянный storage failure/полная очередь диагностируются, но не дают бесконечной памяти или fake forwarded. Успешный AppMetrica call означает SDK handoff. После crash между handoff и локальным ACK возможен повтор с тем же ID; server exactly-once и выплата рекламной сетью этим кодом не доказаны.

**KIT IMPACT: REUSE.** Runtime kit и source inventory не менялись. Это собственный consumer native reliability fix; vendor source/assets не добавлены.
