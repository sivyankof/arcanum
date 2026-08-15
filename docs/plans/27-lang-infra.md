# План 27 · Инфраструктура 4 языков

> **Для исполнителя (Opus 5):** выполнять по задачам через superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans. Чекбоксы `- [ ]` — трекинг шагов.
> Сабагентам ВСЕГДА указывать модель явно: механические свипы (задачи 2, 3, 5) и реализация
> по готовому коду (1, 4, 6, 7, 8) — `sonnet`; ревью между задачами и финальное ревью ветки — Opus.

**Цель:** приложение готово к RU+EN+ES+PT без единой строки перевода: тип языка один и на 4 значения,
язык читается одним хуком `useLang()`, контент отдаётся с фолбэком на `en`, переключатель показывает
доступные языки списком, при первой установке язык берётся с устройства, плюрализация es/pt под тестами.

**Архитектура:** новый чистый модуль `src/lib/lang.ts` (тип, список, названия, локали, детекция,
`Localized`/`inLang`); хук `useLang()` в `i18n.ts` читает зеркало i18n (стор остаётся источником
правды и синхронизирует i18n через `_layout`); адаптер `deviceLang.ts` — единственный файл, знающий
`expo-localization`; общий `OptionPicker`, вынесенный из `TimePicker.web`. Порядок задач подобран так,
что `npx tsc --noEmit` чист после КАЖДОГО коммита: сначала расширяем типы (шире принимает уже),
потом переводим места чтения на `inLang`, потом сужаем тип записи до `Localized`, потом меняем
источник `lang` на хук.

**Стек:** Expo SDK 54 (НЕ обновлять), React Native, zustand/persist, react-i18next + i18next 26,
`intl-pluralrules`, jest-expo. Новый пакет: `expo-localization ~17.0.9` (в Expo Go SDK 54).

**Спека:** `docs/specs/27-lang-infra.md` — разделы «Решения брейншторма» 1–10 и «Что делаем» А–З читать перед работой.

## Глобальные ограничения

- Ветка `feat/27-lang-infra` от `main`; merge только после лайв-проверки Артёма (процесс, CLAUDE.md).
- После КАЖДОГО шага с правкой кода: `npx tsc --noEmit` — чисто. `npm test` зелёный перед каждым
  коммитом (на старте ветки: 574 теста в 23 сьютах).
- Комментарии в коде и сообщения коммитов — русские, без упоминаний ИИ и без трейлеров.
- Цвета ТОЛЬКО из `useTheme()`; хардкод запрещён. Новых визуальных значений в задаче нет —
  `OptionPicker` наследует стили `TimePicker.web` один в один.
- UI-строки — сразу в оба языка `src/lib/i18n.ts` (ru и en); es/pt-строк в этой задаче НЕТ.
- Меняется `package.json` (задача 6) → после неё нужен `npm install` и перезапуск `npx expo start --tunnel`.
- Persist: `SCHEMA_VERSION` → **8** (задача 7), ветки `migrate` НЕ добавлять (форма не менялась).
- Тип `Lang` объявляется РОВНО один раз — `src/lib/lang.ts`; остальные — реэкспорты. Инлайн-юнион
  `'ru' | 'en'` и каст `startsWith('ru')` в `app/` и `src/` (кроме тестов) к концу задачи 5 запрещены
  контракт-тестом.
- `Math.random`/`Date.now` в тестах не использовать; даты фиксированные.

---

### Задача 1: `src/lib/lang.ts` — тип, список, названия, локали, детекция, `Localized`/`inLang`

**Файлы:**
- Создать: `src/lib/lang.ts`
- Тест: `src/lib/__tests__/lang.test.ts`

**Интерфейсы (даёт дальше):**
- `LANGS: readonly ['ru','en','es','pt']`, `type Lang = 'ru'|'en'|'es'|'pt'`, `type CanonLang = 'ru'|'en'`
- `CONTENT_FALLBACK: CanonLang = 'en'`
- `type Localized<T = string> = Record<CanonLang, T> & Partial<Record<Lang, T>>`
- `isLang(x: unknown): x is Lang`
- `presentLang<T>(rec: Localized<T>, lang: Lang): Lang` — язык, на котором запись реально есть
- `inLang<T>(rec: Localized<T>, lang: Lang): T` — текст/список с фолбэком на `en`
- `LANG_NAMES: Record<Lang, string>` — эндонимы; `LOCALES: Record<Lang, string>`; `localeTag(lang): string`
- `primarySubtag(tag: string): string`; `toLang(code: string): Lang`;
  `detectLang(tags: readonly string[], available: readonly Lang[]): Lang`

- [ ] **Шаг 1.0: ветка**

```bash
git checkout main && git pull && git checkout -b feat/27-lang-infra
```

- [ ] **Шаг 1.1: красные тесты**

Создать `src/lib/__tests__/lang.test.ts`:

```ts
/** Язык приложения (спека 27): список языков, нормализация тегов, детекция по предпочтениям
 *  устройства, доступ к многоязычной записи с фолбэком. Чистая логика — без React и expo. */
import {
  CONTENT_FALLBACK,
  detectLang,
  inLang,
  isLang,
  LANG_NAMES,
  LANGS,
  LOCALES,
  localeTag,
  presentLang,
  primarySubtag,
  toLang,
  type Localized,
} from '../lang';

describe('LANGS и словари', () => {
  it('четыре языка v1 в порядке ru, en, es, pt', () => {
    expect([...LANGS]).toEqual(['ru', 'en', 'es', 'pt']);
  });

  it('у каждого языка есть эндоним и локаль — ключи словарей совпадают со списком', () => {
    expect(Object.keys(LANG_NAMES).sort()).toEqual([...LANGS].sort());
    expect(Object.keys(LOCALES).sort()).toEqual([...LANGS].sort());
  });

  it('локали — те, что понимают системные пикеры и toLocaleDateString', () => {
    expect(localeTag('ru')).toBe('ru-RU');
    expect(localeTag('en')).toBe('en-US');
    expect(localeTag('es')).toBe('es-MX');
    expect(localeTag('pt')).toBe('pt-BR');
  });

  it('фолбэк контента — английский (совпадает с fallbackLng i18n)', () => {
    expect(CONTENT_FALLBACK).toBe('en');
  });
});

describe('isLang', () => {
  it.each(['ru', 'en', 'es', 'pt'])('%s — язык', (l) => expect(isLang(l)).toBe(true));
  it.each(['de', 'ru-RU', '', 42, null, undefined])('%p — не язык', (x) => expect(isLang(x)).toBe(false));
});

describe('primarySubtag / toLang', () => {
  it.each([
    ['es-MX', 'es'], ['pt-BR', 'pt'], ['ru-RU', 'ru'], ['en', 'en'],
    ['PT_br', 'pt'], ['  es-419 ', 'es'], ['', ''],
  ])('primarySubtag(%p) → %p', (tag, sub) => {
    expect(primarySubtag(tag)).toBe(sub);
  });

  it.each([
    ['ru', 'ru'], ['ru-RU', 'ru'], ['es-MX', 'es'], ['pt-BR', 'pt'], ['en-GB', 'en'],
    ['de-DE', 'en'], ['', 'en'],
  ])('toLang(%p) → %p (чужой код падает в en)', (code, lang) => {
    expect(toLang(code)).toBe(lang);
  });
});

describe('detectLang — язык устройства при первой установке', () => {
  it.each([
    [['es-MX'], 'es'],
    [['pt-BR', 'en-US'], 'pt'],
    [['ru-RU'], 'ru'],
    // берётся первый ИЗ ДОСТУПНЫХ по всему списку предпочтений, а не первый тег вообще
    [['de-DE', 'es-ES'], 'es'],
    [['de-DE'], 'en'],
    [[], 'en'],
    [['PT_br'], 'pt'],
  ])('%j → %s при всех четырёх доступных', (tags, lang) => {
    expect(detectLang(tags, LANGS)).toBe(lang);
  });

  it('язык без UI-строк не выбирается: es-MX при доступных ru/en → en', () => {
    expect(detectLang(['es-MX'], ['ru', 'en'])).toBe('en');
    expect(detectLang(['es-MX', 'ru-RU'], ['ru', 'en'])).toBe('ru');
  });
});

describe('Localized / presentLang / inLang', () => {
  const full: Localized = { ru: 'Дурак', en: 'The Fool', es: 'El Loco' };
  const canon: Localized = { ru: 'Дурак', en: 'The Fool' };

  it('есть перевод — отдаёт его', () => {
    expect(presentLang(full, 'es')).toBe('es');
    expect(inLang(full, 'es')).toBe('El Loco');
    expect(inLang(full, 'ru')).toBe('Дурак');
  });

  it('перевода нет — падает на en, а не на ru и не в undefined', () => {
    expect(presentLang(canon, 'es')).toBe('en');
    expect(presentLang(canon, 'pt')).toBe('en');
    expect(inLang(canon, 'es')).toBe('The Fool');
    expect(inLang(canon, 'pt')).toBe('The Fool');
  });

  it('работает со списками (ключевые слова)', () => {
    const kw: Localized<string[]> = { ru: ['начало'], en: ['beginning'] };
    expect(inLang(kw, 'pt')).toEqual(['beginning']);
    expect(inLang(kw, 'ru')).toEqual(['начало']);
  });

  it('пустая строка отсутствием НЕ считается — полноту следят контракт-тесты, не рантайм', () => {
    const empty: Localized = { ru: 'Дурак', en: 'The Fool', es: '' };
    expect(inLang(empty, 'es')).toBe('');
  });
});
```

