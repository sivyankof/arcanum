# План 47б · Пуши новолуния и полнолуния

> **Для исполнителей:** выполнять задачами по порядку (subagent-driven или executing-plans),
> шаги — чекбоксы. Спека: `docs/specs/47b-moon-pushes.md` — план аргументирует от неё,
> исполнитель читает обе. Реализация — sonnet-сабагентами (механика по готовому коду плана);
> финальное ревью — модель сессии.

**Цель:** в локальный день новолуния/полнолуния утренний пуш получает лунный текст и заголовок
вместо дежурных — строго «вместо, а не поверх» (число пушей не меняется ни в один день).

**Архитектура:** `planPushes` остаётся чистой функцией от входа — дни событий приходят полем
`PlanInput.moonDays`, которое собирает `planInputFromStore` из `moonEvents()` (окно — от начала
локального СЕГОДНЯ до конца дня +3). Замена — точечный хелпер `morningSlot`, применяемый в двух
местах постановки утреннего; freeze-ветка стоит раньше и не перекрывается. Доставка (`pushes.ts`)
меняется на одну строку: `p.titleKey ?? TITLE_KEY[p.kind]`.

**Стек:** только существующий (expo-notifications уже подключён; новых пакетов НЕТ).

## Глобальные ограничения (из спеки и правил проекта)

- Persist version НЕ меняется — остаётся **10**. Ни одного нового поля в `settings`/сторе.
- `npx tsc --noEmit` чист после КАЖДОГО шага; `npm test` зелёный перед каждым коммитом.
- Комментарии в коде и сообщения коммитов — русские; никаких упоминаний ИИ и трейлеров
  Co-Authored-By в коммитах.
- SDK/версии пакетов не трогать; `package.json`/`app.json` в этой задаче не меняются вовсе.
- Новые UI-строки — сразу в ОБА языка `i18n.ts` (ресурсы несут только ru и en).
- Ветка `feat/47b-moon-pushes` от main; merge — после лайв-проверки Артёма.
- Правило hf-02: новый тест пишется ДО реализации и обязан быть красным на нетронутом коде.

---

### Задача 0: ветка

- [ ] **Шаг 0.1:**

```bash
git checkout main && git pull && git checkout -b feat/47b-moon-pushes
```

---

### Задача 1: `pushPlan.ts` — вид `moon`, замена утреннего (TDD)

**Файлы:**
- Правка: `src/lib/pushPlan.ts`
- Тест: `src/lib/__tests__/pushPlan.test.ts`

**Интерфейсы (их читают задачи 2–3):**
- Производит: `PushKind` += `'moon'`; `export interface MoonDay { date: string; kind: MoonEventKind }`;
  `PlanInput.moonDays: MoonDay[]` (обязательное); `PlannedPush.titleKey?: string`;
  константы `MOON_PHRASE`/`MOON_TITLE` (внутренние, не экспортируются).
- Ключи, которые обязаны появиться в задаче 3: фразы `push.moon_new`, `push.moon_full`
  (phrases.json), заголовки `push.titleMoonNew`, `push.titleMoonFull` (i18n.ts).

- [ ] **Шаг 1.1: написать падающие тесты.** В `src/lib/__tests__/pushPlan.test.ts`:
  в конец объекта `base` добавить строку `moonDays: [],` (поле станет обязательным в шаге 1.3;
  до него tsc на тест-файле красный — это ожидаемо, jest типы не проверяет). В конец файла —
  новый describe (хелперы `base`/`MORNING_8AM`/`onDate`/`kinds` уже есть в файле):

