# План 16 · Профиль = эталон

> **Для исполнителя:** выполнять по задачам через superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans. Чекбоксы `- [ ]` — трекинг шагов.

**Цель:** шапка профиля по эталону `#v-profile` — «ВАШ ПУТЬ» + имя, карточка уровня с XP-полосой,
карточка аркана рождения с приглашением указать дату тем, кто пропустил её в онбординге.

**Архитектура:** два новых компонента (`LevelCard`, `BirthArcanaCard`) поверх готовых данных стора
(`xp`, `profile`) и готовых деталей (`ProgressBar`, `Rule`, `DatePicker`, `cardNumeral`). Один новый
экшен стора `setBirthDate` (заполняет существующие опциональные поля — persist version НЕ меняется).
Дневник (низ экрана) не трогаем.

**Стек:** Expo SDK 54 (НЕ обновлять), React Native, zustand, react-i18next, reanimated, jest-expo.

**Спека:** `docs/specs/16-profile.md` — решения 1–6 читать перед работой.

## Глобальные ограничения

- Ветка `feat/16-profile` от main; merge только после лайв-проверки Артёма (процесс, CLAUDE.md).
- После КАЖДОГО шага с правкой кода: `npx tsc --noEmit` — чисто.
- `npm test` зелёный перед каждым коммитом с тестами (сейчас 297 тестов в 18 сьютах).
- Цвета ТОЛЬКО из `useTheme()` / токенов `src/theme/theme.ts`; хардкод запрещён.
- Тени: свечение карточек — проп `boxShadow` (по прямоугольнику), НЕ `shadow*`-пропы.
- Комментарии в коде и сообщения коммитов — русские. Упоминаний ИИ нигде нет.
- UI-строки — в оба языка `src/lib/i18n.ts` сразу.
- `pointerEvents` — только внутри стиля (не пропом).
- Третьей статы «заморозка» НЕТ (спека, решение 1). Persist version НЕ поднимать (решение 5).

---

### Задача 1: `nextLevelXp` + `levelTitleKey` в xp.ts (и снятие дубля из XpPill)

Константа `LAST_TITLE = 6` сейчас живёт в `XpPill.tsx`; карточке уровня нужна та же логика —
по главному правилу кода выносим в `src/lib/xp.ts` (правило «2+ раза — на верхний уровень»).

**Файлы:**
- Правка: `src/lib/xp.ts`
- Правка: `src/components/XpPill.tsx`
- Тест: `src/lib/__tests__/xp.test.ts`

**Интерфейсы (даёт дальше):**
- `nextLevelXp(level: number): number` — сумма XP, с которой начнётся следующий уровень.
- `levelTitleKey(level: number): string` — i18n-ключ титула (`level.t1`…`level.t6`, выше — `t6`).

- [ ] **Шаг 1.0: ветка**

```bash
git checkout -b feat/16-profile
```

- [ ] **Шаг 1.1: красные тесты**

В `src/lib/__tests__/xp.test.ts` дописать (импорт дополнить `nextLevelXp, levelTitleKey`):

```ts
describe('nextLevelXp — порог следующего уровня для подписи «X / Y XP» (спека 16)', () => {
  it.each([
    [1, 50], [2, 150], [3, 300], [4, 500], [5, 750], [6, 1000], [7, 1250],
  ])('уровень %i → следующий с %i XP', (level, next) => {
    expect(nextLevelXp(level)).toBe(next);
  });
});

describe('levelTitleKey — титул шестого уровня носят все уровни выше (logic-spec §4)', () => {
  it.each([
    [1, 'level.t1'], [5, 'level.t5'], [6, 'level.t6'], [7, 'level.t6'], [42, 'level.t6'],
  ])('уровень %i → ключ %s', (level, key) => {
    expect(levelTitleKey(level)).toBe(key);
  });
});
```

- [ ] **Шаг 1.2: убедиться, что падают**

`npm test -- xp` → FAIL («nextLevelXp is not a function»).

- [ ] **Шаг 1.3: реализация**

В `src/lib/xp.ts` после `levelFromXp` добавить:

