# Выпуск 1.0.1 для Google Play — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** выпустить в Google Play версию 1.0.1 с фоновой музыкой, темой «Как в системе», строкой «Оценить приложение» и сжатием кода (R8).

**Architecture:** музыка — один плеер на приложение в `src/lib/music.ts` (единственный импорт `expo-audio`, ленивая загрузка, веб-заглушка рядом), решения «играть или нет» и громкость затухания — чистые функции `musicLogic.ts`, связывает их корневой хук `useBackgroundMusic`. Тема: сырой режим `ThemeMode` из стора разрешается в `ResolvedMode` одной чистой функцией, все экраны по-прежнему читают `t.mode`. R8 — отдельный последний коммит, откатываемый без остального.

**Tech Stack:** Expo SDK 54 (не обновлять), expo-router 6, zustand/persist, react-i18next, jest-expo, `expo-audio`, `expo-build-properties`, Python 3.10+ с `numpy` и `ffmpeg` (скрипт трека), Playwright из кэша npx (веб-проверка), EAS Build.

**Spec:** `docs/specs/74-release-1-0-1.md` — читать целиком перед любой задачей; решения 1–12 оттуда обязательны.

## Global Constraints

- SDK 54 не обновлять; новые пакеты — только `npx expo install <пакет>` (подбирает версию под SDK).
- Комментарии в коде и сообщения коммитов — по-русски; в коммитах и коде не упоминать ИИ, трейлеры `Co-Authored-By` не добавлять.
- После каждого шага с кодом — `npx tsc --noEmit` без ошибок; перед каждым коммитом — `npm test` зелёный.
- Стейджить поимённо (`git add <путь>`), не `-A`. Ветка `feat/74-release-1-0-1`.
- Цвета — только из `src/theme/theme.ts`; новые строки UI — сразу на 4 языках (ru/en/es/pt) в `src/lib/i18n.ts`; es/pt этой задачи — черновик (дописать в периметр задачи 68 в `docs/backlog.md`).
- Экран меняется → `docs/design-reference.html` правится в том же коммите.
- `SCHEMA_VERSION` 12 → **13** (ровно один подъём, его делает задача 2).
- Каждый новый тест сначала красный: мутацией кода или запуском до реализации.
- Команда тестов: `npx jest <путь>`; полный прогон — `npm test`.
- PowerShell не трогает файлы с кириллицей; правки — Edit или python.
- Точные значения спеки: нарастание **2500 мс**, затухание **400 мс**, стартовая громкость **0.25**, петля **128 с**, иконка кнопки **22 px**, зона нажатия **44×44**.

## Review Focus

1. **Частые нажатия кнопки звука** (5 раз за секунду) — затухания не накладываются, итог равен последнему нажатию. Тест — задача 4, шаг 3 (`music.test.ts`, «быстрая череда»).
2. **Звуковой модуль недоступен** (Expo Go без модуля, ошибка загрузки файла) — приложение не падает, переключатели работают. Тест — задача 4, шаг 3 («модуль бросает при загрузке»).
3. **Уход в фон посреди нарастания** — пауза, и «протухший» таймер не включает звук обратно. Тест — задача 4, шаг 3 («стоп на первой секунде»).
4. **Старое сохранённое состояние версии 12** (без `musicOn`, тема `light`) — поднимается, музыка включена, тема не сбилась. Тест — задача 2, шаг 1 (`useApp.test.ts`).
5. **Телефон сменил тему, а в приложении выбрана не «система»** — тема приложения не меняется; выбрана «система» и телефон не сообщил тему (`null`) — тёмная. Тест — задача 6, шаг 1 (`resolveMode`), живое переключение — задача 9.

---

### Task 0: Ветка

- [ ] **Step 1:** `git checkout -b feat/74-release-1-0-1` от свежего `main`; `npm test` — запомнить число тестов и сьютов (понадобится в задаче 12 для AGENTS.md).

### Task 1: Трек — скрипт, файл, контракт

**Files:**
- Create: `scripts/gen_ambient.py`, `assets/audio/ambient.m4a`, `src/lib/__tests__/ambientAsset.test.ts`
- Modify: `AGENTS.md` (раздел «Контент-конвейер», новый пункт про скрипт)
- Источник: `.superpowers/sdd/74-release-1-0-1/ambient-spike/make_ambient3.py` (вне git; прототип, из которого получен выбранный вариант 7)

**Interfaces:**
- Produces: файл `assets/audio/ambient.m4a` (AAC, стерео, 44100 Гц, одна петля 128 с).

