/** Эмблема-«компас» — рисунок из `.emb`/`.emb2` эталона. Отдельно от CardBack, потому что
 *  нужна в двух местах (рубашка карты дня и шаг 1 онбординга) — пути SVG не дублируем.
 *  Свечение НЕ здесь: у рубашки и онбординга разные радиусы, обёртку с glowShadow
 *  ставит вызывающий. */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

export function Emblem({ size = 96, ticks = true }: { size?: number; ticks?: boolean }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={t.accent} strokeWidth={0.9}>
      <Circle cx={50} cy={50} r={33} />
      <Circle cx={50} cy={50} r={41} strokeDasharray="2 5" />
      <Path d="M50 23 L57 43 L77 50 L57 57 L50 77 L43 57 L23 50 L43 43 Z" />
      <Circle cx={50} cy={50} r={7} />
      {/* засечки по сторонам света есть у рубашки (`.emb`), но НЕ у эмблемы онбординга
          (`.emb2`) — в эталоне это два разных рисунка. Разводим пропом, а не копией путей */}
      {ticks && <Path d="M50 9v6M50 85v6M9 50h6M85 50h6" />}
    </Svg>
  );
}
