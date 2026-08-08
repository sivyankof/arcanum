# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Arcanum — приложение для изучения таро (Expo SDK 54)

Офлайн-приложение: карта дня, каталог 78 карт, курс, расклады, флеш-карты (SRS). Весь контент в бандле, сервера нет.

## Команды

- `npm start` — dev-сервер Expo (`npm run android` / `ios` / `web` — сразу на платформу).
- `npx tsc --noEmit` — проверка типов (strict). Линтера и тестов в проекте нет.
- Контент-конвейер (Python, запускать из корня):
  - `python scripts/build_cards.py` — пересобирает `content/cards.json` из исходника tarot-api (ожидает `/tmp/tarot-api/static/card_data.json`).
  - `python scripts/gen_card_images.py` — регенерирует `src/lib/cardImages.ts` после изменения списка карт.
  - `python scripts/content_stats.py` — отчёт о готовности контента по статусам блоков.

## Архитектура

**Роутинг** — expo-router v6, file-based. `app/_layout.tsx` (корневой Stack) → `app/(tabs)/` с пятью вкладками (`index` = «Сегодня», `course`, `cards`, `spreads`, `profile`) + экран карты `app/card/[id].tsx` поверх табов. Typed routes включены.

**Контент** — статические JSON в `content/` (`cards.json`, `spreads.json`, `course.json`), доступ ТОЛЬКО через `src/lib/content.ts` (типизированные экспорты `cards`, `spreads`, `course`, `cardById`, `cardOfDay`). Каждая карта: 8 контент-блоков (general, reversed, love, career, finances, health, day_card, symbolism), каждый блок `{ru, en, status}` со статусным workflow `todo → draft → reviewed → final`. Расклады и модули курса имеют флаг `free` (freemium).

**Изображения карт** — Metro требует статических `require`, поэтому `src/lib/cardImages.ts` — автогенерируемая карта id → require. Руками не править, только `python scripts/gen_card_images.py`.

**Состояние** — zustand + persist в AsyncStorage (`src/store/useApp.ts`): тема, язык, streak, история карт дня. Ключ хранилища `arcanum-app` — менять схему состояния осторожно, данные уже персистятся у пользователей.

**Тема** — дизайн-токены в `src/theme/theme.ts` (направление «Небесное золото», dark/light + spacing/radius/fonts) — единственный источник правды по цветам. Экраны берут тему через `useTheme()` (режим читается из zustand-стора). Отдельных Themed-компонентов нет.

**i18n** — react-i18next, ресурсы inline в `src/lib/i18n.ts` (ru/en, дефолт ru). Язык лежит в zustand; корневой layout синхронизирует i18n при смене. Все пользовательские строки контента — `Record<'ru' | 'en', string>`; UI-строки добавлять в оба языка в `i18n.ts`.

**SRS** — `src/lib/srs.ts`, чистые функции алгоритма SM-2 (оценки 0–3) для флеш-карт.

Alias путей: `@/*` → корень репозитория. Комментарии в коде — на русском.