- [ ] **Step 1: Тест-контракт (красный — файла ещё нет).** `ambientAsset.test.ts`: файл `assets/audio/ambient.m4a` существует; размер от 0.5 до 4 МБ; байты 4–8 равны `ftyp` (контейнер MP4).
- [ ] **Step 2:** `npx jest src/lib/__tests__/ambientAsset.test.ts` → FAIL (ENOENT).
- [ ] **Step 3: `scripts/gen_ambient.py`.** Перенести из прототипа всё, что нужно варианту 7: последовательность `NIGHT`, `build(NIGHT, 8, bells=True)`, остальные варианты и последовательность `WARM` удалить. Отличия от прототипа:
  - запуск из корня без аргументов; пишет ОДНУ петлю (прототип писал две подряд) во временный WAV, затем `ffmpeg -y -i <wav> -c:a aac -b:a 128k -movflags +faststart assets/audio/ambient.m4a`, WAV удаляет;
  - флаг `--dip`: перед записью умножить сигнал на огибающую, опускающую громкость до нуля к стыку — `cos²` на последних 0.6 с и зеркально на первых 0.6 с (план Б спеки);
  - самопроверка после записи, при провале — код 1 и удаление m4a: без `--dip` скачок на стыке (первый против последнего отсчёта) ≤ наибольшего шага между соседними отсчётами; длительность m4a по `ffprobe` 128 ± 0.1 с; размер 0.5–4 МБ;
  - нет `numpy` или `ffmpeg` — понятное сообщение и код 1;
  - печатает «шов X, наибольший шаг Y, размер Z МБ». **Сверка с прототипом:** без `--dip` обязано напечатать шов `0.00245` и шаг `0.02309` — те же числа, что дал вариант 7; другие числа значат, что перенос изменил звук.
- [ ] **Step 4:** `python scripts/gen_ambient.py` → файл записан, числа совпали; `npx jest src/lib/__tests__/ambientAsset.test.ts` → PASS. Проверить на Python 3.10, если он есть на машине (`py -3.10`); нет — записать в отчёт задачи «на 3.10 не проверено».
- [ ] **Step 5: AGENTS.md** — пункт о скрипте по образцу `gen_notification_icon.py`: что делает, зависимости (`pip install numpy`, `ffmpeg` в PATH), самопроверка, флаг `--dip`, «файл руками не править».
- [ ] **Step 6: Commit** — `feat: фоновый эмбиент — скрипт и звуковой файл (spec 74)`: `scripts/gen_ambient.py`, `assets/audio/ambient.m4a`, тест, `AGENTS.md`.

### Task 2: Поле `settings.musicOn`, схема 13

**Files:**
- Modify: `src/lib/settings.ts`, `src/lib/backup.ts`, `src/store/useApp.ts`
- Test: `src/lib/__tests__/settings.test.ts`, `src/lib/__tests__/backup.test.ts`, `src/store/__tests__/useApp.test.ts`

**Interfaces:**
- Produces: `AppSettings.musicOn: boolean` (дефолт `true`); экшен стора `setMusicOn(on: boolean): void`; `SCHEMA_VERSION === 13`.

- [ ] **Step 1: Тесты.**
  - `settings.test.ts`: в существующий `toEqual` (объект из пяти ключей) добавить `musicOn: true`; новый тест «выключенная музыка не затирается дефолтом»: `mergeSettings({ musicOn: false }).musicOn === false`.
  - `backup.test.ts`: в `toEqual` настроек (~стр. 130) добавить `musicOn: true`; блок версии переименовать в «SCHEMA_VERSION 13…» и ждать `13`; новые тесты: файл версии 12 без `musicOn` принимается и получает `musicOn: true`; `settings.musicOn = 'да'` → `{ ok: false, error: 'corrupt' }`.
  - `useApp.test.ts`: версия `13`; новый тест по образцу соседнего с `rehydrate`: сохранённое состояние `version: 12` с `settings` из пяти старых ключей и `themeMode: 'light'` → после `rehydrate()` `settings.musicOn === true` и `themeMode === 'light'`; тест экшена: `setMusicOn(false)` → `settings.musicOn === false`, остальные ключи `settings` не изменились.
- [ ] **Step 2:** прогнать три файла → FAIL.
- [ ] **Step 3: Реализация.** `settings.ts`: поле в `AppSettings` и `DEFAULT_SETTINGS`. `backup.ts`: `SCHEMA_VERSION = 13`, `isBool(v.musicOn)` в `isSettings`, строка в лесенке версий («v12 → v13: settings.musicOn, спека 74»). `useApp.ts`: `setMusicOn` в типе и реализации по образцу `setReflectionOn`, строка в лесенке версий у `migrate` (сам `migrate` менять не нужно — `mergeSettings` уже там).
- [ ] **Step 4:** три файла → PASS; `npx tsc --noEmit`; `npm test`.
- [ ] **Step 5: Мутация.** Убрать `musicOn` из `DEFAULT_SETTINGS` → красные тесты `settings` и `useApp`; вернуть.
- [ ] **Step 6: Commit** — `feat: настройка фоновой музыки в сторе, схема 13 (spec 74)`.