```ts
/** Сумма XP, с которой начнётся следующий уровень — для подписи «X / Y XP» карточки
 *  уровня в профиле (спека 16): полоса там заполняется долей xp / nextLevelXp(level). */
export function nextLevelXp(level: number): number {
  return levelStart(level + 1);
}

/** Титул шестого уровня носят все уровни выше (logic-spec §4). */
export const LAST_TITLE = 6;

/** i18n-ключ титула уровня — общий для пилюли «Сегодня» и карточки уровня профиля. */
export function levelTitleKey(level: number): string {
  return `level.t${Math.min(level, LAST_TITLE)}`;
}
```

- [ ] **Шаг 1.4: зелёные тесты**

`npm test -- xp` → PASS.

- [ ] **Шаг 1.5: перевести XpPill на общий ключ**

В `src/components/XpPill.tsx`: удалить строку `const LAST_TITLE = 6; ...`, добавить импорт
`import { levelTitleKey } from '../lib/xp';`, заменить

```ts
const title = tr(`level.t${Math.min(level, LAST_TITLE)}`);
```

на

```ts
const title = tr(levelTitleKey(level));
```

- [ ] **Шаг 1.6: проверка и коммит**

`npx tsc --noEmit` чисто, `npm test` зелёный (18 сьютов, +12 тестов).

```bash
git add src/lib/xp.ts src/lib/__tests__/xp.test.ts src/components/XpPill.tsx
git commit -m "feat: nextLevelXp и общий ключ титула уровня (spec 16)"
```

---

### Задача 2: экшен `setBirthDate` в сторе

**Файлы:**
- Правка: `src/store/useApp.ts`

**Интерфейсы (даёт дальше):** `setBirthDate(iso: string): void` — пишет `birthDate` и
`birthArcanaId` внутрь `profile`.

Тесты не пишем: экшен — тонкая обёртка над `birthArcanaId`, который уже покрыт сьютом
birthArcana; стор напрямую в проекте не тестируется.

- [ ] **Шаг 2.1: тип + реализация**

В `src/store/useApp.ts`:

1. К импорту из `../lib/birthArcana` добавить `birthArcanaId`:

```ts
import { birthArcanaId, buildProfile, type Profile } from '../lib/birthArcana';
```

2. В `interface AppState` после `completeOnboarding` добавить:

```ts
  /** Дата рождения, пропущенная в онбординге, — из карточки-приглашения профиля (спека 16).
   *  Заполняет СУЩЕСТВУЮЩИЕ опциональные поля profile — persist version не меняется. */
  setBirthDate: (iso: string) => void;
```

3. В реализацию после `completeOnboarding: ...` добавить:

```ts
      setBirthDate: (iso) =>
        set({
          profile: { ...get().profile, birthDate: iso, birthArcanaId: birthArcanaId(iso) },
        }),
```

- [ ] **Шаг 2.2: проверка и коммит**

`npx tsc --noEmit` чисто.

```bash
git add src/store/useApp.ts
git commit -m "feat: экшен setBirthDate — дата рождения из профиля (spec 16)"
```

---

### Задача 3: i18n-ключи профиля

**Файлы:**
- Правка: `src/lib/i18n.ts`

**Интерфейсы (даёт дальше):** ключи `profile.overline`, `profile.arcana`, `profile.arcanaCta`,
`profile.xpOf`; правка `profile.streak`.

- [ ] **Шаг 3.1: оба языка**

Строку `profile:` в ru-блоке (сейчас
`profile: { title: "Профиль", streak: "СЕРИЯ", cards: "КАРТ ДНЯ" }`) заменить на:

```ts
      profile: {
        title: "Профиль", overline: "ВАШ ПУТЬ", streak: "СЕРИЯ 🔥", cards: "КАРТ ДНЯ",
        arcana: "АРКАН РОЖДЕНИЯ", arcanaCta: "Указать дату рождения",
        // «XP» инвариант к числу — плюрализация не нужна (правило logic-spec §10 — про формы слов)
        xpOf: "{{xp}} / {{next}} XP",
      },
```

В en-блоке (`profile: { title: "Profile", streak: "STREAK", cards: "DAILY CARDS" }`):

