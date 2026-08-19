/** Двусторонняя карта с 3D-переворотом — общий механизм карт расклада (SpreadCard, спека 36) и
 *  флеш-карты тренажёра (ReviewFlashcard, спека 45): две грани, rotateY 0→180 / 180→360,
 *  backfaceVisibility hidden, FLIP_MS 500 (product-spec §4 п.2). Содержимое граней приходит снаружи
 *  (back / front): карта сама рисует только рамку frame, скругление и тень. Тень — на внешней обёртке:
 *  overflow hidden граней срезал бы её (схема CtaButton). animateFlip=false — карта сразу лежит нужной
 *  гранью, без кадра с трансформацией.
 *
 *  ⚠️ Урок лайв-проверки 36/42 (комментарий сохранён при выносе из SpreadCard): `rotateY: 360deg` —
 *  НЕ то же самое для компоновщика iOS, что отсутствие поворота. Слой с 3D-трансформом
 *  (perspective/rotateY/backfaceVisibility) навсегда остаётся в 3D-контексте и рисуется через
 *  offscreen-текстуру — растрируется мимо натива экрана, карта выглядит замыленной.
 *  Перестать ПЕРЕДАВАТЬ стиль не помогает: reanimated накладывает свойства на нативное представление
 *  ИМПЕРАТИВНО, со стороны UI-потока, и ранее наложенные transform/backfaceVisibility остаются на слое
 *  сиротами. Лечение — стиль отдаётся ВСЕГДА, и как только переворот ДОЕХАЛ (settledSV — shared value,
 *  выставляется в колбэке withTiming прямо на UI-потоке), воркл frontStyle явно возвращает пустой
 *  transform и backfaceVisibility 'visible' — те же свойства перезаписываются тем же каналом. Скачка
 *  нет: на flip 1 rotateY уже 360°, визуально это identity. Параллельно JS-состояние settled (из того же
 *  колбэка через runOnJS) убирает рубашку из дерева — лишний слой на карту. При возврате open в false
 *  оба флага сбрасываются — иначе повторное использование по key покажет лицо без переворота. */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';

export const FLIP_MS = 500; // product-spec §4 п.2

export function FlipCard({
  open,
  width,
  height,
  radius,
  shadow,
  animateFlip = true,
  onPress,
  back,
  front,
}: {
  open: boolean;
  width: number;
  height: number;
  /** скругление граней и обёртки: карта расклада 10, флеш-карта radius.card */
  radius: number;
  /** тень обёртки — строка boxShadow; зависит от темы, поэтому приходит снаружи */
  shadow: string;
  animateFlip?: boolean;
  onPress: () => void;
  back: React.ReactNode;
  front: React.ReactNode;
}) {
  const t = useTheme();
  const flip = useSharedValue(open ? 1 : 0);
  // доехал ли переворот — держим ОБА представления: settledSV читает воркл frontStyle на UI-потоке
  // и там же перезаписывает 3D-пропы дефолтом; settled (React-состояние) убирает рубашку из дерева
  const settledSV = useSharedValue(open && !animateFlip);
  const [settled, setSettled] = React.useState(open && !animateFlip);

  React.useEffect(() => {
    if (!open) {
      flip.value = 0;
      settledSV.value = false;
      setSettled(false);
      return;
    }
    if (!animateFlip) {
      flip.value = 1;
      settledSV.value = true;
      setSettled(true);
      return;
    }
    settledSV.value = false;
    setSettled(false);
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        settledSV.value = true; // UI-поток: воркл ниже тут же перекрывает 3D-пропы дефолтом
        runOnJS(setSettled)(true); // JS-поток: прячет рубашку
      }
    });
  }, [open, animateFlip, flip, settledSV]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));
  // Стиль отдаётся ВСЕГДА (и до, и после settled) — единственный способ гарантированно перезаписать
  // 3D-пропы, а не просто перестать их слать (см. комментарий к файлу)
  const frontStyle = useAnimatedStyle(() => {
    if (settledSV.value) {
      return { transform: [], backfaceVisibility: 'visible' as const };
    }
    return {
      transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  return (
    <PressableScale onPress={onPress} style={{ width, height, borderRadius: radius, boxShadow: shadow }}>
      {!settled && (
        <Animated.View style={[st.face, { borderRadius: radius, borderColor: t.frame }, backStyle]}>
          {back}
        </Animated.View>
      )}
      <Animated.View style={[st.face, { borderRadius: radius, borderColor: t.frame }, frontStyle]}>
        {front}
      </Animated.View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
