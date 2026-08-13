# План 09 · Онбординг — имплементация

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Трёхшаговый онбординг первого запуска (welcome → имя+дата → аркан рождения) по эталону
`#v-ob`, с профилем в сторе, фразами «ваш путь» в контенте и золотым чипом на странице карты.

**Architecture:** Отдельный маршрут `app/onboarding.tsx`, гейт через `Stack.Protected` в корневом
layout (сплэш держится до гидрации persist). Формула аркана — чистый модуль `src/lib/birthArcana.ts`.
Фразы — девятый блок `birth_path` в `content/cards.json` у 22 старших арканов.

**Tech Stack:** Expo SDK 54, expo-router v6 (`Stack.Protected`), zustand 5 + persist (version 6),
reanimated 4 (`src/lib/loops.ts`), `@react-native-community/datetimepicker` (уже установлен),
jest-expo.

**Spec:** `docs/specs/09-onboarding.md` — план аргументирует от неё, исполнители читают обе.

## Global Constraints

- SDK НЕ обновлять, мажорные версии пакетов не менять; `npm install` НЕ нужен (новых пакетов нет).
- Комментарии в коде и сообщения коммитов — русские. Никаких упоминаний ИИ в коммитах.
- После КАЖДОГО шага с правкой кода: `npx tsc --noEmit` — чистый.
- `npm test` зелёный перед каждым коммитом с тестами; новая формула → тест в том же коммите.
- Цвета ТОЛЬКО из `src/theme/theme.ts` (`useTheme()`), хардкод запрещён.
- Тени: прямоугольные — проп `boxShadow`; по контуру (SVG-эмблема) — `glowShadow` из
  `src/theme/glow.ts`. Старые `shadow*`-пропы не использовать.
- `pointerEvents` — только внутри `style`, не пропом.
- `Alert.alert` запрещён (на вебе пустышка) — подтверждений в этой задаче и нет.
- Persist: `version: 6` в этой задаче; следующая задача со схемой поднимает до 7.
- Ветка `feat/09-onboarding` от main; merge — только после лайв-проверки Артёма.

---

### Task 0: Ветка

- [ ] **Step 1: создать ветку**

```bash
git checkout main && git pull && git checkout -b feat/09-onboarding
```

---

### Task 1: Формула аркана рождения (`birthArcana.ts`)

**Files:**
- Create: `src/lib/birthArcana.ts`
- Test: `src/lib/__tests__/birthArcana.test.ts`

**Interfaces:**
- Consumes: `cards`, `cardById` из `src/lib/content.ts` (уже есть).
- Produces: `birthNumber(dateISO: string): number` · `birthArcanaId(dateISO: string): string` ·
  `buildProfile(name: string, birthDate?: string): Profile` ·
  `type Profile = { name?: string; birthDate?: string; birthArcanaId?: string; onboarded: boolean }`.
  На них полагаются Task 3 (стор) и Task 7 (экран).

- [ ] **Step 1: написать падающий тест**

`src/lib/__tests__/birthArcana.test.ts`:

```ts
import { birthArcanaId, birthNumber, buildProfile } from '../birthArcana';
import { cardById } from '../content';

describe('birthNumber — сумма цифр даты со свёрткой (logic-spec §5)', () => {
  test('15.03.1994 → 32 → 5', () => expect(birthNumber('1994-03-15')).toBe(5));
  test('29.12.1987 → 39 → 12', () => expect(birthNumber('1987-12-29')).toBe(12));
  test('01.01.2000 → 4', () => expect(birthNumber('2000-01-01')).toBe(4));
  test('10.02.1994 → 26 → 8 (кейс макета — Сила)', () => expect(birthNumber('1994-02-10')).toBe(8));
  test('10.02.1990 → ровно 22: дальше НЕ сворачивается', () =>
    expect(birthNumber('1990-02-10')).toBe(22));
});

describe('birthArcanaId — номер → карта', () => {
  test('22 → Дурак (fool, number 0)', () => expect(birthArcanaId('1990-02-10')).toBe('fool'));
  test('8 → strength', () => expect(birthArcanaId('1994-02-10')).toBe('strength'));
  test('инвариант: любая дата 1900–2100 даёт 1–22 и старший аркан из колоды', () => {
    // шаг 37 суток — покрывает все комбинации сумм без перебора 73 000 дней
    for (let ts = Date.UTC(1900, 0, 1); ts <= Date.UTC(2100, 0, 1); ts += 37 * 24 * 3600 * 1000) {
      const iso = new Date(ts).toISOString().slice(0, 10);
      const n = birthNumber(iso);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(22);
      expect(cardById.get(birthArcanaId(iso))?.arcana).toBe('major');
    }
  });
});

describe('buildProfile — сборка профиля онбордингом', () => {
  test('имя обрезается, дата даёт аркан', () =>
    expect(buildProfile('  Анна  ', '1994-02-10')).toEqual({
      name: 'Анна',
      birthDate: '1994-02-10',
      birthArcanaId: 'strength',
      onboarded: true,
    }));
  test('пустое имя/пробелы → поля name нет', () =>
    expect(buildProfile('   ')).toEqual({ onboarded: true }));
  test('без даты → ни birthDate, ни birthArcanaId', () =>
    expect(buildProfile('Анна')).toEqual({ name: 'Анна', onboarded: true }));
});
```

- [ ] **Step 2: убедиться, что тест падает**

Run: `npm test -- birthArcana`
Expected: FAIL — `Cannot find module '../birthArcana'`.

- [ ] **Step 3: реализация**

`src/lib/birthArcana.ts`:

```ts
/** Аркан рождения (logic-spec §5): сумма ВСЕХ цифр даты рождения, пока результат больше 22 —
 *  суммируем его цифры; 22 — Дурак (number 0), 1–21 — старший аркан с этим номером.
 *  Чистые функции без импортов react/expo — как journal.ts и pushPlan.ts. */
import { cards } from './content';

/** Профиль пользователя (logic-spec §7). Пишется онбордингом одним куском (buildProfile);
 *  onboarded: false у дефолта стора — признак «онбординг ещё не пройден». */
export interface Profile {
  name?: string;
  /** YYYY-MM-DD, локальная дата — как все даты проекта */
  birthDate?: string;
  birthArcanaId?: string;
  onboarded: boolean;
}

const digitSum = (s: string) =>
  [...s].reduce((sum, ch) => (ch >= '0' && ch <= '9' ? sum + Number(ch) : sum), 0);

/** Число рождения 1–22. Сумма цифр не зависит от порядка, поэтому считаем прямо
 *  по строке YYYY-MM-DD — ДД.ММ.ГГГГ из спеки не собираем. */
export function birthNumber(dateISO: string): number {
  let n = digitSum(dateISO);
  while (n > 22) n = digitSum(String(n));
  return n;
}

/** id карты аркана рождения. 22 старших аркана с number 0–21 в колоде есть всегда —
 *  контракт-тест контента держит это инвариантом, поэтому `!` безопасен. */
export function birthArcanaId(dateISO: string): string {
  const n = birthNumber(dateISO);
  const number = n === 22 ? 0 : n;
  return cards.find((c) => c.arcana === 'major' && c.number === number)!.id;
}

/** Сборка профиля финальной CTA онбординга: пустое имя не хранится пустой строкой,
 *  аркан считается только при выбранной дате. */
export function buildProfile(name: string, birthDate?: string): Profile {
  const trimmed = name.trim();
  return {
    ...(trimmed ? { name: trimmed } : {}),
    ...(birthDate ? { birthDate, birthArcanaId: birthArcanaId(birthDate) } : {}),
    onboarded: true,
  };
}
```