### Task 3: Чистая логика музыки

**Files:**
- Create: `src/lib/musicLogic.ts`, `src/lib/__tests__/musicLogic.test.ts`

**Interfaces:**
- Produces:
  - `MUSIC_VOLUME = 0.25`, `FADE_IN_MS = 2500`, `FADE_OUT_MS = 400`, `FADE_STEP_MS = 50`
  - `shouldPlay(s: { hydrated: boolean; onboarded: boolean; musicOn: boolean; inBackground: boolean }): boolean`
  - `nextInBackground(prev: boolean, state: string): boolean`
  - `fadeVolume(from: number, to: number, elapsedMs: number, durationMs: number): number`

- [ ] **Step 1: Тесты.**
  - `shouldPlay`: `true` только при `{ hydrated: true, onboarded: true, musicOn: true, inBackground: false }`; четыре случая, где перевёрнут ровно один признак, — `false`.
  - `nextInBackground`: `(false, 'background') → true`; `(true, 'active') → false`; `(false, 'inactive') → false`; `(true, 'inactive') → true` (решение 10: `inactive` ничего не меняет).
  - `fadeVolume`: `(0, 0.25, 0, 2500) → 0`; `(0, 0.25, 1250, 2500) → 0.125`; `(0, 0.25, 2500, 2500) → 0.25`; `(0, 0.25, 9999, 2500) → 0.25`; `(0.25, 0, 200, 400) → 0.125`; `(0.1, 0.25, -5, 2500) → 0.1`; `(0, 0.25, 0, 0) → 0.25`.
- [ ] **Step 2:** FAIL (модуля нет). **Step 3:** реализация (линейно, зажим по краям). **Step 4:** PASS, `tsc`.
- [ ] **Step 5: Commit** — `feat: логика фоновой музыки — когда играть и как затухать (spec 74)`.

### Task 4: Плеер, хук, пакет, разрешения

**Files:**
- Create: `src/lib/music.ts`, `src/lib/music.web.ts`, `src/lib/useBackgroundMusic.ts`, `src/lib/__tests__/music.test.ts`
- Modify: `app/_layout.tsx` (рядом с `usePremiumSync()`), `app.json`, `package.json`/`package-lock.json` (через `npx expo install`), `src/lib/__tests__/androidPermissions.test.ts`, `src/lib/__tests__/ambientAsset.test.ts`, `CLAUDE.md` (список общих модулей), `AGENTS.md`

**Interfaces:**
- Consumes: всё из задачи 3; `useApp` (`settings.musicOn`, `profile.onboarded`); файл задачи 1.
- Produces: `startMusic(): void`, `stopMusic(): void` (в `music.ts` и `music.web.ts` одинаково); `useBackgroundMusic(hydrated: boolean): void`.

- [ ] **Step 1: Пакет и сверка с типами.** `npx expo install expo-audio`. Прочитать в `node_modules/expo-audio`: (а) типы `AudioMode` — есть ли `playsInSilentMode`, `interruptionMode` со значением `'mixWithOthers'`, `shouldPlayInBackground`; (б) есть ли вызов, сообщающий, что играет другое приложение (греп `other` по `build/*.d.ts`) — найдётся: остановиться и сообщить контроллеру, это меняет спеку; (в) параметры конфиг-плагина (`plugin/build`); (г) `android/src/main/AndroidManifest.xml` — какие разрешения и службы объявлены. Результат четырёх пунктов — в отчёт задачи.
- [ ] **Step 2: `app.json`.** Плагин `expo-audio` с выключенными записью и фоновым воспроизведением (имена параметров — из пункта «в»). В `android.blockedPermissions` добавить `android.permission.RECORD_AUDIO` и каждое разрешение из манифеста пакета, относящееся к записи или фоновой службе (`FOREGROUND_SERVICE*`), — список из пункта «г». В `androidPermissions.test.ts` — тест: `blockedPermissions` содержит `android.permission.RECORD_AUDIO` и прежний `ACTIVITY_RECOGNITION`.
- [ ] **Step 3: Тесты плеера** (`music.test.ts`, `jest.useFakeTimers()`, `jest.mock('expo-audio', …)` с поддельным плеером `{ volume, loop, play: jest.fn(), pause: jest.fn() }` и `setAudioModeAsync: jest.fn(() => Promise.resolve())`; модуль `music` загружать через `jest.isolateModules`, чтобы у каждого теста был свой плеер):
  - «старт»: `startMusic()` → `play` вызван, `loop === true`, громкость в момент старта `0`; после `advanceTimersByTime(2500)` громкость `0.25` (`toBeCloseTo`).
  - «стоп»: после полного старта `stopMusic()` + 400 мс → громкость `0`, `pause` вызван один раз.
  - «стоп на первой секунде» (Review Focus 3): `startMusic()`, 1000 мс, `stopMusic()`, 5000 мс → `pause` вызван, громкость `0`, `play` вызван ровно один раз.
  - «быстрая череда» (Review Focus 1): `start, stop, start, stop, start` без пауз, затем 5000 мс → громкость `0.25`, после последнего `start` вызовов `pause` нет.
  - «режим звука»: `setAudioModeAsync` вызван с `{ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }`, причём один раз за несколько стартов.
  - «модуль бросает при загрузке» (Review Focus 2): фабрика мока бросает → `startMusic()` и `stopMusic()` не бросают.
