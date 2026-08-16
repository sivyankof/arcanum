/** Доска расклада ≤5 карт (`.s3row` эталона + геометрия spreadLayout, спека 36): позиции —
 *  абсолютно по boardLayout, под каждой картой подпись позиции (до 2 строк) и, после открытия,
 *  имя карты. Карты входят каскадом FadeUp (≤5 элементов, motion-spec §4). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Spread } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { drawnCardLabel, type SpreadDraw } from '../lib/spread';
import { boardLayout } from '../lib/spreadLayout';
import { spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { FadeUp } from './FadeUp';
import { SpreadCard } from './SpreadCard';
import { Txt } from './Txt';

export function SpreadBoard({
  spread,
  draw,
  opened,
  lang,
  onOpen,
  onPressCard,
  animateFlip,
}: {
  spread: Spread;
  draw: SpreadDraw;
  opened: boolean[];
  lang: Lang;
  onOpen: (index: number) => void;
  onPressCard: (cardId: string) => void;
  animateFlip: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { width } = useWindowDimensions();
  const lay = React.useMemo(() => boardLayout(spread.id, width - 2 * spacing.xl), [spread.id, width]);

  return (
    <View style={[st.board, { width: lay.width, height: lay.height }]}>
      {lay.cells.map((cell, i) => {
        const c = draw.cards[i];
        // защита от рассинхрона (правка 2, ревью): у сохранённого расклада может быть меньше карт,
        // чем ячеек в ТЕКУЩЕЙ раскладке, если у расклада однажды поменяют число карт — пропускаем
        // ячейку, а не роняем экран (удаления записей дневника нет, вернуться было бы неоткуда)
        if (!c) return null;
        return (
          // подпись обязана быть шириной с карту: собственная обёртка нужной ширины
          // с alignItems center (правило обёрток design-system §5)
          <FadeUp key={i} index={i + 1} style={[st.col, { left: cell.left, top: cell.top, width: lay.cardW }]}>
            <SpreadCard
              cardId={c.cardId}
              reversed={c.reversed}
              open={opened[i]}
              width={lay.cardW}
              height={lay.cardH}
              animateFlip={animateFlip}
              onPress={() => (opened[i] ? onPressCard(c.cardId) : onOpen(i))}
            />
            <Txt numberOfLines={2} style={[st.label, { color: t.muted }]}>
              {inLang(spread.positions[i], lang).toUpperCase()}
            </Txt>
            {opened[i] && (
              <Txt numberOfLines={1} style={[st.name, { color: t.head }]}>
                {drawnCardLabel(c.cardId, c.reversed, lang, tr)}
              </Txt>
            )}
          </FadeUp>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  board: { alignSelf: 'center', marginTop: 22 }, // `.s3row` margin-top 22, по центру
  col: { position: 'absolute', alignItems: 'center' },
  label: { fontSize: 8.5, letterSpacing: 1.5, textAlign: 'center', marginTop: 7 }, // `.s3col small`
  name: { fontSize: 8.5, letterSpacing: 1.5, textAlign: 'center', marginTop: 1 }, // `.s3col small b`
});
