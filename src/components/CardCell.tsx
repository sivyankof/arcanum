/** Ячейка сетки карт (`.gc` эталона, design-system §5): миниатюра с рамкой и тенью, скелетон до
 *  загрузки, подпись-название 9.5/600. Вынесена из справочника задачей 46; режим `dimmed`
 *  (спека 46б) — неизученная карта: картинка приглушена до opacity .55, рамка/тень/подпись как
 *  у всех, бейджа нет; тап открывает страницу, как у любой карты — ничего не запирается.
 *  Позицию картинки меряем на нажатии — с неё начнётся перелёт на страницу карты (пункт 6
 *  motion-spec). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { setCardOrigin } from '../lib/cardTransition';
import type { TarotCard } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CornerBadge } from './CornerBadge';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';
import { Txt } from './Txt';

const { width: W } = Dimensions.get('window');
/** Сетка карт: 3 колонки, зазор 11 в обе стороны (`.grid` эталона), поля экрана 24 — общие для
 *  справочника и альбома, иначе ячейки двух экранов разъехались бы по ширине. */
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
}: {
  card: TarotCard;
  lang: Lang;
  /** текст углового бейджа («ИЗУЧЕНО ✓»); не задан — бейджа нет */
  badge?: string;
  /** неизученная карта — картинка приглушена */
  dimmed?: boolean;
}) {
  const t = useTheme();
  const imRef = React.useRef<View>(null);
  const [loaded, setLoaded] = React.useState(false);

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
        <Image
          source={cardImages[card.id]}
          style={[st.im, dimmed && st.dim]}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          onLoad={() => setLoaded(true)}
        />
        {!loaded && <Skeleton style={StyleSheet.absoluteFill} />}
        {!!badge && <CornerBadge label={badge} />}
      </View>
      <Txt numberOfLines={2} style={[st.name, { color: t.muted }]}>
        {inLang(card.name, lang)}
      </Txt>
    </PressableScale>
  );
}

/** Ряд сетки карт: до GRID_COLS ячеек с зазором GRID_GAP и добивкой пустыми местами, чтобы карты
 *  неполного ряда не растягивались на всю ширину. Второе место после справочника — альбом коллекции. */
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
  // бейдж «ИЗУЧЕНО ✓» — общий CornerBadge (эталон `.st2`, design-system §5)
  name: { fontSize: 9.5, textAlign: 'center', marginTop: 5, fontWeight: '600', letterSpacing: 0.3, lineHeight: 12 },
});
