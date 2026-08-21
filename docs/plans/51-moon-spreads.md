# Лунные расклады — детальный план

> **Для исполнителя:** план идёт задача за задачей, шаги помечены `- [ ]`. Каждая задача
> заканчивается проверкой и коммитом. Спека, из которой этот план выведен, —
> `docs/specs/51-moon-spreads.md`, читать вместе с планом.

**Цель:** в окно новолуния и полнолуния открывается свой расклад из 4 карт; вне окна карточка
показывается заблокированной с датой ближайшего события.

**Архитектура:** правило окна — чистый модуль без react/expo, как `moon.ts` и `pushPlan.ts`.
Экран расклада НЕ дублируется: `SpreadScreen` получает лунные отличия из поля `spread.moon`.
Ничего не хранится — состояние выводится из времени, persist остаётся версии 10.

**Стек:** Expo SDK 54, expo-router v6, zustand, react-i18next, jest-expo.

**Ветка:** `feat/51-moon-spreads` (задача крупная — правило процесса для задач 07+).

## Глобальные ограничения

- SDK НЕ обновлять, мажорные версии пакетов не менять. Новых пакетов задача не требует.
- После каждого шага с кодом — `npx tsc --noEmit` без ошибок.
- Цвета только из `src/theme/theme.ts`, хардкод запрещён.
- Комментарии в коде — русские. Ни слова про ИИ в коде и коммитах.
- Новая формула/алгоритм — юнит-тест в том же коммите; `npm test` зелёный перед push.
  На старте — **1488 тестов в 39 сьютах**.
- Новая UI-строка добавляется сразу в ЧЕТЫРЕ языка `src/lib/i18n.ts` (контракт `i18nPlurals`
  требует совпадения наборов ключей; забыл язык — тест краснеет поимённо).
- Контент новых раскладов пишется на ru+en. `es`/`pt` НЕ создавать даже пустыми строками:
  пустая строка значит «язык есть и он пустой» и покажет пользователю пустое место вместо
  готового английского. Переводы зальёт Cowork задачей 28м.

---

### Задача 1: правило окна — чистый модуль `moonSpread.ts`

**Файлы:**
- Создать: `src/lib/moonSpread.ts`
- Создать: `src/lib/__tests__/moonSpread.test.ts`

**Интерфейсы:**
- Использует: `moonEvents`, `MoonEvent`, `MoonEventKind`, `EventSource` из `src/lib/moon.ts`;
  `localDateISO`, `localMidnight`, `plusDaysISO` из `src/lib/dates.ts`.
- Отдаёт: `MoonSpreadState`, `moonSpreadState(kind, now?, source?)`, `isMoonWindowOpen(at, now?)`,
  `MOON_WINDOW_DAYS`.

⚠️ Функции ДВЕ, и они отвечают на разные вопросы. `moonSpreadState` — «какое событие этого вида
сейчас актуально и открыто ли оно»: нужна списку раскладов, где конкретного события нет, есть
только расклад. `isMoonWindowOpen` — «открыто ли окно ИМЕННО ЭТОГО события»: нужна панели на
экране луны, которая стоит под конкретной строкой события. Без второй панель под вторым
полнолунием месяца (голубая луна) показывала бы состояние первого.

- [ ] **Шаг 1: тест — окно открыто в день события и в сутки по обе стороны**

Создать `src/lib/__tests__/moonSpread.test.ts`:

```ts
/** Окно доступности лунного расклада (спека 51). Синтетические события собираются ЛОКАЛЬНЫМ
 *  конструктором Date, иначе тест зависел бы от часового пояса машины; ожидания — литералы,
 *  а не вызов проверяемой функции (урок 47б: иначе тест становится тавтологией). */
import type { EventSource, MoonEvent, MoonEventKind } from '../moon';
import { isMoonWindowOpen, moonSpreadState } from '../moonSpread';

/** Источник, уважающий границы периода, — как настоящий moonEvents (полуинтервал [from, to)). */
const sourceOf =
  (events: Array<[MoonEventKind, Date]>): EventSource =>
  (from, to) =>
    events
      .filter(([, at]) => at.getTime() >= from.getTime() && at.getTime() < to.getTime())
      .map(([kind, at]): MoonEvent => ({ kind, at }));

// новолуние 12 августа 2026, 21:36 местного времени
const NEW_AUG = new Date(2026, 7, 12, 21, 36);
const src = sourceOf([['new', NEW_AUG], ['new', new Date(2026, 8, 11, 10, 0)], ['full', new Date(2026, 7, 28, 8, 18)]]);

describe('moonSpreadState — окно события', () => {
  it('в день события окно открыто', () => {
    const s = moonSpreadState('new', new Date(2026, 7, 12, 9, 0), src);
    expect(s).toEqual({ kind: 'new', at: NEW_AUG, open: true });
  });

  it('за сутки до события окно уже открыто', () => {
    expect(moonSpreadState('new', new Date(2026, 7, 11, 0, 1), src)?.open).toBe(true);
  });

  it('через сутки после события окно ещё открыто', () => {
    expect(moonSpreadState('new', new Date(2026, 7, 13, 23, 59), src)?.open).toBe(true);
  });

  it('за двое суток до события окно закрыто, at указывает на это событие', () => {
    const s = moonSpreadState('new', new Date(2026, 7, 10, 12, 0), src);
    expect(s).toEqual({ kind: 'new', at: NEW_AUG, open: false });
  });

  it('через двое суток после события окно закрыто, at указывает на СЛЕДУЮЩЕЕ событие', () => {
    const s = moonSpreadState('new', new Date(2026, 7, 14, 12, 0), src);
    expect(s?.open).toBe(false);
    expect(s?.at).toEqual(new Date(2026, 8, 11, 10, 0));
  });

  it('вид события не путается: полнолуние своё окно, новолуние своё', () => {
    const at28 = new Date(2026, 7, 28, 12, 0);
    expect(moonSpreadState('full', at28, src)?.open).toBe(true);
    expect(moonSpreadState('new', at28, src)?.open).toBe(false);
  });

  it('пустой источник — null, а не выдуманная дата', () => {
    expect(moonSpreadState('new', new Date(2026, 7, 12), sourceOf([]))).toBeNull();
  });
});

describe('isMoonWindowOpen — окно КОНКРЕТНОГО события', () => {
  it('день события и сутки по обе стороны — открыто', () => {
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 11, 0, 1))).toBe(true);
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 12, 12, 0))).toBe(true);
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 13, 23, 59))).toBe(true);
  });
  it('двое суток в любую сторону — закрыто', () => {
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 10, 23, 59))).toBe(false);
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 14, 0, 1))).toBe(false);
  });
});
```

