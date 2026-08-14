/** Полноэкранный просмотр карты — «взять карту в руки» (спека 14, motion-spec §15).
 *  Оверлей на Modal: накрывает нативную шапку и таб-бар; координаты measureInWindow
 *  совпадают с системой координат модалки. Тёмная «комната просмотра» одинакова
 *  в обеих темах — константы макета .lightbox, не токены. */
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarHidden } from 'expo-status-bar';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withTiming,
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
import { useDeviceTilt } from '../lib/useDeviceTilt';
import { GLARE_ANGLE, GLARE_COLORS, GLARE_LOCATIONS } from '../theme/glow';
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
// закрытие делят panY и closing — оба ехали с одинаковым конфигом, дублировавшимся дважды (задача 6)
const CLOSE_ANIM = { duration: CLOSE_MS, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System };

// блик по лицу карты после посадки — один проход (motion-spec §15, приём .glare из «Сегодня»;
// геометрия GLARE_ANGLE/COLORS/LOCATIONS — общая с домашним экраном, theme/glow.ts)
const GLARE_DELAY = OPEN_MS + 120;
const GLARE_MS = 900;

// параллакс/качание после посадки (motion-spec §15): на устройстве — наклон через useDeviceTilt,
// на вебе/без сенсора — цикл sway 0..1..0 (.lbidle макета)
const SWAY_DELAY = 800;
const SWAY_MS = 2500;

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

  // наклон устройства (null на вебе/без сенсора — тогда включаем sway ниже); hasTilt как
  // отдельный булев — сам объект пересоздаётся на каждый рендер, а эффекту нужна стабильная зависимость
  const tilt = useDeviceTilt(open && !reduceMotion);
  const hasTilt = tilt !== null;
  // качание карты без сенсора (веб) — общий shared value 0..1, крутится только пока tilt === null
  const sway = useSharedValue(0);
  // однократный блик по лицу карты вскоре после посадки
  const glare = useSharedValue(0);

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

  // качание камеры без сенсора: пока идёт наклон устройства (hasTilt) или включён reduce motion —
  // не запускаем вовсе, эффекты параллакса/качания в этом случае не должны идти вовсе
  React.useEffect(() => {
    sway.value = 0;
    if (!open || reduceMotion || hasTilt) return;
    sway.value = withDelay(
      SWAY_DELAY,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: SWAY_MS, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [open, reduceMotion, hasTilt, sway]);

  // блик по лицу карты — один проход, начинается сразу после посадки; при reduce motion
  // не запускаем вовсе (спека 14, «Reduce motion»: без глейра, без параллакса/качания)
  React.useEffect(() => {
    glare.value = 0;
    if (!open || reduceMotion) return;
    glare.value = withDelay(GLARE_DELAY, withTiming(1, { duration: GLARE_MS }));
  }, [open, reduceMotion, glare]);

  // зум и пан — состояние жестов (спека 14, задача 5)
  const zoom = useSharedValue(1);
  const savedZoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPan = useSharedValue({ x: 0, y: 0 });

  const close = React.useCallback(() => {
    // полёт стартует с текущего сдвига пальца (Task 6): panY едет в 0 тем же
    // таймингом, что и closing, — сложение с translateY(from.dy*k) даёт один плавный полёт,
    // а не рывок «сначала прыжок в центр, потом полёт».
    panY.value = withTiming(0, CLOSE_ANIM);
    closing.value = withTiming(1, CLOSE_ANIM, (finished) => { if (finished) runOnJS(onClose)(); });
  }, [closing, panY, onClose]);

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
    // лёгкий наклон вслед за пальцем при свайпе-вниз (Task 6) — только при ×1 и вне полёта
    // закрытия: при зуме panY — это панорамирование, а не свайп, наклон там неуместен.
    const rotZ = savedZoom.value === 1 && closing.value === 0
      ? interpolate(panY.value, [0, 300], [0, 2])
      : 0;
    // параллакс/качание — только когда карта уже сидит в центре и не улетает обратно;
    // при reduce motion не запускаем вовсе (ни наклон устройства, ни sway)
    let tiltX = 0;
    let tiltY = 0;
    if (prog.value === 1 && closing.value === 0 && !reduceMotion) {
      if (tilt) {
        tiltX = -tilt.x.value;
        tiltY = tilt.y.value;
      } else {
        tiltX = interpolate(sway.value, [0, 1], [1.5, -1.5]);
        tiltY = interpolate(sway.value, [0, 1], [-2.5, 2.5]);
      }
    }
    return {
      transform: [
        { translateX: from.dx * k },
        { translateY: from.dy * k },
        { translateX: panX.value },
        { translateY: panY.value },
        { perspective: 1200 },
        { rotateX: `${tiltX}deg` },
        { rotateY: `${spin + tiltY}deg` },
        { scale: (1 + (from.scale - 1) * k) * zoom.value },
        { rotateZ: `${rotZ}deg` },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => ({ backfaceVisibility: 'hidden' as const }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: '180deg' }],
    backfaceVisibility: 'hidden' as const,
  }));
  const scrimStyle = useAnimatedStyle(() => {
    // скрим бледнеет вместе со свайпом — обратная связь «отпустишь — закроется»
    const fade = interpolate(panY.value, [0, 300], [1, 0.5], Extrapolation.CLAMP);
    return { opacity: Math.min(prog.value, 1 - closing.value) * fade };
  });
  const glareStyle = useAnimatedStyle(() => {
    // противофаза наклону: блик идёт слегка навстречу качанию/наклону устройства
    const driftX = tilt ? -tilt.y.value * 4 : 0;
    return {
      transform: [
        { translateX: interpolate(glare.value, [0, 1], [-CARD_W * 1.4, CARD_W * 1.4]) + driftX },
      ],
    };
  });

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
              {/* блик: один проход по лицу карты вскоре после посадки (motion-spec §15) */}
              <Animated.View style={[StyleSheet.absoluteFill, st.glareLayer, glareStyle]}>
                <LinearGradient
                  colors={GLARE_COLORS}
                  locations={GLARE_LOCATIONS}
                  start={GLARE_ANGLE.start}
                  end={GLARE_ANGLE.end}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
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
  // pointerEvents 'none' — только веб-причина (фикс-раунд 1): у <img> в браузере включён
  // нативный drag-and-drop, и mousedown на картинке запускает перетаскивание её «призрака»
  // раньше, чем RNGH успевает распознать pan. Жест всё равно ловится: GestureDetector висит
  // на родительской сцене st.stage, а не на самой карте, поэтому клик «проваливается» сквозь
  // непрозрачную для указателя карту прямо на сцену — тапы и pan продолжают работать.
  // На устройстве (touch) этого механизма нет, это не дефект жестов, а веб-плоскости.
  card: { width: CARD_W, height: CARD_H, pointerEvents: 'none' as const },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.l, borderWidth: 1, overflow: 'hidden',
  },
  im: { width: '100%', height: '100%' },
  glareLayer: { pointerEvents: 'none' as const },
  x: {
    position: 'absolute', right: 18, width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  hint: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 10, letterSpacing: 2.5 },
});