```ts
describe('planPushes — лунные пуши (спека 47б)', () => {
  it('день события в горизонте — утренний этого дня становится лунным', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-13', kind: 'new' as const }] };
    const day = onDate(input, MORNING_8AM, '2026-08-13');
    expect(day).toHaveLength(1);
    expect(day[0].kind).toBe('moon');
    expect(day[0].phraseKey).toBe('push.moon_new');
    expect(day[0].titleKey).toBe('push.titleMoonNew');
    expect(day[0].hour).toBe(9);
    expect(day[0].minute).toBe(0);
  });

  it('полнолуние даёт свою пару ключей', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-14', kind: 'full' as const }] };
    const day = onDate(input, MORNING_8AM, '2026-08-14');
    expect(day[0].kind).toBe('moon');
    expect(day[0].phraseKey).toBe('push.moon_full');
    expect(day[0].titleKey).toBe('push.titleMoonFull');
  });

  it('сегодняшний лунный стоит, пока карта не открыта, и вытесняет обычный утренний', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-12', kind: 'new' as const }] };
    const today = onDate(input, MORNING_8AM, '2026-08-12');
    expect(today.map((p) => p.kind)).toContain('moon');
    expect(today.map((p) => p.kind)).not.toContain('morning');
  });

  it('карта открыта — сегодняшнего лунного нет (правило утреннего)', () => {
    const input = {
      ...base,
      todayCardId: 'the-tower',
      moonDays: [{ date: '2026-08-12', kind: 'full' as const }],
    };
    expect(onDate(input, MORNING_8AM, '2026-08-12').map((p) => p.kind)).not.toContain('moon');
  });

  it('freeze-день совпал с днём события — побеждает freeze', () => {
    // карта открыта сегодня → freezeDay = послезавтра, 2026-08-14 (спека 10)
    const input = {
      ...base,
      todayCardId: 'the-tower',
      streak: 5,
      freezes: 1,
      moonDays: [{ date: '2026-08-14', kind: 'full' as const }],
    };
    expect(onDate(input, MORNING_8AM, '2026-08-14').map((p) => p.kind)).toEqual(['freeze']);
  });

  it('возвратный (4-й день) лунным не подменяется', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-16', kind: 'new' as const }] };
    expect(onDate(input, MORNING_8AM, '2026-08-16').map((p) => p.kind)).toEqual(['comeback']);
  });

  it('день события вне горизонта утренних — лунного в плане нет', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-17', kind: 'new' as const }] };
    expect(kinds(input, MORNING_8AM)).not.toContain('moon');
  });

  it('capPerDay: лунный уступает спасению серии и вечернему', () => {
    const mk = (kind: PlannedPush['kind'], hour: number): PlannedPush => ({
      kind,
      date: '2026-08-12',
      hour,
      minute: 0,
      phraseKey: 'x',
    });
    const kept = capPerDay([mk('moon', 9), mk('evening', 21), mk('streak', 20)]);
    expect(kept.map((p) => p.kind).sort()).toEqual(['evening', 'streak']);
  });

  it('детерминизм: один вход — один план', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-13', kind: 'new' as const }] };
    expect(planPushes(input, MORNING_8AM)).toEqual(planPushes(input, MORNING_8AM));
  });
});
```

- [ ] **Шаг 1.2: убедиться, что тесты красные.**

```bash
npm test -- pushPlan
```

Ожидание: новый describe падает (вид `morning` вместо `moon`, `titleKey` undefined);
СТАРЫЕ тесты файла остаются зелёными. Зелёный новый тест на этом шаге = ошибка в тесте.

- [ ] **Шаг 1.3: реализация в `src/lib/pushPlan.ts`.** Пять правок:

1. К импортам добавить (import type — модуль остаётся чистым, `moon.ts` тоже без expo/react):

```ts
import type { MoonEventKind } from './moon';
```

2. Тип вида и новый тип дня события (рядом с `PushKind`):

```ts
export type PushKind = 'morning' | 'evening' | 'streak' | 'comeback' | 'freeze' | 'moon';

/** День лунного события по ЛОКАЛЬНОМУ календарю — как на экране /moon (logic-spec §6). */
export interface MoonDay {
  date: string;
  kind: MoonEventKind;
}
```

3. В `PlannedPush` после `phraseKey` добавить поле:

```ts
  /** Явный ключ заголовка: у лунного пуша их два (новолуние/полнолуние), по виду не выбрать. */
  titleKey?: string;
```

В `PlanInput` после `todayOutcome` добавить поле:

```ts
  /** Дни новолуний/полнолуний в горизонте плана (собирает planInputFromStore). */
  moonDays: MoonDay[];
```