- [ ] **Step 4: тесты зелёные, tsc чистый**

Run: `npm test -- birthArcana` → PASS (11 тестов). Run: `npx tsc --noEmit` → пусто.

- [ ] **Step 5: коммит**

```bash
git add src/lib/birthArcana.ts src/lib/__tests__/birthArcana.test.ts
git commit -m "feat: формула аркана рождения с тестами (spec 09)"
```

---

### Task 2: Контент — фразы «ваш путь» (блок `birth_path`)

**Files:**
- Create: `scripts/add_birth_path.py` (остаётся в репо как staging-источник черновиков,
  по образцу `merge_quiz.py`)
- Modify: `content/cards.json` (скриптом, не руками)
- Test: `src/lib/__tests__/birthPathContent.test.ts`

**Interfaces:**
- Produces: у 22 старших карт `card.content.birth_path: { ru, en, status: "draft" }`.
  Тип `TarotCard.content` — `Record<string, CardContentBlock>`, правок типов НЕ нужно.
  На блок полагается Task 7 (экран, шаг 3).

- [ ] **Step 1: написать падающий контракт-тест**

`src/lib/__tests__/birthPathContent.test.ts`:

```ts
import { cards } from '../content';

// Контракт контента (спека 09): фразы «ваш путь» есть у ВСЕХ старших арканов и ТОЛЬКО у них.
// Ловит опечатку при будущей вычитке редактором — как courseContent.test.ts у викторин.
describe('birth_path в cards.json', () => {
  const majors = cards.filter((c) => c.arcana === 'major');
  const minors = cards.filter((c) => c.arcana === 'minor');

  test('22 старших: блок есть, ru и en непустые', () => {
    expect(majors).toHaveLength(22);
    for (const c of majors) {
      const b = c.content['birth_path'];
      expect(b).toBeDefined();
      expect(b.ru.trim().length).toBeGreaterThan(0);
      expect(b.en.trim().length).toBeGreaterThan(0);
    }
  });

  test('56 младших: блока нет', () => {
    expect(minors).toHaveLength(56);
    for (const c of minors) expect(c.content['birth_path']).toBeUndefined();
  });
});
```

- [ ] **Step 2: убедиться, что тест падает**

Run: `npm test -- birthPathContent`
Expected: FAIL — `b` undefined у всех 22 старших.

- [ ] **Step 3: скрипт с фразами**

`scripts/add_birth_path.py` (словарь по `number` карты — слаги не нужны):