- [ ] **Шаг 1.2: убедиться, что тесты красные**

Run: `npx jest src/lib/__tests__/lang.test.ts`
Ожидание: FAIL — `Cannot find module '../lang'`.

- [ ] **Шаг 1.3: реализация**

Создать `src/lib/lang.ts`:

```ts
/** Язык приложения (спека 27) — единственное место, где объявлено, какие языки есть, как они
 *  называются, какой локалью форматируются даты и как из многоязычной записи достать текст.
 *  Чистый модуль: без expo и react — целиком под юнит-тестами (lang.test.ts).
 *
 *  Источник правды текущего языка — стор (`useApp().lang`, персист); i18n — его зеркало,
 *  экраны читают зеркало через `useLang()` из `src/lib/i18n.ts`. Здесь — только словари и функции.
 */

/** Языки v1 (решение 12.08): порядок = порядок в пикере настроек. */
export const LANGS = ['ru', 'en', 'es', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

/** Языки канона: на них контент написан руками, эти ключи у записи обязательны.
 *  es/pt появятся с переводами (задача 28) — до этого их у записи может не быть. */
export type CanonLang = 'ru' | 'en';

/** Куда падает контент, пока перевода на выбранный язык нет. Совпадает с fallbackLng i18n. */
export const CONTENT_FALLBACK: CanonLang = 'en';

/** Многоязычная запись контента: ru/en обязательны, остальные — по мере переводов.
 *  Индекс `rec[lang]` по общему `Lang` даёт `T | undefined` — поэтому читать через `inLang`. */
export type Localized<T = string> = Record<CanonLang, T> & Partial<Record<Lang, T>>;

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

/** Язык, на котором запись реально есть: сам `lang` либо CONTENT_FALLBACK.
 *  Нужен там, где важен не только текст, но и его язык — стемминг в поиске (cardSearch). */
export function presentLang<T>(rec: Localized<T>, lang: Lang): Lang {
  return rec[lang] !== undefined ? lang : CONTENT_FALLBACK;
}

/** Текст (или список) на нужном языке с фолбэком на канон.
 *  Пустая строка отсутствием НЕ считается: полноту переводов следят контракт-тесты, а не рантайм. */
export function inLang<T>(rec: Localized<T>, lang: Lang): T {
  const own = rec[lang];
  return own !== undefined ? own : rec[CONTENT_FALLBACK];
}

/** Эндонимы для пикера языка — не переводятся (пользователь ищет свой язык глазами). */
export const LANG_NAMES: Record<Lang, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

/** Локали (BCP-47) по языку приложения. es-MX, а не es-419: любой латиноамериканский тег даёт
 *  те же имена месяцев и дней, но «419» местами не распознаётся движками и молча падает
 *  в дефолт локали; pt-BR — бразильская норма (план локализации). */
export const LOCALES: Record<Lang, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-MX',
  pt: 'pt-BR',
};

/** Тег локали для системных компонентов и toLocaleDateString.
 *
 *  ⚠️ Нужен там, где строку форматирует НЕ наш код, а системный компонент. Язык приложения —
 *  наша собственная настройка в сторе, и он не обязан совпадать ни с языком устройства, ни с тем,
 *  что готова показать система: iOS локализует системные виджеты по списку языков приложения-хоста,
 *  а хост в разработке — Expo Go, чей список мы не контролируем. Поэтому локаль таким компонентам
 *  передаём явно, а не надеемся на окружение (найдено Артёмом 13.08: колесо даты говорило
 *  по-английски при русских и приложении, и телефоне). */
export function localeTag(lang: Lang): string {
  return LOCALES[lang];
}

/** Первичный субтег языка: 'es-MX' → 'es', 'PT_br' → 'pt', '' → ''. */
export function primarySubtag(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0];
}

/** Любой код языка → наш Lang; неизвестный падает в 'en' (как fallbackLng i18n).
 *  Этим нормализуется `i18n.language` в useLang(). */
export function toLang(code: string): Lang {
  const sub = primarySubtag(code);
  return isLang(sub) ? sub : 'en';
}

/** Язык для первой установки по списку предпочтений устройства (в порядке пользователя):
 *  первый, который у нас ДОСТУПЕН (`available` — AVAILABLE_LANGS из i18n.ts), иначе 'en'.
 *  [de-DE, es-ES] → es: смотрим весь список, а не только первый тег. */
export function detectLang(tags: readonly string[], available: readonly Lang[]): Lang {
  for (const tag of tags) {
    const sub = primarySubtag(tag);
    if (isLang(sub) && available.includes(sub)) return sub;
  }
  return 'en';
}
```

- [ ] **Шаг 1.4: тесты зелёные, типы чистые**

Run: `npx jest src/lib/__tests__/lang.test.ts && npx tsc --noEmit`
Ожидание: PASS (все ~30 кейсов), tsc без ошибок.

- [ ] **Шаг 1.5: коммит**

```bash
git add src/lib/lang.ts src/lib/__tests__/lang.test.ts
git commit -m "feat: модуль языка lang.ts — Lang на 4 значения, детекция, Localized/inLang (spec 27)"
```

---

### Задача 2: один тип `Lang` на весь код (реэкспорты + инлайн-юнионы), `localeTag` переезжает в lang.ts

Только типы и импорты — поведение не меняется. Все параметры расширяются с `'ru' | 'en'` до `Lang`
(шире принимает уже: узкие аргументы из кастов проходят), поэтому tsc остаётся чистым.

**Файлы:**
- Правка: `src/lib/content.ts:6`, `src/store/useApp.ts:15`, `src/lib/dates.ts:30-43`,
  `src/lib/backup.ts:20`, `src/lib/phrases.ts:28`, `src/lib/pushBody.ts:17`,
  `src/lib/pushes.ts:122,133,172`, `src/lib/pushes.web.ts:44,54`,
  `src/components/BirthArcanaCard.tsx:22`, `src/components/MonthNav.tsx:43`,
  `src/components/MonthCard.tsx:24`, `src/components/JournalRow.tsx:24`,
  `src/components/Reflection.tsx:44`, `app/(tabs)/cards.tsx:46`, `app/lesson/[id].tsx:291`,
  `src/components/DatePicker.tsx:8`, `src/components/DatePicker.web.tsx`, `src/components/TimePicker.tsx:9`.

**Интерфейсы (даёт дальше):** `import type { Lang } from '../lib/content'` и `from '../store/useApp'`
продолжают работать (реэкспорт); `localeTag` импортируется ТОЛЬКО из `src/lib/lang`.

- [ ] **Шаг 2.1: реэкспорты**

`src/lib/content.ts` — строку 6 `export type Lang = "ru" | "en";` заменить на:

```ts
import type { Lang } from "./lang";
// тип языка живёт в src/lib/lang.ts; реэкспорт — чтобы cardSearch/lesson/компоненты не меняли импорт
export type { Lang };
```

`src/store/useApp.ts` — строку 15 `export type Lang = 'ru' | 'en';` заменить на:

```ts
import type { Lang } from '../lib/lang';
// тип языка живёт в src/lib/lang.ts рядом со словарями и детекцией; здесь — реэкспорт
export type { Lang };
```

`src/lib/backup.ts` — строки 18–20 (комментарий + `import type { Lang } from '../store/useApp';`) заменить на:

```ts
import type { Lang } from './lang';
```

(комментарий про type-only импорт из стора больше не нужен — зависимости от стора нет вовсе).

- [ ] **Шаг 2.2: `dates.ts` — локаль и тип из lang.ts**

В `src/lib/dates.ts` удалить строки 30–43 (`const LOCALES`, `type Lang`, doc-комментарий и функцию
`localeTag`) и добавить импорт в начало файла (после doc-комментария модуля):

```ts
import { LOCALES, type Lang } from './lang';
```

Остальные функции (`formatEntryDate`, `formatDayMonth`, `formatMonthTitle`, `formatFullDate`)
не трогать — они уже пишут `LOCALES[lang]` и `LOCALES.en`.

- [ ] **Шаг 2.3: пикеры — `localeTag` из lang.ts**

`src/components/DatePicker.tsx:8`: `import { localDateISO, localeTag, parseISODate } from '../lib/dates';` →

```ts
import { localDateISO, parseISODate } from '../lib/dates';
import { localeTag } from '../lib/lang';
```

`src/components/DatePicker.web.tsx` — та же замена (найти строку импорта `localeTag` из `../lib/dates`).

`src/components/TimePicker.tsx:9`: `import { localeTag } from '../lib/dates';` → `import { localeTag } from '../lib/lang';`.