4. `PRIORITY` и ключи. `PHRASE_KEY` сужается до видов с единственным ключом — у лунного ключ
   выбирается по СОБЫТИЮ, tsc сам проследит, что новый вид нигде не читает старую таблицу:

```ts
/** Кого оставляем, когда на день претендует больше двух. С morning лунный в один день
 *  не сосуществует по построению (он и есть утренний этого дня), но порядок обязан быть
 *  полным: «не нашёл в списке» = indexOf −1 = внезапно высший приоритет. */
const PRIORITY: PushKind[] = ['streak', 'evening', 'freeze', 'moon', 'morning', 'comeback'];

const PHRASE_KEY: Record<Exclude<PushKind, 'moon'>, string> = {
  morning: 'push.morning_card',
  evening: 'push.evening_reflect',
  streak: 'push.streak_save',
  comeback: 'push.winback',
  freeze: 'push.freeze_saved',
};

/** Лунному пушу ключи фразы и заголовка выбираются по виду СОБЫТИЯ (спека 47б). */
const MOON_PHRASE: Record<MoonEventKind, string> = {
  new: 'push.moon_new',
  full: 'push.moon_full',
};
const MOON_TITLE: Record<MoonEventKind, string> = {
  new: 'push.titleMoonNew',
  full: 'push.titleMoonFull',
};
```

5. Хелпер слота (положить перед `planPushes`) и два места использования:

```ts
/** Утренний слот дня: в локальный день новолуния/полнолуния — лунный текст вместо дежурного
 *  («вместо, а не поверх», master-plan). Freeze-день сюда не попадает: его ветка в planPushes
 *  стоит раньше — спасение серии функционально и праздником не перекрывается (спека 47б). */
function morningSlot(
  date: string,
  at: { hour: number; minute: number },
  moonDays: MoonDay[],
): PlannedPush {
  const moon = moonDays.find((m) => m.date === date);
  return moon
    ? { kind: 'moon', date, ...at, phraseKey: MOON_PHRASE[moon.kind], titleKey: MOON_TITLE[moon.kind] }
    : { kind: 'morning', date, ...at, phraseKey: PHRASE_KEY.morning };
}
```

В `planPushes` заменить обе постановки утреннего:
строку `out.push({ kind: 'morning', date: today, ...morning, phraseKey: PHRASE_KEY.morning });`
на `out.push(morningSlot(today, morning, input.moonDays));`
и в цикле `for (let d = 1; ...)` ветку else
`out.push({ kind: 'morning', date: daysAheadISO(d, now), ...morning, phraseKey: PHRASE_KEY.morning });`
на `out.push(morningSlot(daysAheadISO(d, now), morning, input.moonDays));`.
Возвратный пуш (`kind: 'comeback'`) НЕ трогать.

В `planInputFromStore` в возвращаемый объект добавить ВРЕМЕННУЮ строку `moonDays: [],` —
настоящее окно ставит задача 2 (без этой строки tsc красный на самом модуле).

- [ ] **Шаг 1.4: зелёный прогон и типы.**

```bash
npm test -- pushPlan && npx tsc --noEmit
```

Ожидание: оба чистые (в т.ч. старые тесты pushPlan — они получили `moonDays: []` через `base`).

- [ ] **Шаг 1.5: коммит.**

```bash
git add src/lib/pushPlan.ts src/lib/__tests__/pushPlan.test.ts
git commit -m "feat: лунный пуш заменяет утренний в день новолуния/полнолуния (spec 47b)"
```

---

### Задача 2: `planInputFromStore` — окно `moonDays` (TDD)

**Файлы:**
- Правка: `src/lib/pushPlan.ts` (только `planInputFromStore` и импорты)
- Тест: `src/lib/__tests__/pushPlan.test.ts`

**Интерфейсы:**
- Потребляет: `moonEvents(from: Date, to: Date): MoonEvent[]` из `./moon` (события в `[from, to)`),
  `localDateISO(d: Date): string` из `./dates` (уже импортирован), `MORNING_AHEAD_DAYS` (там же).
- Производит: `planInputFromStore(...).moonDays` — дни событий от начала локального СЕГОДНЯ
  до конца дня +3. Сигнатура функции НЕ меняется — `usePushScheduler.ts` и `app/settings.tsx`
  не трогаются.