- [ ] **Step 4:** FAIL. Если jest не может разрешить `require` файла `.m4a` — посмотреть, как пресет `jest-expo` обрабатывает картинки (`assetFileTransformer`), и добавить расширение тем же способом; мок самого файла в тесте не писать.
- [ ] **Step 5: `music.ts`.** Единственный файл проекта с `expo-audio`. `expo-audio` и звуковой файл подключаются лениво (`require` внутри функции, в `try/catch`): модуль недоступен → флаг «звука нет», обе функции молча выходят. Плеер один на модуль, создаётся при первом `startMusic`. Затухание — `setInterval` с шагом `FADE_STEP_MS`, значение через `fadeVolume` от ТЕКУЩЕЙ громкости плеера; каждый новый вызов `startMusic`/`stopMusic` отменяет предыдущий интервал. `stopMusic` по окончании затухания зовёт `pause()`. Позицию не сбрасывать (после паузы музыка продолжается с того же места).
- [ ] **Step 6: `music.web.ts`** — те же два экспорта, пустые тела, без импортов.
- [ ] **Step 7: `useBackgroundMusic(hydrated)`.** Состояние `inBackground` (старт — `AppState.currentState === 'background'`), подписка `AppState.addEventListener('change', …)` через `nextInBackground`; `musicOn` и `onboarded` — селекторами стора (булевы значения, не объекты). Эффект по `shouldPlay(...)`: `true` → `startMusic()`, `false` → `stopMusic()`. В `app/_layout.tsx` вызвать сразу после `usePremiumSync()`, передав тот же признак гидрации, по которому layout решает показывать приложение.
- [ ] **Step 8: Контракты.** В `ambientAsset.test.ts` — `src/lib/music.ts` содержит строку `assets/audio/ambient.m4a`. В `androidPermissions.test.ts` (там уже есть обход исходников `sources()`) — `expo-audio` встречается ровно в одном файле вне тестов: `src/lib/music.ts`.
- [ ] **Step 9:** все тесты PASS; `tsc`; `npm test`. **Мутации:** убрать отмену предыдущего интервала → красный «быстрая череда»; `loop = false` → красный «старт».
- [ ] **Step 10: Доки.** `CLAUDE.md` → «Общие модули»: `music`/`music.web`, `musicLogic`, `useBackgroundMusic`. `AGENTS.md` → строка в «Архитектура» о музыке (один плеер, единственный импорт, веб-заглушка).
- [ ] **Step 11: Commit** — `feat: фоновая музыка — плеер, хук, разрешения (spec 74)`.

### Task 5: Интерфейс музыки

**Files:**
- Create: `src/components/MusicToggle.tsx`
- Modify: `src/components/ScreenHeader.tsx`, `app/(tabs)/index.tsx`, `app/settings.tsx`, `src/lib/i18n.ts`, `docs/design-reference.html`, `docs/design-system.md`, `CLAUDE.md` (список компонентов)

**Interfaces:**
- Consumes: `settings.musicOn`, `setMusicOn` (задача 2).
- Produces: `<MusicToggle />` (без пропсов, `testID="music-toggle"`); проп `right?: React.ReactNode` у `ScreenHeader`; ключ `settings.music`; у строки настроек `testID="settings-music"` (если `SettingsRow` не принимает `testID` — добавить необязательный проп).