```python
#!/usr/bin/env python3
"""Вставляет блок birth_path (фразы «ваш путь» онбординга, спека 09) в content/cards.json.

22 фразы — по одной на старший аркан, черновики (status: draft); вычитка редактором —
отдельная задача бэклога. Идемпотентен: СУЩЕСТВУЮЩИЙ блок не перезаписывает, чтобы повторный
прогон после вычитки не откатил правки редактора к черновику.
Формат записи — как у остального конвейера (ensure_ascii=False, indent=1, LF).
Запуск из корня: python scripts/add_birth_path.py
"""
import json
from pathlib import Path

CARDS = Path(__file__).resolve().parent.parent / "content" / "cards.json"

# Тон — content-guide: про характер пути, без предсказаний и обещаний, без медицины.
# Образец Силы (8) — дословно из макета design-reference.html (#ob3).
PHRASES = {
    0: {"ru": "Ваш путь — доверие к началу: вы умеете шагать в новое налегке, и мир отвечает вам дорогой.",
        "en": "Your path is trust in beginnings: you step into the new travelling light, and the road rises to meet you."},
    1: {"ru": "Ваш путь — воплощение: у вас под рукой всегда есть всё, чтобы замысел стал делом.",
        "en": "Your path is manifestation: you always have everything at hand to turn an idea into reality."},
    2: {"ru": "Ваш путь — внутренний голос: вы слышите то, что ещё не сказано вслух, и редко ошибаетесь, доверяя тишине.",
        "en": "Your path is the inner voice: you hear what has not yet been said aloud, and silence rarely misleads you."},
    3: {"ru": "Ваш путь — взращивание: рядом с вами люди и замыслы расцветают, как сад в заботливых руках.",
        "en": "Your path is nurturing: people and plans blossom around you like a well-tended garden."},
    4: {"ru": "Ваш путь — опора: вы строите порядок, на который могут положиться другие.",
        "en": "Your path is foundation: you build an order others can lean on."},
    5: {"ru": "Ваш путь — передача смысла: вы соединяете опыт поколений с собственной мудростью и делитесь ею просто.",
        "en": "Your path is passing on meaning: you join the wisdom of generations with your own and share it simply."},
    6: {"ru": "Ваш путь — выбор сердцем: вы умеете находить своё среди множества дорог и хранить верность выбранному.",
        "en": "Your path is choosing with the heart: you find what is truly yours among many roads and stay faithful to it."},
    7: {"ru": "Ваш путь — движение: воля и собранность несут вас туда, куда другие лишь смотрят.",
        "en": "Your path is motion: will and focus carry you where others only look."},
    8: {"ru": "Ваш путь — мягкая смелость: вы приручаете бури терпением там, где другие ломают двери.",
        "en": "Your path is gentle courage: you tame storms with patience where others break down doors."},
    9: {"ru": "Ваш путь — глубина: вы находите ответы наедине с собой и возвращаетесь к людям со светом.",
        "en": "Your path is depth: you find answers alone with yourself and return to people carrying light."},
    10: {"ru": "Ваш путь — чувство поворота: вы умеете ловить момент, когда жизнь меняет курс, и разворачиваться вместе с ней.",
         "en": "Your path is sensing the turn: you catch the moment life changes course and turn with it."},
    11: {"ru": "Ваш путь — ясность и честность: вы видите суть и умеете называть вещи своими именами.",
         "en": "Your path is clarity and honesty: you see the essence and call things by their names."},
    12: {"ru": "Ваш путь — иной взгляд: там, где все видят тупик, вы находите смысл, просто посмотрев с другой стороны.",
         "en": "Your path is another angle: where everyone sees a dead end, you find meaning simply by looking differently."},
    13: {"ru": "Ваш путь — обновление: вы не боитесь завершать отжившее, и потому новое приходит к вам легче, чем к другим.",
         "en": "Your path is renewal: you are not afraid to end what is over, so the new comes to you more easily."},
    14: {"ru": "Ваш путь — соразмерность: вы соединяете противоположности в живое равновесие.",
         "en": "Your path is balance: you blend opposites into living harmony."},
    15: {"ru": "Ваш путь — честность с собственными желаниями: вы видите свои привязанности в лицо, и в этом ваша свобода.",
         "en": "Your path is honesty with your own desires: you look your attachments in the eye, and that is your freedom."},
    16: {"ru": "Ваш путь — правда: вы умеете отпускать шаткое, чтобы строить на настоящем.",
         "en": "Your path is truth: you can let go of the shaky to build on what is real."},
    17: {"ru": "Ваш путь — тихая надежда: вы умеете видеть свет впереди и вести к нему других.",
         "en": "Your path is quiet hope: you see the light ahead and lead others toward it."},
    18: {"ru": "Ваш путь — чуткость: вы читаете полутона и сны там, где другие видят только темноту.",
         "en": "Your path is sensitivity: you read the half-tones and dreams where others see only darkness."},
    19: {"ru": "Ваш путь — ясная радость: ваше тепло освещает и вас, и тех, кто рядом.",
         "en": "Your path is clear joy: your warmth lights up both you and those around you."},
    20: {"ru": "Ваш путь — пробуждение: вы умеете слышать зов перемен и отвечать на него всей жизнью.",
         "en": "Your path is awakening: you hear the call of change and answer it with your whole life."},
    21: {"ru": "Ваш путь — целостность: вы доводите начатое до полноты и умеете праздновать завершение.",
         "en": "Your path is wholeness: you carry what you began to completion and know how to celebrate it."},
}


def main() -> None:
    data = json.loads(CARDS.read_text(encoding="utf-8"))
    added = skipped = 0
    for card in data["cards"]:
        if card["arcana"] != "major":
            continue
        if "birth_path" in card["content"]:
            skipped += 1
            continue
        phrase = PHRASES[card["number"]]
        card["content"]["birth_path"] = {"ru": phrase["ru"], "en": phrase["en"], "status": "draft"}
        added += 1
    CARDS.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"OK: birth_path добавлен {added}, уже был {skipped}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: прогнать скрипт, проверить идемпотентность**

Run: `python scripts/add_birth_path.py` → «OK: birth_path добавлен 22, уже был 0».
Run повторно → «OK: birth_path добавлен 0, уже был 22». `git diff --stat content/cards.json`
после второго прогона — без новых изменений.

- [ ] **Step 5: тесты зелёные**

Run: `npm test -- birthPathContent` → PASS. Run: `npx tsc --noEmit` → пусто.
Проверить, что конвейер видит блок: `python scripts/content_stats.py` — общее число блоков
выросло на 22 (646 вместо 624), ошибок нет.

- [ ] **Step 6: коммит**

```bash
git add scripts/add_birth_path.py content/cards.json src/lib/__tests__/birthPathContent.test.ts
git commit -m "content: фразы «ваш путь» для 22 старших арканов, черновики (spec 09)"
```

---

### Task 3: Стор — `profile`, persist version 6

**Files:**
- Modify: `src/store/useApp.ts`

**Interfaces:**
- Consumes: `buildProfile`, `type Profile` из Task 1.
- Produces: `useApp((s) => s.profile)` (`Profile`, дефолт `{ onboarded: false }`) ·
  `completeOnboarding(name: string, birthDate?: string): void` · `resetOnboarding(): void`.
  На них полагаются Task 6 (гейт), Task 7 (экран), Task 8 (чип и DEV-строка).

- [ ] **Step 1: правки `useApp.ts`**

К импортам:

```ts
import { buildProfile, type Profile } from '../lib/birthArcana';
```

Реэкспорт типа (рядом с `export type { AppSettings }`):

```ts
// профиль (имя, дата и аркан рождения) — тип живёт в src/lib/birthArcana.ts рядом с формулой
export type { Profile };
```

В `interface AppState` (после `settings: AppSettings;`):

```ts
  /** Профиль онбординга (logic-spec §7): имя, дата и аркан рождения.
   *  onboarded: false — онбординг ещё не пройден, корневой layout уводит на /onboarding. */
  profile: Profile;
```

и к экшенам (после `setPushAsked`):

```ts
  /** Финальная CTA онбординга: профиль пишется одним куском (buildProfile). */
  completeOnboarding: (name: string, birthDate?: string) => void;
  /** Только для разработки: вернуть онбординг — гард в _layout сам уведёт на экран. */
  resetOnboarding: () => void;
```

В дефолтах (после `settings: DEFAULT_SETTINGS,`):

```ts
      profile: { onboarded: false },
```

Экшены (после `setPushAsked: ...`):

```ts
      completeOnboarding: (name, birthDate) => set({ profile: buildProfile(name, birthDate) }),
      resetOnboarding: () => set({ profile: { onboarded: false } }),
```

Версия персиста — заменить строку `version: 5,` и дописать комментарий к списку миграций:

```ts
      // v5 → v6: profile (спека 09) — снова ключ ВЕРХНЕГО уровня, дефолт { onboarded: false }
      // доливается поверхностным слиянием сам, ветка миграции не нужна. Существующие установки
      // получают onboarded: false и проходят онбординг один раз (решение Артёма 13.08).
      // Следующая задача, меняющая схему, поднимает до 7.
      version: 6,
```

- [ ] **Step 2: tsc и полный прогон тестов**

Run: `npx tsc --noEmit` → пусто. Run: `npm test` → зелёный (правка стора ничего не ломает).

- [ ] **Step 3: коммит**

```bash
git add src/store/useApp.ts
git commit -m "feat: профиль пользователя в сторе, persist v6 (spec 09)"
```

---

### Task 4: Эмблема-компас — общий компонент

**Files:**
- Create: `src/components/Emblem.tsx`
- Modify: `src/components/CardBack.tsx` (заменить инлайновый SVG)

**Interfaces:**
- Produces: `Emblem({ size?: number })` — рисунок компаса, stroke из темы. Task 7 использует
  `size={110}`.

- [ ] **Step 1: создать `src/components/Emblem.tsx`**

```tsx
/** Эмблема-«компас» — рисунок из `.emb`/`.emb2` эталона. Отдельно от CardBack, потому что
 *  нужна в двух местах (рубашка карты дня и шаг 1 онбординга) — пути SVG не дублируем.
 *  Свечение НЕ здесь: у рубашки и онбординга разные радиусы, обёртку с glowShadow
 *  ставит вызывающий. */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