- [ ] **Шаг 2.1: написать падающий тест.** В `pushPlan.test.ts` — импорты
  `planInputFromStore` (добавить в существующий import из `../pushPlan`),
  `localDateISO, plusDaysISO` из `../dates`, `DEFAULT_SETTINGS` из `../settings`. Новый describe:

```ts
describe('planInputFromStore — moonDays (спека 47б)', () => {
  // Точный момент новолуния 12.08.2026 17:37 UTC (logic-spec §6). Его ЛОКАЛЬНЫЙ день зависит
  // от пояса машины, поэтому ожидание строится тем же localDateISO, что и реализация, —
  // тест проверяет ОКНО (от начала дня, границы горизонта), а не сам маппинг момента в день.
  const NEW_MOON = new Date(Date.UTC(2026, 7, 12, 17, 37));
  const eventDay = localDateISO(NEW_MOON);
  const at = (iso: string, h: number) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, h, 0);
  };
  const moonDaysAt = (now: Date) =>
    planInputFromStore(DEFAULT_SETTINGS, 0, [], 0, null, now).moonDays;

  it('событие раньше now, но в том же локальном дне — в окне (окно от НАЧАЛА дня)', () => {
    expect(moonDaysAt(at(eventDay, 23))).toContainEqual({ date: eventDay, kind: 'new' });
  });

  it('событие во вчерашнем дне — вне окна', () => {
    expect(moonDaysAt(at(plusDaysISO(eventDay, 1), 8)).map((d) => d.date)).not.toContain(eventDay);
  });

  it('день +3 — в окне, день +4 — уже нет', () => {
    expect(moonDaysAt(at(plusDaysISO(eventDay, -3), 8))).toContainEqual({
      date: eventDay,
      kind: 'new',
    });
    expect(moonDaysAt(at(plusDaysISO(eventDay, -4), 8)).map((d) => d.date)).not.toContain(eventDay);
  });
});
```

- [ ] **Шаг 2.2: убедиться, что тест красный.**

```bash
npm test -- pushPlan
```

Ожидание: все три новых it падают — `moonDays` пока пустой литерал из задачи 1.

- [ ] **Шаг 2.3: реализация.** В `pushPlan.ts` дополнить импорт из `./moon`
  (был `import type`, станет значение + тип):

```ts
import { moonEvents, type MoonEventKind } from './moon';
```

В `planInputFromStore` заменить временную строку `moonDays: [],` на настоящее окно; перед
`return` добавить:

```ts
  // Окно лунных событий — от НАЧАЛА локального сегодня (событие в 04:18 обязано попасть в план
  // и при пересчёте в 09:00) до конца последнего дня утренних (+MORNING_AHEAD_DAYS).
  // moonEvents отдаёт [from, to) — правая граница это полночь дня +4, сам день +4 не входит.
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizonEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + MORNING_AHEAD_DAYS + 1,
  );
```

и в возвращаемом объекте:

```ts
    moonDays: moonEvents(dayStart, horizonEnd).map((e) => ({
      date: localDateISO(e.at),
      kind: e.kind,
    })),
```

- [ ] **Шаг 2.4: зелёный прогон.**

```bash
npm test -- pushPlan && npx tsc --noEmit
```

- [ ] **Шаг 2.5: коммит.**

```bash
git add src/lib/pushPlan.ts src/lib/__tests__/pushPlan.test.ts
git commit -m "feat: planInputFromStore собирает дни лунных событий от начала локального дня (spec 47b)"
```

---

### Задача 3: тексты и заголовки — `phrases.json`, `i18n.ts`, `pushes.ts` (TDD)

**Файлы:**
- Правка: `content/phrases.json`, `src/lib/i18n.ts`, `src/lib/pushes.ts`
- Тест: `src/lib/__tests__/phrases.test.ts`

**Интерфейсы:**
- Потребляет: ключи `push.moon_new`/`push.moon_full`/`push.titleMoonNew`/`push.titleMoonFull`,
  обещанные задачей 1; `PlannedPush.titleKey` оттуда же.
