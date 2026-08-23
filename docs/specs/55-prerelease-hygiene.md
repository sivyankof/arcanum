# 55 · Предрелизная гигиена кода: патчи SDK 54, подсказка тренажёра в `review.ts`, иконка пуша Android

Статус: **спека готова (23.08), ждёт «ок» Артёма**. Заведена по решению 23.08 «берём то, что решается
кодом, пока аккаунты и EAS откладываются». Три мелких пункта одним заходом, потому что каждый — меньше
30 строк и ни один не тянет отдельной ветки. В `main`, без `docs/plans/`.

## Цель

К первой EAS-сборке проект подходит без известных заусенцев: зависимости совпадают с тем, что ждёт
SDK 54 (`npx expo-doctor` зелёный 18/18), иконка пуша Android прописана (иначе Android рисует
серый силуэт по умолчанию), а формула подсказки тренажёра живёт в одном месте под контрактом,
а не в экране и в тесте двумя копиями.

## Что показал аудит 23.08 (пункт E из плана сессии — выполнен)

`npx expo-doctor`: **17 из 18** проверок зелёные. Единственная красная — патч-версии внутри SDK 54:

| пакет | ожидается | стоит |
|---|---|---|
| `expo` | ~54.0.37 | 54.0.36 (в `package.json` `~54.0.35`) |
| `expo-constants` | ~18.0.14 | 18.0.13 |
| `expo-file-system` | ~19.0.24 | 19.0.23 |
| `jest-expo` | ~54.0.18 | 54.0.17 |

Это **патчи**, не мажоры — жёсткое правило «SDK не обновлять» не нарушается (SDK остаётся 54).
Других находок у `expo-doctor` нет (конфиг, схема `app.json`, дубли нативных модулей — чисто).

## Решения (предложение сессии)

- **Д1. Патчи ставим** командой `npx expo install expo expo-constants expo-file-system jest-expo`
  (она подбирает версии под SDK 54 сама). ⚠️ Урок задачи 12: `npx expo install` иногда правит
  `app.json` сам — после команды смотреть `git diff app.json package.json`, чужие правки откатывать.
- **Д2. Подсказка тренажёра** — одна функция `reviewPrompt(card, lang)` в `src/lib/review.ts`,
  экран и тесты зовут её. Контракт по корпусу и синтетический тест переписываются на неё, плюс
  контракт по исходнику (приём `langSources.test.ts`): `app/review.tsx` не вызывает `promptSentence`/
  `maskCardName`/`presentLang` напрямую. Альтернатива «оставить копию, добавить только греп-контракт»
  отклонена: копия формулы — это и есть дефект (хвост 45б, бэклог строка ~1406).
- **Д3. Иконка пуша Android** — монохромный силуэт эмблемы (восьмилучевая звезда в кольце, как
  `Emblem.tsx`/`adaptive-icon.png`) 96×96, белый на прозрачном, в `assets/images/notification-icon.png`;
  плагин `expo-notifications` в `app.json` с `icon` и `color: "#caa45a"` (первый стоп `gold.gradient`
  из `theme.ts` — плоский цвет, градиент Android не принимает) и `defaultChannel: "daily"` (тот же
  `CHANNEL_ID`, что в `pushes.ts`). Файл рисуется скриптом `scripts/gen_notification_icon.py` (PIL уже
  используется в `fetch_card_scans.py`) — чтобы иконку можно было перерисовать, а не хранить как
  «нарисовано однажды неизвестно чем». Альтернатива «взять `adaptive-icon.png` и обесцветить»
  отклонена: у него лучи-градиент, при 96 px и требовании «только белый» они превращаются в шум.
  ⚠️ Проверить иконку можно только на сборке (урок задачи 12 — в Expo Go иконок не видно); в этой
  задаче проверяется сам файл (размер, прозрачность, только белый) контракт-тестом.

## Что делаем

### 1. Патчи (Д1)
- `npx expo install expo expo-constants expo-file-system jest-expo` → `git diff package.json app.json`
  (в `app.json` изменений быть не должно) → `npm install` → `npx expo-doctor` = 18/18 → `npx tsc --noEmit`
  → `npm test` зелёный.