- [ ] **Step 1: Строки** `settings.music`: ru «Фоновая музыка», en «Background music», es «Música de fondo», pt «Música de fundo». Прогнать существующие i18n-контракты (`npx jest src/lib/__tests__/i18n`) → PASS.
- [ ] **Step 2: `ScreenHeader`.** Проп `right`. Оверлайн и заголовок обернуть в `View` с `position: 'relative'`; `right` — в абсолютном контейнере `right: 0, bottom: 0, height: 36, justifyContent: 'center'` (строка заголовка), чтобы центровка текста не сдвигалась. Без `right` вёрстка побайтово прежняя (`app/daily.tsx` не трогать).
- [ ] **Step 3: `MusicToggle`.** `PressableScale` + Ionicons: `volume-medium-outline` цветом `t.accent` при `musicOn`, `volume-mute-outline` цветом `t.muted` иначе; размер 22; `hitSlop` до зоны 44×44; `hapticTap()`; `accessibilityRole="switch"`, `accessibilityState={{ checked: musicOn }}`, `accessibilityLabel={tr('settings.music')}`. Нажатие — `setMusicOn(!musicOn)`.
- [ ] **Step 4:** `app/(tabs)/index.tsx` — `<ScreenHeader … right={<MusicToggle />} />`.
- [ ] **Step 5: Настройки.** В блоке `FadeUp index={1}` сразу после строки языка: `SettingsRow icon="musical-notes-outline" label={tr('settings.music')} value={musicOn ? tr('settings.on') : tr('settings.off')} onPress={() => setMusicOn(!musicOn)}`.
- [ ] **Step 6: Макет и дизайн-система.** `design-reference.html`: значок звука в шапке «Учёбы» (найти экран по заголовку) и строка «Фоновая музыка · Вкл» в `#v-settings` после языка. `design-system.md`: кнопка-иконка в шапке (22 px, зона 44×44, цвета accent/muted, положение — правый край строки заголовка).
- [ ] **Step 7:** `tsc`, `npm test`. Быстрый взгляд в вебе (`npx expo start --web --clear`): кнопка на месте в обеих темах, заголовок по центру.
- [ ] **Step 8: Commit** — `feat: кнопка звука на «Учёбе» и строка музыки в настройках (spec 74)`.

### Task 6: Тема «Как в системе»

**Files:**
- Create: `src/theme/resolveMode.ts`, `src/lib/__tests__/resolveMode.test.ts`
- Modify: `src/theme/theme.ts`, `src/theme/useTheme.ts`, `src/lib/backup.ts`, `app/settings.tsx`, `src/lib/i18n.ts`, `src/lib/__tests__/backup.test.ts`, `docs/design-reference.html`, всё, на что укажет `tsc` (ожидается `src/components/CardBackSurface.tsx` — запись, индексируемая режимом)

**Interfaces:**
- Produces (в `theme.ts`): `THEME_MODES = ['dark', 'light', 'system'] as const`; `type ThemeMode = (typeof THEME_MODES)[number]`; `type ResolvedMode = 'dark' | 'light'`; `Theme.mode: ResolvedMode`.
- Produces (в `resolveMode.ts`, без импортов react-native): `resolveMode(mode: ThemeMode, scheme: string | null | undefined): ResolvedMode`; `THEME_LABEL_KEY: Record<ThemeMode, string>` = `{ dark: 'settings.dark', light: 'settings.light', system: 'settings.system' }`; `THEME_ICON: Record<ThemeMode, string>` = `{ dark: 'moon', light: 'sunny', system: 'contrast-outline' }`.

- [ ] **Step 1: Тесты.**
  - `resolveMode.test.ts`: `('dark', 'light') → 'dark'`; `('light', 'dark') → 'light'` (Review Focus 5: выбранная тема не слушает телефон); `('system', 'dark') → 'dark'`; `('system', 'light') → 'light'`; `('system', null) → 'dark'`; `('system', undefined) → 'dark'`; `THEME_MODES` равен `['dark', 'light', 'system']`; у `THEME_LABEL_KEY` и `THEME_ICON` ключи совпадают с `THEME_MODES`.
  - `backup.test.ts`: `themeMode: 'system'` → `ok: true`; прежний отрицательный `'blue'` остаётся.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Типы и разрешение.** `theme.ts` — как в Interfaces. `useTheme()` — `resolveMode(mode, useColorScheme())`, тема по результату. `backup.ts` `validState` — `THEME_MODES.includes(...)` вместо пары литералов. Пройти все ошибки `tsc`: записи и сравнения, которым нужен разрешённый режим, типизировать `ResolvedMode`.