- Производит: содержимое этих ключей. `pushBody.ts`, `pushes.web.ts`, `usePushScheduler.ts`,
  `app/settings.tsx` НЕ меняются.

- [ ] **Шаг 3.1: контракт-тест фраз (падающий).** В `phrases.test.ts` по образцу соседнего
  теста `freeze.saved`:

```ts
  it('push.moon_new и push.moon_full отдают непустой текст на обоих языках', () => {
    for (const key of ['push.moon_new', 'push.moon_full']) {
      expect(pickPhrase(key, '2026-08-12', 'ru').length).toBeGreaterThan(0);
      expect(pickPhrase(key, '2026-08-12', 'en').length).toBeGreaterThan(0);
    }
  });
```

- [ ] **Шаг 3.2: убедиться, что красный.**

```bash
npm test -- phrases
```

Ожидание: FAIL — `pickVariant` на неизвестном ключе отдаёт пустую строку.

- [ ] **Шаг 3.3: фразы.** В `content/phrases.json`, внутрь объекта `push`, после
  `freeze_saved` (тон — интрига, не спам; без времени события; с приглашением открыть карту;
  правило вариативности — 3 формулировки одного смысла; черновики до вычитки редактором):

```json
  "moon_new": [
   {
    "ru": "Сегодня новолуние — время начинать. Какая карта откроет цикл?",
    "en": "New moon today — a time for beginnings. Which card opens the cycle?"
   },
   {
    "ru": "Новолуние: небо тёмное, колода ждёт ✦",
    "en": "New moon: the sky is dark, the deck is waiting ✦"
   },
   {
    "ru": "Новый лунный цикл начался. Ваша карта уже здесь",
    "en": "A new lunar cycle begins. Your card is already here"
   }
  ],
  "moon_full": [
   {
    "ru": "Полнолуние: самое время открыть карту дня",
    "en": "Full moon — the perfect moment to draw your card"
   },
   {
    "ru": "Луна сегодня полная. Что она подсветит в вашей карте?",
    "en": "The moon is full today. What will it light up in your card?"
   },
   {
    "ru": "Полнолуние ✦ Загляните, какая карта выпала вам сегодня",
    "en": "Full moon ✦ See which card came to you today"
   }
  ]
```

- [ ] **Шаг 3.4: заголовки в `src/lib/i18n.ts`** — в ОБА языка. В ru-секции `push`
  после `titleFreeze` (≈ строка 231):

```ts
        titleMoonNew: "Новолуние ✦",
        titleMoonFull: "Полнолуние ✦",
```

В en-секции `push` после `titleFreeze` (≈ строка 485):

```ts
        titleMoonNew: "New Moon ✦",
        titleMoonFull: "Full Moon ✦",
```

- [ ] **Шаг 3.5: доставка — `src/lib/pushes.ts`.** В `TITLE_KEY` добавить запись
  (только полнота `Record<PushKind, string>` для tsc — планировщик всегда даёт лунному
  пушу явный `titleKey`, это защитный фолбэк):

```ts
  moon: 'push.titleMoonNew',
```

В `applyPlanImpl` строку
`title: tFixed(TITLE_KEY[p.kind], { count: p.n ?? 0 }),`
заменить на:

```ts
        title: tFixed(p.titleKey ?? TITLE_KEY[p.kind], { count: p.n ?? 0 }),
```

- [ ] **Шаг 3.6: зелёный прогон всего.**

```bash
npm test && npx tsc --noEmit
```

Ожидание: все сьюты зелёные (в т.ч. контракт-тесты контента, которых фразы не касаются).

- [ ] **Шаг 3.7: коммит.**

```bash
git add content/phrases.json src/lib/i18n.ts src/lib/pushes.ts src/lib/__tests__/phrases.test.ts
git commit -m "feat: тексты и заголовки лунных пушей, доставка учитывает titleKey (spec 47b)"
```

---

### Задача 4: доки

**Файлы:**
- Правка: `docs/logic-spec.md` (§6 и §8), `AGENTS.md` (раздел «Луна»),
  `docs/backlog.md` (запись 47б)