```ts
      profile: {
        title: "Profile", overline: "YOUR PATH", streak: "STREAK 🔥", cards: "DAILY CARDS",
        arcana: "BIRTH ARCANA", arcanaCta: "Add your birth date",
        xpOf: "{{xp}} / {{next}} XP",
      },
```

- [ ] **Шаг 3.2: проверка и коммит**

`npx tsc --noEmit` чисто, `npm test` зелёный (контракт-тесты i18n не ломаются).

```bash
git add src/lib/i18n.ts
git commit -m "feat: i18n-ключи шапки профиля (spec 16)"
```

---

### Задача 4: компонент `LevelCard`

**Файлы:**
- Создать: `src/components/LevelCard.tsx`

**Интерфейсы:**
- Берёт: `levelFromXp`, `nextLevelXp`, `levelTitleKey` (задача 1), `ProgressBar`/`PROGRESS_EASE`,
  ключ `profile.xpOf` (задача 3).
- Даёт: `<LevelCard xp={number} />` — задача 6 ставит её в шапку.

- [ ] **Шаг 4.1: компонент целиком**

```tsx
/** Карточка уровня в профиле — класс `.lvlcard` эталона: «Уровень N · Титул» + «X / Y XP»
 *  и XP-полоса. Полоса и подпись согласованы: доля = xp / порог следующего уровня
 *  (спека 16, решение 2 — у XpPill на «Сегодня» шкала «внутри уровня», это осознанно разное).
 *  Заполнение один раз при монтировании (эталон fill2: 1.4s, задержка .4s) — возврат на таб
 *  полосу не переигрывает, как у XpPill. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { levelFromXp, levelTitleKey, nextLevelXp } from '../lib/xp';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PROGRESS_EASE, ProgressBar } from './ProgressBar';
import { Txt } from './Txt';

const FILL_DELAY = 400; // эталон fill2: задержка .4s
const FILL_MS = 1400; // эталон fill2: ход 1.4s

export function LevelCard({ xp }: { xp: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const { level } = levelFromXp(xp);
  const next = nextLevelXp(level);

  const fill = useSharedValue(0);
  React.useEffect(() => {
    fill.value = withDelay(
      FILL_DELAY,
      withTiming(xp / next, { duration: FILL_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, xp, next]);

  return (
    <View style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={st.row}>
        <Txt style={[st.name, { color: t.head }]}>
          {tr('level.line', { n: level, title: tr(levelTitleKey(level)) })}
        </Txt>
        <Txt style={[st.xp, { color: t.muted }]}>{tr('profile.xpOf', { xp, next })}</Txt>
      </View>
      <ProgressBar progress={fill} radius={4} style={st.track} />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.lvlcard`
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginTop: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: fonts.displaySemi, fontSize: 16 }, // `.lt b`: serif 16 w600
  xp: { fontSize: 10, fontWeight: '700' }, // `.lt small`
  track: { height: 7, marginTop: 8 }, // `.lvlbar`
});
```

- [ ] **Шаг 4.2: проверка и коммит**

`npx tsc --noEmit` чисто.

```bash
git add src/components/LevelCard.tsx
git commit -m "feat: карточка уровня LevelCard (spec 16)"
```

---

### Задача 5: компонент `BirthArcanaCard` + подпись «назад» со страницы карты

**Файлы:**
- Создать: `src/components/BirthArcanaCard.tsx`
- Правка: `app/card/[id].tsx` (одна строка в `BACK_TITLES`)

**Интерфейсы:**
- Берёт: `setBirthDate` (задача 2), ключи `profile.arcana`/`profile.arcanaCta` (задача 3),
  `DatePicker`, `cardNumeral`, `cardById`, `cardImages`.
- Даёт: `<BirthArcanaCard lang={'ru' | 'en'} />` — сам читает профиль из стора, сам держит пикер.

- [ ] **Шаг 5.1: компонент целиком**

```tsx
/** Карточка аркана рождения в профиле — класс `.barc` эталона: мини-карта со свечением,
 *  Overline «АРКАН РОЖДЕНИЯ», «римский номер · название»; тап → страница карты.
 *  Дата рождения не указана (пропущена в онбординге) — пунктирное приглашение по паттерну
 *  NotePlate: тап открывает пикер даты, выбор пишет дату в профиль (setBirthDate), и карточка
 *  тут же становится обычной. Пустого состояния в макете нет — осознанная дорисовка
 *  (спека 16, решение 4). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { cardById, cardNumeral } from '../lib/content';
import { hapticTap } from '../lib/haptics';
import { useApp } from '../store/useApp';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { DatePicker } from './DatePicker';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function BirthArcanaCard({ lang }: { lang: 'ru' | 'en' }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const arcanaId = useApp((s) => s.profile.birthArcanaId);
  const setBirthDate = useApp((s) => s.setBirthDate);
  const [picking, setPicking] = React.useState(false);

  const card = arcanaId ? cardById.get(arcanaId) : undefined;

  if (!card) {
    return (
      <>
        <PressableScale
          onPress={() => {
            hapticTap();
            setPicking(true);
          }}
          style={[st.card, st.invite, { borderColor: t.line }]}
        >
          <View>
            <Txt style={[st.overline, { color: t.accent }]}>{tr('profile.arcana')}</Txt>
            <Txt style={[st.cta, { color: t.text }]}>{tr('profile.arcanaCta')}</Txt>
          </View>
        </PressableScale>
        <DatePicker
          visible={picking}
          value={null}
          title={tr('profile.arcanaCta')}
          onPick={setBirthDate}
          onClose={() => setPicking(false)}
        />
      </>
    );
  }

  return (
    <PressableScale
      onPress={() => {
        hapticTap();
        router.push({ pathname: '/card/[id]', params: { id: card.id, from: 'profile' } });
      }}
      style={[st.card, { backgroundColor: t.panel, borderColor: t.frame }]}
    >
      {/* свечение — box-shadow по прямоугольнику (правило теней): слой тени отдельно от clip,
          как у HeroImage страницы карты */}
      <View style={[st.imShadow, { boxShadow: `0px 6px 18px ${t.glow}`, backgroundColor: t.bg }]}>
        <View style={[st.imClip, { borderColor: t.frame }]}>
          <Image source={cardImages[card.id]} style={st.im} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      </View>
      <View>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('profile.arcana')}</Txt>
        <Txt style={[st.name, { color: t.head }]}>{`${cardNumeral(card)} · ${card.name[lang]}`}</Txt>
      </View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.barc`
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  // приглашение: пунктир = «можно заполнить» (паттерн NotePlate), без фона и изображения
  invite: { borderStyle: 'dashed' },
  imShadow: { borderRadius: 6 },
  imClip: { width: 44, height: 71, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  im: { width: '100%', height: '100%' },
  overline: { fontSize: 8.5, letterSpacing: 2 }, // `.bt small`
  name: { fontFamily: fonts.display, fontSize: 17, marginTop: 1 }, // `.bt b`: serif 17 w500
  cta: { fontSize: 13, marginTop: 2 },
});
```

