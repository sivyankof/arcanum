# 61 · EAS Build: проект, профили сборки, первая сборка

Статус: **в работе (25.08), пауза до покупки Android-телефона** — проект и `eas.json` готовы,
первая сборка не запускалась. Заведена по release-checklist «EAS Build настроен» — первый пункт
очереди после исчерпания задач «решается кодом» (57 закрыта 25.08). Согласование пропущено как у
мелкой задачи: конфигурация < 30 строк, решений, требующих Артёма, нет.

## Цель

Сборки приложения делаются одной командой из репозитория: Android APK для проверки на
устройстве и AAB для закрытого тестирования Google Play; iOS — как только Apple одобрит
аккаунт разработчика (кейс поддержки, release-checklist).

## Что делаем

- Expo-аккаунт `art9` (регистрация через GitHub, пароль задан для CLI). Проект EAS
  `@art9/arcanum` создан `eas init --account art9 --non-interactive --force`: в `app.json`
  появляются `owner` и `extra.eas.projectId` — это привязка репозитория к проекту в облаке,
  без неё `eas build` не знает, куда класть сборку.
- `eas.json` с двумя профилями:
  - **`preview`** — `distribution: internal`, Android → **APK** (ставится на телефон файлом,
    без магазина), iOS → устройство (ad hoc, нужен Apple-аккаунт и UDID iPhone через
    `eas device:create`). Это профиль лайв-проверок на сборке — там, где Expo Go слеп
    (иконка приложения, иконка пуша Android, виджеты, покупки).
  - **`production`** — Android → **AAB** (Google Play принимает только его), `autoIncrement`
    поднимает номер сборки сам. Профиль закрытого тестирования и релиза.
  - `appVersionSource: remote` — `versionCode`/`buildNumber` живут в EAS, а не в `app.json`:
    номер растёт с каждой сборкой без коммита, `version` 1.0.0 в `app.json` остаётся ручным.
  - `cli.version >= 22.4.0` — версия, на которой конфигурация написана; более старый CLI
    откажется собирать вместо того, чтобы молча понять поля иначе.
- Первая Android-сборка `preview`: `npx eas-cli build -p android --profile preview`.
  ⚠️ **Только интерактивно и только Артёмом**: при первой сборке EAS генерирует keystore
  подписи Android и в `--non-interactive` это запрещено (`Generating a new Keystore is not
  supported in --non-interactive mode`). Keystore хранится в EAS, в репозиторий не попадает;
  последующие сборки сессия запускает сама с `--non-interactive`.

## Что НЕ делаем

- **`development`-профиль (dev client)** — требует пакет `expo-dev-client` (правка
  `package.json`), а пока в проекте нет нативных модулей вне Expo Go, он не нужен. Появится
  вместе с RevenueCat в 53б, где без него не обойтись.
- **EAS Update / `runtimeVersion`** — OTA-обновлений в v1 нет; `runtimeVersion` без
  `expo-updates` бессмыслен. Решение можно пересмотреть в v1.1.
- **`eas submit`** — нужны сервисный аккаунт Google Play и App Store Connect API key,
  их выдают одобренные аккаунты магазинов. Секция `submit.production` оставлена пустой
  как место для них.
- Глобальная установка `eas-cli` — команды идут через `npx eas-cli@latest`, чтобы не менять
  окружение машины; Артём может поставить глобально по своему желанию.

## Готово, когда

- [x] `app.json` содержит `owner: art9` и `extra.eas.projectId`; `npx expo config --type public`
  отдаёт их.
- [x] `eas.json` валиден: `npx eas-cli build:inspect`/`eas config` не ругаются на схему,
  `npx expo-doctor` по-прежнему 18/18.
- [ ] Android `preview` собрался в облаке (Артём, интерактивно — keystore), APK установлен на
  Android-телефон, приложение открывается, иконка приложения и иконка пуша — наши, не Expo Go.
- [ ] Android `production` (AAB) собрался — файл для первого закрытого теста Google Play,
  как только консоль откроет «Создать приложение».
- [ ] iOS `preview` — после одобрения Apple: `eas device:create` (UDID iPhone Артёма),
  сборка, установка по ссылке, лайв-проверка.
- [ ] release-checklist: пункт «EAS Build настроен» → `[x]`, пункт «Иконка 1024/сплэш/adaptive
  icon» подтверждён на сборке.

## План по файлам

1. `eas init` → `app.json` (`owner`, `extra.eas.projectId`) — сделано сессией.
2. `eas.json` — новый файл (выше) — сделано сессией.
3. `docs/backlog.md` — задача 61; `docs/release-checklist.md` — пункт EAS в `[~]` со ссылкой.
4. Коммит `feat: EAS Build — проект и профили сборки (spec 61)`, push.
5. Артём: первая сборка Android `preview` интерактивно; ссылка/QR на APK — в Expo dashboard
   (`expo.dev/accounts/art9/projects/arcanum/builds`).
6. Сессия: после установки APK — чек-лист «готово, когда», обновление доков.
