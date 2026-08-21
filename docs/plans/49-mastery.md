# План 49 — уровни мастерства карты

> **Для исполнителя:** выполнять по задачам, шаги — чекбоксы. Спека — `docs/specs/49-mastery.md`
> (план аргументирует от неё; читать обе). Реализация — сабагентами sonnet по этому плану,
> оркестрация и ревью — сессия. После КАЖДОГО шага с кодом — `npx tsc --noEmit`.

**Цель:** у изученной карты видна ступень мастерства из SRS — чип на странице карты,
полоски в ячейке справочника.

**Архитектура:** чистая функция `masteryLevel` над `SrsState` (новый модуль `mastery.ts`),
два места показа читают её через уже имеющиеся `learnedCardIds` + `srs` из стора.
Ничего не хранится, persist version 10 не меняется.

**Стек:** RN/Expo SDK 54, zustand, react-i18next, jest-expo. Новых пакетов НЕТ (`npm install` не нужен).

## Глобальные ограничения (из спеки и правил проекта)

- SDK НЕ обновлять, версии пакетов не трогать.
- Цвета ТОЛЬКО из `src/theme/theme.ts` — хардкод запрещён (единственное новое значение —
  токен `successBg`, он и добавляется в тему).
- Комментарии в коде и сообщения коммитов — русские, без упоминаний ИИ.
- Новая формула → юнит-тест в том же коммите; `npm test` зелёный перед каждым push.
- i18n: новый ключ добавляется СРАЗУ во все 4 языка (ru/en/es/pt) — контракт-тест
  `i18nPlurals` проверяет совпадение набора ключей и упадёт на пропуске.
- Persist version остаётся **10**: схема стора не меняется (DEV-экшен пишет в уже
  существующий ключ `srs`).
- Ступень существует ТОЛЬКО у изученной карты (`learnedCardIds`); неизученной — ни чипа,
  ни полосок, даже «НОВАЯ».
- Правило сегментов: ступень N подсвечивает ровно N сегментов из 4 (решение Артёма 21.08).

---

### Задача 0: ветка и документы

**Файлы:** ничего в коде.

- [ ] **Шаг 0.1.** От `main` создать ветку:
```bash
git checkout main && git pull && git checkout -b feat/49-mastery
```
- [ ] **Шаг 0.2.** Закоммитить спеку и план:
```bash
git add docs/specs/49-mastery.md docs/plans/49-mastery.md
git commit -m "docs: спека и план задачи 49 — уровни мастерства карты"
```

---

### Задача 1: модуль `mastery.ts` + тесты (TDD)

**Файлы:**
- Создать: `src/lib/mastery.ts`
- Создать: `src/lib/__tests__/mastery.test.ts`

**Интерфейсы (их используют задачи 3–5):**
- `export type MasteryLevel = 1 | 2 | 3 | 4`
- `export const MASTERY_KEYS: Record<MasteryLevel, string>` — полные i18n-ключи
- `export function masteryLevel(s: SrsState | undefined): MasteryLevel`

- [ ] **Шаг 1.1. Написать падающий тест** `src/lib/__tests__/mastery.test.ts`:

```ts
/** Ступень мастерства карты по SRS-записи (спека 49). Кейс на КАЖДУЮ границу порогов. */
import { masteryLevel } from '../mastery';
import { reviewState, type SrsState } from '../srs';

const st = (intervalDays: number): SrsState => ({ reps: 1, intervalDays, ease: 2.5, due: '2026-08-22' });

describe('masteryLevel', () => {
  test('записи нет — НОВАЯ (1): изучена уроком, ещё не повторялась', () => {
    expect(masteryLevel(undefined)).toBe(1);
  });
  test('интервал 0 (после провала) — ЗНАКОМАЯ (2), не НОВАЯ: запись есть, карта в работе', () => {
    expect(masteryLevel(st(0))).toBe(2);
  });
  test('границы ЗНАКОМОЙ: 1 и 5', () => {
    expect(masteryLevel(st(1))).toBe(2);
    expect(masteryLevel(st(5))).toBe(2);
  });
  test('границы УВЕРЕННОЙ: 6 и 20', () => {
    expect(masteryLevel(st(6))).toBe(3);
    expect(masteryLevel(st(20))).toBe(3);
  });
  test('границы МАСТЕРА: 21 и потолок 365', () => {
    expect(masteryLevel(st(21))).toBe(4);
    expect(masteryLevel(st(365))).toBe(4);
  });
  test('МАСТЕР после «не помню» падает до ЗНАКОМОЙ — сквозь настоящий reviewState', () => {
    const master = st(30);
    expect(masteryLevel(master)).toBe(4);
    expect(masteryLevel(reviewState(master, 0, '2026-08-21'))).toBe(2);
  });
});
```