export function Emblem({ size = 96 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={t.accent} strokeWidth={0.9}>
      <Circle cx={50} cy={50} r={33} />
      <Circle cx={50} cy={50} r={41} strokeDasharray="2 5" />
      <Path d="M50 23 L57 43 L77 50 L57 57 L50 77 L43 57 L23 50 L43 43 Z" />
      <Circle cx={50} cy={50} r={7} />
      <Path d="M50 9v6M50 85v6M9 50h6M85 50h6" />
    </Svg>
  );
}
```

- [ ] **Step 2: перевести `CardBack.tsx` на него**

Внутри обёртки со свечением заменить весь `<Svg …>…</Svg>` (строки с `EMB_SIZE`) на:

```tsx
        <View style={glowShadow(t.glow, t.accent, 12, 0.35)}>
          <Emblem size={EMB_SIZE} />
        </View>
```

Импорт `{ Emblem } from './Emblem'`; из импорта `react-native-svg` в CardBack убрать
`Circle` и `Path` (остаются `Svg, Defs, RadialGradient, Rect, Stop` для фона).
Константа `EMB_SIZE = 96` остаётся.

- [ ] **Step 3: tsc + визуальный no-op**

Run: `npx tsc --noEmit` → пусто. На запущенном dev-сервере (`http://localhost:8081`) рубашка
карты дня выглядит как раньше (рефакторинг без визуальных изменений).

- [ ] **Step 4: коммит**

```bash
git add src/components/Emblem.tsx src/components/CardBack.tsx
git commit -m "refactor: эмблема-компас вынесена в общий компонент (spec 09)"
```

---

### Task 5: Пикер даты рождения (`DatePicker` + веб-версия) и формат полной даты

**Files:**
- Modify: `src/lib/dates.ts` (+ `formatFullDate`)
- Test: `src/lib/__tests__/dates.test.ts` (+ 2 кейса)
- Create: `src/components/DatePicker.tsx`
- Create: `src/components/DatePicker.web.tsx`

**Interfaces:**
- Consumes: `ModalPanel`, `Txt`, `parseISODate`/`localDateISO` из `dates.ts`.
- Produces: `formatFullDate(iso: string, lang: 'ru' | 'en'): string` («10 февраля 1994»);
  `DatePicker({ visible, value: string | null, title, onPick: (iso: string) => void, onClose })`.
  На них полагается Task 7.

- [ ] **Step 1: падающий тест формата даты**

В существующий `src/lib/__tests__/dates.test.ts` добавить:

```ts
import { formatFullDate } from '../dates';

describe('formatFullDate — дата рождения в поле онбординга (спека 09)', () => {
  test('ru: «10 февраля 1994», год без хвоста «г.»', () =>
    expect(formatFullDate('1994-02-10', 'ru')).toBe('10 февраля 1994'));
  test('en: «February 10, 1994»', () =>
    expect(formatFullDate('1994-02-10', 'en')).toBe('February 10 1994'));
});
```

Run: `npm test -- dates` → FAIL (`formatFullDate` не экспортирован).

- [ ] **Step 2: реализация в `dates.ts`**

После `formatMonthTitle` добавить:

```ts
/** «10 февраля 1994» — дата рождения в поле онбординга (спека 09). Год приписываем сами:
 *  с `year: 'numeric'` русская локаль добавляет хвост «г.» (та же ловушка, что formatMonthTitle). */
export function formatFullDate(iso: string, lang: Lang): string {
  const d = parseISODate(iso);
  return `${d.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long' })} ${d.getFullYear()}`;
}
```

Run: `npm test -- dates` → PASS (en-кейс сверить с фактическим выводом ICU: `toLocaleDateString`
с `{day, month}` в en-US даёт «February 10» — итог «February 10 1994»; если тест показал другое,
поправить ОЖИДАНИЕ теста по реальному выводу, формат собирается из тех же частей, что и ru).

- [ ] **Step 3: нативный `DatePicker.tsx`**

По образцу `TimePicker.tsx` (черновик + OK на iOS, системный диалог на Android, `themeVariant`):

```tsx
/** Выбор даты рождения — системный пикер (спека 09), пара к TimePicker: та же схема
 *  «iOS-колесо в ModalPanel с черновиком и OK, Android — системный диалог».
 *  Веб-реализации у пакета нет — она в соседнем DatePicker.web.tsx, Metro подставит сам. */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { localDateISO, parseISODate } from '../lib/dates';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

/** Стартовая позиция колеса, пока дата не выбрана: середина диапазона аудитории (спека 09). */
const DEFAULT_DATE = new Date(1995, 5, 15);
const MIN_DATE = new Date(1900, 0, 1);