(Каст `i18n.language.startsWith('ru') ? 'ru' : 'en'` в этих трёх файлах пока остаётся — уйдёт в задаче 5.)

- [ ] **Шаг 2.4: инлайн-юнионы → `Lang`**

В каждом файле заменить `'ru' | 'en'` на `Lang` и добавить импорт типа (путь — относительный до `src/lib/lang`):

| Файл | Было | Стало |
|---|---|---|
| `src/lib/phrases.ts:28` | `lang: 'ru' \| 'en',` | `lang: Lang,` + `import type { Lang } from './lang';` |
| `src/lib/pushBody.ts:17` | `lang: 'ru' \| 'en'` | `lang: Lang` + `import type { Lang } from './lang';` |
| `src/lib/pushes.ts:122,133,172` | три `lang: 'ru' \| 'en'` | `lang: Lang` + `import type { Lang } from './lang';` |
| `src/lib/pushes.web.ts:44,54` | `_lang: 'ru' \| 'en'` ×2 | `_lang: Lang` + `import type { Lang } from './lang';` |
| `src/components/BirthArcanaCard.tsx:22` | `{ lang: 'ru' \| 'en' }` | `{ lang: Lang }` + `import type { Lang } from '../lib/lang';` |
| `src/components/MonthNav.tsx:43` | `lang: 'ru' \| 'en';` | `lang: Lang;` + импорт |
| `src/components/MonthCard.tsx:24` | то же | то же |
| `src/components/JournalRow.tsx:24` | то же | то же |
| `src/components/Reflection.tsx:44` | то же | то же |
| `app/(tabs)/cards.tsx:46` | `lang: 'ru' \| 'en';` в пропсах `Cell` | `lang: Lang;` + `import type { Lang } from '../../src/lib/lang';` |
| `app/lesson/[id].tsx:291` | `lang: 'ru' \| 'en'` в пропсах `CardStep` | `lang: Lang` + `import type { Lang } from '../../src/lib/lang';` |

Проверка полноты: `grep -rnE "['\"]ru['\"] \| ['\"]en['\"]" app src --include=*.ts --include=*.tsx` — должны остаться
ТОЛЬКО 10 кастов `as 'ru' | 'en'` в экранах (задача 5) и мёртвый `export const lang` в `src/lib/i18n.ts:449`
(задача 4). `backup.ts:170` (`s.lang === 'ru' || s.lang === 'en'`) под этот grep не попадает — уходит в задаче 7.

- [ ] **Шаг 2.5: проверка**

Run: `npx tsc --noEmit && npm test`
Ожидание: чисто; 574 + тесты задачи 1 зелёные.

- [ ] **Шаг 2.6: коммит**

```bash
git add -A src app
git commit -m "refactor: один тип Lang из lang.ts, localeTag переехал из dates.ts (spec 27)"
```

---

### Задача 3: контент через `inLang` + тип `Localized`; поиск стеммит на языке текста

Порядок внутри задачи важен: сначала ВСЕ места чтения переводятся на `inLang` (тип записи ещё
`Record<Lang, T>` — компилируется), потом тип сужается до `Localized` (компилируется, потому что прямых
индексов не осталось; если остался — tsc покажет ровно его).

**Файлы:**
- Правка: `src/lib/content.ts`, `src/lib/phrases.ts`, `src/lib/cardSearch.ts`, `src/lib/lesson.ts`,
  `src/lib/pushBody.ts`, `src/components/BirthArcanaCard.tsx:74`, `src/components/CoursePath.tsx:77`,
  `src/components/ModuleHeader.tsx:46`, `src/components/MonthCard.tsx:61`,
  `app/card/[id].tsx:230,308,318`, `app/(tabs)/index.tsx:342-343,450`, `app/(tabs)/cards.tsx:79`,
  `app/(tabs)/spreads.tsx:41,43`, `app/onboarding.tsx:197,201`, `app/note/[date].tsx:94`,
  `app/lesson/[id].tsx:186,241,256,273,303,304`.
- Тест: `src/lib/__tests__/cardSearch.test.ts` (дописать), `src/lib/__tests__/lang.test.ts` (без изменений).

**Интерфейсы (даёт дальше):** `TarotCard.name: Localized`, `keywords/search: Localized<string[]>`,
`CardContentBlock extends Localized { status }`, `QuizQuestion.q/explain: Localized`, `options: Localized[]`,
`CourseLesson.title`, `CourseModule.title: Localized`; `Phrase` в phrases.ts = `Localized`.

- [ ] **Шаг 3.1: красный тест поиска на языке без контента**

В `src/lib/__tests__/cardSearch.test.ts` добавить в конец файла:

```ts
describe('язык без переводов контента (es/pt до задачи 28) — спека 27', () => {
  it('ищет по английским словам и стеммит английскими окончаниями, а не падает', () => {
    // у карты нет name.es → текст берётся из en, окончания — английские
    expect(matchesQuery(fool, 'fool', 'es')).toBe(true);
    // поисковое слово en «risk» находится по форме «risks» ТОЛЬКО английским стеммингом
    // (русские окончания «s» не срежут, префикс тоже не совпадёт) — так проверяется, что
    // окончания берутся по языку текста, а не по выбранному языку
    expect(matchesQuery(fool, 'risks', 'pt')).toBe(true);
    expect(matchesQuery(fool, 'дурак', 'es')).toBe(false);
  });

  it('фильтрация всей колоды на pt не бросает и что-то находит', () => {
    expect(filterCards(cards, { query: 'sword', filter: 'all', lang: 'pt' }).length).toBeGreaterThan(0);
  });
});
```

Run: `npx jest src/lib/__tests__/cardSearch.test.ts`
Ожидание: FAIL — `Cannot read properties of undefined (reading 'flatMap')`/`toLowerCase` или подобное
(`card.name['es']` — undefined). Если вдруг PASS — остановиться и разобраться, почему поиск на `es`
не падает (значит, тип/данные не те, что в разведке).

- [ ] **Шаг 3.2: `cardSearch.ts` — стемминг на языке текста**

В `src/lib/cardSearch.ts`:

импорт (строка 3):
```ts
import type { Lang, TarotCard } from './content';
import { inLang, presentLang } from './lang';
```

`ENDINGS` (строки 24–29): тип `Record<Lang, string[]>` → `Partial<Record<Lang, string[]>>`, содержимое
не менять; над таблицей добавить строку комментария:
```ts
/** Окончания для отсечения, сначала длинные — иначе «деньгами» потеряет только «и».
 *  es/pt появятся вместе с контентом на этих языках (задача 28) — пока их тексты английские
 *  и режутся английскими окончаниями (см. matchesQuery). */
```

`stem` (строка 41): `const end = ENDINGS[lang].find(` → `const end = (ENDINGS[lang] ?? []).find(`.

`matchesQuery` (строки 61–67) заменить целиком:
```ts
export function matchesQuery(card: TarotCard, query: string, lang: Lang): boolean {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return true;
  // язык, на котором тексты карты РЕАЛЬНО есть: до переводов es/pt это en, и стеммить
  // английский текст надо английскими окончаниями, а не окончаниями выбранного языка
  const src = presentLang(card.name, lang);
  const source = [inLang(card.name, src), ...(inLang(card.keywords, src) ?? []), ...(inLang(card.search, src) ?? [])];
  const words = source.flatMap(tokenize);
  return queryTokens.every((q) => words.some((w) => tokenMatches(w, q, src)));
}
```

Run: `npx jest src/lib/__tests__/cardSearch.test.ts` — Ожидание: PASS (все, включая новые).

- [ ] **Шаг 3.3: `inLang` в остальных чистых модулях**

`src/lib/lesson.ts:60`: `theoryPages(lesson.theory?.[lang] ?? '')` → `theoryPages(lesson.theory ? inLang(lesson.theory, lang) : '')`;
импорт: `import { inLang } from './lang';` (проверка `lessonPlayable` по `theory?.ru` — оставить: канон).

`src/lib/pushBody.ts:21`: `card: card ? card.name[lang] : '',` → `card: card ? inLang(card.name, lang) : '',`;
импорт: `import { inLang, type Lang } from './lang';` (заменить type-only импорт из задачи 2).

`src/lib/phrases.ts`: `interface Phrase { ru: string; en: string }` (строка 10) → удалить; в `variantsAt`
`(node as Phrase[])` → `(node as Localized[])`, возвращаемый тип `Localized[]`; строка 33
`…% variants.length][lang]` → `inLang(variants[fnv1a32(\`${dateISO}:${key}\`) % variants.length], lang)`;
импорт: `import { inLang, type Lang, type Localized } from './lang';`.

- [ ] **Шаг 3.4: `inLang` в компонентах и экранах**

Импорт везде: `import { inLang } from '<путь>/src/lib/lang';` (в `src/components` — `'../lib/lang'`;
в `app/(tabs)` и `app/lesson`, `app/note`, `app/card` — `'../../src/lib/lang'`; в `app/onboarding.tsx` — `'../src/lib/lang'`).