- [ ] **Шаг 2: прогнать тест — обязан упасть**

Запустить: `npx jest src/lib/__tests__/moonSpread.test.ts`
Ожидается: FAIL, «Cannot find module '../moonSpread'».

- [ ] **Шаг 3: реализация**

Создать `src/lib/moonSpread.ts`:

```ts
/** Окно доступности лунного расклада (спека 51, master-plan п. 11).
 *  Чистый модуль: ни react, ни expo, ни i18n — как moon.ts и pushPlan.ts.
 *
 *  Окно считается КАЛЕНДАРНЫМИ сутками: локальный день события плюс день до и день после.
 *  Не ±24 часа от точного момента — всё приложение живёт локальными днями (граница карты дня
 *  hf-01, SRS 45, лунный пуш 47б), и окно, закрывающееся в 21:36 посреди вечера, было бы
 *  единственным исключением; вдобавок утренний пуш «Полнолуние ✦» и доступность расклада
 *  обязаны совпадать по дню. Решение спеки 51, подтверждено Артёмом 21.08. */
import { localDateISO, localMidnight, plusDaysISO } from './dates';
import { moonEvents, type EventSource, type MoonEventKind } from './moon';

/** Сколько суток по обе стороны от дня события держится окно. */
export const MOON_WINDOW_DAYS = 1;

/** Горизонт поиска ближайшего события своего вида. Синодический месяц ≈ 29.53 суток,
 *  поэтому 40 суток гарантированно содержат и новолуние, и полнолуние. */
const SEARCH_AHEAD_DAYS = 40;

export interface MoonSpreadState {
  kind: MoonEventKind;
  /** Момент события: текущего, если окно идёт, иначе ближайшего будущего. */
  at: Date;
  open: boolean;
}

function inWindow(eventISO: string, todayISO: string): boolean {
  return (
    todayISO === eventISO ||
    todayISO === plusDaysISO(eventISO, -MOON_WINDOW_DAYS) ||
    todayISO === plusDaysISO(eventISO, MOON_WINDOW_DAYS)
  );
}

/** Открыто ли окно ИМЕННО ЭТОГО события. Нужна там, где событие уже известно — панель под
 *  строкой события на экране луны. Без неё панель пришлось бы спрашивать «какое событие сейчас
 *  актуально», и под вторым полнолунием месяца (голубая луна) она показала бы состояние первого. */
export function isMoonWindowOpen(at: Date, now: Date = new Date()): boolean {
  return inWindow(localDateISO(at), localDateISO(now));
}

/** Источник событий инъектируется — тем же приёмом, что monthEvents (47) и moonDaysIn (47б):
 *  без него проверка «момент → ЛОКАЛЬНЫЙ день» стала бы тавтологией.
 *  null — событий этого вида в горизонте нет: в приложении недостижимо, защита от пустого
 *  источника; экран в этом случае просто не рисует панель. */
export function moonSpreadState(
  kind: MoonEventKind,
  now: Date = new Date(),
  source: EventSource = moonEvents,
): MoonSpreadState | null {
  const todayISO = localDateISO(now);
  // от вчерашней полуночи: событие вчера ещё держит окно на сегодня, позавчерашнее — уже нет
  const events = source(localMidnight(now, -MOON_WINDOW_DAYS), localMidnight(now, SEARCH_AHEAD_DAYS))
    .filter((e) => e.kind === kind)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const open = events.find((e) => inWindow(localDateISO(e.at), todayISO));
  if (open) return { kind, at: open.at, open: true };

  const next = events.find((e) => localDateISO(e.at) > todayISO);
  return next ? { kind, at: next.at, open: false } : null;
}
```

- [ ] **Шаг 4: прогнать тест — обязан пройти**