- [ ] **Шаг 5.2: подпись «назад» для перехода из профиля**

В `app/card/[id].tsx` в `BACK_TITLES` добавить строку `profile` (ключ `card.backProfile`
уже существует — им пользуется дневник):

```ts
const BACK_TITLES: Record<string, string> = {
  today: 'card.backToday',
  journal: 'card.backProfile',
  profile: 'card.backProfile',
};
```

- [ ] **Шаг 5.3: проверка и коммит**

`npx tsc --noEmit` чисто (маршрут `/card/[id]` существует — typedRoutes пропустит).

```bash
git add src/components/BirthArcanaCard.tsx "app/card/[id].tsx"
git commit -m "feat: карточка аркана рождения с приглашением указать дату (spec 16)"
```

---

### Задача 6: шапка профиля по эталону

**Файлы:**
- Правка: `app/(tabs)/profile.tsx`

**Интерфейсы:** берёт `LevelCard` (задача 4), `BirthArcanaCard` (задача 5), `Rule`,
ключи задачи 3; стор — `xp`, `profile.name`.

- [ ] **Шаг 6.1: импорты и данные**

В `app/(tabs)/profile.tsx` добавить импорты:

```ts
import { BirthArcanaCard } from '../../src/components/BirthArcanaCard';
import { LevelCard } from '../../src/components/LevelCard';
import { Rule } from '../../src/components/Rule';
```

