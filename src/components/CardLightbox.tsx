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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion,
  useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardBack } from './CardBack';
import { Txt } from './Txt';
import { cardImages } from '../lib/cardImages';
import type { Rect } from '../lib/cardTransition';
import { hapticSoft, hapticTap } from '../lib/haptics';
import {
  clampZoom, clampPan, panBounds, doubleTapTarget, focalTranslate,
  swipeCloseAllowed, ZOOM_MIN, SWIPE_CLOSE_PX,
} from '../lib/lightbox';
import { radius } from '../theme/theme';
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
    prog.value = withTiming(
      1,
      { duration: OPEN_MS, easing: OPEN_EASE, reduceMotion: ReduceMotion.System },
      (finished) => { if (finished) runOnJS(hapticSoft)(); }, // Soft на посадке карты
    );
    return () => setStatusBarHidden(false, 'fade');
  }, [open, prog, closing]);

  const close = React.useCallback(() => {
    closing.value = withTiming(
      1,
      { duration: CLOSE_MS, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System },
      (finished) => { if (finished) runOnJS(onClose)(); },
    );
  }, [closing, onClose]);

  // зум и пан — состояние жестов (спека 14, задача 5)
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

  // полёт: открытие тянет prog 0→1, закрытие поверх тянет closing 0→1 обратно к from
  const cardStyle = useAnimatedStyle(() => {
    const k = (1 - prog.value) + closing.value; // 0 — центр, 1 — исходная позиция
    // оборот: открытие 360°→0 (полный, через рубашку), закрытие 0→180° (полуоборот)
    let spin = prog.value < 1 && closing.value === 0
      ? interpolate(prog.value, [0, 1], [360, 0])
      : interpolate(closing.value, [0, 1], [0, 180]);
    if (reduceMotion) spin = 0; // reduce motion: без оборота, только перелёт/масштаб
    return {
      transform: [
        { translateX: from.dx * k },
        { translateY: from.dy * k },
        { translateX: panX.value },
        { translateY: panY.value },
        { perspective: 1200 },
        { rotateY: `${spin}deg` },
        { scale: (1 + (from.scale - 1) * k) * zoom.value },
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
      {/* pinch+pan одновременно (Simultaneous), одиночный тап закрывает и ждёт провала
          двойного (Exclusive), оба режима гонятся Race — вся сцена под одним детектором */}
      <GestureDetector gesture={gestures}>
        <View style={st.stage}>
          <Animated.View style={[st.card, cardStyle]}>
            <Animated.View style={[st.face, frontStyle, { borderColor: t.frame, boxShadow: CARD_SHADOW }]}>
              <Image source={cardImages[cardId]} style={st.im} contentFit="cover" cachePolicy="memory-disk" />
            </Animated.View>
            <Animated.View style={[st.face, backStyle, { borderColor: t.frame }]}>
              <CardBack />
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>
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