Запустить: `npx jest src/lib/__tests__/moonSpread.test.ts`
Ожидается: PASS, 9 тестов (7 у `moonSpreadState`, 2 у `isMoonWindowOpen`).

- [ ] **Шаг 5: проверить, что тест НЕ декорация**

Временно заменить в `inWindow` `plusDaysISO(eventISO, -MOON_WINDOW_DAYS)` на `eventISO`
(то есть сломать левую границу окна). Прогнать сьют — обязан покраснеть тест «за сутки до
события окно уже открыто». Вернуть строку как было, прогнать снова — зелёный.
Правило проекта: зелёный с первого раза и на сломанном коде значит, что проверка ничего не проверяет.

- [ ] **Шаг 6: типы и коммит**

```bash
npx tsc --noEmit
git add src/lib/moonSpread.ts src/lib/__tests__/moonSpread.test.ts
git commit -m "feat: правило окна лунного расклада — чистый модуль moonSpread (spec 51)"
```

---

### Задача 2: контент, тип расклада, раскладка, строки интерфейса

**Файлы:**
- Изменить: `content/spreads.json` (добавить два расклада в конец массива `spreads`)
- Изменить: `src/lib/content.ts:97-105` (поле `moon` в интерфейсе `Spread`)
- Изменить: `src/lib/spreadLayout.ts:14-36` (две раскладки в `SPREAD_LAYOUTS`)
- Изменить: `src/lib/i18n.ts` (секция `moonSpread` в четырёх языках)

**Интерфейсы:**
- Использует: `Localized` из `src/lib/lang.ts` (ru/en обязательны, es/pt опциональны — то есть
  контент на двух языках типобезопасен), `row()` из `src/lib/spreadLayout.ts`.
- Отдаёт: `Spread.moon?: 'new' | 'full'`; id `new-moon` и `full-moon`; ключи `moonSpread.*`.

- [ ] **Шаг 1: поле `moon` в интерфейсе расклада**

В `src/lib/content.ts` в интерфейсе `Spread` после поля `free`:

```ts
  /** Привязка к лунному событию (спека 51): расклад доступен только в окно новолуния
   *  или полнолуния. У восьми обычных раскладов поля нет. */
  moon?: 'new' | 'full';
```

- [ ] **Шаг 2: два расклада в `content/spreads.json`**

Добавить в конец массива `spreads` (порядок = порядок в списке экрана, как в макете —
лунные идут последними). Отступ файла — 1 пробел, как во всём контенте:

```json
  {
   "id": "new-moon",
   "free": true,
   "moon": "new",
   "cards": 4,
   "name": {
    "ru": "Расклад новолуния",
    "en": "New Moon Spread"
   },
   "description": {
    "ru": "Четыре карты о том, что начинается: что зреет, что поддержит, что мешает и с чего начать. Открыт в окно новолуния — сутки до и после.",
    "en": "Four cards about what is beginning: what is taking seed, what will support it, what gets in the way, and where to start. Open during the new moon window — a day before and after."
   },
   "positions": [
    { "ru": "Семя", "en": "The seed" },
    { "ru": "Почва", "en": "The ground" },
    { "ru": "Помеха", "en": "The obstacle" },
    { "ru": "Первый шаг", "en": "First step" }
   ]
  },
  {
   "id": "full-moon",
   "free": false,
   "moon": "full",
   "cards": 4,
   "name": {
    "ru": "Расклад полнолуния",
    "en": "Full Moon Spread"
   },
   "description": {
    "ru": "Четыре карты о завершении цикла: что созрело, что стало ясно, что оставалось в тени и что пора отпустить. Открыт в окно полнолуния — сутки до и после.",
    "en": "Four cards about a cycle closing: what has ripened, what came clear, what stayed in the shadow, and what it is time to release. Open during the full moon window — a day before and after."
   },
   "positions": [
    { "ru": "Урожай", "en": "The harvest" },
    { "ru": "Что стало ясно", "en": "What came clear" },
    { "ru": "Тень", "en": "The shadow" },
    { "ru": "Что отпустить", "en": "What to release" }
   ]
  }
```

⚠️ Позиции — короткими именами, БЕЗ пояснений: решение редактора 10 в `docs/editor-questions.md`
(«пояснения к позициям раскладов в v1 не пишем»). Ключей `es`/`pt` не добавлять вовсе.

- [ ] **Шаг 3: раскладки мини-схемы и доски**

В `src/lib/spreadLayout.ts` в объект `SPREAD_LAYOUTS` рядом с `'month-ahead': row(4)`:

```ts
  // лунные расклады (спека 51): четыре карты в ряд, как «На месяц» — в макете `v-moonspread`
  // ячейки стоят на одной высоте с шагом 13px
  'new-moon': row(4),
  'full-moon': row(4),
```

- [ ] **Шаг 4: строки интерфейса в четырёх языках**

В `src/lib/i18n.ts` добавить секцию `moonSpread` в каждый из четырёх языков (рядом с секцией
`moon`). Русский:

```ts
      moonSpread: {
        event: "СОБЫТИЕ",
        open: "ОТКРЫТЬ →",
        opensOn: "Откроется {{date}}",
        position: "ПОЗИЦИЯ {{n}}",
        hintNew: "Доступен в окно события — сутки до и после новолуния",
        hintFull: "Доступен в окно события — сутки до и после полнолуния",
      },
```

