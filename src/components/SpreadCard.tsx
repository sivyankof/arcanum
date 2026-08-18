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
 *  карта выглядит замыленной.
 *  Первая попытка чинить это (просто перестать передавать `frontStyle` в массив стилей, когда
 *  переворот доехал) не сработала: reanimated применяет свойства к нативному представлению
 *  ИМПЕРАТИВНО, со стороны UI-потока — это не то же самое, что обычный React-проп. Убрать стиль
 *  из массива значит просто перестать его ПЕРЕДАВАТЬ; ранее наложенные `transform`/
 *  `backfaceVisibility` от этого никуда не деваются — они остаются осиротевшими на слое, и слой
 *  продолжает жить в 3D-контексте. Мыло «перескакивало» только при следующем рендере (открытие
 *  соседней карты, возврат на экран), потому что тогда представление пересобиралось заново.
 *  Лечение — не переставать слать стиль, а ЯВНО ПЕРЕЗАПИСАТЬ его дефолтами: как только переворот
 *  ДОЕХАЛ (`settledSV` — shared value, выставляется прямо в колбэке `withTiming` на UI-потоке,
 *  без раунд-трипа через JS), воркл `frontStyle` возвращает пустой `transform` и
 *  `backfaceVisibility: 'visible'` — те же самые свойства, что раньше держали слой в 3D, теперь
 *  явно снимаются через тот же канал, которым были наложены. Скачка при этом не будет: на
 *  `flip.value === 1` `rotateY` уже стоит на 360°, что для компоновщика визуально совпадает
 *  с identity-поворотом (sin 360° = sin 0°), — перезапись убирает только остаточный 3D-слой,
 *  а не видимое положение карты. Параллельно (JS-состояние `settled`, из того же колбэка через
 *  `runOnJS`) рубашка перестаёт рендериться вовсе — она больше не нужна и это лишний SVG на карту.
 *  В просмотре сохранённого (animateFlip=false) карта обязана быть «доехавшей» сразу — без кадра
 *  с трансформацией: оба флага стартуют уже в состоянии settled. При возврате `open` в false оба
 *  флага сбрасываются — иначе повторное тасование (карта переиспользуется по `key`, см.
 *  SpreadScreen.onAgain) покажет лицо без переворота. */
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
  // доехал ли переворот — держим ОБА представления. settledSV (shared value) читает воркл
  // frontStyle прямо на UI-потоке и там же перезаписывает 3D-пропы дефолтом; settled (React-
  // состояние) убирает рубашку из дерева на JS-потоке (см. комментарий к файлу)
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
  // Стиль отдаётся ВСЕГДА (и до, и после settled) — это единственный способ гарантированно
  // перезаписать 3D-пропы, а не просто перестать их слать (см. комментарий к файлу). После
  // settled воркл явно возвращает дефолты вместо того, чтобы пропасть из массива стилей.
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
    <PressableScale onPress={onPress} style={[st.wrap, { width, height, boxShadow: `0px 10px 26px ${t.glow}` }]}>
      {!settled && (
        <Animated.View style={[st.face, { borderColor: t.frame }, backStyle]}>
          <CardBackSurface />
          {/* ✶ отсутствует в Manrope — обычный Text без fontFamily (правило Txt.tsx) */}
          <Text style={[st.star, { color: t.accent }]}>✶</Text>
        </Animated.View>
      )}
      <Animated.View style={[st.face, { borderColor: t.frame }, frontStyle]}>
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
