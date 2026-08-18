/** Иконки нижнего меню — контуры взяты из блока .nav эталона (viewBox 24, обводка 1.5,
 *  скруглённые концы, без заливки). Иконка «Профиль» в макете не нарисована: он там
 *  четырёхвкладочный, поэтому дорисована в том же стиле — круг головы и дуга плеч. */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'today' | 'course' | 'cards' | 'spreads' | 'profile';

const SIZE = 22;

function Frame({ color, size, children }: { color: string; size: number; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function TabIcon({ name, color, size = SIZE }: { name: TabIconName; color: string; size?: number }) {
  switch (name) {
    case 'today': // солнце с лучами
      return (
        <Frame color={color} size={size}>
          <Circle cx={12} cy={12} r={4.2} />
          <Path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
        </Frame>
      );
    case 'course': // конверт-«шапка» над стопкой
      return (
        <Frame color={color} size={size}>
          <Path d="M12 4 2.8 8.4 12 12.8l9.2-4.4L12 4z" />
          <Path d="M6 10.6v5.2c0 1.4 2.7 2.9 6 2.9s6-1.5 6-2.9v-5.2" />
        </Frame>
      );
    case 'cards': // две наклонённые карты
      // наклон задаём строкой transform, а не парой rotation/origin: те уходят в DOM
      // дефисным атрибутом transform-origin, и React ругается на невалидное свойство
      return (
        <Frame color={color} size={size}>
          <Rect x={3.4} y={4.6} width={10.4} height={15.6} rx={1.8} transform="rotate(-8 8.6 12.4)" />
          <Rect x={10.4} y={4.2} width={10.4} height={15.6} rx={1.8} transform="rotate(7 15.6 12)" />
        </Frame>
      );
    case 'spreads': // полумесяц
      return (
        <Frame color={color} size={size}>
          <Path d="M20 14.2A8.3 8.3 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2z" />
        </Frame>
      );
    case 'profile':
      return (
        <Frame color={color} size={size}>
          <Circle cx={12} cy={8.4} r={3.6} />
          <Path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        </Frame>
      );
  }
}