Английский:

```ts
      moonSpread: {
        event: "EVENT",
        open: "OPEN →",
        opensOn: "Opens {{date}}",
        position: "POSITION {{n}}",
        hintNew: "Available around the event — a day before and after the new moon",
        hintFull: "Available around the event — a day before and after the full moon",
      },
```

Испанский:

```ts
      moonSpread: {
        event: "EVENTO",
        open: "ABRIR →",
        opensOn: "Se abre el {{date}}",
        position: "POSICIÓN {{n}}",
        hintNew: "Disponible en la ventana del evento: un día antes y uno después de la luna nueva",
        hintFull: "Disponible en la ventana del evento: un día antes y uno después de la luna llena",
      },
```

Португальский:

```ts
      moonSpread: {
        event: "EVENTO",
        open: "ABRIR →",
        opensOn: "Abre em {{date}}",
        position: "POSIÇÃO {{n}}",
        hintNew: "Disponível na janela do evento: um dia antes e um depois da lua nova",
        hintFull: "Disponível na janela do evento: um dia antes e um depois da lua cheia",
      },
```

⚠️ Стрелка в `open` — символ U+2192 «→», тот же, что уже стоит в проекте (сверять побайтово,
урок задачи 27: похожая литера тихо меняет экран).

- [ ] **Шаг 5: проверки**

```bash
npx tsc --noEmit
npm test
```
Ожидается: типы чистые; тестов **1497** в 40 сьютах (1488 + 9 новых из задачи 1).
Контракт `spread.test.ts` («у каждого расклада позиций столько же, сколько карт») обязан пройти —
у обоих новых раскладов 4 позиции и `cards: 4`.

- [ ] **Шаг 6: проверить, что контракт наборов ключей ловит пропуск языка**

Временно удалить `position` из португальской секции `moonSpread`, прогнать
`npx jest src/lib/__tests__/i18nPlurals.test.ts` — обязан упасть с именем ключа
`moonSpread.position` в списке `missing`. Вернуть строку, прогнать снова — зелёный.

- [ ] **Шаг 7: коммит**

```bash
git add content/spreads.json src/lib/content.ts src/lib/spreadLayout.ts src/lib/i18n.ts
git commit -m "feat: два лунных расклада в каталоге, раскладка и строки интерфейса (spec 51)"
```

---

### Задача 3: панель на экране луны

**Файлы:**
- Создать: `src/components/MoonSpreadPanel.tsx`
- Изменить: `app/moon.tsx` (вставить панель под строкой события)

**Интерфейсы:**
- Использует: `isMoonWindowOpen` (задача 1), `spreads` из `content.ts`, `inLang`, `useLang`,
  `formatDayMonth`, `localDateISO`, `useTheme`, `Txt`, `PressableScale`.
- Отдаёт: `<MoonSpreadPanel kind={'new' | 'full'} at={Date} now={Date} />` — панель получает
  СВОЙ момент события пропом, а не спрашивает «какое событие сейчас актуально».

- [ ] **Шаг 1: компонент панели**

Создать `src/components/MoonSpreadPanel.tsx`:

```tsx
/** Панель лунного расклада под строкой события на экране луны — блок `.moonspread` эталона
 *  (спека 51): пунктирная рамка frame на фоне chipBg, слева название расклада, справа
 *  «ОТКРЫТЬ →» либо «ОТКРОЕТСЯ 28 АВГУСТА».
 *
 *  Панель показывается под событием, чьё окно ИДЁТ или ещё ВПЕРЕДИ; под уже прошедшим событием
 *  месяца её нет — расклад к нему недоступен навсегда, а строка события и так приглушена. */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spreads } from '../lib/content';
import { formatDayMonth, localDateISO } from '../lib/dates';
import { hapticTap } from '../lib/haptics';
import { useLang } from '../lib/i18n';
import { inLang } from '../lib/lang';
import type { MoonEventKind } from '../lib/moon';
import { isMoonWindowOpen } from '../lib/moonSpread';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function MoonSpreadPanel({ kind, at, now }: { kind: MoonEventKind; at: Date; now: Date }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();

  const spread = spreads.find((s) => s.moon === kind);
  if (!spread) return null;
  const open = isMoonWindowOpen(at, now);

  const right = open
    ? tr('moonSpread.open')
    : tr('moonSpread.opensOn', { date: formatDayMonth(localDateISO(at), lang) }).toUpperCase();

  const body = (
    <>
      <Txt style={[st.name, { color: t.head }]}>{inLang(spread.name, lang)}</Txt>
      <Txt style={[st.right, { color: t.accent }]}>{right}</Txt>
    </>
  );
  const box = [st.box, { backgroundColor: t.chipBg, borderColor: t.frame }, !open && st.dim];

  // вне окна панель не нажимается вовсе: причина написана на ней самой датой, качать нечего
  // (у закрытого узла курса иначе — там причина неочевидна, спека 07)
  return open ? (
    <PressableScale
      onPress={() => {
        hapticTap();
        router.push({ pathname: '/spreads/[id]', params: { id: spread.id } });
      }}
      style={box}
    >
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  // `.moonspread` эталона: пунктир frame, radius 13, паддинг 10×13, отступ 8, ряд gap 10
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  // сжимаемый текст — flex 1 (в RN flexShrink по умолчанию 0, урок задачи 16)
  name: { flex: 1, fontFamily: fonts.display, fontSize: 13.5 },
  right: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  dim: { opacity: 0.45 }, // тот же токен приглушения, что у прошедших дней календаря
});
```