- [ ] **Step 4: Настройки.** Строка темы: `icon={THEME_ICON[themeMode]}`, `value={tr(THEME_LABEL_KEY[themeMode])}`, нажатие открывает `OptionPicker` (образец — выбор языка рядом: локальное состояние `themePicker`, `options={THEME_MODES.map(…)}`, `onPick={setThemeMode}`). Текст письма обратной связи (поле `theme`) — `tr(THEME_LABEL_KEY[themeMode])`. Греп по проекту: `themeMode ===` вне `resolveMode.ts` не остаётся.
- [ ] **Step 5: Строки** `settings.system`: ru «Как в системе», en «System», es «Como el sistema», pt «Como o sistema».
- [ ] **Step 6: Макет** — в `#v-settings` строка «Тема» остаётся, рядом (по образцу того, как в макете показан выбор языка; если пикера языка в макете нет — комментарием у строки) три пункта: Тёмная / Светлая / Как в системе.
- [ ] **Step 7:** тесты PASS, `tsc`, `npm test`. **Мутация:** `resolveMode` возвращает `'light'` при `null` → красный.
- [ ] **Step 8: Commit** — `feat: тема «Как в системе» (spec 74, задача 70)`.

### Task 7: «Оценить приложение»

**Files:**
- Modify: `src/lib/appInfo.ts`, `app/settings.tsx`, `src/lib/i18n.ts`, `docs/design-reference.html`
- Create: `src/lib/__tests__/appInfo.test.ts`

**Interfaces:**
- Produces: `ANDROID_PACKAGE = 'app.arcanum.tarot'`; `IOS_APP_ID = '6805994267'`; `IOS_PUBLISHED = false`; `rateUrlFor(os: string, iosPublished?: boolean): string | null`; `RATE_URL: string | null` (от `Platform.OS`); `RATE_WEB_URL = 'https://play.google.com/store/apps/details?id=app.arcanum.tarot'`.

- [ ] **Step 1: Тесты** (`appInfo.test.ts`): `rateUrlFor('android') === 'market://details?id=app.arcanum.tarot'`; `rateUrlFor('ios', false) === null`; `rateUrlFor('ios', true) === 'itms-apps://itunes.apple.com/app/viewContentsUserReviews/id6805994267?action=write-review'`; `rateUrlFor('web') === null`; `ANDROID_PACKAGE` равен `android.package` из `app.json`; `IOS_APP_ID` равен `submit.production.ios.ascAppId` из `eas.json`.
- [ ] **Step 2:** FAIL. **Step 3:** реализация. **Step 4:** PASS.
- [ ] **Step 5: Настройки.** Сразу после строки «О приложении», только при `RATE_URL !== null`: `SettingsRow icon="star-outline" label={tr('settings.rate')} value=""`; нажатие — `Linking.openURL(RATE_URL).catch(() => Linking.openURL(RATE_WEB_URL))`.
- [ ] **Step 6: Строки** `settings.rate`: ru «Оценить приложение», en «Rate the app», es «Valorar la app», pt «Avaliar o app». **Макет:** строка после «О приложении».
- [ ] **Step 7:** `tsc`, `npm test`. **Step 8: Commit** — `feat: строка «Оценить приложение» в настройках (spec 74, задача 71)`.

### Task 8: Версия 1.0.1 и «Что нового»

**Files:**
- Modify: `app.json` (`expo.version`), `package.json` и `package-lock.json` (`npm version 1.0.1 --no-git-tag-version`), `docs/store-listing.md`, `src/lib/__tests__/storeListing.test.ts`, `docs/backlog.md` (периметр задачи 68: новые es/pt строки `settings.music`/`system`/`rate` и «что нового 1.0.1»)