- Артёму после мерджа: **нужен `npm install` и перезапуск `npx expo start --tunnel`** (правило 4).

### 2. `reviewPrompt` (Д2)
- `src/lib/review.ts`: новая функция
  ```ts
  /** Подсказка тренажёра для карты: первое предложение general на языке интерфейса (через blockText —
   *  у todo пусто, «Текст готовится» на флеш-карте не бывает) и то же предложение с именем карты под
   *  маской для рубашки toCard. Имя для маски — на языке ПОКАЗАННОГО текста (presentLang), не
   *  интерфейса: name и general переводятся разными единицами (28а) и падают на английский независимо. */
  export function reviewPrompt(card: TarotCard, lang: Lang): { sentence: string; hint: string } {
    const meaning = blockText(card.content.general, lang);
    const sentence = meaning.todo ? '' : promptSentence(meaning.text);
    const maskName = inLang(card.name, presentLang(card.content.general, lang));
    return { sentence, hint: sentence ? maskCardName(sentence, maskName) : '' };
  }
  ```
  Импорты: `blockText`, `type TarotCard` из `./content`; `inLang`, `presentLang`, `type Lang` из `./lang`.
  Комментарий-обоснование из экрана (строки 126–137 `app/review.tsx`) переезжает сюда, в экране
  остаётся одна строка.
- `app/review.tsx`: `const { sentence, hint: backHint } = card ? reviewPrompt(card, lang) : { sentence: '', hint: '' };`
  — удаляются `meaning`, `maskName`, прямые вызовы `blockText`/`promptSentence`/`maskCardName`/`presentLang`
  (если `blockText` больше нигде в файле не нужен — снять и импорт).
- `src/lib/__tests__/review.test.ts`:
  - контракт по корпусу «подсказка не содержит имени» — считает `reviewPrompt(c, lang).hint`
    вместо ручной сборки;
  - синтетический тест «расхождение языков name/general» — через `reviewPrompt` на объекте-карте
    с блоком `{ru, en, status: {ru:'reviewed', en:'reviewed'}}` (без `es`); наивный вариант
    (`inLang(name, lang)` напрямую) остаётся в тесте как демонстрация течи — он показывает, ПОЧЕМУ
    функция устроена так;
  - новый контракт по исходнику: `app/review.tsx` не содержит `promptSentence(`, `maskCardName(`,
    `presentLang(` — по образцу `langSources.test.ts` (чтение файла, регулярка, список нарушителей
    пустой). Красный прогон: вернуть в экран прямой вызов `maskCardName(` — падает ровно этот тест.
- `CLAUDE.md` «Общие модули» — `review` получает упоминание `reviewPrompt`; запись хвоста 45б
  в бэклоге (строка ~1406) помечается закрытой.

### 3. Иконка пуша Android (Д3)
- `scripts/gen_notification_icon.py`: рисует 96×96 RGBA, прозрачный фон, белым — кольцо
  (окружность r≈33 из `Emblem.tsx`, толщина ~6 px в масштабе 96) и восьмилучевая звезда
  (путь `M50 23 L57 43 L77 50 L57 57 L50 77 L43 57 L23 50 L43 43 Z`, масштаб 100 → 96); рендер
  в 4× и даунскейл `LANCZOS` для гладких краёв. Пишет `assets/images/notification-icon.png`.
  Запуск из корня, без аргументов; идемпотентен. Докстрока — зачем (Android: «all-white with
  transparency»), откуда геометрия (`Emblem.tsx`).
- `app.json` → `plugins`:
  ```json
  ["expo-notifications", {
    "icon": "./assets/images/notification-icon.png",
    "color": "#caa45a",
    "defaultChannel": "daily"
  }]
  ```
  Артёму: это правка `app.json` — **нужен перезапуск `npx expo start --tunnel`** (в Expo Go
  эффекта не будет, плагин применяется при prebuild/EAS).