- [ ] **Шаг 2: вставить панель на экран луны**

В `app/moon.tsx` внутри `events.map((e) => ...)`, сразу ПОСЛЕ закрывающего `</View>` панели
события и внутри того же фрагмента. Заменить тело `map` на фрагмент с ключом:

```tsx
          {events.map((e) => (
            <React.Fragment key={e.at.getTime()}>
              <View
                style={[st.event, { backgroundColor: t.panel, borderColor: t.frame }, e.day < today && st.dim]}
              >
                <EventGlyph kind={e.kind} size={14} />
                <View style={st.eventTexts}>
                  <Txt style={[st.eventTitle, { color: t.accent }]}>
                    {`${tr(`moon.${e.kind}`)} · ${formatDayMonth(localDateISO(e.at), lang)} · ${formatTime(e.at, lang)}`.toUpperCase()}
                  </Txt>
                  <Txt style={[st.eventHint, { color: t.head }]}>
                    {tr(e.kind === 'new' ? 'moon.newHint' : 'moon.fullHint')}
                  </Txt>
                </View>
              </View>
              {/* панель расклада — только под событием, чьё окно идёт или впереди (спека 51);
                  момент события передаётся пропом, чтобы панель судила о СВОЁМ событии */}
              {e.day >= today && <MoonSpreadPanel kind={e.kind} at={e.at} now={now} />}
            </React.Fragment>
          ))}
```

Импорт добавить: `import { MoonSpreadPanel } from '../src/components/MoonSpreadPanel';`

⚠️ `key` переезжает с `<View>` на `<React.Fragment>` — иначе React ругается на список без ключей.

- [ ] **Шаг 3: проверки**

```bash
npx tsc --noEmit
npm test
```
Ожидается: типы чистые, 1497 тестов зелёные (компоненты юнитами не покрываются —
testing-strategy п. 2, их судит веб-прогон задачи 7).

- [ ] **Шаг 4: коммит**

```bash
git add src/components/MoonSpreadPanel.tsx app/moon.tsx
git commit -m "feat: панель лунного расклада на экране календаря луны (spec 51)"
```

---

### Задача 4: карточки в списке раскладов

**Файлы:**
- Изменить: `app/(tabs)/spreads/index.tsx`

**Интерфейсы:**
- Использует: `moonSpreadState` (задача 1), `useAppActive` из `src/lib/useAppActive.ts`,
  `formatDayMonth`, `localDateISO`.

- [ ] **Шаг 1: состояние «сейчас», обновляемое при возврате из фона**

В `SpreadsScreen` после `const scrollRef = ...`:

```tsx
  // «сейчас» — при монтировании и на возврате приложения из фона: таб остаётся смонтированным,
  // поэтому переход через полночь (и, значит, закрытие окна события) иначе не заметить.
  // Тот же приём, что на экране луны и на «Сегодня» (правило 06а).
  const [now, setNow] = React.useState(() => new Date());
  useAppActive(() => setNow(new Date()));
```

Импорты: `import { useAppActive } from '../../../src/lib/useAppActive';`,
`import { formatDayMonth, localDateISO } from '../../../src/lib/dates';`,
`import { moonSpreadState } from '../../../src/lib/moonSpread';`

- [ ] **Шаг 2: гейт открытия и лунная карточка**

Заменить `open` и тело `spreads.map` на:

```tsx
  const open = (s: Spread, locked: boolean) => {
    if (locked) return; // вне окна карточка не нажимается: причина написана на ней датой
    hapticTap();
    // «Карта дня» раскладом не играется — это ритуал главного экрана (product-spec §4)
    if (s.id === 'card-of-day') router.navigate('/');
    else router.push({ pathname: '/spreads/[id]', params: { id: s.id } });
  };
```

```tsx
        {spreads.map((s, si) => {
          const moon = s.moon ? moonSpreadState(s.moon, now) : null;
          const locked = !!s.moon && !moon?.open;
          const desc = locked && moon
            ? tr('moonSpread.opensOn', { date: formatDayMonth(localDateISO(moon.at), lang) })
            : `${tr('spreads.cards', { count: s.cards })} · ${inLang(s.description, lang)}`;
          return (
            <FadeUp key={s.id} index={1 + si}>
              <PressableScale
                onPress={() => open(s, locked)}
                style={[st.item, { backgroundColor: t.panel, borderColor: t.line }, locked && st.dim]}
              >
                <SpreadDiagram spreadId={s.id} />
                <View style={st.tx}>
                  <Txt style={[st.name, { color: t.head }]}>{inLang(s.name, lang)}</Txt>
                  <Txt style={[st.desc, { color: t.muted }]}>{desc}</Txt>
                </View>
                {/* у лунных раскладов бейдж события ВМЕСТО PREMIUM: бейдж на карточке один,
                    и событийный информативнее. free: false у полнолуния остаётся в данных
                    для будущего пейволла — в v1 он рисует только бейдж (product-spec §4) */}
                {s.moon ? (
                  <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                    <Txt style={{ color: t.accent, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' }}>
                      {tr('moonSpread.event')}
                    </Txt>
                  </View>
                ) : (
                  !s.free && (
                    <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                      <Txt style={{ color: t.accent, fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' }}>
                        {tr('spreads.premium')}
                      </Txt>
                    </View>
                  )
                )}
              </PressableScale>
            </FadeUp>
          );
        })}
```