- [ ] **Step 1: Тест.** В `storeListing.test.ts` — для каждого из четырёх языков есть блок с заголовком `### <lang> · что нового 1.0.1 (500)` и его текст ≤ 500 знаков Unicode (посмотреть, как тест разбирает существующие заголовки с лимитом в скобках, и переиспользовать тот же разбор — `scripts/lib/storeListing.js`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Тексты** в `docs/store-listing.md`, по блоку после существующего «что нового» каждого языка:
  - ru: `Что нового в 1.0.1:` / `• Фоновая музыка — тихий эмбиент. Включается и выключается кнопкой на главном экране или в настройках.` / `• Тема «Как в системе» — приложение следует тёмной или светлой теме телефона.` / `• Кнопка «Оценить приложение» в настройках.`
  - en: `What's new in 1.0.1:` / `• Background music — a quiet ambient track. Turn it on or off with the button on the home screen or in Settings.` / `• "System" theme — the app follows your phone's dark or light mode.` / `• "Rate the app" button in Settings.`
  - es: `Novedades de la versión 1.0.1:` / `• Música de fondo: un ambiente suave. Se activa y desactiva con el botón de la pantalla principal o en Ajustes.` / `• Tema «Como el sistema»: la app sigue el modo oscuro o claro del teléfono.` / `• Botón «Valorar la app» en Ajustes.` (черновик)
  - pt: `Novidades da versão 1.0.1:` / `• Música de fundo: um ambiente suave. Ligue ou desligue pelo botão na tela inicial ou em Configurações.` / `• Tema "Como o sistema": o app segue o modo escuro ou claro do celular.` / `• Botão "Avaliar o app" em Configurações.` (черновик)
  - ⚠️ Названия разделов («Ajustes», «Configurações») сверить с тем, как настройки названы в `i18n.ts` на этих языках, и привести к ним.
- [ ] **Step 4:** PASS. Версии: `app.json` → `1.0.1`, `npm version 1.0.1 --no-git-tag-version`. `tsc`, `npm test`.
- [ ] **Step 5: Commit** — `chore: версия 1.0.1, «Что нового» на четырёх языках (spec 74)`.

### Task 9: Веб-проверка 6а/6б

**Files:**
- Create: `scripts/check_74_web.js`, `scripts/shoot_74.js`, `docs/screenshots/74/*`
- Образцы: `scripts/check_72_web.js`, `scripts/shoot_56.js`, общий сид `scripts/lib/seed72.js`; рецепт запуска Playwright и правила сида — `AGENTS.md`, «Веб-проверка».

- [ ] **Step 1: Сценарий `check_74_web.js`** (390×844, сид `goto → evaluate → reload`, dev-сервер с `--clear`). Проверки:
  1. на «Учёбе» есть `[data-testid="music-toggle"]`; заголовок экрана остался по центру (центр заголовка совпадает с центром экрана ± 1 px);
  2. сид — состояние **версии 12** без `settings.musicOn`: после загрузки в `localStorage` `version === 13`, `settings.musicOn === true`, ошибок в консоли нет;
  3. клик по кнопке → `settings.musicOn === false`, `aria-checked="false"`; после `reload` — то же;
  4. в настройках строка музыки показывает «Выкл»; клик по ней → «Вкл», и кнопка на «Учёбе» снова `aria-checked="true"`;
  5. строка темы открывает пикер из трёх пунктов; выбор «Как в системе» + `page.emulateMedia({ colorScheme: 'light' })` → цвет фона экрана равен фону светлой темы, затем `'dark'` → тёмной, без перезагрузки (цвета — из `themeHex` сида);
  6. выбрана «Тёмная» + `emulateMedia({ colorScheme: 'light' })` → фон остаётся тёмным;
  7. строки «Оценить приложение» на вебе нет;
  8. консоль без ошибок на всём проходе.
- [ ] **Step 2: Красный прогон.** До запуска на готовом коде сломать по очереди и убедиться, что падает нужная проверка: `MusicToggle` убран из шапки → 1; дефолт `musicOn: false` → 2; `resolveMode` игнорирует систему → 5; `RATE_URL` отдаёт адрес на вебе → 7. Записать «упало N из M» по каждой мутации.
- [ ] **Step 3: Зелёный прогон** на целом коде, «M из M».
- [ ] **Step 4: `shoot_74.js`** — «Учёба» с кнопкой, настройки, открытый пикер темы × обе темы → `docs/screenshots/74/`; сверить с макетом по `docs/ui-verification.md`, расхождения исправить или перечислить в отчёте.
- [ ] **Step 5: Commit** — `test: веб-проверка выпуска 1.0.1 (spec 74)`.

### Task 10: Сборка `preview` и эмулятор — этап без сжатия

- [ ] **Step 1:** `python scripts/check_easignore.py` (с `PYTHONIOENCODING=utf-8`) → код 0, `assets/audio/ambient.m4a` в списке уезжающего.
- [ ] **Step 2:** `npx eas-cli@latest build --platform android --profile preview --non-interactive`; скачать APK.
- [ ] **Step 3: Манифест.** `C:/Android/sdk/build-tools/<версия>/aapt2 dump permissions <apk>` → нет `RECORD_AUDIO`, нет `FOREGROUND_SERVICE*`, нет `ACTIVITY_RECOGNITION`. Есть лишнее — вернуться к задаче 4, шаг 2.
- [ ] **Step 4: Эмулятор** (рецепт — `AGENTS.md`): онбординг проходит в тишине → на «Учёбе» музыка нарастает → свернуть (`adb shell input keyevent KEYCODE_HOME`) — пауза → вернуть — продолжает → кнопка выключает → перезапуск — состояние то же → настройки включают. Звук эмулятора слышен на машине Артёма: наблюдаемые из сессии признаки — `adb shell dumpsys audio | grep -A3 app.arcanum.tarot` (плеер в состоянии started/paused) и отсутствие ошибок в `logcat`. «Оценить приложение» → открывается Play Store на странице приложения. Тёмная тема эмулятора (`adb shell cmd uimode night yes|no`) при «Как в системе» меняет тему приложения.
- [ ] **Step 5:** проверить по типам/логу, глушит ли Android музыку на вибро (`playsInSilentMode: false`); результат — в спеку (строка таблицы поведения) одной фразой.
- [ ] **Step 6:** находки исправить в ветке, пересобрать при правках нативной части.

### Task 11: Сжатие кода (R8) — отдельный коммит

**Files:** `package.json`/`package-lock.json`, `app.json`

- [ ] **Step 1:** `npx expo install expo-build-properties`; в `node_modules/expo-build-properties/build/pluginConfig.d.ts` найти точные имена свойств Android для сжатия кода и ресурсов в релизной сборке (ожидаются `enableMinifyInReleaseBuilds` и `enableShrinkResourcesInReleaseBuilds`; в старых версиях — `enableProguardInReleaseBuilds`).
- [ ] **Step 2:** плагин в `app.json` с обоими свойствами `true`; `npx expo-doctor` → без новых замечаний; `npm test` (контракты `app.json`) зелёный.
- [ ] **Step 3: Commit** — `build: сжатие кода R8 в релизной сборке Android (spec 74, задача 73)` — ОДИН коммит, только эти файлы.
- [ ] **Step 4:** сборка `preview` → **этап 1** на эмуляторе: запуск, онбординг, урок с викториной, карта дня с анимацией переворота, игра «Угадай карту», тренажёр, музыка (весь список задачи 10), тестовое уведомление (DEV-строки нет в релизной сборке — проверить, что запрос разрешения и планирование не падают в `logcat`), пейвол показывает цены магазина. Падение с `ClassNotFoundException`/`NoSuchMethod` в `logcat` → правило `extraProguardRules` для этой библиотеки, пересборка. Не лечится двумя попытками → `git revert` коммита шага 3, запись в спеку «часть Г перенесена в 1.0.2», идти дальше.

### Task 12: Лайв-проверка, слияние, выпуск, синхронизация

- [ ] **Step 1: Сценарий 6в Артёму** (отправлять, когда ветка собрана и APK готов): установить APK на телефон или слушать на эмуляторе; (1) громкость «тихо, но слышно» — назвать «громче/тише/ок»; (2) дождаться 2:08 от старта — слышен ли стык; (3) на iPhone в Expo Go (`npm install`, `npx expo start --tunnel`): играет ли вообще и глушит ли беззвучный режим; (4) кнопка и строка настроек; (5) тема «как в системе».
- [ ] **Step 2: По итогам 6в.** Громкость — поправить `MUSIC_VOLUME` (и тест задачи 4, где ждётся `0.25` — через константу, не литерал). Стык слышен — `python scripts/gen_ambient.py --dip`, коммит файла, пересборка.
- [ ] **Step 3:** слияние ветки в `main` после «ок» Артёма; `npx eas-cli@latest build --platform android --profile production --non-interactive` → AAB (`versionCode` 7).
- [ ] **Step 4:** проверить AAB до заливки: ключ RevenueCat в бандле (команда из `AGENTS.md`), манифест без лишних разрешений. Залить во внутренний трек (Playwright, как 28.08).
- [ ] **Step 5: Этап 2** — магазинная сборка на эмуляторе через внутренний трек: покупка тестовой подпиской → «✦ АКТИВНА» → переустановка → «Восстановить покупки». Страница выпуска в Play Console: предупреждения «Оптимизация DEX-кода ниже порога» нет (записать процент обфускации).
- [ ] **Step 6:** **по «ок» Артёма** — рабочий выпуск 1.0.1 с «Что нового» на 4 языках из `store-listing.md`.
- [ ] **Step 7: Синхронизация.** `docs/backlog.md` (70, 71, 73, 74 — отметки), `docs/changelog.md` (запись), `docs/lessons.md` (новые ⚠️ под свои темы), `CLAUDE.md` «Статус» (версия, persist 13, число тестов, хвосты), `AGENTS.md` (число тестов, persist 13), `docs/release-checklist.md` (выпуск 1.0.1, решение по двум рекомендациям консоли), спека 74 — статус и отчёт. Коммит `feat: выпуск 1.0.1 (spec 74)`, `git push`.