- [ ] **Шаг 1.2.** Прогнать: `npx jest src/lib/__tests__/mastery.test.ts` —
  ожидаю FAIL «Cannot find module '../mastery'».
- [ ] **Шаг 1.3. Реализация** `src/lib/mastery.ts`:

```ts
/**
 * Ступень мастерства изученной карты по SRS-записи (спека 49, master-plan п. 13).
 * Чистый модуль без импортов react/expo — как srs.ts, из которого берёт тип.
 *
 * Пороги — решение Артёма 20.08: НОВАЯ (записи нет — изучена уроком, не повторялась) ·
 * ЗНАКОМАЯ (intervalDays 0–5) · УВЕРЕННАЯ (6–20) · МАСТЕР (21+).
 * Ноль в пороге ЗНАКОМОЙ — осознанно: «не помню» сбрасывает интервал в 0, и ступень
 * честно ПАДАЕТ (МАСТЕР → провал → ЗНАКОМАЯ), но не до НОВОЙ — запись существует.
 * Изученность проверяет ВЫЗЫВАЮЩИЙ (learnedCardIds): у неизученной карты ступени нет
 * по определению, и тащить курс в чистый модуль ради этой проверки — лишняя связность.
 */
import type { SrsState } from './srs';

export type MasteryLevel = 1 | 2 | 3 | 4;

/** i18n-ключи ярлыков по ступени — одно место, обоим потребителям (чип, DEV). */
export const MASTERY_KEYS: Record<MasteryLevel, string> = {
  1: 'mastery.new',
  2: 'mastery.familiar',
  3: 'mastery.confident',
  4: 'mastery.master',
};

export function masteryLevel(s: SrsState | undefined): MasteryLevel {
  if (!s) return 1;
  if (s.intervalDays <= 5) return 2;
  if (s.intervalDays <= 20) return 3;
  return 4;
}
```

- [ ] **Шаг 1.4.** `npx jest src/lib/__tests__/mastery.test.ts` — PASS (6 тестов);
  `npx tsc --noEmit` — чисто.
- [ ] **Шаг 1.5.** Коммит:
```bash
git add src/lib/mastery.ts src/lib/__tests__/mastery.test.ts
git commit -m "feat: ступень мастерства карты — чистая функция по интервалу SM-2 (spec 49)"
```

---

### Задача 2: токен `successBg` + строки i18n

**Файлы:**
- Изменить: `src/theme/theme.ts` (интерфейс + обе темы)
- Изменить: `src/lib/i18n.ts` (4 языка × 5 ключей)

**Производит:** `t.successBg` (задача 3), ключи `mastery.*` (задача 3), `settings.devSeedMastery` (задача 5).

- [ ] **Шаг 2.1.** В `Theme` (после `success: string;`, строка ~26) добавить:
```ts
  /** фон чипа МАСТЕР (`.mastery.m4` эталона) — подложка под текст цвета success */
  successBg: string;
```
В `darkTheme` после `success: '#5aa07e',` и в `lightTheme` после `success: '#4d9370',` — одинаково:
```ts
  successBg: 'rgba(90,160,126,0.12)',
```
- [ ] **Шаг 2.2.** В `src/lib/i18n.ts` добавить секцию `mastery` во ВСЕ ЧЕТЫРЕ языка
  (сиблинг секции `cards`, сразу после неё; ru ~строка 50, en ~335, es ~605, pt ~923 —
  ориентироваться по ключу `cards.learned`, номера строк могли уехать). Ярлыки капсом,
  род женский — согласован со словом «карта» (carta — ж. р. в es и pt):