- [ ] **Шаг 4.1: `docs/logic-spec.md`.** В §8 (пуши) дописать вид `moon`: «в локальный день
  новолуния/полнолуния утренний пуш заменяется лунным (тот же час; вид `moon`, фразы
  `push.moon_new`/`push.moon_full`) — правило master-plan „вместо, а не поверх“; freeze-день
  лунной заменой не перекрывается; приоритет обрезки:
  `streak > evening > freeze > moon > morning > comeback`; возвратный не подменяется».
  В §6 строку «пуши новолуния/полнолуния — задача 47б» заменить на
  «пуши новолуния/полнолуния — §8 (задача 47б)».

- [ ] **Шаг 4.2: `AGENTS.md`.** В разделе «Луна» строку «Пуши новолуния/полнолуния — задача
  47б, их ещё нет» заменить на «Пуши новолуния/полнолуния — замена утреннего в день события
  (`pushPlan.ts`, вид `moon`, спека 47б)».

- [ ] **Шаг 4.3: `docs/backlog.md`.** В хвостах записи 47 отметить 47б сделанной со ссылкой
  на спеку и пометкой: «фразы `push.moon_*` ждут вычитки редактором (как `push.freeze_saved`
  задачи 10)».

- [ ] **Шаг 4.4: коммит.**

```bash
git add docs/logic-spec.md AGENTS.md docs/backlog.md
git commit -m "docs: правила лунных пушей в logic-spec §8, статус 47б (spec 47b)"
```

---

### Задача 5: проверка 6б и финал

- [ ] **Шаг 5.1: полный прогон.**

```bash
npm test && npx tsc --noEmit
```

- [ ] **Шаг 5.2: веб-проверка 6б (DEV-диалог «План пушей»).** Поднять `npx expo start --web`,
  Playwright-скриптом (правила из AGENTS.md: сид `arcanum-app` через `evaluate` + `reload`,
  НЕ `addInitScript`; вьюпорт 390×844) зайти в `/settings`, открыть DEV-строку «План пушей»
  и проверить: (а) строки плана есть, формат прежний `дата ЧЧ:ММ · вид`; (б) на текущем дне
  без лунного события вида `moon` в плане НЕТ. Красный прогон веб-сценария не требуется —
  его роль сыграли красные юнит-прогоны шагов 1.2/2.2/3.2 (зафиксировано в спеке);
  если день запуска попал на событие — ожидание инвертируется: `moon` обязан быть.
  Скриншот диалога — в `docs/screenshots/47b/`.

- [ ] **Шаг 5.3: отчёт в спеку.** Раздел «Отчёт о реализации» в
  `docs/specs/47b-moon-pushes.md`: что сделано, отклонения от плана, результат 6б,
  напоминание про отложенное подтверждение (утро 28.08.2026 — баннер «Полнолуние ✦»,
  если карта к 09:00 не открыта).

- [ ] **Шаг 5.4: коммит + пуш ветки.**

```bash
git add docs/specs/47b-moon-pushes.md docs/screenshots/47b
git commit -m "docs: отчёт веб-проверки 47б (spec 47b)"
git push -u origin feat/47b-moon-pushes
```

- [ ] **Шаг 5.5: лайв-проверка Артёма (6в), сценарий:** DEV-диалог «План пушей» — обычные
  утренний/вечерний на месте, счётчик очереди ОС ненулевой; тестовый пуш через 10 секунд
  приходит; регрессия: переключение тумблера напоминаний и времён не падает. После «ок» —
  merge в main, отметка в backlog/CLAUDE.md (процесс, шаг 7–8).

## Чего в плане НЕТ намеренно

- Тумблер, изменения settings/persist (version остаётся 10), пуш «в момент события»,
  тексты на лунные дни — раздел «Что НЕ делаем» спеки.
- Правки `pushes.web.ts`/`pushBody.ts`/`usePushScheduler.ts`/`app/settings.tsx` — вход
  собирается в `planInputFromStore`, DEV-диалог печатает `p.kind` как есть и покажет `moon` сам.
- Новых сьютов нет: тесты ложатся в существующие `pushPlan.test.ts` и `phrases.test.ts`.
