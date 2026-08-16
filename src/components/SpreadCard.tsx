/** Карта расклада на доске (`.s3card` эталона, design-system §5): 88×150 (или уменьшенная), radius 10,
 *  бордер frame, тень glow. Рубашка — поверхность CardBackSurface + звезда ✶; лицо — изображение
 *  (перевёрнутая — вверх ногами). Открытие — 3D-переворот 500 мс тем же приёмом, что у карты дня
 *  (две грани, rotateY 0→180 / 180→360, backfaceVisibility hidden). В просмотре сохранённого
 *  (animateFlip=false) карта сразу лежит лицом. Тень — на внешней обёртке: overflow hidden граней
 *  срезал бы её (схема CtaButton).
 *
 *  ⚠️ Дефект с лайв-проверки: `rotateY: 360deg` — НЕ то же самое для компоновщика iOS, что
 *  отсутствие поворота. Слой с 3D-трансформом (perspective/rotateY/backfaceVisibility) навсегда
 *  остаётся в 3D-контексте и рисуется через offscreen-текстуру — растрируется мимо натива экрана,
 *  карта выглядит замыленной; открытие следующей карты освобождает текстуру этой, и мыло
 *  «перескакивает». Лечение: как только переворот ДОЕХАЛ (флаг `settled` — из колбэка `withTiming`
 *  через `runOnJS`, не таймером, чтобы не разъехаться с анимацией), лицо рисуется обычным `View` без
 *  единого 3D-пропа, а рубашка не рендерится вовсе (она больше не нужна и это лишний SVG на карту).
 *  В просмотре сохранённого (animateFlip=false) карта обязана быть «доехавшей» сразу — без кадра
 *  с трансформацией. При возврате `open` в false флаг сбрасывается — иначе повторное тасование
 *  (карта переиспользуется по `key`, см. SpreadScreen.onAgain) покажет лицо без переворота. */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cardImages } from '../lib/cardImages';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';
import { PressableScale } from './PressableScale';

const FLIP_MS = 500; // product-spec §4 п.2

export function SpreadCard({
  cardId,
  reversed,
  open,
  width,
  height,
  animateFlip = true,
  onPress,
}: {
  cardId: string;
  reversed: boolean;
  open: boolean;
  width: number;
  height: number;
  animateFlip?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const flip = useSharedValue(open ? 1 : 0);
  // переворот доехал — лицо переходит на обычный слой без 3D (см. комментарий к файлу)
  const [settled, setSettled] = React.useState(open && !animateFlip);

  React.useEffect(() => {
    if (!open) {
      flip.value = 0;
      setSettled(false);
      return;
    }
    if (!animateFlip) {
      flip.value = 1;
      setSettled(true);
      return;
    }
    setSettled(false);
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setSettled)(true);
    });
  }, [open, animateFlip, flip]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));

  return (
    <PressableScale onPress={onPress} style={[st.wrap, { width, height, boxShadow: `0px 10px 26px ${t.glow}` }]}>
      {!settled && (
        <Animated.View style={[st.face, { borderColor: t.frame }, backStyle]}>
          <CardBackSurface />
          {/* ✶ отсутствует в Manrope — обычный Text без fontFamily (правило Txt.tsx) */}
          <Text style={[st.star, { color: t.accent }]}>✶</Text>
        </Animated.View>
      )}
      <Animated.View style={[st.face, { borderColor: t.frame }, !settled && frontStyle]}>
        <Image
          source={cardImages[cardId]}
          style={[st.img, reversed && st.reversed]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  wrap: { borderRadius: 10 },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 20 },
  img: { width: '100%', height: '100%' },
  reversed: { transform: [{ rotate: '180deg' }] },
});