- [ ] **Шаг 3: стиль приглушения**

В `const st = StyleSheet.create({...})` добавить:

```ts
  dim: { opacity: 0.45 }, // вне окна события — как прошедшие дни лунного календаря
```

- [ ] **Шаг 4: проверки и коммит**

```bash
npx tsc --noEmit
npm test
git add "app/(tabs)/spreads/index.tsx"
git commit -m "feat: лунные расклады в списке — бейдж события и заблокированное состояние (spec 51)"
```

---

### Задача 5: экран расклада и гейт маршрута

**Файлы:**
- Создать: `src/components/PositionCards.tsx`
- Изменить: `src/components/SpreadScreen.tsx`
- Изменить: `app/(tabs)/spreads/[id].tsx`

**Интерфейсы:**
- Использует: `moonSpreadState` (задача 1), `Rule` (проп `glyph`), `Spread.moon` (задача 2).
- Отдаёт: `<PositionCards spread={Spread} />`.

- [ ] **Шаг 1: список позиций**

Создать `src/components/PositionCards.tsx`:

```tsx
/** Перечень позиций расклада до тасования — блок `.poscard` эталона (спека 51, экран
 *  `v-moonspread`): пунктирная заглушка карты со звездой, номер позиции и её название.
 *  Показывается только у лунных раскладов: для редкого расклада это объяснение, что он даёт;
 *  у обычных восьми список позиций до тасования не появляется. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { Spread } from '../lib/content';
import { useLang } from '../lib/i18n';
import { inLang } from '../lib/lang';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function PositionCards({ spread }: { spread: Spread }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();

  return (
    <>
      {spread.positions.map((p, i) => (
        <View key={i} style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          <View style={[st.thumb, { borderColor: t.line }]}>
            {/* ✶ нет в Manrope, поэтому обычный Text без fontFamily (правило Txt.tsx) */}
            <Text style={{ fontSize: 12, color: t.muted }}>✶</Text>
          </View>
          <View style={st.tx}>
            <Txt style={[st.num, { color: t.accent }]}>{tr('moonSpread.position', { n: i + 1 })}</Txt>
            <Txt style={[st.name, { color: t.muted }]}>{inLang(p, lang)}</Txt>
          </View>
        </View>
      ))}
    </>
  );
}

const st = StyleSheet.create({
  // `.poscard`: panel/line, radius 13, паддинг 11×13, отступ 8, ряд gap 11
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  // `.pcimg`: 34×56, radius 5, пунктир line
  thumb: {
    width: 34,
    height: 56,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tx: { flex: 1 }, // сжимаемый текст (в RN flexShrink по умолчанию 0)
  num: { fontSize: 8.5, letterSpacing: 1.8 }, // `.pcn`
  name: { fontFamily: fonts.display, fontSize: 14, marginTop: 2 }, // `.pct`
});
```

- [ ] **Шаг 2: лунные отличия в `SpreadScreen`**

В `src/components/SpreadScreen.tsx` добавить импорты (⚠️ `formatDayMonth` и `localDateISO`
там УЖЕ импортированы одной строкой из `../lib/dates` — второй раз не добавлять, будет
ошибка дублирующего импорта):

```tsx
import { moonSpreadState } from '../lib/moonSpread';
import { PositionCards } from './PositionCards';
```

После `const board = isBoard(n);` добавить:

```tsx
  // лунный расклад: событие в оверлайне, свой глиф разделителя, своя подпись и перечень позиций
  // до тасования (спека 51). У обычных восьми раскладов spread.moon нет — всё как было.
  const moon = spread.moon ? moonSpreadState(spread.moon) : null;
```

Заменить сборку `overline`:

```tsx
  const overline = moon
    ? `${tr('moonSpread.event')} · ${tr(`moon.${moon.kind}`)} ${formatDayMonth(localDateISO(moon.at), lang)}`.toUpperCase()
    : [
        tr('spread.overline'),
        tr('spreads.cards', { count: n }).toUpperCase(),
        ...(view && draw ? [formatDayMonth(draw.date, lang).toUpperCase()] : []),
      ].join(' · ');
```

Заменить `<Rule />` на:

```tsx
          <Rule glyph={spread.moon === 'full' ? '○' : spread.moon === 'new' ? '●' : undefined} />
```

Заменить блок подсказки:

```tsx
        {!view && (!dealt || board) && (
          <FadeUp index={1}>
            <Txt style={[st.hint, { color: t.muted }]}>
              {spread.moon ? tr(spread.moon === 'new' ? 'moonSpread.hintNew' : 'moonSpread.hintFull') : tr('spread.hint')}
            </Txt>
          </FadeUp>
        )}
```

Перед блоком CTA `{!dealt && (...)}` добавить перечень позиций:

```tsx
        {!dealt && spread.moon && (
          <FadeUp index={2}>
            <PositionCards spread={spread} />
          </FadeUp>
        )}
```