```ts
        // ru
        mastery: { new: "НОВАЯ", familiar: "ЗНАКОМАЯ", confident: "УВЕРЕННАЯ", master: "МАСТЕР" },
        // en
        mastery: { new: "NEW", familiar: "FAMILIAR", confident: "CONFIDENT", master: "MASTER" },
        // es (черновик — на вычитку Cowork, хвост в бэклоге)
        mastery: { new: "NUEVA", familiar: "CONOCIDA", confident: "SEGURA", master: "MAESTRA" },
        // pt (черновик — на вычитку Cowork)
        mastery: { new: "NOVA", familiar: "CONHECIDA", confident: "SEGURA", master: "MESTRA" },
```

- [ ] **Шаг 2.3.** Там же — DEV-строка настроек, рядом с `devAgeSrs` (ru 169, en 434, es 743, pt 1061):
```ts
        devSeedMastery: "Рассадить ступени мастерства",   // ru
        devSeedMastery: "Seed mastery levels",            // en
        devSeedMastery: "Repartir niveles de dominio",    // es
        devSeedMastery: "Distribuir níveis de domínio",   // pt
```
- [ ] **Шаг 2.4.** `npx tsc --noEmit` — чисто; `npm test` — зелёный (контракт паритета
  ключей i18n обязан пройти: ключи добавлены во все 4 языка).
- [ ] **Шаг 2.5.** Коммит:
```bash
git add src/theme/theme.ts src/lib/i18n.ts
git commit -m "feat: токен successBg и строки ступеней мастерства на 4 языках (spec 49)"
```

---

### Задача 3: чип `MasteryChip` + страница карты

**Файлы:**
- Создать: `src/components/MasteryChip.tsx`
- Изменить: `app/card/[id].tsx` (импорты ~23–42; хуки ~213–219; рендер ~315–316; стили ~417)

**Потребляет:** `masteryLevel`/`MASTERY_KEYS`/`MasteryLevel` (задача 1), `t.successBg` и ключи `mastery.*` (задача 2).

- [ ] **Шаг 3.1.** `src/components/MasteryChip.tsx`:

```tsx
/** Чип ступени мастерства (`.mastery` эталона, спека 49): 4 точки + ярлык ступени.
 *  Подсвечено ровно `level` точек (правило сегментов 1/2/3/4). Цвета по ступени:
 *  НОВАЯ — muted/line/panel; ЗНАКОМАЯ и УВЕРЕННАЯ — accent/frame/chipBg (как чип
 *  аркана рождения); МАСТЕР — success/successBg. Показывается только изученной карте —
 *  это проверяет вызывающий. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MASTERY_KEYS, type MasteryLevel } from '../lib/mastery';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function MasteryChip({ level, style }: { level: MasteryLevel; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const colors =
    level === 4
      ? { text: t.success, border: t.success, bg: t.successBg }
      : level === 1
        ? { text: t.muted, border: t.line, bg: t.panel }
        : { text: t.accent, border: t.frame, bg: t.chipBg };
  return (
    <View style={[st.chip, { borderColor: colors.border, backgroundColor: colors.bg }, style]}>
      <View style={st.dots}>
        {([1, 2, 3, 4] as const).map((i) => (
          <View key={i} style={[st.dot, { backgroundColor: colors.text }, i > level && st.dotOff]} />
        ))}
      </View>
      <Txt style={[st.label, { color: colors.text }]}>{tr(MASTERY_KEYS[level])}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  // .mastery эталона: gap 5, граница 1, radius 12, паддинг 3/9; в строку, не на всю ширину
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotOff: { opacity: 0.3 },
  label: { fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' },
});
```

- [ ] **Шаг 3.2.** `app/card/[id].tsx` — импорты: к строке
  `import { blockText, cardById, cardNumeral } from '../../src/lib/content';` добавить `course`;
  новые строки импортов (по алфавиту к соседям):
```tsx
import { MasteryChip } from '../../src/components/MasteryChip';
import { learnedCardIds } from '../../src/lib/courseProgress';
import { masteryLevel } from '../../src/lib/mastery';
```
- [ ] **Шаг 3.3.** Хуки — после селектора `birthCardId` (~строка 216), ДО раннего
  `if (!card) return null;`:
```tsx
  // ступень мастерства изученной карты (спека 49): learned — то же множество, что бейдж
  // «ИЗУЧЕНО ✓» в справочнике; неизученной карте чип не показывается вовсе
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srsEntry = useApp((s) => s.srs[id ?? '']);
  const learned = React.useMemo(() => learnedCardIds(course, lessonsProgress), [lessonsProgress]);
```
  После проверки `if (!card) return null;` (рядом с `isTodayCard`):