- Контракт-тест `src/lib/__tests__/notificationIcon.test.ts` (сосед `cardAssets.test.ts`, который
  читает размеры JPEG по SOF-маркеру; для PNG размеры — в IHDR: байты 16–24, затем глубина и тип
  цвета): файл существует, PNG-сигнатура, 96×96, bit depth 8, color type 6 (RGBA). Красный прогон:
  подменить путь на `favicon.png` — падает по размеру. Плюс проверка `app.json`: в `plugins` есть
  запись `expo-notifications` с `icon`, указывающим на существующий файл, и `color` вида `#rrggbb`.
  **Белизну пикселей проверяет сам генератор** после записи (перечитать файл, каждый пиксель с
  альфой > 0 обязан быть R=G=B=255, доля непрозрачных 8–40 % — иначе скрипт падает с кодом 1):
  декодировать PNG в jest без зависимостей — это unfilter-цикл на 50 строк ради одной картинки,
  в тесте ему не место. Запуск генератора — часть плана, его самопроверка — часть приёмки.
- `docs/release-checklist.md`: пункт «Иконка уведомлений на Android» → `[x]` с пометкой «файл и
  плагин готовы 23.08, увидеть — только на сборке».

## Что НЕ делаем
- Мажорные обновления, `expo upgrade`, смену SDK — запрещено правилом 1.
- `eas.json`, `runtimeVersion`, аккаунты, `expo-dev-client` — это этап EAS (отложен решением 23.08).
- Иконку приложения/сплэш не трогаем (готовы, проверено 18.08).
- Новых экранов/строк нет; i18n не меняется.

## Критерии приёмки («готово, когда…»)
- [ ] `npx expo-doctor` — 18/18; `package.json` содержит патч-версии из таблицы; `app.json`
      изменён ТОЛЬКО блоком `plugins` (дифф прочитан).
- [ ] `npx tsc --noEmit` чист; `npm test` зелёный (число тестов выросло: +1 контракт по исходнику
      review, +1 сьют иконки).
- [ ] В `app/review.tsx` нет прямых вызовов `promptSentence`/`maskCardName`/`presentLang`;
      контракт по исходнику краснеет на возвращённом прямом вызове (мутация выполнена и описана
      в коммите).
- [ ] `assets/images/notification-icon.png` сгенерирован скриптом, 96×96 RGBA; самопроверка
      генератора (только белый на прозрачном, доля 8–40 %) прошла; контракт-тест краснеет на
      подмене пути файлом другого размера.
- [ ] Веб-проверка 6а/6б в объёме тренажёра: открыть `/review` на вебе, направление `toCard` —
      подсказка с маской `···` на месте (поведение не изменилось). Скриншот не обязателен —
      визуально ничего не менялось; достаточно прокликивания и чистой консоли.
- [ ] Лайв 6в: Артём открывает тренажёр после `npm install` + перезапуска — экран работает как
      раньше (пуш-иконку на телефоне в Expo Go увидеть нельзя, это не критерий).
- [ ] Бэклог: задача 55 `[x]`, хвост 45б (строка ~1406) закрыт; release-checklist — иконка пуша `[x]`;
      changelog — запись; CLAUDE.md — статус и `reviewPrompt` в общих модулях.

## План (по файлам, в порядке; после каждого шага `npx tsc --noEmit`)
1. Патчи: `npx expo install …` → дифф → `npm install` → `expo-doctor` → `npm test`. Коммит
   `chore: патчи SDK 54 по expo-doctor (спека 55)`.
2. `src/lib/review.ts` — `reviewPrompt`; `app/review.tsx` — переход на неё; `review.test.ts` —
   три правки тестов + мутация. Коммит `refactor: подсказка тренажёра одной функцией reviewPrompt (спека 55)`.
3. `scripts/gen_notification_icon.py` → PNG → `app.json` plugins → контракт-тест → release-checklist.
   Коммит `feat: иконка пуша Android и плагин expo-notifications (спека 55)`.
4. Документы: backlog/changelog/CLAUDE.md. Коммит `docs: задача 55 закрыта`. Push.