⚠️ `Rule` принимает `glyph?: string` со значением по умолчанию `'✦'`, поэтому `undefined`
для обычных раскладов даёт прежний вид — менять `Rule` не нужно.

- [ ] **Шаг 3: гейт маршрута**

В `app/(tabs)/spreads/[id].tsx` после проверки `if (!spread || spread.id === 'card-of-day')`:

```tsx
  // вне окна события лунный расклад не играется — прямая ссылка не должна обходить блокировку
  // списка (тот же приём, что у 'card-of-day' и чужого id)
  if (spread.moon && !moonSpreadState(spread.moon)?.open) return <Redirect href="/spreads" />;
```

Импорт: `import { moonSpreadState } from '../../../src/lib/moonSpread';`

⚠️ Режим `view` (сохранённый расклад из дневника, `app/spread/[ts].tsx`) окном НЕ ограничивается
никогда: это дневник, а не игра — расклад, сохранённый в августе, обязан открываться в декабре.
Файл `app/spread/[ts].tsx` в этой задаче НЕ трогаем.

- [ ] **Шаг 4: проверки и коммит**

```bash
npx tsc --noEmit
npm test
git add src/components/PositionCards.tsx src/components/SpreadScreen.tsx "app/(tabs)/spreads/[id].tsx"
git commit -m "feat: экран лунного расклада — событие в шапке, перечень позиций, гейт окна (spec 51)"
```

---

### Задача 6: дорисовка макета

**Файлы:**
- Изменить: `docs/design-reference.html`

- [ ] **Шаг 1: вторая лунная карточка и заблокированное состояние в списке раскладов**

В блоке `/* 3. бейдж события у лунных раскладов в списке «Расклады» */` (около строки 1837)
заменить создание одной карточки на две — открытую и заблокированную:

```js
/* 3. бейдж события у лунных раскладов в списке «Расклады».
   Две карточки: новолуние в окне (открыта) и полнолуние вне окна (заблокировано с датой) —
   решение 20, состояние «вне окна» дорисовано задачей 51. */
(function(){
  const box=document.getElementById('sps'); if(!box) return;
  const diag = `<div class="diag"><i style="left:0;top:11px"></i><i style="left:13px;top:11px"></i>`+
    `<i style="left:26px;top:11px"></i><i style="left:39px;top:11px"></i></div>`;
  const open=document.createElement('div');
  open.className='sp'; open.onclick=()=>show('v-moonspread');
  open.innerHTML = diag+
    `<div class="tx"><b>Расклад новолуния</b><small>4 карты · открыт в окно события — сутки до и после</small></div>`+
    `<span class="evbadge">● СОБЫТИЕ</span>`;
  box.appendChild(open);
  const locked=document.createElement('div');
  locked.className='sp splocked';
  locked.innerHTML = diag+
    `<div class="tx"><b>Расклад полнолуния</b><small>Откроется 28 августа</small></div>`+
    `<span class="evbadge">○ СОБЫТИЕ</span>`;
  box.appendChild(locked);
})();
```

- [ ] **Шаг 2: стиль заблокированной карточки и панели**

В секцию `/* 3. лунные расклады */` (около строки 633) добавить:

```css
.sp.splocked{opacity:.45;cursor:default}
.moonspread.mslocked{opacity:.45;cursor:default}
```

- [ ] **Шаг 3: заблокированная панель на экране луны**

В `#v-moon` (около строки 1171) после строки события полнолуния добавить панель вне окна:

```html
      <div class="moonspread mslocked"><span class="ms1">Расклад полнолуния · 4 карты</span><span class="ms2">ОТКРОЕТСЯ 28 АВГУСТА</span></div>
```

- [ ] **Шаг 4: настоящие названия позиций вместо плейсхолдеров**

В `#v-moonspread` (строки 1193–1196) заменить четыре `.poscard` на:

```html
      <div class="poscard"><div class="pcimg">✶</div><div><div class="pcn">ПОЗИЦИЯ 1</div><div class="pct">Семя</div></div></div>
      <div class="poscard"><div class="pcimg">✶</div><div><div class="pcn">ПОЗИЦИЯ 2</div><div class="pct">Почва</div></div></div>
      <div class="poscard"><div class="pcimg">✶</div><div><div class="pcn">ПОЗИЦИЯ 3</div><div class="pct">Помеха</div></div></div>
      <div class="poscard"><div class="pcimg">✶</div><div><div class="pcn">ПОЗИЦИЯ 4</div><div class="pct">Первый шаг</div></div></div>
```

- [ ] **Шаг 5: проверка и коммит**

Открыть файл в браузере, пройти на экран луны и в список раскладов, убедиться, что оба состояния
рисуются и ничего не съехало. Затем:

```bash
git add docs/design-reference.html
git commit -m "docs: макет — лунный расклад полнолуния и состояние «вне окна» (spec 51)"
```

---

### Задача 7: веб-проверка, документы, закрытие

**Файлы:**
- Изменить: `docs/product-spec.md` (§4 — лунные расклады и окно)
- Изменить: `docs/logic-spec.md` (правило окна рядом с разделом про луну)
- Изменить: `docs/design-system.md` (§5 — панель, бейдж события, позиция)
- Изменить: `docs/backlog.md`, `CLAUDE.md`
- Изменить: `docs/specs/51-moon-spreads.md` (отчёт)
- Создать: `docs/screenshots/51/`