```tsx
  const mastery = learned.has(card.id) ? masteryLevel(srsEntry) : undefined;
```
- [ ] **Шаг 3.4.** Рендер: между `<Txt style={[st.num, …]}>` и `<View style={st.nameRow}>`
  (порядок макета: overline → чип → название):
```tsx
            {mastery !== undefined && <MasteryChip level={mastery} style={st.mastery} />}
```
  В `st` рядом с `num`: `mastery: { marginTop: 6 },`.
- [ ] **Шаг 3.5.** `npx tsc --noEmit` — чисто. Коммит:
```bash
git add src/components/MasteryChip.tsx "app/card/[id].tsx"
git commit -m "feat: чип ступени мастерства на странице карты (spec 49)"
```

---

### Задача 4: полоски в `CardCell` + передача из справочника

**Файлы:**
- Изменить: `src/components/CardCell.tsx` (пропсы ~31–43, рендер ~69, стили ~99)
- Изменить: `app/(tabs)/cards.tsx` (импорты ~14–23, селекторы ~93, рендер ячейки ~170)

**Потребляет:** `masteryLevel`/`MasteryLevel` (задача 1).

- [ ] **Шаг 4.1.** `CardCell.tsx`: импорт `import type { MasteryLevel } from '../lib/mastery';`,
  проп в сигнатуру:
```tsx
  /** ступень мастерства изученной карты — 4 полоски под миниатюрой; не задана — полосок нет */
  mastery?: MasteryLevel;
```
  Рендер — МЕЖДУ `</View>` (закрытие `imWrap`) и `<Txt numberOfLines={2}…>` — полоски идут
  под миниатюрой, ВЫШЕ подписи, чтобы стоять на одной высоте по ряду (подписи бывают
  в 1–2 строки; расхождение с демо макета осознанное, спека 49 п. В):
```tsx
      {!!mastery && (
        <View style={st.mbar}>
          {([1, 2, 3, 4] as const).map((i) => (
            <View
              key={i}
              style={[
                st.bar,
                i <= mastery ? { backgroundColor: t.accent } : { backgroundColor: t.muted, opacity: 0.28 },
              ]}
            />
          ))}
        </View>
      )}
```
  Стили (в `st`):
```tsx
  // .gc .mbar эталона: 4 полоски 8×2, зазор 2, по центру, отступ от миниатюры 4
  mbar: { flexDirection: 'row', gap: 2, justifyContent: 'center', marginTop: 4 },
  bar: { width: 8, height: 2, borderRadius: 1 },
```
- [ ] **Шаг 4.2.** `app/(tabs)/cards.tsx`: импорт `masteryLevel` из `../../src/lib/mastery`;
  селектор рядом с `lessonsProgress` (~строка 93):
```tsx
  const srs = useApp((s) => s.srs);
```
  Рендер ячейки (~строка 170) — добавить проп:
```tsx
                <CardCell key={c.id} card={c} lang={lang} badge={learned.has(c.id) ? tr('cards.learned') : undefined} dimmed={!learned.has(c.id)} mastery={learned.has(c.id) ? masteryLevel(srs[c.id]) : undefined} />
```
- [ ] **Шаг 4.3.** `npx tsc --noEmit` — чисто. Коммит:
```bash
git add src/components/CardCell.tsx "app/(tabs)/cards.tsx"
git commit -m "feat: полоски мастерства в ячейке справочника (spec 49)"
```

---

### Задача 5: DEV-экшен «рассадить ступени» + строка в настройках

**Файлы:**
- Изменить: `src/store/useApp.ts` (интерфейс ~93, реализация ~216, импорты)
- Изменить: `app/settings.tsx` (селектор ~93, строка после `devResetSrs` ~492)

**Потребляет:** ключ `settings.devSeedMastery` (задача 2).

- [ ] **Шаг 5.1.** `useApp.ts` — импорты: к импорту из `./courseProgress`
  (там уже есть `completeLessonProgress`) добавить `learnedCardIds`; убедиться, что
  импортированы `course` из `../lib/content`, `EASE_START` из `../lib/srs` и тип `SrsMap`
  из `../lib/review` — чего нет, добавить. В интерфейс после `devAgeSrs: () => void;`:
```ts
  /** DEV: рассадить изученным картам ступени мастерства по кругу (спека 49) — без этого
   *  УВЕРЕННАЯ и МАСТЕР недостижимы на проверке раньше чем через 6/21 день повторений. */
  devSeedMastery: () => void;
```
  Реализация после `devAgeSrs`:
```ts
      devSeedMastery: () => {
        const learned = [...learnedCardIds(course, get().lessonsProgress)];
        const today = localDateISO();
        // ступени по кругу: без записи (НОВАЯ) / интервал 1 / 6 / 21; due в будущем,
        // чтобы после рассадки очередь тренажёра не наводнялась «просроченными»
        const plans = [null, { reps: 1, iv: 1 }, { reps: 2, iv: 6 }, { reps: 3, iv: 21 }] as const;
        const srs: SrsMap = { ...get().srs };
        learned.forEach((id, i) => {
          const p = plans[i % plans.length];
          if (!p) delete srs[id];
          else srs[id] = { reps: p.reps, intervalDays: p.iv, ease: EASE_START, due: plusDaysISO(today, p.iv) };
        });
        set({ srs });
      },
```
- [ ] **Шаг 5.2.** `app/settings.tsx`: селектор рядом с `devAgeSrs` (~строка 93):
```tsx
  const devSeedMastery = useApp((s) => s.devSeedMastery);
```
  Строка после `devResetSrs` (~строка 493), индекс FadeUp следующий за соседним:
```tsx
            <FadeUp index={17}>
              <SettingsRow icon="ribbon-outline" label={tr('settings.devSeedMastery')} value="DEV" onPress={devSeedMastery} />
            </FadeUp>
```
  ⚠️ Проверить фактический последний `index` соседних FadeUp на момент правки — взять следующий.
- [ ] **Шаг 5.3.** `npx tsc --noEmit` — чисто; `npm test` — зелёный. Коммит:
```bash
git add src/store/useApp.ts app/settings.tsx
git commit -m "feat: DEV-строка «рассадить ступени мастерства» (spec 49)"
```

---

### Задача 6: макет и design-system

**Файлы:**
- Изменить: `docs/design-reference.html` (строки ~1810–1835)
- Изменить: `docs/design-system.md` (раздел «5. Компоненты», строка ~64+)

- [ ] **Шаг 6.1.** Макет, массив `MASTERY` (~1810): dots → `1/2/3/4` (правило сегментов):
```js
const MASTERY = [
  {cls:'m1', dots:1, label:'НОВАЯ'},        /* нет записи srs */
  {cls:'m2', dots:2, label:'ЗНАКОМАЯ'},     /* intervalDays 0–5 */
  {cls:'m3', dots:3, label:'УВЕРЕННАЯ'},    /* 6–20 */
  {cls:'m4', dots:4, label:'МАСТЕР'},       /* 21+ */
];
```
- [ ] **Шаг 6.2.** Макет, демо полосок (~1826): значения только 1..4 и вставка ПЕРЕД
  подписью `<small>` (полоски под миниатюрой, выше подписи — как в приложении):
```js
(function(){
  const cells=[...document.querySelectorAll('#grid .gc')];
  const demo=[3,4,2,1,2,3,4,1];  /* ступени 1..4 для первых восьми изученных */
  cells.slice(0,8).forEach((c,i)=>{
    const lvl=demo[i];
    const bar=document.createElement('div'); bar.className='mbar';
    bar.innerHTML=[0,1,2,3].map(k=>`<i class="${k<lvl?'on':''}"></i>`).join('');
    c.insertBefore(bar, c.querySelector('small'));
  });
})();
```
- [ ] **Шаг 6.3.** Статический чип-пример страницы карты (~872): класс `m3` уже светит
  3 точки из 4 — правилу соответствует, не трогать (проверить глазами после 6.1: тап
  по чипу перебирает ступени с верным числом точек).
- [ ] **Шаг 6.4.** `docs/design-system.md`, раздел 5 — добавить подраздел:

```markdown
### Уровни мастерства (спека 49)

Ступень изученной карты по интервалу SM-2: НОВАЯ (записи нет) · ЗНАКОМАЯ (0–5 дней) ·
УВЕРЕННАЯ (6–20) · МАСТЕР (21+). Ступень N подсвечивает ровно N сегментов из 4.
Неизученная карта индикатора не имеет вовсе.

**Чип `MasteryChip`** (страница карты, между overline и названием, отступ сверху 6):
4 точки 4×4 r2 зазор 2 + ярлык 8.5/ls 1.5/700 капсом; gap 5, граница 1, r12, паддинг 3/9.
Цвета: НОВАЯ — `muted`/`line`/`panel`; ЗНАКОМАЯ, УВЕРЕННАЯ — `accent`/`frame`/`chipBg`;
МАСТЕР — `success`/`successBg` (единственный потребитель токена `successBg`,
rgba(90,160,126,.12) в обеих темах). Выключенная точка — opacity .3 цвета текста.

**Полоски в ячейке справочника**: 4 × (8×2 r1), зазор 2, по центру, между миниатюрой
и подписью (отступ 4) — на одной высоте по ряду. Включённая — `accent`, выключенная —
`muted` opacity .28. Демо макета кладёт полоски под подпись — расхождение осознанное
(подписи в 1–2 строки роняли бы линию ряда).
```

- [ ] **Шаг 6.5.** Открыть `docs/design-reference.html` в браузере, глазами проверить чип
  (тап-перебор) и полоски. Коммит:
```bash
git add docs/design-reference.html docs/design-system.md
git commit -m "docs: правило сегментов мастерства 1/2/3/4 в макете и design-system (spec 49)"
```

---

### Задача 7: веб-проверка 6а/6б

**Файлы:** скрипт во временной папке (в репо не коммитится), скриншоты в `docs/screenshots/49/`.

