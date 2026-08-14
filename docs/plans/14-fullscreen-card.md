# План 14 — Полноэкранный просмотр карты

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Цель:** тап по изображению карты (страница карты; карта дня после переворота) открывает
полноэкранный просмотр с полётом-оборотом, pinch-zoom/паном и параллаксом от гироскопа.

**Архитектура:** общий компонент `CardLightbox` на RN `Modal` (transparent), локальное состояние
на экране-хозяине; вся жестовая математика — в чистом модуле `src/lib/lightbox.ts` под юнит-тестами;
позиция источника меряется в момент тапа (`measureInWindow`, тип `Rect` из `cardTransition.ts`).

**Стек:** react-native-reanimated 4 (уже есть), react-native-gesture-handler (НОВЫЙ пакет),
expo-sensors (НОВЫЙ пакет), expo-blur, expo-status-bar — всё в Expo Go SDK 54.

**Спека:** `docs/specs/14-fullscreen-card.md` — читать перед стартом. Макет: `.lightbox`
в `docs/design-reference.html` (строки ~403–425 CSS, ~764 разметка).

## Global Constraints

- Expo SDK 54, `expo upgrade` НЕ запускать; новые пакеты ставить ТОЛЬКО `npx expo install`.
- Ветка `feat/14-fullscreen-card`; после каждого шага `npx tsc --noEmit` чистый; `npm test`
  зелёный перед каждым push. Комментарии в коде — русские.
- Цвета из `useTheme()`/токенов. Исключения ниже — константы макета (тёмная «комната просмотра»
  одинакова в обеих темах, как в фото-вьюверах): scrim `rgba(4,5,14,0.88)`, тень карты
  `0 30px 80px rgba(0,0,0,0.65)`.
- Тени: `boxShadow` (не `shadow*`), `pointerEvents` — только внутри style.
- Persist не меняется (version остаётся 7).
- Геометрия карты просмотра: ширина 265, aspectRatio 0.58 (высота ≈457), radius 16 (`radius.l`),
  рамка 1px `frame`. Открытие 650мс `Easing.bezier(0.3, 0.7, 0.3, 1)`; закрытие 380мс
  `Easing.in(Easing.cubic)`; полный оборот на открытии (360°→0), полуоборот на закрытии (0→180°).

---

### Task 1: пакеты и GestureHandlerRootView

**Files:**
- Modify: `package.json` (через npx expo install)
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: рабочие импорты `react-native-gesture-handler` и `expo-sensors` для задач 5–7.

- [ ] **Step 1: поставить пакеты**

```bash
npx expo install react-native-gesture-handler expo-sensors
```

Ожидание: в package.json появляются версии, совместимые с SDK 54 (`react-native-gesture-handler`
~2.28.x, `expo-sensors` ~15.x). ⚠️ Сказать Артёму: менялся package.json → нужен npm install
и перезапуск `npx expo start --tunnel`.

- [ ] **Step 2: обернуть корневой layout**

