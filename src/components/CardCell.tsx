/** Ячейка сетки карт (`.gc` эталона, design-system §5): миниатюра с рамкой и тенью, скелетон до
 *  загрузки, подпись-название 9.5/600. Жила локально в справочнике; второе место — альбом коллекции
 *  (спека 46), где добавился режим «закрыто»: рубашка-плейсхолдер `StarBack` при opacity .42 и
 *  подпись «· · ·» вместо названия — карта скрыта до изучения, нажимать нечего, поэтому БЕЗ
 *  PressableScale (пружина обещала бы переход, прецедент ReviewPanel).
 *  Позицию картинки меряем на нажатии — с неё начнётся перелёт на страницу карты (пункт 6
 *  motion-spec); `from` уходит параметром маршрута, по нему страница подписывает кнопку «назад». */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { setCardOrigin } from '../lib/cardTransition';
import type { TarotCard } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CornerBadge } from './CornerBadge';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

const { width: W } = Dimensions.get('window');
/** Сетка карт: 3 колонки, зазор 11 в обе стороны (`.grid` эталона), поля экрана 24 — общие для
 *  справочника и альбома, иначе ячейки двух экранов разъехались бы по ширине. */
export const GRID_COLS = 3;
export const GRID_GAP = 11;
export const CELL_W = (W - spacing.xl * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

/** Подпись закрытой ячейки — типографический знак, а не текст интерфейса (в i18n не нужен). */
const CLOSED_LABEL = '· · ·';

export function CardCell({
  card,
  lang,
  from,
  badge,
  closed,
}: {
  card: TarotCard;
  lang: Lang;
  /** откуда открыта страница карты — подпись кнопки «назад» (BACK_TITLES в app/card/[id].tsx) */
  from: 'cards' | 'collection';
  /** текст углового бейджа («ИЗУЧЕНО ✓» в справочнике); не задан — бейджа нет */
  badge?: string;
  /** закрытая карта альбома: рубашка вместо картинки, «· · ·» вместо названия, не нажимается */
  closed?: boolean;
}) {
  const t = useTheme();
  const imRef = React.useRef<View>(null);
  const [loaded, setLoaded] = React.useState(false);

  if (closed) {
    return (
      <View style={st.cell}>
        {/* рамка и тень остаются в полной силе — гаснет только плейсхолдер внутри (`.gc.closed .ph`:
            opacity .42; grayscale(.4) эталона не воспроизводим — решение спеки 46) */}
        <View style={[st.imWrap, { borderColor: t.line }]}>
          <View style={[StyleSheet.absoluteFill, st.closedIm]}>
            <StarBack starSize={17} />
          </View>
        </View>
        {/* `.gc.closed small`: opacity .5 */}
        <Txt style={[st.name, st.closedName, { color: t.muted }]}>{CLOSED_LABEL}</Txt>
      </View>
    );
  }

  return (
    <PressableScale
      onPressIn={() =>
        imRef.current?.measureInWindow((x, y, w, h) => {
          if (w) setCardOrigin(card.id, { x, y, w, h });
        })
      }
      onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id, from } })}
      style={st.cell}
    >
      <View ref={imRef} style={[st.imWrap, { borderColor: t.line }]}>
        <Image
          source={cardImages[card.id]}
          style={st.im}
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

const st = StyleSheet.create({
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
  closedIm: { opacity: 0.42 },
  // бейдж «ИЗУЧЕНО ✓» — общий CornerBadge (эталон `.st2`, design-system §5)
  name: { fontSize: 9.5, textAlign: 'center', marginTop: 5, fontWeight: '600', letterSpacing: 0.3, lineHeight: 12 },
  closedName: { opacity: 0.5 },
});