Запуск: dev-сервер `npx expo start --web` (http://localhost:8081), Playwright из кэша npx
(`NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node <скрипт>`),
вьюпорт 390×844, headless.

- [ ] **Шаг 7.1. Сид состояния.** Выяснить карты первых уроков:
  `python -c "import json;c=json.load(open('content/course.json',encoding='utf-8'));print([(l['id'],l['cards']) for m in c for l in m['lessons']][:4])"`.
  Выбрать уроки, покрывающие ≥4 карты, и посеять `localStorage` (НЕ `addInitScript`:
  `goto → evaluate → reload`):
```js
localStorage.setItem('arcanum-app', JSON.stringify({
  version: 10,
  state: {
    installSeed: 123456789,
    profile: { onboarded: true, name: 'Тест' },
    lessonsProgress: { /* реальные id уроков: */ m1l3: { done: true, errors: 0, ts: 1755750000000 } },
    srs: {
      /* реальные id карт из тех уроков — по одной на ступени 2/3/4, одна без записи (НОВАЯ): */
      'card-a': { reps: 1, intervalDays: 1,  ease: 2.5, due: '2026-08-22' },
      'card-b': { reps: 2, intervalDays: 6,  ease: 2.5, due: '2026-08-27' },
      'card-c': { reps: 3, intervalDays: 21, ease: 2.5, due: '2026-09-11' },
    },
  },
}));
```
- [ ] **Шаг 7.2. Проверки сценария** (каждая — счётом/замером, не «на глаз»):
  1. Справочник: у 4 посеянных карт полоски с 1/2/3/4 подсвеченными сегментами
     (считать узлы с непрозрачным `accent`-фоном); у неизученной карты полосок НЕТ (0 узлов).
  2. Страница изученной карты каждой ступени: чип с верным ярлыком (`НОВАЯ`/`ЗНАКОМАЯ`/
     `УВЕРЕННАЯ`/`МАСТЕР` — строки из i18n.ts, не из памяти) и верным числом точек;
     чип стоит МЕЖДУ overline и названием (сравнить y-координаты).
  3. Страница НЕизученной карты: чипа нет (поиск по всем четырём ярлыкам — 0).
  4. Контраст ярлыка: `getComputedStyle` + формула WCAG (раскладка полупрозрачного фона
     чипа на фон страницы — метод задач 25/48) для всех 4 ступеней × обе темы
     (тему переключать кликами через настройки). Ниже 4.5:1 — НЕ чинить молча, флаг Артёму.
  5. es/pt: переключить язык, страница карты со ступенью 3 (`SEGURA`) и 2 (`CONOCIDA`/
     `CONHECIDA`) — чип в одну строку, не переполнен (ширина чипа < ширины колонки текста).
  6. Консоль: ни ошибок, ни warning (кроме известного `props.pointerEvents` из
     react-navigation — он не наш, спека 39).
- [ ] **Шаг 7.3. Красный прогон** (обязателен ДО зелёного, правило AGENTS.md). Две мутации
  инструментом Edit или python-скриптом (НЕ PowerShell-конвейером — портит UTF-8):
  1. в `masteryLevel` порог `<= 5` → `<= 20`: проверки 1–2 обязаны упасть (ступени слиплись);
  2. в `CardCell` условие `i <= mastery` → `i < mastery`: проверка 1 обязана упасть
     (число полосок). После каждого прогона мутацию откатить, зелёный прогон повторить.
- [ ] **Шаг 7.4. Скриншоты 6а** в `docs/screenshots/49/`: страница карты со ступенью
  (обе темы), справочник с полосками (обе темы), es-вариант чипа. Сверка с макетом
  (`file:///…/docs/design-reference.html`, экран `v-card` и сетка) по чек-листу
  `docs/ui-verification.md`.
- [ ] **Шаг 7.5. Прокликивание 6б**: тап по карте с полосками → страница → назад;
  DEV-строка «Рассадить ступени мастерства» в настройках → справочник показывает все
  4 ступени по кругу; тренажёр: оценка «Не помню» карты-МАСТЕРА → её страница
  показывает ЗНАКОМАЯ (падение ступени вживую); «Сбросить повторение» → у всех
  изученных ступень НОВАЯ (1 сегмент).
- [ ] **Шаг 7.6.** Расхождения: каждое — либо исправить, либо явно перечислить в отчёте
  с причиной. Скриншоты закоммитить:
```bash
git add docs/screenshots/49
git commit -m "test: веб-проверка задачи 49 — скриншоты (spec 49)"
```

---

### Задача 8: синхронизация и финал

**Файлы:**
- Изменить: `docs/specs/49-mastery.md` (раздел «Отчёт веб-проверки» — по образцу спеки 47)
- Изменить: `docs/backlog.md` (запись задачи 49 со статусом `[~]`; хвост «вычитка ярлыков
  es/pt Cowork» — в запись 49; в записи 46 хвост (а) пометить «делается задачей 49»)
- Изменить: `CLAUDE.md` (абзац о задаче 49 в «Статус» — по образцу соседних)

- [ ] **Шаг 8.1.** Полный прогон: `npx tsc --noEmit` чисто, `npm test` зелёный целиком
  (зафиксировать в отчёте «N тестов в M сьютах» С УКАЗАНИЕМ редакции — урок hf-02).
- [ ] **Шаг 8.2.** Отчёт веб-проверки в спеку: что проверено, результаты красных прогонов
  (сколько проверок упало на какой мутации), замеры контраста числом, известные
  ограничения (веб не судит резкость/хаптику — пункт 6в).
- [ ] **Шаг 8.3.** Коммит доков + пуш ветки:
```bash
git add docs/specs/49-mastery.md docs/backlog.md CLAUDE.md
git commit -m "docs: отчёт веб-проверки и синхронизация доков (spec 49)"
git push -u origin feat/49-mastery
```
- [ ] **Шаг 8.4.** Сценарий лайв-проверки Артёму (ТОЛЬКО когда все правки в рабочем
  дереве — урок задачи 44): открыть изученную карту — чип; справочник — полоски ровной
  линией; DEV-рассадка → все 4 ступени; «Не помню» в тренажёре у МАСТЕРА → ЗНАКОМАЯ;
  решение «полоски остаются/снимаются» (оговорка Артёма к п. 15); светлая тема — чип
  МАСТЕР читается. Merge в main — ПОСЛЕ лайв-проверки.

---

## Самопроверка плана (выполнена)

- Покрытие спеки: А→задача 1, Б→2+3, В→4, Г→2, Д→5, Е→6, критерии приёмки→7–8. Пробелов нет.
- Типы сквозные: `MasteryLevel` (1|2|3|4) и `masteryLevel(s: SrsState | undefined)` одинаковы
  в задачах 1/3/4; `MASTERY_KEYS` — полные ключи `mastery.*`, соответствуют секции задачи 2.
- Ловушки из спеки учтены: подписка на `srs` в сетке (задача 4 — проверить плавность в 7.5),
  `alignSelf: 'flex-start'` у чипа (задача 3), `due` в будущем у DEV-рассадки (задача 5),
  полоски вне `imWrap` (задача 4), сид не через `addInitScript` (задача 7).