В `app/_layout.tsx`: импорт и обёртка возврата (фрагмент `<>` заменяется на обёртку):

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// ...
  return (
    // жесты RNGH (pinch/pan в просмотре карты, спека 14) требуют корневой обёртки
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack ...>
        ...
      </Stack>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 3: проверить**

`npx tsc --noEmit` чистый; `npm test` зелёный (пакеты не должны сломать jest-expo);
`npx expo start` → приложение открывается, консоль без новых ошибок.

- [ ] **Step 4: commit** — `feat: gesture-handler и expo-sensors для просмотра карты (spec 14)`

---

### Task 2: чистый модуль lightbox.ts (TDD)

**Files:**
- Create: `src/lib/lightbox.ts`
- Test: `src/lib/__tests__/lightbox.test.ts`

**Interfaces:**
- Produces (использует Task 5–6):
  `ZOOM_MIN=1`, `ZOOM_MAX=3`, `DOUBLE_TAP_ZOOM=2`, `SWIPE_CLOSE_PX=120`,
  `clampZoom(z: number): number`,
  `panBounds(zoom: number, cardW: number, cardH: number, viewW: number, viewH: number): { maxX: number; maxY: number }`,
  `clampPan(x: number, y: number, b: { maxX: number; maxY: number }): { x: number; y: number }`,
  `doubleTapTarget(zoom: number): number`,
  `focalTranslate(px: number, py: number, zoom: number, b: { maxX: number; maxY: number }): { x: number; y: number }`,
  `swipeCloseAllowed(zoom: number): boolean`.

- [ ] **Step 1: написать падающие тесты**

```ts
/** Математика полноэкранного просмотра (спека 14): зум, границы пана, двойной тап. */
import {
  clampZoom, panBounds, clampPan, doubleTapTarget, focalTranslate,
  swipeCloseAllowed, ZOOM_MAX, ZOOM_MIN, DOUBLE_TAP_ZOOM,
} from '../lightbox';

describe('clampZoom', () => {
  it('внутри диапазона не трогает', () => expect(clampZoom(2)).toBe(2));
  it('снизу упирается в 1', () => expect(clampZoom(0.4)).toBe(ZOOM_MIN));
  it('сверху упирается в 3', () => expect(clampZoom(5)).toBe(ZOOM_MAX));
});

describe('panBounds (карта 265×457, экран 390×844)', () => {
  it('при зуме 1 пан запрещён: карта меньше экрана по обеим осям', () =>
    expect(panBounds(1, 265, 457, 390, 844)).toEqual({ maxX: 0, maxY: 0 }));
  it('при зуме 2 разрешён только вылезающий излишек', () =>
    expect(panBounds(2, 265, 457, 390, 844)).toEqual({ maxX: 70, maxY: 35 }));
  it('ось, где карта всё ещё меньше экрана, остаётся запертой', () =>
    expect(panBounds(1.4, 265, 457, 390, 844)).toEqual({ maxX: 0, maxY: 0 }));
});

describe('clampPan', () => {
  const b = { maxX: 70, maxY: 35 };
  it('внутри границ не трогает', () => expect(clampPan(10, -20, b)).toEqual({ x: 10, y: -20 }));
  it('за границей прижимает к краю с обеих сторон', () =>
    expect(clampPan(100, -50, b)).toEqual({ x: 70, y: -35 }));
});

describe('doubleTapTarget', () => {
  it('из ×1 ведёт в ×2', () => expect(doubleTapTarget(1)).toBe(DOUBLE_TAP_ZOOM));
  it('из любого зума >1 сбрасывает в ×1', () => {
    expect(doubleTapTarget(2)).toBe(1);
    expect(doubleTapTarget(1.3)).toBe(1);
  });
});

describe('focalTranslate (зум ×2, границы 70/35)', () => {
  const b = { maxX: 70, maxY: 35 };
  it('тап в центр не двигает картинку', () => expect(focalTranslate(0, 0, 2, b)).toEqual({ x: 0, y: 0 }));
  it('тап правее центра тянет картинку влево (точка тапа к центру), с клампом', () =>
    expect(focalTranslate(100, 0, 2, b)).toEqual({ x: -70, y: 0 }));
  it('без границ формула -(p·(z−1))', () =>
    expect(focalTranslate(-40, 20, 2, { maxX: 200, maxY: 200 })).toEqual({ x: 40, y: -20 }));
});

describe('swipeCloseAllowed', () => {
  it('при ×1 свайп-закрытие разрешено', () => expect(swipeCloseAllowed(1)).toBe(true));
  it('при зуме >1 запрещено — жест отдан пану', () => expect(swipeCloseAllowed(1.01)).toBe(false));
});
```

- [ ] **Step 2: убедиться, что падают** — `npm test -- lightbox` → FAIL (модуля нет).

- [ ] **Step 3: реализация**

```ts
/** Чистая математика полноэкранного просмотра карты (спека 14).
 *  Без импортов из react/expo — правила тестируются как данные. */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const DOUBLE_TAP_ZOOM = 2;
/** Порог свайпа вниз, после которого карта улетает на место (motion-spec §15). */
export const SWIPE_CLOSE_PX = 120;

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Пан разрешён только на излишек, вылезающий за экран: карта меньше экрана — стоит по центру. */
export function panBounds(zoom: number, cardW: number, cardH: number, viewW: number, viewH: number) {
  return {
    maxX: Math.max(0, (cardW * zoom - viewW) / 2),
    maxY: Math.max(0, (cardH * zoom - viewH) / 2),
  };
}

export function clampPan(x: number, y: number, b: { maxX: number; maxY: number }) {
  return {
    x: Math.min(b.maxX, Math.max(-b.maxX, x)),
    y: Math.min(b.maxY, Math.max(-b.maxY, y)),
  };
}

/** Двойной тап: из ×1 — в ×2, из любого зума — сброс к ×1. */
export function doubleTapTarget(zoom: number): number {
  return zoom > ZOOM_MIN ? ZOOM_MIN : DOUBLE_TAP_ZOOM;
}

/** Куда сдвинуть картинку, чтобы точка тапа (px,py — смещение от центра карты при ×1)
 *  оказалась в центре экрана после зума; результат зажат границами пана. */
export function focalTranslate(px: number, py: number, zoom: number, b: { maxX: number; maxY: number }) {
  return clampPan(-px * (zoom - 1), -py * (zoom - 1), b);
}

/** Свайп-вниз закрывает только при ×1: при зуме жест вертикали принадлежит пану. */
export function swipeCloseAllowed(zoom: number): boolean {
  return zoom <= ZOOM_MIN;
}
```

- [ ] **Step 4: тесты зелёные** — `npm test -- lightbox` → PASS; `npx tsc --noEmit` чистый.

- [ ] **Step 5: commit** — `feat: математика зума и пана просмотра карты + тесты (spec 14)`

---

### Task 3: компонент CardLightbox — ядро (полёт, рубашка, закрытие)

**Files:**
- Create: `src/components/CardLightbox.tsx`
- Modify: `src/lib/i18n.ts` (ключ подсказки в оба языка)

**Interfaces:**
- Consumes: `Rect` из `src/lib/cardTransition`, `CardBack` (проп `hint` НЕ передавать),
  `cardImages` из `src/lib/cardImages`, `hapticTap` из `src/lib/haptics`.
- Produces (используют Task 4 и 8):
  `<CardLightbox cardId={string} origin={Rect | null} onClose={() => void} />` —
  открыт, пока `origin !== null`; хозяин обнуляет `origin` в `onClose`.

- [ ] **Step 1: ключи i18n**

В `src/lib/i18n.ts`, семейство `card` (или создать по соседству с `lesson`):
ru `tapToClose: "НАЖМИТЕ, ЧТОБЫ ЗАКРЫТЬ"`, en `tapToClose: "TAP TO CLOSE"`.

- [ ] **Step 2: компонент**

Скелет (полный, дальше задачи только дополняют его жестами):

```tsx
/** Полноэкранный просмотр карты — «взять карту в руки» (спека 14, motion-spec §15).
 *  Оверлей на Modal: накрывает нативную шапку и таб-бар; координаты measureInWindow
 *  совпадают с системой координат модалки. Тёмная «комната просмотра» одинакова
 *  в обеих темах — константы макета .lightbox, не токены. */
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { setStatusBarHidden } from 'expo-status-bar';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardBack } from './CardBack';
import { Txt } from './Txt';
import { cardImages } from '../lib/cardImages';
import type { Rect } from '../lib/cardTransition';
import { hapticTap } from '../lib/haptics';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';

// геометрия и тайминги — .lightbox макета и motion-spec §15
const CARD_W = 265;                 // 238 в раме макета ~350px → ×1.11
const CARD_H = Math.round(CARD_W / 0.58);
const OPEN_MS = 650;                // motion-spec §15 (в макете 680 — расхождение принято спекой)
const CLOSE_MS = 380;
const OPEN_EASE = Easing.bezier(0.3, 0.7, 0.3, 1);
const SCRIM = 'rgba(4,5,14,0.88)';
const CARD_SHADOW = '0px 30px 80px rgba(0,0,0,0.65)';

type Props = { cardId: string; origin: Rect | null; onClose: () => void };

export function CardLightbox({ cardId, origin, onClose }: Props) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: viewW, height: viewH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // 0 — карта в исходной позиции, 1 — в центре экрана
  const prog = useSharedValue(0);
  // 0 — открытие/просмотр, 1 — карта долетела назад (модалка закрывается)
  const closing = useSharedValue(0);

  const open = origin !== null;

  // смещение исходной позиции от центра экрана (куда лететь «обратно»)
  const from = React.useMemo(() => {
    if (!origin) return { dx: 0, dy: 0, scale: 0.3 };
    return {
      dx: origin.x + origin.w / 2 - viewW / 2,
      dy: origin.y + origin.h / 2 - viewH / 2,
      scale: origin.w / CARD_W,
    };
  }, [origin, viewW, viewH]);

  React.useEffect(() => {
    if (!open) return;
    setStatusBarHidden(true, 'fade');
    hapticTap(); // Light на старте (motion-spec §15)
    prog.value = 0;
    closing.value = 0;
    prog.value = withTiming(1, {
      duration: OPEN_MS, easing: OPEN_EASE, reduceMotion: ReduceMotion.System,
    });
    return () => setStatusBarHidden(false, 'fade');
  }, [open, prog, closing]);

  const close = React.useCallback(() => {
    closing.value = withTiming(
      1,
      { duration: CLOSE_MS, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System },
      (finished) => { if (finished) runOnJS(onClose)(); },
    );
  }, [closing, onClose]);

  // полёт: открытие тянет prog 0→1, закрытие поверх тянет closing 0→1 обратно к from
  const cardStyle = useAnimatedStyle(() => {
    const k = (1 - prog.value) + closing.value; // 0 — центр, 1 — исходная позиция
    // оборот: открытие 360°→0 (полный, через рубашку), закрытие 0→180° (полуоборот)
    const spin = prog.value < 1 && closing.value === 0
      ? interpolate(prog.value, [0, 1], [360, 0])
      : interpolate(closing.value, [0, 1], [0, 180]);
    return {
      transform: [
        { translateX: from.dx * k },
        { translateY: from.dy * k },
        { perspective: 1200 },
        { rotateY: `${spin}deg` },
        { scale: 1 + (from.scale - 1) * k },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => ({ backfaceVisibility: 'hidden' as const }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: '180deg' }],
    backfaceVisibility: 'hidden' as const,
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(prog.value, 1 - closing.value),
  }));

  if (!open) return null;
  return (
    <Modal transparent statusBarTranslucent visible onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} />
      </Animated.View>
      {/* тап по фону/карте закрывает; в Task 5 сюда встанет GestureDetector */}
      <Pressable style={st.stage} onPress={close}>
        <Animated.View style={[st.card, cardStyle]}>
          <Animated.View style={[st.face, frontStyle, { borderColor: t.frame, boxShadow: CARD_SHADOW }]}>
            <Image source={cardImages[cardId]} style={st.im} contentFit="cover" cachePolicy="memory-disk" />
          </Animated.View>
          <Animated.View style={[st.face, backStyle, { borderColor: t.frame }]}>
            <CardBack />
          </Animated.View>
        </Animated.View>
      </Pressable>
      <Pressable onPress={close} style={[st.x, { top: Math.max(insets.top, 18), borderColor: t.line }]}>
        <Txt style={{ color: t.muted, fontSize: 14 }}>✕</Txt>
      </Pressable>
      <Txt style={[st.hint, { color: t.muted, bottom: insets.bottom + 26 }]}>{tr('card.tapToClose')}</Txt>
    </Modal>
  );
}

const st = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: CARD_W, height: CARD_H },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.l, borderWidth: 1, overflow: 'hidden',
  },
  im: { width: '100%', height: '100%' },
  x: {
    position: 'absolute', right: 18, width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  hint: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 10, letterSpacing: 2.5 },
});
```

Примечания исполнителю:
- Рубашка — `CardBack` БЕЗ подписи: макет рисует `.lbback` упрощённым глифом ✶, но рубашка
  в приложении уже нарисована компонентом — по правилу задачи 16 «символ уже нарисован —
  побеждает нарисованное» берём `CardBack` (флаг про это уже стоит в спеке… если нет — добавить
  строку в отчёт спеки).
- Тень на `face` переднем: iOS срезает тень при overflow hidden — если на устройстве тень
  пропадёт, вынести `boxShadow` на внешнюю обёртку `st.card` (как сделано у героя card/[id]).
- `reduceMotion`: `withTiming` с `ReduceMotion.System` сам сожмёт полёт; оборот при reduce
  motion выключить явно — в `cardStyle` вернуть `spin = 0`, если `reduceMotion === true`
  (флаг из `useReducedMotion()` захватывается worklet'ом).
- Хаптика «Soft на посадке»: в колбэке `withTiming` открытия — `runOnJS(hapticSoft)()`;
  отдельного Soft в haptics.ts нет — добавить `hapticSoft` по образцу `hapticTap`
  с `ImpactFeedbackStyle.Soft` (докстрока: «Мягкая посадка: карта легла в руки в просмотре»).
- Требование спеки «перевёрнутая карта показывается прямой» выполняется конструкцией:
  изображения карт нигде в приложении не поворачиваются, лицевая сторона — просто
  `cardImages[cardId]`. Отдельного кода не нужно, в отчёте отметить как проверенное.

- [ ] **Step 3: проверить** — `npx tsc --noEmit` чистый (компонент ещё никем не используется).

- [ ] **Step 4: commit** — `feat: компонент CardLightbox — полёт с оборотом и закрытие (spec 14)`

---

### Task 4: вход со страницы карты

**Files:**
- Modify: `app/card/[id].tsx`

**Interfaces:**
- Consumes: `CardLightbox` из Task 3.

- [ ] **Step 1: состояние и обёртка героя**

В `CardDetail`: состояние `const [lbOrigin, setLbOrigin] = React.useState<Rect | null>(null);`,
рендер `<CardLightbox cardId={card.id} origin={lbOrigin} onClose={() => setLbOrigin(null)} />`
последним ребёнком корневого `View` экрана.

В `HeroImage` добавить проп `onOpen: (r: Rect) => void`; обернуть содержимое в `Pressable`
(или повесить onPress на существующий `Animated.View` через `Pressable` вокруг):

```tsx
const heroRef = React.useRef<View>(null);
const openLightbox = () => {
  // позиция меряется в момент тапа — карта «парит» ±8px, полёт стартует из живой позиции
  heroRef.current?.measureInWindow((x, y, w, h) => onOpen({ x, y, w, h }));
};
```

`heroRef` вешается на НОВЫЙ обычный `View`-контейнер вокруг существующего `Animated.View`
героя, с `collapsable={false}` (иначе Android не отдаст measure). `useAnimatedRef` героя
занят перелётом из сетки — не переиспользовать.

- [ ] **Step 2: проверить руками (веб)** — открыть страницу карты → тап по изображению:
карта летит в центр с оборотом, scrim затемняет; тап/✕ возвращают на место. Консоль чистая.

- [ ] **Step 3: `npx tsc --noEmit`; commit** — `feat: просмотр карты со страницы карты (spec 14)`

---

### Task 5: жесты — pinch, pan, double-tap

**Files:**
- Modify: `src/components/CardLightbox.tsx`

**Interfaces:**
- Consumes: весь `src/lib/lightbox.ts` (Task 2).

- [ ] **Step 1: shared values и жесты**

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  clampZoom, clampPan, panBounds, doubleTapTarget, focalTranslate,
  swipeCloseAllowed, ZOOM_MIN, SWIPE_CLOSE_PX,
} from '../lib/lightbox';

const zoom = useSharedValue(1);
const savedZoom = useSharedValue(1);
const panX = useSharedValue(0);
const panY = useSharedValue(0);
const savedPan = useSharedValue({ x: 0, y: 0 });

const pinch = Gesture.Pinch()
  .onUpdate((e) => {
    'worklet';
    // упругое сопротивление за пределами: излишек входит в четверть силы
    const raw = savedZoom.value * e.scale;
    const clamped = clampZoom(raw);
    zoom.value = clamped + (raw - clamped) * 0.25;
  })
  .onEnd(() => {
    'worklet';
    zoom.value = withTiming(clampZoom(zoom.value), { duration: 180 });
    savedZoom.value = clampZoom(zoom.value);
    const b = panBounds(savedZoom.value, CARD_W, CARD_H, viewW, viewH);
    const p = clampPan(panX.value, panY.value, b);
    panX.value = withTiming(p.x, { duration: 180 });
    panY.value = withTiming(p.y, { duration: 180 });
    savedPan.value = p;
  });

const pan = Gesture.Pan()
  .onUpdate((e) => {
    'worklet';
    if (!swipeCloseAllowed(savedZoom.value)) {
      const b = panBounds(savedZoom.value, CARD_W, CARD_H, viewW, viewH);
      const p = clampPan(savedPan.value.x + e.translationX, savedPan.value.y + e.translationY, b);
      panX.value = p.x; panY.value = p.y;
    } else {
      // свайп-вниз при ×1 — Task 6 (карта следует за пальцем)
      panY.value = Math.max(0, e.translationY);
    }
  })
  .onEnd((e) => {
    'worklet';
    if (!swipeCloseAllowed(savedZoom.value)) {
      savedPan.value = { x: panX.value, y: panY.value };
    } else if (panY.value > SWIPE_CLOSE_PX) {
      runOnJS(close)();
    } else {
      panY.value = withTiming(0, { duration: 180 });
    }
  });

const doubleTap = Gesture.Tap().numberOfTaps(2)
  .onEnd((e) => {
    'worklet';
    const target = doubleTapTarget(savedZoom.value);
    const b = panBounds(target, CARD_W, CARD_H, viewW, viewH);
    // точка тапа в координатах карты относительно её центра (карта в центре экрана при ×1)
    const p = target === ZOOM_MIN
      ? { x: 0, y: 0 }
      : focalTranslate(e.absoluteX - viewW / 2, e.absoluteY - viewH / 2, target, b);
    zoom.value = withTiming(target, { duration: 220 });
    panX.value = withTiming(p.x, { duration: 220 });
    panY.value = withTiming(p.y, { duration: 220 });
    savedZoom.value = target;
    savedPan.value = p;
  });

const singleTap = Gesture.Tap()
  .onEnd(() => { 'worklet'; runOnJS(close)(); });

// pinch и pan живут одновременно (зумишь и ведёшь одним движением);
// Exclusive сам заставляет одиночный тап ждать провала двойного
const gestures = Gesture.Race(
  Gesture.Simultaneous(pinch, pan),
  Gesture.Exclusive(doubleTap, singleTap),
);
```

`Pressable`-обёртка из Task 3 заменяется на `<GestureDetector gesture={gestures}>` вокруг
сцены (✕ остаётся обычным Pressable ПОВЕРХ детектора). В `cardStyle` к transform добавить
(ПЕРЕД perspective): `{ translateX: panX.value }, { translateY: panY.value }` и в scale —
множитель `zoom.value`.

- [ ] **Step 2: проверить (веб)** — двойной тап приближает в точку и сбрасывает; одиночный
закрывает (с задержкой ожидания второго ~макс 300мс — норма жеста); пан при зуме не выпускает
картинку за края. Pinch в вебе мышью не проверить — это 6в.

- [ ] **Step 3: `npx tsc --noEmit`; `npm test` зелёный; commit** —
`feat: pinch-zoom, пан и двойной тап в просмотре карты (spec 14)`

---

### Task 6: свайп-вниз с полётом на место

**Files:**
- Modify: `src/components/CardLightbox.tsx`

- [ ] **Step 1: карта следует за пальцем**

Ветка `swipeCloseAllowed` в `pan.onUpdate` уже тянет `panY`; добавить в `cardStyle` поворот
при следовании: `rotateZ: ${interpolate(panY.value, [0, 300], [0, 2])}deg` (только при
`savedZoom.value === 1` и `closing.value === 0`). Скрим бледнеет:
в `scrimStyle` домножить opacity на `interpolate(panY.value, [0, 300], [1, 0.5], 'clamp')`.

- [ ] **Step 2: порог** — уже в `pan.onEnd`: `panY.value > SWIPE_CLOSE_PX → runOnJS(close)()`;
`close` играет полуоборот и полёт на исходное место (Task 3), стартуя с текущего сдвига —
при закрытии обнулить `panY` тем же `withTiming`, что и `closing`.

- [ ] **Step 3: проверить (веб, перетаскивание мышью)** — свайп <120px возвращает карту
пружинкой, >120px — улетает на место. `npx tsc --noEmit`; commit —
`feat: свайп-вниз закрывает просмотр карты (spec 14)`

---

### Task 7: глейр и параллакс / качание

**Files:**
- Create: `src/lib/useDeviceTilt.ts`
- Modify: `src/components/CardLightbox.tsx`

**Interfaces:**
- Produces: `useDeviceTilt(enabled: boolean): { x: SharedValue<number>; y: SharedValue<number> } | null`
  — null на вебе/без сенсора; значения — целевые градусы наклона, зажатые ±6.

- [ ] **Step 1: хук наклона**

```ts
/** Наклон устройства для параллакса просмотра карты (motion-spec §15).
 *  Вне iOS/Android (или без сенсора) отдаёт null — хозяин включает CSS-качание вместо. */
import React from 'react';
import { Platform } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { DeviceMotion } from 'expo-sensors';

const MAX_DEG = 6;
const clampDeg = (v: number) => Math.min(MAX_DEG, Math.max(-MAX_DEG, v));

export function useDeviceTilt(enabled: boolean) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const native = Platform.OS === 'ios' || Platform.OS === 'android';

  React.useEffect(() => {
    if (!enabled || !native) return;
    DeviceMotion.setUpdateInterval(33); // 30Hz — motion-spec §15
    const sub = DeviceMotion.addListener((m) => {
      const rot = m.rotation; // радианы: beta — наклон к себе/от себя, gamma — вбок
      if (!rot) return;
      // пружина damping 20 — карта «догоняет» руку, а не дёргается за ней
      x.value = withSpring(clampDeg((rot.beta * 180) / Math.PI / 6), { damping: 20 });
      y.value = withSpring(clampDeg((rot.gamma * 180) / Math.PI / 6), { damping: 20 });
    });
    return () => sub.remove();
  }, [enabled, native, x, y]);

  return native ? { x, y } : null;
}
```

⚠️ Делитель `/6` — стартовая чувствительность (полный ±6° на ~±36° наклона); подобрать
на устройстве при 6в, это ожидаемая ручная настройка.

- [ ] **Step 2: применить в CardLightbox**

- `const tilt = useDeviceTilt(open && !reduceMotion);`
- В `cardStyle` после посадки (когда `prog === 1 && closing === 0`) добавить
  `rotateX: ${tilt ? -tilt.x.value : sway} deg`, `rotateY: ... tilt.y.value ...`.
- Веб/без сенсора: качание из макета `lbidle` — shared value `sway` c
  `withRepeat(withSequence(withTiming(1, {duration: 2500, easing: Easing.inOut(Easing.ease)}), withTiming(0, ...)), -1)`,
  старт с задержкой 800мс после открытия; в стиле `rotateY: ±2.5°`, `rotateX: ∓1.5°`.
  При `reduceMotion` — ни того, ни другого (не запускать эффекты вовсе).
- Глейр: absolute-слой поверх лицевой стороны (`pointerEvents: 'none'` В СТИЛЕ) — тот же
  приём, что блик карты дня (`app/(tabs)/index.tsx`, `glareStyle` + LinearGradient
  112°, стопы прозрачность/0.3/прозрачность); запуск `withDelay(OPEN_MS + 120, withTiming(1, { duration: 900 }))`,
  один прогон. Противофаза параллаксу: к translateX глейра добавить `-tilt.y.value * 4`.

- [ ] **Step 3: проверить (веб)** — качание видно после посадки, глейр пробегает один раз.
`npx tsc --noEmit`; `npm test`; commit — `feat: глейр и параллакс просмотра карты (spec 14)`

---

### Task 8: вход с карты дня

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `CardLightbox` из Task 3.

- [ ] **Step 1: подключение**

- Состояние: `const [lbOrigin, setLbOrigin] = React.useState<Rect | null>(null);`
- Ref на СЦЕНУ карты: обычный `React.useRef<View>(null)` на `View` с `{ width: CARD_W, height: CARD_H }`
  (строка ~353; добавить `collapsable={false}`).
- В `onDraw` первой строкой заменить ранний выход:

```tsx
if (drawn) {
  // карта уже открыта — тап берёт её «в руки» (спека 14; до переворота тап открывает карту дня)
  sceneRef.current?.measureInWindow((x, y, w, h) => setLbOrigin({ x, y, w, h }));
  return;
}
```

- Рендер `<CardLightbox cardId={card.id} origin={lbOrigin} onClose={() => setLbOrigin(null)} />`
  последним ребёнком корневого `View` экрана.

- [ ] **Step 2: проверить (веб)** — до переворота тап переворачивает карту (как раньше);
после — открывает просмотр; закрытие возвращает карту на место сцены.
`npx tsc --noEmit`; commit — `feat: просмотр карты с карты дня (spec 14)`

---

### Task 9: проверка 6а/6б, отчёт, синхронизация

- [ ] **Step 1: полный прогон** — `npx tsc --noEmit`, `npm test` (все сьюты; новый `lightbox`
  в списке). Пересчитать «тестов N в M сьютах» для отчёта.
- [ ] **Step 2: веб-проверка** — Playwright, вьюпорт 390×844 (проверить `window.innerWidth`!):
  открыть просмотр со страницы карты и с карты дня, скриншоты открытого просмотра в ОБЕИХ темах
  → `docs/screenshots/14/`; прокликать: открытие, ✕, тап-закрытие, двойной тап (×2 и сброс),
  свайп мышью <120px и >120px, Android-back не проверяется в вебе. Консоль без новых
  ошибок/warning (⚠️ известный старый: `pointerEvents` из expo-router).
- [ ] **Step 3: отчёт** — результаты и отклонения в `docs/specs/14-fullscreen-card.md`
  (раздел «Отчёт»); отметить 14 в `docs/backlog.md` как [~]; статус в `CLAUDE.md`;
  напомнить Артёму про npm install (package.json менялся) и что pinch/параллакс/хаптика —
  только лайв-проверка 6в.
- [ ] **Step 4: push ветки** — merge в main только после лайв-проверки Артёма (задача 07+).

## Что НЕ делать (из спеки)

- Не менять изображения карт и не добавлять «full»-размеры.
- Не добавлять просмотр в сетку справочника, расклады, онбординг.
- Не делать просмотр маршрутом навигации (URL не меняется).
- Не трогать `cardTransition.ts` (только импорт типа `Rect`).