export function DatePicker({
  visible,
  value,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** YYYY-MM-DD; null — дата ещё не выбрана */
  value: string | null;
  title: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const date = React.useMemo(() => (value ? parseISODate(value) : DEFAULT_DATE), [value]);

  // Черновик и «OK» — как в TimePicker: iOS-колесо шлёт onChange на КАЖДЫЙ тик прокрутки
  // (ловушка 06б), поэтому крутить ≠ сохранять; запись — только кнопкой.
  const [draft, setDraft] = React.useState(date);
  React.useEffect(() => {
    if (visible) setDraft(date);
  }, [visible, date]);

  const onChangeAndroid = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || !picked) {
      onClose();
      return;
    }
    onPick(localDateISO(picked));
    onClose();
  };

  const onChangeIOS = (_event: DateTimePickerEvent, picked?: Date) => {
    if (picked) setDraft(picked);
  };

  const confirmIOS = () => {
    onPick(localDateISO(draft));
    onClose();
  };

  if (!visible) return null;

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        minimumDate={MIN_DATE}
        maximumDate={new Date()}
        onChange={onChangeAndroid}
      />
    );
  }

  return (
    <ModalPanel visible onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <DateTimePicker
        value={draft}
        mode="date"
        display="spinner"
        minimumDate={MIN_DATE}
        maximumDate={new Date()}
        onChange={onChangeIOS}
        // тема приложения — своя настройка; без themeVariant колесо красится под системную
        // тему телефона и на светлом iOS с тёмной темой приложения невидимо (ловушка 06б)
        themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
      />
      <Pressable onPress={confirmIOS} style={[st.done, { borderColor: t.frame }]}>
        <Txt style={[st.doneTxt, { color: t.accent }]}>{tr('settings.ok')}</Txt>
      </Pressable>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
```

- [ ] **Step 4: веб-версия `DatePicker.web.tsx`**

```tsx
/** Веб-версия выбора даты: три списка (день / месяц / год) + OK.
 *  У @react-native-community/datetimepicker веб-реализации нет; без замены шаг 2 онбординга
 *  нечем прокликать в браузере (проверка 6а/6б). Точность жеста — на устройстве. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { localDateISO, parseISODate } from '../lib/dates';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

const DEFAULT_DATE = new Date(1995, 5, 15);
const MIN_YEAR = 1900;

/** Дней в месяце (месяц 0–11): new Date(y, m+1, 0) — последний день месяца m. */
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function DatePicker({
  visible,
  value,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string | null;
  title: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US';

  const init = value ? parseISODate(value) : DEFAULT_DATE;
  const [day, setDay] = React.useState(init.getDate());
  const [month, setMonth] = React.useState(init.getMonth());
  const [year, setYear] = React.useState(init.getFullYear());
  React.useEffect(() => {
    if (visible) {
      const d = value ? parseISODate(value) : DEFAULT_DATE;
      setDay(d.getDate());
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  }, [visible, value]);

  const now = new Date();
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= MIN_YEAR; y--) years.push(y);
  // названия месяцев — из локали, не руками (спека 09 §10)
  const months = Array.from({ length: 12 }, (_, m) =>
    new Date(2000, m, 1).toLocaleDateString(locale, { month: 'long' }),
  );
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  const confirm = () => {
    // «31 февраля» не собрать: день зажимается в реальную длину месяца
    let picked = new Date(year, month, Math.min(day, daysInMonth(year, month)));
    if (picked > now) picked = now; // будущее закрыто, как maximumDate нативного пикера
    onPick(localDateISO(picked));
    onClose();
  };

  const column = <T extends number>(
    items: T[],
    selected: T,
    label: (v: T) => string,
    onSel: (v: T) => void,
  ) => (
    <ScrollView style={st.col}>
      {items.map((v) => (
        <Pressable
          key={v}
          onPress={() => onSel(v)}
          style={[st.row, v === selected && { backgroundColor: t.chipBg, borderColor: t.frame }]}
        >
          <Txt style={{ color: v === selected ? t.head : t.text, fontSize: 13.5 }}>{label(v)}</Txt>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <View style={st.cols}>
        {column(days, day, String, setDay)}
        {column(Array.from({ length: 12 }, (_, m) => m), month, (m) => months[m], setMonth)}
        {column(years, year, String, setYear)}
      </View>
      <Pressable onPress={confirm} style={[st.done, { borderColor: t.frame }]}>
        <Txt style={[st.doneTxt, { color: t.accent }]}>{tr('settings.ok')}</Txt>
      </Pressable>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  cols: { flexDirection: 'row', gap: 6, height: 240, marginBottom: spacing.m },
  col: { flex: 1 },
  row: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.s,
    paddingVertical: 8,
    paddingHorizontal: spacing.s,
    marginBottom: 3,
    alignItems: 'center',
  },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
```

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit` → пусто (компоненты ещё нигде не используются — это нормально).

- [ ] **Step 6: коммит**

```bash
git add src/lib/dates.ts src/lib/__tests__/dates.test.ts src/components/DatePicker.tsx src/components/DatePicker.web.tsx
git commit -m "feat: пикер даты рождения и формат полной даты (spec 09)"
```

---

### Task 6: i18n-ключи онбординга (ru + en)

**Files:**
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Produces: ключи `ob.*` и `settings.devOnboarding` в ОБОИХ языках. На них полагаются
  Task 7 (экран) и Task 8 (чип — ключ `ob.birthOverline`, DEV-строка).

- [ ] **Step 1: добавить в `resources.ru.translation`** (после блока `spreads`):

```ts
      // онбординг (спека 09); birthOverline общий с чипом на странице карты
      ob: {
        sub: "Научитесь читать таро — по 5 минут в день. Без магии из кино, с уважением к традиции.",
        start: "НАЧАТЬ ПУТЬ",
        aboutTitle: "Немного о вас",
        aboutLead: "Дата рождения откроет ваш личный аркан — карту-спутницу вашей жизни.",
        nameLabel: "ИМЯ",
        namePlaceholder: "Как к вам обращаться",
        birthLabel: "ДАТА РОЖДЕНИЯ",
        birthPlaceholder: "Выберите дату",
        pickTitle: "Дата рождения",
        openArcana: "ОТКРЫТЬ МОЙ АРКАН",
        continue: "ПРОДОЛЖИТЬ",
        birthOverline: "ВАШ АРКАН РОЖДЕНИЯ",
        learnMore: "УЗНАТЬ БОЛЬШЕ ОБО МНЕ",
      },
```

и в `settings` (ru): `devOnboarding: "Пройти онбординг заново",`

- [ ] **Step 2: добавить в `resources.en.translation`** (симметрично, та же позиция):

```ts
      ob: {
        sub: "Learn to read tarot — five minutes a day. No movie magic, with respect for the tradition.",
        start: "BEGIN THE PATH",
        aboutTitle: "About you",
        aboutLead: "Your birth date reveals your personal arcana — the card that walks beside you.",
        nameLabel: "NAME",
        namePlaceholder: "What should we call you",
        birthLabel: "BIRTH DATE",
        birthPlaceholder: "Pick a date",
        pickTitle: "Birth date",
        openArcana: "REVEAL MY ARCANA",
        continue: "CONTINUE",
        birthOverline: "YOUR BIRTH ARCANA",
        learnMore: "TELL ME MORE",
      },
```

и в `settings` (en): `devOnboarding: "Replay onboarding",`

- [ ] **Step 3: tsc + структурные тесты i18n**

Run: `npx tsc --noEmit` → пусто. Run: `npm test -- i18nPlurals` → PASS (структурный тест обходит
ключи по `Object.keys(resources)` — новые ключи без `{{count}}` его не задевают, но прогнать
обязательно: он ловит рассинхрон структур ru/en).

- [ ] **Step 4: коммит**

```bash
git add src/lib/i18n.ts
git commit -m "feat: строки онбординга ru/en (spec 09)"
```

---

### Task 7: Экран онбординга + гейт первого запуска

**Files:**
- Create: `app/onboarding.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `birthArcanaId` (Task 1), `profile`/`completeOnboarding` (Task 3), `Emblem` (Task 4),
  `DatePicker`/`formatFullDate` (Task 5), ключи `ob.*` (Task 6), `pingPong`/`startSpin` из
  `src/lib/loops.ts`, `glowShadow` из `src/theme/glow.ts`, `hapticTap`/`hapticSuccess`,
  `CtaButton`, `FadeUp`, `ScreenBg`, `Txt`, `cardById`/`cardImages`.
- Produces: маршрут `/onboarding`; гейт: `!profile.onboarded` → онбординг, иначе — приложение.

- [ ] **Step 1: экран `app/onboarding.tsx`**

```tsx
/** Онбординг первого запуска (спека 09): welcome → о вас → аркан рождения.
 *  Три шага живут в ОДНОМ экране: они делят состояние формы и точки-прогресс.
 *  Профиль пишется ТОЛЬКО финальной CTA (шаг 3, либо «ПРОДОЛЖИТЬ» при пропуске даты):
 *  приложение, закрытое посреди онбординга, начнёт его заново — осознанное решение спеки.
 *  Разрешение на пуши здесь НЕ спрашивается (правило 06б: прелюдия после первой карты дня). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { DatePicker } from '../src/components/DatePicker';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { birthArcanaId } from '../src/lib/birthArcana';
import { cardById, cardImages } from '../src/lib/content';
import { formatFullDate } from '../src/lib/dates';
import { hapticSuccess, hapticTap } from '../src/lib/haptics';
import { pingPong, startSpin } from '../src/lib/loops';
import { useApp } from '../src/store/useApp';
import { glowShadow } from '../src/theme/glow';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

const EMBLEM_SIZE = 110; // .emb2 svg эталона
const CARD_WIDTH = 165; // .reveal: 150 макета + масштаб рамы ~10%
const CARD_HEIGHT = Math.round((CARD_WIDTH * 518) / 300); // пропорция сканов assets/cards

export default function Onboarding() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const insets = useSafeAreaInsets();
  const completeOnboarding = useApp((s) => s.completeOnboarding);

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [name, setName] = React.useState('');
  const [birthDate, setBirthDate] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // эмблема шага 1 — вращение 40s (.emb2 эталона); цикл через loops.ts (ловушка withRepeat)
  const angle = useSharedValue(0);
  React.useEffect(() => {
    startSpin(angle, 40_000);
  }, [angle]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  // карта шага 3 — парение ±4px, полный цикл 4s (hov эталона); запуск при входе на шаг
  const hover = useSharedValue(0);
  const hoverStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hover.value }] }));

  const goStep = (next: 2 | 3) => {
    hapticTap();
    setStep(next);
    if (next === 3) {
      hover.value = -4;
      hover.value = pingPong(4, 2000);
      hapticSuccess(); // вау-момент: карта аркана появилась
    }
  };

  // Финал: профиль в стор одним куском. Дальше уводит САМ гард — expo-router, потеряв
  // текущий экран из навигатора, переходит на anchor (у нас initialRouteName '(tabs)').
  // ⚠️ Своего router.replace('/(tabs)') здесь быть НЕ должно: в момент вызова состояние
  // ещё не перерисовалось, маршрута (tabs) в навигаторе нет, и переход уходит в никуда.
  // По той же причине переход на страницу аркана откладывается на следующий тик — к нему
  // гард уже отработал и маршрут card/[id] существует.
  const finish = (cardId: string | null) => {
    completeOnboarding(name, birthDate ?? undefined);
    // «назад» со страницы карты ведёт на «Сегодня»: под ней лежит anchor, а не онбординг
    if (cardId) {
      setTimeout(() => router.push({ pathname: '/card/[id]', params: { id: cardId, from: 'today' } }), 0);
    }
  };

  const arcana = birthDate ? cardById.get(birthArcanaId(birthDate)) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* key={step}: новый шаг = свежий монтаж, FadeUp отыгрывает каскад заново */}
          <View key={step} style={st.step}>
            {step === 1 && (
              <>
                <FadeUp index={0}>
                  <Animated.View style={[st.emblem, spin]}>
                    {/* ticks={false} — у эмблемы онбординга (.emb2 эталона) засечек
                        по сторонам света нет, в отличие от рубашки карты (.emb) */}
                    <View style={glowShadow(t.glow, t.accent, 16, 0.35)}>
                      <Emblem size={EMBLEM_SIZE} ticks={false} />
                    </View>
                  </Animated.View>
                </FadeUp>
                <FadeUp index={1}>
                  <Txt style={[st.h1, { color: t.head }]}>Arcanum</Txt>
                </FadeUp>
                <FadeUp index={2}>
                  <Txt style={[st.lead, { color: t.muted }]}>{tr('ob.sub')}</Txt>
                </FadeUp>
                <FadeUp index={3} style={st.ctaWrap}>
                  <CtaButton label={tr('ob.start')} onPress={() => goStep(2)} />
                </FadeUp>
              </>
            )}

            {step === 2 && (
              <>
                <FadeUp index={0}>
                  <Txt style={[st.h2, { color: t.head }]}>{tr('ob.aboutTitle')}</Txt>
                </FadeUp>
                <FadeUp index={1}>
                  <Txt style={[st.lead, { color: t.muted }]}>{tr('ob.aboutLead')}</Txt>
                </FadeUp>
                <FadeUp index={2} style={st.fieldWrap}>
                  <View style={[st.field, { backgroundColor: t.panel, borderColor: t.line }]}>
                    <Txt style={[st.fieldLabel, { color: t.accent }]}>{tr('ob.nameLabel')}</Txt>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={tr('ob.namePlaceholder')}
                      placeholderTextColor={t.muted}
                      autoCorrect={false}
                      returnKeyType="done"
                      style={[st.fieldInput, { color: t.head }]}
                    />
                  </View>
                </FadeUp>
                <FadeUp index={3} style={st.fieldWrap}>
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    style={[st.field, { backgroundColor: t.panel, borderColor: t.line }]}
                  >
                    <Txt style={[st.fieldLabel, { color: t.accent }]}>{tr('ob.birthLabel')}</Txt>
                    <Txt style={[st.fieldValue, { color: birthDate ? t.head : t.muted }]}>
                      {birthDate ? formatFullDate(birthDate, lang) : tr('ob.birthPlaceholder')}
                    </Txt>
                  </Pressable>
                </FadeUp>
                {/* дата выбрана → к аркану; нет → «ПРОДОЛЖИТЬ» = «пропустить» из product-spec §0 */}
                <FadeUp index={4} style={st.ctaWrap}>
                  <CtaButton
                    label={tr(birthDate ? 'ob.openArcana' : 'ob.continue')}
                    onPress={() => (birthDate ? goStep(3) : finish(null))}
                  />
                </FadeUp>
              </>
            )}

            {step === 3 && arcana && (
              <>
                <FadeUp index={0}>
                  <Txt style={[st.overline, { color: t.accent }]}>{tr('ob.birthOverline')}</Txt>
                </FadeUp>
                <FadeUp index={1}>
                  <Animated.View
                    style={[
                      st.reveal,
                      { borderColor: t.frame, boxShadow: `0px 20px 50px ${t.glow}` },
                      hoverStyle,
                    ]}
                  >
                    <Image
                      source={cardImages[arcana.id]}
                      style={st.revealImg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </Animated.View>
                </FadeUp>
                <FadeUp index={2}>
                  <Txt style={[st.cardName, { color: t.head }]}>{arcana.name[lang]}</Txt>
                </FadeUp>
                <FadeUp index={3}>
                  <Txt style={[st.lead, { color: t.muted }]}>
                    {arcana.content['birth_path']?.[lang] ?? ''}
                  </Txt>
                </FadeUp>
                <FadeUp index={4} style={st.ctaWrap}>
                  <CtaButton label={tr('ob.learnMore')} onPress={() => finish(arcana.id)} />
                </FadeUp>
              </>
            )}

            <View style={st.dots}>
              {([1, 2, 3] as const).map((n) => (
                <View
                  key={n}
                  style={[
                    st.dot,
                    { backgroundColor: n === step ? t.accent : t.line },
                    n === step && st.dotOn,
                  ]}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePicker
        visible={pickerOpen}
        value={birthDate}
        title={tr('ob.pickTitle')}
        onPick={setBirthDate}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  step: { flex: 1, alignItems: 'center' },
  emblem: { marginTop: 40, marginBottom: 30 },
  h1: { fontFamily: fonts.display, fontSize: 32, textAlign: 'center' },
  h2: { fontFamily: fonts.display, fontSize: 26, marginTop: 30, textAlign: 'center' },
  lead: { fontSize: 14, lineHeight: 24, textAlign: 'center', marginTop: 12, maxWidth: 270 },
  fieldWrap: { width: '100%' },
  field: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 12 },
  fieldLabel: { fontSize: 9, letterSpacing: 2 },
  fieldValue: { fontFamily: fonts.display, fontSize: 16, marginTop: 3 },
  fieldInput: { fontFamily: fonts.display, fontSize: 16, marginTop: 3, padding: 0 },
  overline: { fontSize: 10, letterSpacing: 2, marginTop: 8 },
  reveal: { marginTop: 26, marginBottom: 16, borderWidth: 1, borderRadius: 12 },
  revealImg: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 12 },
  cardName: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center' },
  ctaWrap: { width: '100%', marginTop: 'auto' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
});
```

- [ ] **Step 2: гейт в `app/_layout.tsx`**

Три правки:

1. Состояние гидрации и подписка (внутри `RootLayout`, после `const lang = ...`):

```tsx
  // сплэш держится до гидрации persist: иначе у нового пользователя мигнёт «Сегодня»
  // до редиректа на онбординг, а у старого — наоборот (спека 09)
  const [hydrated, setHydrated] = useState(() => useApp.persist.hasHydrated());
  const onboarded = useApp((s) => s.profile.onboarded);
  useEffect(() => useApp.persist.onFinishHydration(() => setHydrated(true)), []);
```

(добавить `useState` к импорту из `react`).

2. Условие сплэша — обе строки:

```tsx
  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;
```

3. Дети `<Stack>` — обернуть в `Stack.Protected`. Онбординг объявлен ПЕРВЫМ: когда
`onboarded === false`, все основные экраны сняты гардом и роутер падает на первый
доступный маршрут — онбординг (мигания кадра нет: недоступные маршруты вообще
не попадают в состояние навигатора):

```tsx
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.head,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          {/* ...четыре существующих Stack.Screen БЕЗ изменений: (tabs), card/[id],
              note/[date], lesson/[id] — переносятся внутрь как есть... */}
        </Stack.Protected>
      </Stack>
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit` → пусто.
⚠️ Если ругается на маршрут `/onboarding` в `router`-вызовах — маршрут новый, `typedRoutes`
пересобирает `.expo/types/router.d.ts` только при работающем dev-сервере (ловушка задачи 07):
запустить `npx expo start --web`, дождаться сборки, повторить tsc.

⚠️ **Проверено по документации Expo v54 перед реализацией** (`docs.expo.dev/router/advanced/protected/`):
«если экран становится защищённым, пока он активен, пользователя перенаправляет на anchor-маршрут
или на ПЕРВЫЙ ДОСТУПНЫЙ экран стека». Отсюда два следствия, которые нельзя нарушать:
1. При `!onboarded` доступен ровно ОДИН экран (онбординг) — потому все четыре остальных обязаны
   лежать внутри `Stack.Protected guard={onboarded}`. Оставь хоть один снаружи — и «первым
   доступным» на холодном старте может оказаться он, порядок тут не наш.
2. `unstable_settings = { initialRouteName: '(tabs)' }` остаётся как есть: при `onboarded`
   он и есть anchor, на который роутер уводит сам после финальной CTA.

- [ ] **Step 4: ручная проверка на вебе (smoke, не 6а)**

На `http://localhost:8081`: приложение открывается как обычно (профиль ещё не записан в вебе →
должен открыться онбординг). Пройти: шаг 1 → CTA → шаг 2 → выбрать дату 10.02.1994 →
«ОТКРЫТЬ МОЙ АРКАН» → шаг 3 показывает Силу с фразой → CTA → страница карты, «назад» →
«Сегодня». Перезагрузить страницу — онбординг больше не показывается.
Второй заход: очистить localStorage (DevTools → Application → Local Storage → удалить ключ
`arcanum-app`), перезагрузить — онбординг снова; на шаге 2 НЕ выбирать дату → «ПРОДОЛЖИТЬ» →
сразу табы. Консоль — без новых ошибок.

- [ ] **Step 5: коммит**

```bash
git add app/onboarding.tsx app/_layout.tsx
git commit -m "feat: экран онбординга и гейт первого запуска (spec 09)"
```

---

### Task 8: Чип «ВАШ АРКАН РОЖДЕНИЯ» + DEV-сброс онбординга

**Files:**
- Modify: `app/card/[id].tsx` (чип у названия)
- Modify: `app/settings.tsx` (DEV-строка)

**Interfaces:**
- Consumes: `profile.birthArcanaId`, `resetOnboarding` (Task 3), ключ `ob.birthOverline` и
  `settings.devOnboarding` (Task 6).

- [ ] **Step 1: чип на странице карты**

В `app/card/[id].tsx`:

1. Селектор (рядом с существующими селекторами стора):

```tsx
  // золотой чип у названия, если карта — аркан рождения пользователя (product-spec §3, спека 09)
  const birthCardId = useApp((s) => s.profile.birthArcanaId);
```

2. После `const isTodayCard = ...`:

```tsx
  const isBirthArcana = birthCardId === card.id;
```

3. Заменить строку `<Txt style={[st.name, { color: t.head }]}>{card.name[lang]}</Txt>` на:

```tsx
            <View style={st.nameRow}>
              <Txt style={[st.name, { color: t.head }]}>{card.name[lang]}</Txt>
              {isBirthArcana && (
                <View style={[st.birthChip, { backgroundColor: t.chipBg, borderColor: t.frame }]}>
                  <Txt style={[st.birthChipTxt, { color: t.accent }]}>
                    ✦ {tr('ob.birthOverline')}
                  </Txt>
                </View>
              )}
            </View>
```

4. В `StyleSheet.create` добавить:

```tsx
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  birthChip: { borderWidth: 1, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  birthChipTxt: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
```

- [ ] **Step 2: DEV-строка в настройках**

В `app/settings.tsx`: селектор `const resetOnboarding = useApp((s) => s.resetOnboarding);`
и в секцию `__DEV__` после последней строки (`devCourseReset`, `FadeUp index={11}`):

```tsx
            <FadeUp index={12}>
              <SettingsRow
                icon="sparkles-outline"
                label={tr('settings.devOnboarding')}
                value="DEV"
                // сброс профиля целиком: гард в _layout сам уводит на онбординг
                onPress={resetOnboarding}
              />
            </FadeUp>
```

- [ ] **Step 3: tsc + прокликивание**

Run: `npx tsc --noEmit` → пусто. На вебе: пройти онбординг с датой 10.02.1994 → страница Силы
показывает чип; открыть любую другую карту — чипа нет. Настройки → «Пройти онбординг заново» →
экран онбординга открывается сам (гард сработал).

- [ ] **Step 4: коммит**

```bash
git add "app/card/[id].tsx" app/settings.tsx
git commit -m "feat: чип аркана рождения и DEV-сброс онбординга (spec 09)"
```

---

### Task 9: Веб-проверка 6а-0 / 6а / 6б (делает исполнитель, НЕ Артём)

**Files:**
- Create: `docs/screenshots/09/*.png`

- [ ] **Step 1 (6а-0):** сверить реализацию с ДВУМЯ парами: «приложение = макет `#v-ob`»
  И «макет = спеки». Известные расхождения уже зафиксированы в спеке: чип на странице карты
  (в макете нет — прав product-spec §3), динамическая CTA вместо кнопки «пропустить»
  (правится формулировка §0). Новые конфликты — флаг Артёму, реализация по спеке.

- [ ] **Step 2 (6а):** `npx expo start --web` + Playwright MCP: окно 390×844, скриншоты
  трёх шагов в ОБЕИХ темах (тему переключать через настройки до сброса онбординга) →
  `docs/screenshots/09/step{1,2,3}-{dark,light}.png` + страница карты с чипом.
  Рядом второе окно с `file:///…/docs/design-reference.html` (кнопка «Онбординг») — сверка
  композиции по чек-листу `docs/ui-verification.md`. Каждое расхождение — исправить или
  явно перечислить в отчёте спеки с причиной.

- [ ] **Step 3 (6б):** прокликать каждый интерактив: CTA всех шагов, поле имени (ввод, длинное
  имя 30+ символов — не ломает вёрстку), поле даты → веб-пикер (три списка, OK, отмена тапом
  по затемнению, 29 февраля: месяц февраль + день 31 → зажим в 28/29), «ПРОДОЛЖИТЬ» без даты,
  чип на карте, «назад» → «Сегодня», DEV-сброс, перезагрузка страницы на каждом шаге
  (онбординг с начала — профиль не записан), обе локали (en: переключить язык в настройках,
  сбросить онбординг — все строки английские). Консоль браузера — ноль новых ошибок/warning.
  Известные ограничения веба НЕ баги: хаптики нет, системного колеса нет (три списка),
  нативные тени слабее.

- [ ] **Step 4:** отчёт о проверке — дополнением в `docs/specs/09-onboarding.md`
  (что проверено, что расходится и почему), скриншоты в коммит:

```bash
git add docs/screenshots/09 docs/specs/09-onboarding.md
git commit -m "docs: веб-проверка онбординга, скриншоты и отчёт (spec 09)"
```

---

### Task 10: Синхронизация доков + финальный прогон

**Files:**
- Modify: `docs/product-spec.md` (§0 статус ✅ + формулировка CTA; §3 чип ✅)
- Modify: `docs/logic-spec.md` (§7: profile реализован, `version: 6`, следующая — 7)
- Modify: `docs/backlog.md` (09 → [x] с отчётом; + задача «Контент: вычитать birth_path»;
  дополнение задачи 15 — дорисовка чипа аркана; дополнение задачи 16 — «предложить дату,
  если пропущена»)
- Modify: `CLAUDE.md` (раздел «Статус»: задача 09, persist → 6, следующая — 7;
  счётчик тестов)

- [ ] **Step 1: правки доков по списку выше.** В backlog новая контентная задача:

```markdown
- [ ] **23 · Контент: вычитать birth_path (22 фразы «ваш путь»)** (заведено 13.08, спека 09) —
      черновики написаны кодом (scripts/add_birth_path.py), показываются в онбординге и ждут
      вычитки редактором: `python scripts/set_status.py reviewed --only cards` после круга
      правок (двинет ВСЕ draft-блоки карт — если к тому моменту будут другие черновики,
      править точечно). Тон: «ваш путь», без предсказаний (content-guide).
```

- [ ] **Step 2: финальный прогон**

Run: `npx tsc --noEmit` → пусто. Run: `npm test` → зелёный, зафиксировать итоговое число
тестов и сьютов В МОМЕНТ прогона (правило hf-02: цифра без редакции файла бессмысленна) —
вписать в CLAUDE.md «Статус» и отчёт спеки.

- [ ] **Step 3: коммит + пуш ветки**

```bash
git add docs/product-spec.md docs/logic-spec.md docs/backlog.md CLAUDE.md
git commit -m "docs: синхронизация после задачи 09 (онбординг)"
git push -u origin feat/09-onboarding
```

- [ ] **Step 4: доложить Артёму** — задача готова к лайв-проверке на iPhone (пункт 6в):
  колесо пикера в ОБЕИХ темах приложения (themeVariant), хаптика Light/Success, холодный старт
  с флагом и без, реальные данные (серия/дневник/XP целы после онбординга).
  ⚠️ Отдельным пунктом — **формат даты рождения в поле шага 2**: ru «10 февраля 1994»
  (родительный падеж месяца, без хвоста «г.»), en «February 10, 1994». Это ровно тот класс,
  который по правилу hf-02 не доказывают ни веб, ни jest: формат считает сам движок, у Node
  и браузера полный ICU, у Hermes — урезанный. Судья только устройство.
  Merge в main — только после его ✓.

---

## Чего в плане НЕТ (осознанно)

- `npm install` — не нужен: все пакеты уже стоят (`datetimepicker` — с 06б).
- Прелюдия пушей, карточка профиля, «предложить дату позже» — вне скоупа (спека, «Что НЕ делаем»).
- Правка `product-spec` §0 ДО реализации — формулировка «кнопка пропустить» правится в Task 10,
  когда поведение уже реализовано и проверено.