Рядом с чтением стора (`const streak = ...`) добавить:

```ts
  const xp = useApp((s) => s.xp);
  const name = useApp((s) => s.profile.name);
```

- [ ] **Шаг 6.2: константа каскада**

Комментарий и значение `BODY_STEP` (строки записей — на ступеньку позже шапки дневника,
которая переезжает с 2 на 3):

```ts
/** Шаг каскада тела списка: на ступеньку позже шапки дневника (motion-spec §4). */
const BODY_STEP = 4;
```

- [ ] **Шаг 6.3: новая шапка**

Блок `const header = (...)` до дневника заменить на (дневниковые блоки — как были,
только `FadeUp index={2}` у них становится `index={3}`):

```tsx
  const header = (
    <>
      <FadeUp index={0} style={st.pad}>
        {/* эталон: overline «ВАШ ПУТЬ» + имя; имени нет (пропущено в онбординге) — «Профиль» */}
        <Txt style={[st.overline, { color: t.muted }]}>{tr('profile.overline')}</Txt>
        <Txt style={[st.title, { color: t.head }]}>{name ?? tr('profile.title')}</Txt>
      </FadeUp>

      <FadeUp index={1} style={st.pad}>
        <Rule />
        <LevelCard xp={xp} />
      </FadeUp>

      <FadeUp index={2} style={[st.stats, st.pad]}>
        <View style={[st.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Txt style={[st.statNum, { color: t.head }]}>{streak}</Txt>
          <Txt style={[st.statLbl, { color: t.muted }]}>{tr('profile.streak')}</Txt>
        </View>
        <View style={[st.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Txt style={[st.statNum, { color: t.head }]}>{history.length}</Txt>
          <Txt style={[st.statLbl, { color: t.muted }]}>{tr('profile.cards')}</Txt>
        </View>
      </FadeUp>

      <FadeUp index={2} style={st.pad}>
        <BirthArcanaCard lang={lang} />
      </FadeUp>

      {month && summary && (
        <FadeUp index={3} style={st.pad}>
          <MonthNav
            month={month}
            lang={lang}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={() => setPicked(months[index + 1])}
            onNext={() => setPicked(months[index - 1])}
          />
          <MonthCard summary={summary} stats={stats} lang={lang} onPress={openCard} />
        </FadeUp>
      )}

      {month && chips.length > 1 && (
        <FadeUp index={3}>
          <FilterChips
            values={chips}
            // «Все» и «С заметкой» — текст из i18n; три ответа — знак ✓/≈/✗ (один источник
            // на весь экран, см. OUTCOME_MARK). У каждого чипа свой счётчик (design-reference.html)
            labels={(f) =>
              f === 'all' || f === 'note'
                ? `${tr(`journal.filters.${f}`)} ${counts[f]}`
                : `${OUTCOME_MARK[f]} ${counts[f]}`
            }
            active={filter}
            onPick={setFilter}
            contentStyle={st.chips}
          />
        </FadeUp>
      )}
    </>
  );
```

- [ ] **Шаг 6.4: стили по макету**

В `StyleSheet.create` профиля:

```ts
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // `.date`
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // `.h2`
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 }, // `.statrow`
  stat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.statbox`
    paddingVertical: 13,
  },
  statNum: { fontFamily: fonts.display, fontSize: 24 }, // `.statbox b` (было 30)
  statLbl: { fontSize: 8.5, letterSpacing: 2, marginTop: 2 }, // `.statbox small`
```

(остальные стили — `pad`, `chips`, `gear` — без изменений; `spacing` в импорте остаётся —
им пользуются `pad`/`gear`).

- [ ] **Шаг 6.5: проверка и коммит**

`npx tsc --noEmit` чисто, `npm test` зелёный.

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat: шапка профиля по эталону — путь, уровень, аркан (spec 16)"
```

---

### Задача 7: веб-проверка 6а + 6б

