/** Ячейка сетки карт (`.gc` эталона, design-system §5): миниатюра с рамкой и тенью, скелетон до
 *  загрузки, подпись-название 9.5/600. Вынесена из справочника задачей 46; режим `dimmed`
 *  (спека 46б) — неизученная карта: картинка приглушена до opacity .55, рамка/тень/подпись как
 *  у всех, бейджа нет; тап открывает страницу, как у любой карты — ничего не запирается.
 *  Позицию картинки меряем на нажатии — с неё начнётся перелёт на страницу карты (пункт 6
 *  motion-spec). Проп `reveal` (спека 46в) — «момент переворота»: только что изученная карта
 *  раскрывается волной из приглушённой, вместо того чтобы просто оказаться яркой молча. */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cardImages } from '../lib/cardImages';
import { setCardOrigin } from '../lib/cardTransition';
import type { TarotCard } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import type { MasteryLevel } from '../lib/mastery';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CornerBadge } from './CornerBadge';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';
import { Txt } from './Txt';

/** Параметры волны раскрытия (спека 46в, макет `.gc.revealing .im` / `@keyframes cardReveal`).
 *  Экспортированы — экран справочника считает по ним время жизни своего state волны. */
export const REVEAL_MS = 520;
export const REVEAL_STAGGER = 70;

// Кривая CSS применяется К КАЖДОМУ отрезку @keyframes отдельно (0→60% и 60%→100%), поэтому
// анимация ниже — не один withTiming, а withSequence из двух отрезков с той же кривой на каждом.
const REVEAL_EASE = Easing.bezier(0.2, 0.9, 0.3, 1.05);

const { width: W } = Dimensions.get('window');
/** Сетка карт: 3 колонки, зазор 11 в обе стороны (`.grid` эталона), поля экрана 24 (`spacing.xl`). */
export const GRID_COLS = 3;
export const GRID_GAP = 11;
export const CELL_W = (W - spacing.xl * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

/** Приглушение картинки неизученной карты (спека 46б, вариант «а»). */
export const DIM_OPACITY = 0.55;

export function CardCell({
  card,
  lang,
  badge,
  dimmed,
  mastery,
  reveal,
}: {
  card: TarotCard;
  lang: Lang;
  /** текст углового бейджа («ИЗУЧЕНО ✓»); не задан — бейджа нет */
  badge?: string;
  /** неизученная карта — картинка приглушена */
  dimmed?: boolean;
  /** ступень мастерства изученной карты — 4 полоски под миниатюрой; не задана — полосок нет */
  mastery?: MasteryLevel;
  /** ступенька стаггера «момента переворота» (спека 46в): 0..7, задержка = reveal × REVEAL_STAGGER.
   *  Не задан — картинка в нейтральном состоянии, анимации нет вовсе. */
  reveal?: number;
}) {
  const t = useTheme();
  const imRef = React.useRef<View>(null);
  const [loaded, setLoaded] = React.useState(false);

  // прогресс волны раскрытия: 1 — нейтраль (обычная ячейка), 0 → 1 — раскрытие. Обёртка вокруг
  // Image держится ВСЕГДА (см. ниже), а не только при reveal != null — условная обёртка
  // перемонтировала бы Image, и скелетон мигнул бы заново
  const prog = useSharedValue(1);
  React.useEffect(() => {
    if (reveal == null) {
      prog.value = 1;
      return;
    }
    prog.value = 0;
    prog.value = withDelay(
      reveal * REVEAL_STAGGER,
      withSequence(
        withTiming(0.6, { duration: REVEAL_MS * 0.6, easing: REVEAL_EASE, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: REVEAL_MS * 0.4, easing: REVEAL_EASE, reduceMotion: ReduceMotion.System }),
      ),
    );
  }, [reveal, prog]);

  // 2D-безопасно (уроки задач 36/42): трансформация только scale, конечные значения нейтральны
  // (opacity 1, scale 1), стиль с обёртки не снимается никогда — «осиротевших» 3D-пропов тут нет.
  // Выброс кривой (scale до 1.02 на 60%) без клампа — задуманный пружинный перелёт, как в CSS.
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(prog.value, [0, 0.6, 1], [DIM_OPACITY, 1, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(prog.value, [0, 0.6, 1], [0.965, 1.02, 1]) }],
  }));

  return (
    <PressableScale
      onPressIn={() =>
        imRef.current?.measureInWindow((x, y, w, h) => {
          if (w) setCardOrigin(card.id, { x, y, w, h });
        })
      }
      onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id, from: 'cards' } })}
      style={st.cell}
    >
      <View ref={imRef} style={[st.imWrap, { borderColor: t.line }]}>
        <Animated.View style={[st.im, revealStyle]}>
          <Image
            source={cardImages[card.id]}
            style={[st.im, dimmed && st.dim]}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            onLoad={() => setLoaded(true)}
          />
        </Animated.View>
        {!loaded && <Skeleton style={StyleSheet.absoluteFill} />}
        {!!badge && <CornerBadge label={badge} />}
      </View>
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
      <Txt numberOfLines={2} style={[st.name, { color: t.muted }]}>
        {inLang(card.name, lang)}
      </Txt>
    </PressableScale>
  );
}

/** Ряд сетки карт: до GRID_COLS ячеек с зазором GRID_GAP и добивкой пустыми местами, чтобы карты
 *  неполного ряда не растягивались на всю ширину. Потребитель сегодня один — справочник; вынесен
 *  волной правок 46 и оставлен рядом с ячейкой, потому что геометрия сетки (CELL_W/GRID_GAP/добивка)
 *  живёт в одном файле. */
export function CardGridRow({ count, style, children }: {
  /** сколько настоящих ячеек в ряду (остальное — добивка) */
  count: number;
  /** внешние стили ряда (у справочника — горизонтальные поля экрана) */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View style={[st.row, style]}>
      {children}
      {count < GRID_COLS &&
        Array.from({ length: GRID_COLS - count }, (_, i) => (
          <View key={`gap-${i}`} style={{ width: CELL_W }} />
        ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: GRID_GAP },
  cell: { width: CELL_W },
  imWrap: {
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    aspectRatio: 0.58,
    // .gc .im: тень по прямоугольнику миниатюры (design-system §4)
    boxShadow: '0px 8px 20px rgba(0,0,0,0.28)',
  },
  im: { width: '100%', height: '100%' },
  dim: { opacity: DIM_OPACITY },
  // .gc .mbar эталона: 4 полоски 8×2, зазор 2, по центру, отступ от миниатюры 4
  mbar: { flexDirection: 'row', gap: 2, justifyContent: 'center', marginTop: 4 },
  bar: { width: 8, height: 2, borderRadius: 1 },
  // бейдж «ИЗУЧЕНО ✓» — общий CornerBadge (эталон `.st2`, design-system §5)
  name: { fontSize: 9.5, textAlign: 'center', marginTop: 5, fontWeight: '600', letterSpacing: 0.3, lineHeight: 12 },
});