| Файл:строка | Было | Стало |
|---|---|---|
| `src/components/BirthArcanaCard.tsx:74` | `${card.name[lang]}` | `${inLang(card.name, lang)}` |
| `src/components/CoursePath.tsx:77` | `title={l.title[lang]}` | `title={inLang(l.title, lang)}` |
| `src/components/ModuleHeader.tsx:46` | `{mod.title[lang]}` | `{inLang(mod.title, lang)}` |
| `src/components/MonthCard.tsx:61` | `${card.name[lang]} · …` | `${inLang(card.name, lang)} · …` |
| `app/card/[id].tsx:230` | `return { text: block[lang], todo: false };` | `return { text: inLang(block, lang), todo: false };` |
| `app/card/[id].tsx:308` | `{card.name[lang]}` | `{inLang(card.name, lang)}` |
| `app/card/[id].tsx:318` | `{card.keywords[lang].map((k) => (` | `{inLang(card.keywords, lang).map((k) => (` |
| `app/(tabs)/index.tsx:450` | `{card.name[lang].toUpperCase()}` | `{inLang(card.name, lang).toUpperCase()}` |
| `app/(tabs)/cards.tsx:79` | `{item.name[lang]}` | `{inLang(item.name, lang)}` |
| `app/(tabs)/spreads.tsx:41` | `{s.name[lang]}` | `{inLang(s.name, lang)}` |
| `app/(tabs)/spreads.tsx:43` | `{s.description[lang]}` | `{inLang(s.description, lang)}` |
| `app/onboarding.tsx:197` | `{arcana.name[lang]}` | `{inLang(arcana.name, lang)}` |
| `app/note/[date].tsx:94` | `{card.name[lang]}` | `{inLang(card.name, lang)}` |
| `app/lesson/[id].tsx:186` | `{found.lesson.title[lang]}` | `{inLang(found.lesson.title, lang)}` |
| `app/lesson/[id].tsx:241` | `{step.question.q[lang]}` | `{inLang(step.question.q, lang)}` |
| `app/lesson/[id].tsx:256` | `{o[lang]}` | `{inLang(o, lang)}` |
| `app/lesson/[id].tsx:273` | `` {` ${step.question.explain[lang]}`} `` | `` {` ${inLang(step.question.explain, lang)}`} `` |
| `app/lesson/[id].tsx:303` | `{card.name[lang]}` | `{inLang(card.name, lang)}` |
| `app/lesson/[id].tsx:304` | `` {`✦ ${card.keywords[lang].join(' · ')}`} `` | `` {`✦ ${inLang(card.keywords, lang).join(' · ')}`} `` |

`app/(tabs)/index.tsx:342–343` — было:
```ts
  const dayText = card.content.day_card?.[lang];
  const hasText = dayText && card.content.day_card.status !== 'todo';
```
стало:
```ts
  const dayBlock = card.content.day_card;
  const dayText = dayBlock ? inLang(dayBlock, lang) : undefined;
  const hasText = dayText && dayBlock.status !== 'todo';
```

`app/onboarding.tsx:201` — было `{arcana.content['birth_path']?.[lang] ?? ''}`; стало:
```tsx
{arcana.content['birth_path'] ? inLang(arcana.content['birth_path'], lang) : ''}
```

- [ ] **Шаг 3.5: сузить типы контента до `Localized`**

`src/lib/content.ts` — импорт из шага 2.1 расширить: `import type { Lang, Localized } from "./lang";`, и:

```ts
export interface CardContentBlock extends Localized { status: BlockStatus }
export interface TarotCard {
  …
  name: Localized;
  /** Витрина: 4 канонических слова, показываются чипами под названием карты. */
  keywords: Localized<string[]>;
  /** Только для поиска … */
  search: Localized<string[]>;
  …
}
export interface QuizQuestion {
  type: QuizType;
  q: Localized;
  /** ровно 3 варианта; … */
  options: Localized[];
  correct: number;
  explain: Localized;
  cardId?: string;
}
export interface CourseLesson { … title: Localized; … }
export interface CourseModule { … title: Localized; … }
```
(комментарии у полей сохранить как были; меняется только `Record<Lang, …>` → `Localized<…>`,
а `{ ru: string; en: string; status }` → `extends Localized`).

- [ ] **Шаг 3.6: проверка**

Run: `npx tsc --noEmit`
Ожидание: чисто. Если tsc ругается «Type 'string | undefined' is not assignable» — это пропущенный
прямой индекс `[lang]`, перевести его на `inLang` (список выше неполон только если код менялся после 15.08).

Run: `grep -n "\[lang\]" app src --include=*.ts --include=*.tsx | grep -v __tests__`
Ожидание: только `src/lib/lang.ts` (сам фолбэк), `src/lib/dates.ts` (`LOCALES[lang]`), `src/lib/cardSearch.ts` (`ENDINGS[lang]`).

Run: `npm test` — зелёный (контракт-сьюты `cardsContent`, `courseContent`, `birthPathContent`
индексируют `.ru/.en` — обязательные ключи `Localized`, компилируются как раньше).

- [ ] **Шаг 3.7: коммит**

```bash
git add -A src app
git commit -m "feat: контент читается через inLang с фолбэком на en, тип записи Localized (spec 27)"
```

---

### Задача 4: `i18n.ts` — `useLang()`, `AVAILABLE_LANGS`, новые ключи, тесты фолбэка и оракул es/pt

**Файлы:**
- Правка: `src/lib/i18n.ts` (импорты, ключи, хвост файла)
- Правка: `src/lib/__tests__/i18nPlurals.test.ts` (оракул по `LANGS`, +1 кейс)
- Создать: `src/lib/__tests__/i18nLangs.test.ts`

**Интерфейсы (даёт дальше):**
- `useLang(): Lang` — текущий язык для экранов
- `AVAILABLE_LANGS: readonly Lang[]` — что показывать в пикере и среди чего искать язык устройства
- Ключи: `today.tapToReveal`, `today.meaning`, `today.continue`, `today.streakDays_*`,
  `card.majorArcana`, `card.minorArcana`, `cards.subtitle`, `settings.devDeviceLang`

- [ ] **Шаг 4.1: красные тесты**

Создать `src/lib/__tests__/i18nLangs.test.ts`:

```ts
/** Проводка языков в i18n (спека 27): какие языки доступны и как ведёт себя интерфейс на языке,
 *  UI-строк которого ещё нет (es/pt до сессии L-0 плана локализации). */
import i18n, { AVAILABLE_LANGS, resources } from '../i18n';
import { LANGS } from '../lang';

describe('AVAILABLE_LANGS', () => {
  it('подмножество LANGS в том же порядке, канон ru/en всегда доступен', () => {
    expect(AVAILABLE_LANGS.every((l) => (LANGS as readonly string[]).includes(l))).toBe(true);
    expect(AVAILABLE_LANGS).toContain('ru');
    expect(AVAILABLE_LANGS).toContain('en');
    const order = AVAILABLE_LANGS.map((l) => LANGS.indexOf(l));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('в dev (как в jest) доступны все четыре — проверка проводки не ждёт переводов', () => {
    expect(__DEV__).toBe(true);
    expect([...AVAILABLE_LANGS]).toEqual([...LANGS]);
  });

  it('язык с UI-строками доступен всегда — это и есть «включение» языка сессией L-0', () => {
    for (const l of Object.keys(resources)) expect(AVAILABLE_LANGS).toContain(l);
  });
});

describe('язык без ресурсов: i18n принимает его, строки падают на en', () => {
  afterEach(() => {
    i18n.changeLanguage('ru');
  });

  it.each(['es', 'pt'])('%s — language выставлен, t() английский', (lng) => {
    i18n.changeLanguage(lng);
    expect(i18n.language).toBe(lng);
    expect(i18n.t('tabs.today')).toBe('Today');
    expect(i18n.t('course.lessons', { count: 2 })).toBe('2 LESSONS');
  });
});
```

В `src/lib/__tests__/i18nPlurals.test.ts`:
- в `CASES` после строки `['spreads.cards', { count: 1 }, '1 карта'],` добавить:
  ```ts
  // плашка серии на «Сегодня»: «дн.» не склоняется, но семейство обязано быть полным (спека 27)
  ['today.streakDays', { count: 3 }, '3 дн.'],
  ```
- строку `const LANGS = Object.keys(resources);` заменить на:
  ```ts
  /** Оракул — по ВСЕМ языкам приложения (`LANGS` из lang.ts), включая те, чьих UI-строк ещё нет:
   *  плюрализация es/pt должна быть верной ДО переводов. Структурные тесты ниже — по `resources`:
   *  у языка без строк проверять нечего. */
  const RESOURCE_LANGS = Object.keys(resources);
  ```
  и импорт `import { LANGS } from '../lang';` в начало файла;
- в блоке `describe('оракул: …')` — `it.each(LANGS)` оставить (теперь это 4 языка из lang.ts);
- в двух `it.each(LANGS)` блока `describe('структура ключей: …')` → `it.each(RESOURCE_LANGS)`.