- [ ] **Шаг 1: поднять dev-сервер ЗАНОВО**

```bash
npx expo start --web --port 8081 --clear
```
⚠️ Именно заново и с `--clear`: у работающего сервера своя закешированная карта модулей, новых
файлов `moonSpread.ts` / `MoonSpreadPanel.tsx` / `PositionCards.tsx` он бы не увидел, и проверка
была бы зелёной ни на чём (уроки задач 06б, 49 и 46в). Доставку правки проверять грепом
по САМОМУ бандлу, а не по диску.

- [ ] **Шаг 2: красный прогон — сценарий обязан покраснеть без гейта**

Временно снять гейт из `app/(tabs)/spreads/[id].tsx` (строку с `Redirect`), перезапустить
сервер, прогнать сценарий «вне окна прямая ссылка `/spreads/new-moon` уводит в список» —
обязан упасть. Вернуть гейт, перезапустить, прогнать снова — зелёный.
Правило проекта: зелёный с первого раза — повод искать ошибку в самой проверке.

- [ ] **Шаг 3: веб-проверка 6а/6б с подменой часов**

Скрипт Playwright (запуск — как в AGENTS.md, `NODE_PATH` на кэш npx, вьюпорт 390×844).
Сид состояния ставить `goto` → `evaluate` → `reload`, НЕ через `addInitScript`.
Даты подменять `page.clock.install({ time: ... })` — без этого проверка идёт на одной дате,
и одно из двух состояний не наблюдается вовсе (приём задачи 47б).

Проверить в ОБЕИХ темах:
1. в окно новолуния — панель на экране луны активна, надпись «ОТКРЫТЬ →»;
2. вне окна — панель под будущим событием приглушена и показывает «ОТКРОЕТСЯ …»;
3. под уже прошедшим событием месяца панели нет вовсе;
4. в списке раскладов лунная карточка вне окна приглушена, тап ничего не делает;
5. в окно — тап открывает экран расклада: оверлайн «СОБЫТИЕ · НОВОЛУНИЕ …», глиф ●,
   подпись про окно, четыре панели позиций, CTA «Разложить карты»;
6. полный цикл: разложить → открыть 4 карты → состав → заметка → сохранить → запись
   появилась в дневнике профиля;
7. сохранённый расклад открывается из дневника ВНЕ окна (подменить часы на месяц вперёд);
8. прямая ссылка `/spreads/new-moon` вне окна редиректит в список.

Скриншоты изменённых экранов в обеих темах — в `docs/screenshots/51/`. Консоль без ошибок
(известный чужой warning `pointerEvents` из `@react-navigation/elements` — не наш, спека 39).

- [ ] **Шаг 4: прогон приёмки переводов**

```bash
python scripts/check_translation.py --scope spreads --lang es,pt
```
Ожидается: ровно два новых расклада отмечены как непереведённые и НИЧЕГО больше. Это
задокументированное состояние до задачи 28м — записать вывод в отчёт спеки.

- [ ] **Шаг 5: синхронизация документов**

- `docs/product-spec.md` §4: два лунных расклада, окно «сутки до и после», вход с экрана луны
  и из списка, заблокированное состояние, premium-бейджа у полнолуния нет.
- `docs/logic-spec.md`: правило окна календарными сутками и почему не ±24 часа.
- `docs/design-system.md` §5: панель `.moonspread` (пунктир, chipBg, radius 13, паддинг 10×13),
  бейдж события (8px/ls 1.2), позиция `.poscard` (34×56 пунктир, `.pcn` 8.5/ls 1.8,
  `.pct` Cormorant 14 muted), приглушение вне окна 0.45.
- `docs/backlog.md` и `CLAUDE.md`: статус задачи, новое общее, заведённая задача 28м.
- `docs/specs/51-moon-spreads.md`: отчёт веб-проверки с числами.

- [ ] **Шаг 6: завести задачу 28м в бэклоге**

Перевод названий, описаний и восьми позиций двух лунных раскладов на es/pt — работа Cowork
(переводы Claude Code не пишет). Промт по образцу `docs/prompts/28l-resync.md`.

- [ ] **Шаг 7: финальные проверки и коммит**

```bash
npx tsc --noEmit
npm test
git add -- docs CLAUDE.md
git commit -m "docs: отчёт веб-проверки 51, скриншоты и синхронизация доков (spec 51)"
git push -u origin feat/51-moon-spreads
```
⚠️ Коммитить поимённым списком путей, НЕ `git add -A`: в репозитории бывают параллельные сессии
и поставки Cowork, и `git add -A` подметает чужую работу в свой коммит (случилось 21.08).

- [ ] **Шаг 8: лайв-проверка и merge**

Отправить Артёму сценарий лайв-проверки: панель на экране луны, оба состояния карточки в списке,
полный цикл расклада с вибрациями, сохранение в дневник. ⚠️ Сценарий отправлять только после
того, как правка лежит в рабочем дереве (урок задачи 44: сценарий, ушедший раньше правки,
выглядел бы пройденным, не будучи им). После зелёной лайв-проверки — merge в main.
