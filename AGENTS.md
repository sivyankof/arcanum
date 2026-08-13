# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Arcanum — приложение для изучения таро (Expo SDK 54)

Офлайн-приложение: карта дня, каталог 78 карт, курс, расклады, флеш-карты (SRS). Весь контент в бандле, сервера нет.

## Команды

- `npm start` — dev-сервер Expo (`npm run android` / `ios` / `web` — сразу на платформу).
- `npx tsc --noEmit` — проверка типов (strict). Линтера нет.
- `npm test` — юнит-тесты (jest-expo). На 13.08: 240 тестов в 15 сьютах, все зелёные. Правило: новая формула или алгоритм — тест в том же коммите (`docs/testing-strategy.md`).
- Контент-конвейер (Python, запускать из корня):
  - `python scripts/build_cards.py` — пересобирает `content/cards.json` из исходника tarot-api (ожидает `/tmp/tarot-api/static/card_data.json`). Сливает, а не затирает: `keywords`, `search` и тексты блоков переносятся из существующего файла, из источника обновляются только `name`/`image`/`source`. (До 11.08 скрипт стирал весь написанный контент.)
  - `python scripts/merge_quiz.py` — сливает черновик викторин `content/quiz-m1-m2.json` в `content/course.json` (поля `quiz`/`quizStatus`, остальное не трогает). Идемпотентен, валидирует схему до записи: ровно 5 вопросов и 3 варианта, `correct` в 0..2, двуязычность, `cardId` существует в колоде.
  - `python scripts/gen_card_images.py` — регенерирует `src/lib/cardImages.ts` после изменения списка карт.
  - `python scripts/content_stats.py` — отчёт о готовности контента по статусам блоков.
  - `python scripts/set_status.py <статус>` — двигает статусы по workflow `todo → draft → reviewed → final` сразу в трёх файлах (значения карт, теория, викторины). Есть `--only` и `--dry-run`. ⚠️ Викторинам статус правится в ДВУХ местах (черновик редактора и собранный course.json), иначе следующий прогон `merge_quiz.py` откатит его назад.

## Архитектура

**Роутинг** — expo-router v6, file-based: дерево `app/` и есть маршруты.

**Контент** — статические JSON в `content/` (`cards.json`, `spreads.json`, `course.json`), доступ ТОЛЬКО через `src/lib/content.ts` (типизированные экспорты `cards`, `spreads`, `course`, `cardById`, `cardOfDay`). Каждая карта: 8 контент-блоков (general, reversed, love, career, finances, health, day_card, symbolism), каждый блок `{ru, en, status}` со статусным workflow `todo → draft → reviewed → final`. Слов у карты два набора: `keywords` — 4 слова витрины (чипы под названием), `search` — 8–12 скрытых поисковых синонимов, которые нигде не отображаются (правила подбора — `docs/content-guide.md`). Расклады и модули курса имеют флаг `free` (freemium).

**Изображения карт** — Metro требует статических `require`, поэтому `src/lib/cardImages.ts` — автогенерируемая карта id → require. Руками не править, только `python scripts/gen_card_images.py`.

**Состояние** — zustand + persist в AsyncStorage (`src/store/useApp.ts`): тема, язык, streak, история карт дня. Ключ хранилища `arcanum-app` — менять схему состояния осторожно, данные уже персистятся у пользователей.

**Тема** — дизайн-токены в `src/theme/theme.ts` (направление «Небесное золото», dark/light + spacing/radius/fonts) — единственный источник правды по цветам. Экраны берут тему через `useTheme()` (режим читается из zustand-стора). Отдельных Themed-компонентов нет.

**i18n** — react-i18next, ресурсы inline в `src/lib/i18n.ts` (ru/en, дефолт ru). Язык лежит в zustand; корневой layout синхронизирует i18n при смене. Все пользовательские строки контента — `Record<'ru' | 'en', string>`; UI-строки добавлять в оба языка в `i18n.ts`.

**SRS** — `src/lib/srs.ts`, чистые функции алгоритма SM-2 (оценки 0–3) для флеш-карт.

Alias путей: `@/*` → корень репозитория. Комментарии в коде — на русском.