Run: `npx jest src/lib/__tests__/i18nLangs.test.ts src/lib/__tests__/i18nPlurals.test.ts`
Ожидание: FAIL — `AVAILABLE_LANGS` не экспортирован; кейс `today.streakDays` — ключ отсутствует.

- [ ] **Шаг 4.2: правки `src/lib/i18n.ts`**

Импорты: строку `import { initReactI18next } from "react-i18next";` расширить и добавить lang.ts:
```ts
import { initReactI18next, useTranslation } from "react-i18next";
import { LANGS, toLang, type Lang } from "./lang";
```

Ключи — ru:
- в `today` (строка 19) добавить:
  ```ts
  today: {
    title: "Карта дня", draw: "Вытянуть карту", drawn: "Ваша карта на сегодня",
    // подписи «Сегодня», раньше стоявшие тернаром lang === 'ru' мимо i18n (спека 27, раздел З)
    tapToReveal: "НАЖМИ, ЧТОБЫ ОТКРЫТЬ",
    meaning: "ЗНАЧЕНИЕ ДНЯ",
    continue: "ПРОДОЛЖИТЬ ПУТЬ →",
    // «дн.» не склоняется, но семейство держим полным — структурный тест требует все формы языка
    streakDays_one: "{{count}} дн.", streakDays_few: "{{count}} дн.", streakDays_many: "{{count}} дн.",
  },
  ```
- в `card` (после `viewerClose/viewerOpen`): `majorArcana: "СТАРШИЙ АРКАН", minorArcana: "МЛАДШИЙ АРКАН",`
- в `cards` (после `learned`): `subtitle: "СПРАВОЧНИК · РАЙДЕР–УЭЙТ 1909",`
- в `settings`: строку `language: "Язык", languageValue: "Русский", resetToday: …` → `language: "Язык", resetToday: …`
  (ключ `languageValue` удалить: название языка — эндоним из `LANG_NAMES`, не переводится);
  после `devOnboarding` добавить `devDeviceLang: "Язык устройства",`.

Ключи — en:
- `today`: `tapToReveal: "TAP TO REVEAL", meaning: "TODAY'S MEANING", continue: "CONTINUE YOUR PATH →", streakDays_one: "{{count}} day", streakDays_other: "{{count}} days",`
- `card`: `majorArcana: "MAJOR ARCANA", minorArcana: "MINOR ARCANA",`
- `cards`: `subtitle: "REFERENCE · RIDER–WAITE 1909",`
- `settings`: убрать `languageValue: "English",`; добавить `devDeviceLang: "Device language",`.

Хвост файла — строку 449 `export const lang = () => (i18n.language.startsWith("ru") ? "ru" : "en") as "ru" | "en";`
удалить (мёртвый код) и вместо неё после `export default i18n;` добавить:

```ts
/** Языки, доступные пользователю: список в пикере настроек и множество, среди которого ищется
 *  язык устройства при первой установке. Язык «включается» появлением его UI-строк в `resources`
 *  (сессия L-0 плана локализации): до этого бета-тестер не увидит «Español», за которым скрывался бы
 *  английский. В dev — все четыре: проверка проводки (даты, плюрализация, фолбэк контента) не ждёт
 *  переводов. */
export const AVAILABLE_LANGS: readonly Lang[] = LANGS.filter((l) => __DEV__ || l in resources);

/** Текущий язык приложения для экранов — вместо каста по префиксу (`startsWith('ru')` → ru, иначе en),
 *  который копировался в каждый новый экран и молча делал бы третий язык английским.
 *  Читает ЗЕРКАЛО i18n, а не стор: экран, взявший язык из стора, на один кадр разошёлся бы с `t()`
 *  (стор уже новый, i18n ещё старый). Источник правды — стор (персист), синхронизирует
 *  `app/_layout.tsx`. `useTranslation` подписывает компонент на смену языка — как и раньше.
 *  ⚠️ В комментариях этого файла не писать сам старый каст буквально: контракт-тест
 *  `langSources.test.ts` ищет его по всем исходникам, включая комментарии. */
export function useLang(): Lang {
  return toLang(useTranslation().i18n.language);
}
```

- [ ] **Шаг 4.3: зелёные тесты, типы**

Run: `npx jest src/lib/__tests__/i18nLangs.test.ts src/lib/__tests__/i18nPlurals.test.ts && npx tsc --noEmit`
Ожидание: PASS; tsc чист (`settings.languageValue` пока используется в `app/settings.tsx` через строку —
i18n-ключи не типизированы, tsc не заметит; экран получит ключ строкой до задачи 8 — это одна сессия,
в коммит не уходит непроверенным: задача 8 закрывает).
⚠️ Чтобы не оставлять «Язык · settings.languageValue» даже на один коммит — в этом же шаге в
`app/settings.tsx:239` заменить `value={tr('settings.languageValue')}` на `value={LANG_NAMES[lang]}` с
импортом `import { LANG_NAMES } from '../src/lib/lang';` (тап-по-кругу на строке 240 остаётся до задачи 8).

- [ ] **Шаг 4.4: коммит**

```bash
git add src/lib/i18n.ts src/lib/__tests__/i18nLangs.test.ts src/lib/__tests__/i18nPlurals.test.ts app/settings.tsx
git commit -m "feat: useLang() и AVAILABLE_LANGS в i18n, ключи вместо хардкод-тернаров, оракул плюрализации на 4 языках (spec 27)"
```

---

### Задача 5: свип `useLang()` по 11 экранам и 3 пикерам, хардкод-строки → ключи, контракт-тест

**Файлы:**
- Правка: `app/(tabs)/index.tsx`, `app/(tabs)/course.tsx`, `app/(tabs)/cards.tsx`, `app/(tabs)/spreads.tsx`,
  `app/(tabs)/profile.tsx`, `app/settings.tsx`, `app/onboarding.tsx`, `app/lesson/[id].tsx`,
  `app/note/[date].tsx`, `app/card/[id].tsx`, `src/components/StreakPill.tsx`,
  `src/components/DatePicker.tsx`, `src/components/DatePicker.web.tsx`, `src/components/TimePicker.tsx`
- Создать: `src/lib/__tests__/langSources.test.ts` (контракт: в исходниках нет копий каста)

- [ ] **Шаг 5.1: замена каста в 10 экранах**

В каждом из файлов `app/(tabs)/{index,course,cards,spreads,profile}.tsx`, `app/settings.tsx`,
`app/onboarding.tsx`, `app/lesson/[id].tsx`, `app/note/[date].tsx`, `app/card/[id].tsx`:

было (две строки рядом):
```ts
  const { t: tr, i18n } = useTranslation();
  …
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
```
стало:
```ts
  const { t: tr } = useTranslation();
  …
  const lang = useLang();
```
и импорт `useLang` из `src/lib/i18n` (в `app/(tabs)/*`, `app/lesson`, `app/note`, `app/card` —
`import { useLang } from '../../src/lib/i18n';`; в `app/settings.tsx` и `app/onboarding.tsx` —
`import { useLang } from '../src/lib/i18n';`). Переменная `i18n` из `useTranslation` в этих файлах
больше нигде не используется (проверено разведкой: единственное использование — сам каст).

`src/components/StreakPill.tsx:26–27`:
```ts
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en';
```
→ заменить обе строки одной (импорт `useTranslation` остаётся как был):
```ts
  const { t: tr } = useTranslation();
```
(`lang` в компоненте больше не нужен: обе его строки уходят в i18n на шаге 5.3, для них нужен `tr`).

- [ ] **Шаг 5.2: пикеры**

`src/components/DatePicker.tsx:33–34`, `src/components/DatePicker.web.tsx:33–34`, `src/components/TimePicker.tsx:33–34`:
```ts
  const { t: tr, i18n } = useTranslation();
  const locale = localeTag(i18n.language.startsWith('ru') ? 'ru' : 'en');
```
→
```ts
  const { t: tr } = useTranslation();
  const locale = localeTag(useLang());
```
импорт `import { useLang } from '../lib/i18n';`.

- [ ] **Шаг 5.3: хардкод-строки → ключи (спека, раздел З)**

`app/(tabs)/index.tsx`:
- строки 346–351 (`const locale = …; const now = new Date(); const dateStr = …;`) →
  ```ts
  const now = new Date();
  // «Пятница · 1 августа» — та же сборка, что строка записи дневника (formatEntryDate, weekday long);
  // регистр — в стиле .date
  const dateStr = formatEntryDate(localDateISO(now), lang, 'long');
  ```
  импорт `formatEntryDate` добавить в строку 34: `import { daysAgoISO, formatEntryDate, localDateISO } from '../../src/lib/dates';`
- строка 412: `hint={drawn ? undefined : lang === 'ru' ? 'НАЖМИ, ЧТОБЫ ОТКРЫТЬ' : 'TAP TO REVEAL'}` → `hint={drawn ? undefined : tr('today.tapToReveal')}`
- строки 453–455:
  ```tsx
                {card.arcana === 'major'
                  ? lang === 'ru' ? 'СТАРШИЙ АРКАН' : 'MAJOR ARCANA'
                  : lang === 'ru' ? 'МЛАДШИЙ АРКАН' : 'MINOR ARCANA'}
  ```
  → `{card.arcana === 'major' ? tr('card.majorArcana') : tr('card.minorArcana')}`