Требует dev-сервера: `npx expo start --web` (приложение на http://localhost:8081) и браузерного
MCP. Скриншоты класть в `docs/screenshots/16/`.

- [ ] **Шаг 7.1: сверка с макетом (6а-0 и 6а)**

Открыть приложение и `file:///…/docs/design-reference.html` (вкладка «Профиль»), окно 390×844.
Скриншоты профиля в ОБЕИХ темах: `profile-dark.png`, `profile-light.png` (+ состояние
приглашения: `profile-invite-dark.png` — получить, сбросив дату: DEV-сброс онбординга →
пройти без даты). Чек-лист `docs/ui-verification.md`. Ожидаемые расхождения (в отчёт,
не чинить): нет третьей статы «заморозка» (решение 1 спеки); пунктирное приглашение
отсутствует в макете (решение 4 — дорисовка); порядок «карточка месяца ↔ чипы» — как
в закрытых задачах 05/06а.

- [ ] **Шаг 7.2: прокликивание (6б)**

- Тап по карточке аркана → страница карты, «назад» подписан «Профиль», на странице виден чип
  «✦ ВАШ АРКАН РОЖДЕНИЯ»; возврат работает.
- DEV-сбросом получить профиль без даты → пунктирное приглашение; тап → пикер (веб-версия
  DatePicker); выбрать дату → карточка аркана появилась без перезагрузки; XP/уровень не изменились.
- Уровень: полоса заполняется один раз при входе; цифры «X / Y XP» соответствуют стору
  (проверить на нескольких значениях через DEV-строки уроков: пройти урок → XP вырос → подпись
  и полоса согласованы).
- Шестерёнка → настройки → назад. Навигатор месяцев, чипы-фильтры, редактирование сегодняшней
  записи — работают как раньше. Обе темы. Консоль браузера — без ошибок и warning.

- [ ] **Шаг 7.3: фиксы и коммит**

Каждое несогласованное расхождение — исправить, повторить скриншот.

```bash
git add docs/screenshots/16
git commit -m "chore: скриншоты веб-сверки профиля (spec 16)"
```

---

### Задача 8: синхронизация документов

- [ ] **Шаг 8.1: backlog**

В `docs/backlog.md`:
- Задачу 16 пометить `[~]` с датой и остатком «лайв-проверка на iPhone» (в `[x]` — только
  после 6в).
- В задачу 10 дописать: «+ третья стата „ЗАМОРОЗКА ❄“ в профиле (`.statbox`, спека 16
  её осознанно не делает — данных нет)».
- В раздел дорисовок макета добавить: «Макет: пустое состояние карточки аркана рождения
  в профиле — приложение показывает пунктирное приглашение „Указать дату рождения“
  (паттерн NotePlate), макет рисует только заполненную `.barc` (спека 16, решение 4)».

- [ ] **Шаг 8.2: статус в CLAUDE.md**

В раздел «Статус» — абзац о задаче 16 (кратко: что сделано, новое общее — `LevelCard`,
`BirthArcanaCard`, `nextLevelXp`/`levelTitleKey`/`LAST_TITLE` в xp.ts, `setBirthDate`;
persist version НЕ менялась и почему; счёт тестов). Спеку 16 — статус «реализована,
ждёт лайв-проверки».

- [ ] **Шаг 8.3: коммит и пуш ветки**

```bash
git add docs/backlog.md CLAUDE.md docs/specs/16-profile.md
git commit -m "docs: задача 16 реализована, ждёт лайв-проверки (spec 16)"
git push -u origin feat/16-profile
```

После лайв-проверки Артёма на iPhone (6в: хаптика, свечение, русское колесо даты) — merge
в main отдельным шагом, отметка `[x]` в backlog.

---

## Самопроверка плана (выполнена)

- Покрытие спеки: решения 1–6 и все пункты «Что делаем» разнесены по задачам 1–6;
  критерии приёмки — задачи 7–8. Третья стата и настройки имени — не делаются (по спеке).
- Типы сходятся: `nextLevelXp(level)` (задача 1) ↔ `LevelCard` (задача 4);
  `setBirthDate(iso: string)` (задача 2) ↔ `onPick={setBirthDate}` у `DatePicker`
  (сигнатура `onPick: (iso: string) => void` — совпадает); `from: 'profile'` (задача 5, шаг 5.1)
  ↔ `BACK_TITLES.profile` (шаг 5.2).
- Плейсхолдеров нет: весь код приведён целиком.
