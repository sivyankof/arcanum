/** Мягкое золотое свечение позади элемента (виньетка из раздела «Изображения» motion-spec).
 *  Радиального градиента в RN нет, а react-native-svg в проект не ставим ради одной детали,
 *  поэтому собираем из нескольких вложенных скруглённых слоёв: на тёмном фоне ступенек не видно.
 *  Родителю нужен position: relative и overflow: visible. */
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';

/** Слоёв должно быть много, а каждый — почти прозрачным: тогда внешний край не читается
 *  как окружность, а к центру набегает нужная плотность (по спеке ~0.25). */
const LAYER_COUNT = 12;
const LAYER_OPACITY = 0.06;

export function Glow({ size }: { size: number }) {
  const t = useTheme();
  // доли размера от внешнего слоя к внутреннему: 1 → 0.08
  const layers = Array.from({ length: LAYER_COUNT }, (_, i) => 1 - i / LAYER_COUNT);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {layers.map((k) => (
        <View
          key={k}
          style={{
            position: 'absolute',
            width: size * k,
            height: size * k,
            borderRadius: (size * k) / 2,
            backgroundColor: t.glow,
            opacity: LAYER_OPACITY,
          }}
        />
      ))}
    </View>
  );
}