- строка 462: `{lang === 'ru' ? 'ЗНАЧЕНИЕ ДНЯ' : "TODAY'S MEANING"}` → `{tr('today.meaning')}`
- строка 468: `label={lang === 'ru' ? 'ПРОДОЛЖИТЬ ПУТЬ →' : 'CONTINUE YOUR PATH →'}` → `label={tr('today.continue')}`

`app/card/[id].tsx:220–223`:
```ts
  const arcanaLabel =
    card.arcana === 'major'
      ? lang === 'ru' ? 'СТАРШИЙ АРКАН' : 'MAJOR ARCANA'
      : `${tr(`cards.${card.suit}`)}`.toUpperCase();
```
→
```ts
  const arcanaLabel =
    card.arcana === 'major' ? tr('card.majorArcana') : `${tr(`cards.${card.suit}`)}`.toUpperCase();
```

`app/(tabs)/cards.tsx:174`: `{lang === 'ru' ? 'СПРАВОЧНИК · РАЙДЕР–УЭЙТ 1909' : 'REFERENCE · RIDER–WAITE 1909'}` → `{tr('cards.subtitle')}`.

`src/components/StreakPill.tsx:51–54`:
```tsx
        <Txt style={[st.count, { color: t.head }]}>
          {streak} {lang === 'ru' ? 'дн.' : 'days'}
        </Txt>
        <Txt style={[st.label, { color: t.muted }]}>{lang === 'ru' ? 'СЕРИЯ' : 'STREAK'}</Txt>
```
→
```tsx
        <Txt style={[st.count, { color: t.head }]}>{tr('today.streakDays', { count: streak })}</Txt>
        {/* «СЕРИЯ» — тот же ключ, что у статы профиля: одно слово, один перевод */}
        <Txt style={[st.label, { color: t.muted }]}>{tr('profile.streak')}</Txt>
```

- [ ] **Шаг 5.4: проверка свипа**

Run: `npx tsc --noEmit`
Run: `grep -rn "startsWith('ru')\|startsWith(\"ru\")\|'ru' | 'en'\|lang === 'ru' ?" app src --include=*.ts --include=*.tsx | grep -v __tests__`
Ожидание: пусто (кроме, возможно, `src/lib/backup.ts:170` — уходит в задаче 7).

- [ ] **Шаг 5.5: контракт-тест исходников**

Создать `src/lib/__tests__/langSources.test.ts` (по образцу worklet-контракта в `lightbox.test.ts` —
тест читает исходники, а не поведение):

```ts
/** Страж от копипасты каста языка в новый экран (спека 27). До задачи 27 выражение
 *  `(i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en'` жило в 11 файлах, и каждый новый
 *  экран приносил свою копию — третий язык молча становился английским, компилятор молчал.
 *  Теперь язык читается ТОЛЬКО через useLang() из src/lib/i18n.ts, а тип Lang объявлен ровно
 *  один раз в src/lib/lang.ts. Тест краснеет на первой же новой копии. */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../..');
const DIRS = ['app', 'src'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');

describe('язык читается одним способом (спека 27)', () => {
  it('исходники найдены (иначе тест проверял бы пустоту)', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('нет каста i18n.language.startsWith — только useLang()', () => {
    const bad = files.filter((f) => /i18n\.language\.startsWith\(/.test(fs.readFileSync(f, 'utf8')));
    expect(bad.map(rel)).toEqual([]);
  });

  it("нет инлайн-юниона 'ru' | 'en' — только тип Lang из src/lib/lang.ts", () => {
    const bad = files.filter((f) => /['"]ru['"]\s*\|\s*['"]en['"]/.test(fs.readFileSync(f, 'utf8')));
    // единственное законное место — сам lang.ts (CanonLang)
    expect(bad.map(rel)).toEqual(['src/lib/lang.ts']);
  });

  it('тип Lang объявлен ровно один раз', () => {
    const decl = files.filter((f) => /^\s*(export\s+)?type\s+Lang\s*=/m.test(fs.readFileSync(f, 'utf8')));
    expect(decl.map(rel)).toEqual(['src/lib/lang.ts']);
  });
});
```

⚠️ Тест `нет инлайн-юниона` ожидает ровно `['src/lib/lang.ts']`: там `CanonLang = 'ru' | 'en'`. Если
`backup.ts:170` ещё содержит `s.lang === 'ru' || s.lang === 'en'` — это НЕ юнион с `|`-одинарным,
регулярка его не ловит; всё равно уходит в задаче 7.

Run: `npx jest src/lib/__tests__/langSources.test.ts` — Ожидание: PASS (все четыре).
Контроль честности теста: временно вернуть каст в любой экран → тест красный → откатить.

- [ ] **Шаг 5.6: полный прогон и коммит**

Run: `npx tsc --noEmit && npm test`

```bash
git add -A src app
git commit -m "refactor: useLang() вместо 11 копий каста, подписи «Сегодня»/справочника/серии через i18n (spec 27)"
```

---

### Задача 6: язык устройства при первой установке + `useLayoutEffect` в `_layout`

**Файлы:**
- `package.json` / `package-lock.json` (expo-localization)
- Создать: `src/lib/deviceLang.ts`
- Правка: `src/store/useApp.ts` (импорты, `onRehydrateStorage`), `app/_layout.tsx:16,63-65`

**Интерфейсы (даёт дальше):** `deviceLocaleTags(): string[]` — теги предпочтений устройства по порядку.

- [ ] **Шаг 6.1: пакет**

```bash
npx expo install expo-localization
```
Ожидание: в `package.json` появилась строка `"expo-localization": "~17.0.9"` (или соседний патч той же
минорной — SDK 54). ⚠️ Артёму: нужен `npm install` и перезапуск `npx expo start --tunnel` на устройстве.

- [ ] **Шаг 6.2: адаптер**

Создать `src/lib/deviceLang.ts`:

```ts
/** Языки устройства — единственный файл, знающий про `expo-localization` (спека 27).
 *  Отдаёт теги в порядке предпочтений пользователя (`['es-MX', 'en-US']`); выбор из них делает
 *  чистый `detectLang` (lang.ts) — там и тесты. Веб/SSR-безопасно: реализация пакета сама
 *  проверяет наличие DOM и падает на Intl. Стор зовёт это один раз — при первой гидрации. */
import { getLocales } from 'expo-localization';

export function deviceLocaleTags(): string[] {
  return getLocales().map((l) => l.languageTag);
}
```

- [ ] **Шаг 6.3: детекция в сторе**

`src/store/useApp.ts` — импорты добавить:
```ts
import { deviceLocaleTags } from '../lib/deviceLang';
import { AVAILABLE_LANGS } from '../lib/i18n';
import { detectLang, type Lang } from '../lib/lang';
```
(строку `import type { Lang } from '../lib/lang';` из задачи 2 заменить этой; `export type { Lang };` остаётся).

`onRehydrateStorage` (строки 301–307) — было:
```ts
      // После гидрации назначаем личный сид карты дня, если он ещё не назначен (installSeed === 0):
      // срабатывает и на свежей установке, и у уже существующих пользователей после обновления.
      // Уже открытая сегодня карта не изменится — она читается из history, а не пересчитывается.
      onRehydrateStorage: () => (state) => {
        if (state && state.installSeed === 0) {
          useApp.setState({ installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)) });
        }
```
стало:
```ts
      // После гидрации назначаем личный сид карты дня, если он ещё не назначен (installSeed === 0):
      // срабатывает и на свежей установке, и у уже существующих пользователей после обновления.
      // Уже открытая сегодня карта не изменится — она читается из history, а не пересчитывается.
      // Здесь же — язык первой установки (спека 27): снимок с устройства среди доступных языков,
      // дальше язык свой (пикер в настройках). Существующие установки сюда не попадают (сид уже
      // есть), restoreBackup язык из файла не трогает. Дефолт `lang: 'ru'` в PERSIST_DEFAULTS —
      // только доливка старого файла без поля, настоящий первый язык назначается тут.
      onRehydrateStorage: () => (state) => {
        if (state && state.installSeed === 0) {
          useApp.setState({
            installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)),
            lang: detectLang(deviceLocaleTags(), AVAILABLE_LANGS),
          });
        }
```

- [ ] **Шаг 6.4: `_layout` — кадр без старого языка**

`app/_layout.tsx:16`: `import { useEffect, useState } from 'react';` → `import { useEffect, useLayoutEffect, useState } from 'react';`

Строки 63–65:
```ts
  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);
```
→
```ts
  // layout-эффект, а не обычный: смена языка i18next с inline-ресурсами синхронна, а setState
  // из layout-эффекта отрабатывает ДО отрисовки кадра — иначе первый кадр после гидрации
  // (и первый экран нерусского новичка) на один кадр показывался бы на языке дефолта стора
  useLayoutEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);
```

- [ ] **Шаг 6.5: проверка**

Run: `npx tsc --noEmit && npm test`
Ручная: `npx expo start --web` — dev-сервер поднимается без ошибок импорта `expo-localization`
(SSR-рендер страниц в Node не падает); в браузере DevTools → Application → очистить site data →
перезагрузить → приложение стартует на языке браузера (Chrome на русском → русский; поменять
`chrome://settings/languages` порядок на English → English). Существующая запись (не очищать) — язык прежний.

- [ ] **Шаг 6.6: коммит**

```bash
git add package.json package-lock.json src/lib/deviceLang.ts src/store/useApp.ts app/_layout.tsx
git commit -m "feat: язык первой установки — с устройства через expo-localization; смена языка без кадра-вспышки (spec 27)"
```

---

### Задача 7: бэкап — `SCHEMA_VERSION` 8, `lang` из четырёх

**Файлы:**
- Правка: `src/lib/backup.ts:30-32,168-170`, `src/store/useApp.ts` (комментарий у `version`)
- Тест: `src/lib/__tests__/backup.test.ts:51,120-160`

- [ ] **Шаг 7.1: красные тесты**

`src/lib/__tests__/backup.test.ts`:
- строка 51: `'ключи бэкапа = персистуемая схема v7 — …'` → `'ключи бэкапа = персистуемая схема v8 — …'`;
- в `it.each` блока `parseBackup — битые данные → corrupt` добавить кейс:
  ```ts
    // спека 27: домен lang — четыре языка приложения, чужой код — чужой файл
    ['язык вне четвёрки', (s) => { s.lang = 'de'; }],
  ```
- добавить рядом (после блока `describe('parseBackup — реальная форма состояния …')`):
  ```ts
  describe('lang из четырёх языков (спека 27)', () => {
    it.each(['ru', 'en', 'es', 'pt'])('%s проходит валидацию', (lang) => {
      const state = { ...VALID, lang } as BackupState;
      const text = JSON.stringify(buildBackup(state, SCHEMA_VERSION, AT));
      expect(parseBackup(text, SCHEMA_VERSION)).toEqual({ ok: true, state, exportedAt: AT });
    });
  });
  ```
- добавить проверку самой версии в блок `белый список и дефолты`:
  ```ts
  it('версия схемы 8: lang принимает es/pt — файл v8 старому ридеру откажет как «новее», а не «повреждён»', () => {
    expect(SCHEMA_VERSION).toBe(8);
  });
  ```

Run: `npx jest src/lib/__tests__/backup.test.ts` — Ожидание: FAIL (`es`/`pt` → corrupt; версия 7).

- [ ] **Шаг 7.2: `backup.ts`**

Строки 30–32:
```ts
/** Версия персистуемой схемы (logic-spec §7). Единственный источник: стор берёт её отсюда.
 *  Следующая задача, меняющая схему, поднимает ЭТУ константу до 8. */
export const SCHEMA_VERSION = 7;
```
→
```ts
/** Версия персистуемой схемы (logic-spec §7). Единственный источник: стор берёт её отсюда.
 *  v7 → v8 (спека 27): `lang` принимает es/pt — форма прежняя, ветки миграции нет; поднято, чтобы
 *  файл с `lang: 'es'` старый ридер отверг как «более новая версия», а не как «повреждён».
 *  Следующая задача, меняющая схему, поднимает ЭТУ константу до 9. */
export const SCHEMA_VERSION = 8;
```
Импорт: `import { isLang, type Lang } from './lang';` (заменить type-only импорт из задачи 2).
Строка 170: `(s.lang === 'ru' || s.lang === 'en') &&` → `isLang(s.lang) &&`.

`src/store/useApp.ts` — в комментарии над `version: SCHEMA_VERSION` (строка ~289) строку
`// Следующая задача, меняющая схему, поднимает до 8.` заменить на:
```ts
      // v7 → v8: домен `lang` расширен до ru/en/es/pt (спека 27) — форма не менялась, миграции нет.
      // Следующая задача, меняющая схему, поднимает до 9.
```

- [ ] **Шаг 7.3: зелёные, коммит**

Run: `npx jest src/lib/__tests__/backup.test.ts && npx tsc --noEmit && npm test`

```bash
git add src/lib/backup.ts src/store/useApp.ts src/lib/__tests__/backup.test.ts
git commit -m "feat: persist v8 — lang из четырёх языков в валидации бэкапа (spec 27)"
```

---

### Задача 8: `OptionPicker` + пикер языка в настройках + DEV-строка «Язык устройства»

**Файлы:**
- Создать: `src/components/OptionPicker.tsx`
- Правка: `src/components/TimePicker.web.tsx` (обёртка), `app/settings.tsx` (строка «Язык», DEV-строка, состояние)

**Интерфейсы:**
- `OptionPicker<K extends string>({ visible, title, options: readonly {key: K; label: string}[], value: K, onPick(key: K), onClose })`

- [ ] **Шаг 8.1: `OptionPicker`**

Создать `src/components/OptionPicker.tsx`:

```tsx
/** Список-модалка «выбери один вариант»: overline-заголовок и строки с галочкой на текущем.
 *
 *  Второе появление этой разметки (первое — выбор часа в вебе, TimePicker.web) — вынесена по правилу
 *  «2+ раза → общий компонент»; здесь живёт выбор языка (спека 27), дальше — расклады.
 *  Тап по уже выбранному варианту — «закрыть без изменений»: onPick не зовётся, значение не менялось
 *  (для часа это ещё и защита минут — см. TimePicker.web). Тап по скриму закрывает (ModalPanel).
 *  Значения стилей — те же, что были у списка часов: ничего визуально не меняется. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

export function OptionPicker<K extends string>({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly { key: K; label: string }[];
  value: K;
  onPick: (key: K) => void;
  onClose: () => void;
}) {
  const t = useTheme();

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <ScrollView style={{ maxHeight: 260 }}>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                if (!selected) onPick(o.key);
                onClose();
              }}
              style={[st.row, selected && { backgroundColor: t.chipBg, borderColor: t.frame }]}
            >
              <Txt style={{ color: selected ? t.head : t.text, fontSize: 15.5, flex: 1 }}>{o.label}</Txt>
              {selected && <Txt style={{ color: t.accent, fontSize: 13 }}>✓</Txt>}
            </Pressable>
          );
        })}
      </ScrollView>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.m,
    paddingVertical: 11,
    paddingHorizontal: spacing.m,
    marginBottom: 5,
  },
});
```

- [ ] **Шаг 8.2: `TimePicker.web.tsx` — обёртка**

Заменить содержимое файла целиком:

```tsx
/** Веб-версия выбора времени: список целых часов.
 *
 *  У @react-native-community/datetimepicker веб-реализации нет вовсе, а без неё экран
 *  «Настройки» нечем прокликать в браузере — то есть шаг 6а процесса по этой задаче
 *  выполнить было бы невозможно. Минуты в вебе не выбираются: там проверяется поведение
 *  экрана, а точное время — на устройстве.
 *
 *  Тап по уже выбранному (подсвеченному) часу — «закрыть без изменений», а не команда стереть
 *  минуты (OptionPicker не зовёт onPick для текущего значения): хранимое значение может нести
 *  реальные минуты — на телефоне их выбирает системный пикер, веб их только показывает.
 */
import React from 'react';
import { formatHHMM, parseHHMM } from '../lib/settings';
import { OptionPicker } from './OptionPicker';

export function TimePicker({
  visible,
  value,
  title,
  hours = [7, 8, 9, 10, 11],
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string;
  title: string;
  hours?: number[];
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) {
  const current = String(parseHHMM(value, hours[0]).hour);
  return (
    <OptionPicker
      visible={visible}
      title={title}
      options={hours.map((h) => ({ key: String(h), label: `${h}:00` }))}
      value={current}
      onPick={(key) => onPick(formatHHMM(Number(key), 0))}
      onClose={onClose}
    />
  );
}
```

- [ ] **Шаг 8.3: настройки — строка «Язык» и DEV-строка**

`app/settings.tsx`:
- импорты: добавить `import { OptionPicker } from '../src/components/OptionPicker';`,
  `import { deviceLocaleTags } from '../src/lib/deviceLang';`,
  `import { AVAILABLE_LANGS, useLang } from '../src/lib/i18n';` (объединить с импортом `useLang` из задачи 5),
  `import { detectLang, LANG_NAMES } from '../src/lib/lang';` (объединить с импортом `LANG_NAMES` из задачи 4);
- состояние — рядом со строкой 87 (`const [picker, setPicker] = …`) добавить:
  ```ts
  const [langPicker, setLangPicker] = React.useState(false);
  ```
- строка «Язык» (было строки 236–241):
  ```tsx
          <SettingsRow
            icon="language"
            label={tr('settings.language')}
            value={LANG_NAMES[lang]}
            onPress={() => setLangPicker(true)}
          />
  ```
- пикер — рядом с `<TimePicker …/>` (после него, перед первым `<ConfirmDialog`):
  ```tsx
        {/* выбор языка списком: четыре позиции по кругу не тапаются, макета пикера нет —
            дорисовка записана в задачу «Макет: правки дорисовок» (спека 27) */}
        <OptionPicker
          visible={langPicker}
          title={tr('settings.language')}
          options={AVAILABLE_LANGS.map((l) => ({ key: l, label: LANG_NAMES[l] }))}
          value={lang}
          onPick={setLang}
          onClose={() => setLangPicker(false)}
        />
  ```
- DEV-строка — в блок `{__DEV__ && (…)}` после строки «Пройти онбординг заново» (`FadeUp index={12}`):
  ```tsx
            <FadeUp index={13}>
              <SettingsRow
                icon="globe-outline"
                label={tr('settings.devDeviceLang')}
                // что видит детекция на ЭТОМ устройстве и что выбрала бы при первой установке;
                // тап применяет — иначе пункт 6в по языку устройства требует переустановки
                value={`${deviceLocaleTags()[0] ?? '—'} → ${detectLang(deviceLocaleTags(), AVAILABLE_LANGS)}`}
                onPress={() => setLang(detectLang(deviceLocaleTags(), AVAILABLE_LANGS))}
              />
            </FadeUp>
  ```

- [ ] **Шаг 8.4: проверка**

Run: `npx tsc --noEmit && npm test`
Ручная (веб): настройки → «Язык · Русский» → тап → список Русский/English/Español/Português с ✓ →
English → интерфейс английский мгновенно, строка «Язык · English»; Español → интерфейс английский
(фолбэк), строка «Язык · Español», в дневнике/на «Сегодня» дата по-испански («viernes · 15 de agosto»);
тап по текущему — закрылось без изменений; тап по скриму — закрылось. Время напоминаний (веб) —
список часов работает как раньше. Консоль — без ошибок.

- [ ] **Шаг 8.5: коммит**

```bash
git add src/components/OptionPicker.tsx src/components/TimePicker.web.tsx app/settings.tsx
git commit -m "feat: пикер языка списком (общий OptionPicker) и DEV-строка «Язык устройства» (spec 27)"
```

---

### Задача 9: веб-проверка 6а/6б, документы, push

**Файлы:**
- Создать: `docs/screenshots/27/*.png`
- Правка: `docs/product-spec.md:211`, `docs/logic-spec.md:113,155`, `AGENTS.md:13,35`, `CLAUDE.md` («Статус»),
  `docs/backlog.md` (задача 27, пункт `useLang()`, «Макет: правки дорисовок» п.9), `docs/localization-plan.md:61-64`,
  `docs/testing-strategy.md` (список модулей), `docs/specs/27-lang-infra.md` (отчёт).

- [ ] **Шаг 9.1: веб-проверка**

`npx expo start --web`; Playwright-скриптом (окно 390×844, как в задаче 16 — MCP-браузер на Windows
до 390 не сжимается) снять в обе темы: `settings-dark.png`/`settings-light.png` (пикер языка открыт),
`today-es.png` (после выбора Español: английский UI + испанская дата), `cards-es.png` (справочник,
поиск «sword» на es даёт карты). Прокликать: все 4 языка по кругу, тап по текущему, скрим; DEV-строка
«Язык устройства» показывает тег браузера; очистка site data → старт на языке браузера. Консоль чистая.
Проверить контраст/композицию по `docs/ui-verification.md` для пикера (стили от TimePicker.web — новых нет).

- [ ] **Шаг 9.2: документы**

`docs/product-spec.md:211` — `**Языки:** RU (основной)/EN,` → 
`**Языки:** RU (основной)/EN/ES/PT — выбор списком в настройках (эндонимы), при первой установке — язык устройства из доступных (иначе EN); контент без перевода падает на EN (спека 27); языки без UI-строк в списке не показываются,`

`docs/logic-spec.md:113` — `(сейчас \`version: 7\`)` → `(сейчас \`version: 8\`)`; после абзаца про v7
(строка ~150) перед «Следующая задача, меняющая схему, поднимает до 8.» вставить:
```
**27 подняла `version` до 8** — домен `lang` расширен до `ru|en|es|pt` (форма прежняя, ветки миграции
нет; поднято, чтобы файл с `lang: 'es'` старый ридер отверг как «новее», а не как «повреждён»).
Язык первой установки: `detectLang(теги устройства, AVAILABLE_LANGS)` в `onRehydrateStorage` вместе
с `installSeed` — снимок, дальше своё; `restoreBackup` язык из файла не трогает.
```
и заменить строку `Следующая задача, меняющая схему, поднимает до 8.` → `…поднимает до 9.`

`AGENTS.md:35` — абзац i18n заменить:
```
**i18n** — react-i18next, ресурсы inline в `src/lib/i18n.ts` (ru/en; es/pt-строки придут сессией L-0).
Языки v1 — `LANGS = ru|en|es|pt` в `src/lib/lang.ts` (тип `Lang` объявлен ТОЛЬКО там; словари эндонимов
и локалей, `detectLang`, тип многоязычной записи `Localized<T>` и доступ `inLang(rec, lang)` с фолбэком
на en). Язык лежит в zustand (источник правды); корневой layout синхронизирует i18n; экраны читают
`useLang()` из `i18n.ts` — каст `i18n.language.startsWith('ru')` запрещён контракт-тестом
`langSources.test.ts`. Контент индексировать по языку напрямую нельзя — только `inLang`.
`AVAILABLE_LANGS` — языки с UI-строками (в dev все четыре). `src/lib/deviceLang.ts` — единственный
файл, знающий `expo-localization`. UI-строки добавлять в оба языка `i18n.ts`.
```
`AGENTS.md:13` — обновить счётчик тестов на фактический после `npm test`.

`docs/backlog.md`: задача 27 → `[~]` с датой и ссылкой на спеку/план (после лайв-проверки — `[x]`);
пункт «Хелпер `useLang()` …» → `[x] … ЗАКРЫТ в составе 27`; в задачу «Макет: правки дорисовок 14.08»
добавить пункт `9. **Пикер языка в настройках** (спека 27): строка «Язык · Русский» → модальный список
эндонимов Русский/English/Español/Português с ✓ на текущем (композиция как у списка часов в вебе).`

`docs/localization-plan.md:61–64` — к CC-L1 приписать: `✅ СДЕЛАНО 15.08 (спека 27). Язык
«включается» появлением `resources.<lang>` в i18n.ts (AVAILABLE_LANGS) — L-0 кладёт строки, и
Español/Português сами появляются в пикере и детекции.`

`docs/testing-strategy.md` — в список модулей уровня 2 добавить строку:
`- язык (\`src/lib/lang.ts\`) — детекция по списку предпочтений устройства, фолбэк контента inLang, нормализация тегов; контракт \`langSources.test.ts\` — нет копий каста в исходниках;`

`CLAUDE.md` «Статус» — абзац о задаче 27 по образцу соседних (что сделано, что выросло общего:
`lang.ts`, `useLang`, `Localized`/`inLang`, `OptionPicker`, `deviceLang.ts`; ловушки, найденные по ходу;
persist v8; счётчик тестов). ⚠️ Правило про версию: «Следующая задача, меняющая схему стора, обязана
поднять persist version до 9».

`docs/specs/27-lang-infra.md` — раздел «Отчёт о реализации» (что отклонилось от плана, находки).

- [ ] **Шаг 9.3: финальная проверка и коммит**

Run: `npx tsc --noEmit && npm test` — записать фактические числа тестов/сьютов в AGENTS.md и CLAUDE.md.

```bash
git add -A docs AGENTS.md CLAUDE.md
git commit -m "docs: задача 27 — отчёт, product/logic-spec, AGENTS, backlog, скриншоты веб-проверки (spec 27)"
git push -u origin feat/27-lang-infra
```

- [ ] **Шаг 9.4: финальное ревью ветки (Opus)** — `git diff main...HEAD` целиком; сверка с критериями приёмки спеки;
затем лайв-проверка Артёма на iPhone (пикер, колесо даты по-испански при es, DEV-строка «Язык устройства»,
смена языка туда-обратно, пуш после смены языка приходит на новом языке); после ✓ — merge в `main`, `[x]` в backlog.

## Самопроверка плана (выполнена)

- Покрытие спеки: А (задача 1), Б (4), В (6), Г (6+7), Д (3), Е (2+5+6+8), Ж (1,3,4,5,7), З (5),
  критерии приёмки — задача 9 + контракт-тесты; «Что НЕ делаем» — нигде не нарушено.
- Плейсхолдеров нет; каждый шаг с кодом содержит код.
- Имена сходятся: `inLang`/`presentLang`/`detectLang`/`toLang`/`localeTag`/`LANG_NAMES`/`LOCALES`/`isLang`
  (задача 1) ↔ использование в 2–8; `AVAILABLE_LANGS`/`useLang` (4) ↔ 5, 6, 8; `deviceLocaleTags` (6) ↔ 8;
  `OptionPicker` (8) ↔ `TimePicker.web`.
- tsc чист после каждого коммита: расширение типов (2) → чтение через inLang (3, до сужения) →
  сужение типа (3) → хук (5) — порядок проверен рассуждением о присваиваемости.
