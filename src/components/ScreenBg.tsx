/** Общий градиентный фон всех экранов — эталон «Небесное золото».
 *  В эталоне фон радиальный; здесь вертикальный градиент с теми же стопами.
 *  Поверх — мерцающие звёзды (пункт 2 motion-spec); в светлой теме скрыты. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';
import { pingPong } from '../lib/loops';
import { useTheme } from '../theme/useTheme';

// Позиции, размеры и задержки — из блока .stars эталона (звёзды только в верхней части экрана).
// Двум крупным звёздам в макете размер не задан, то есть они наследуют дефолт браузера — 16 px;
// именно этот контраст 6 → 16 и делает небо живым, не сглаживать его.
const STARS = [
  { left: '8%', top: '7%', size: 16, delay: 0, symbol: '✦' },
  { left: '26%', top: '12%', size: 7, delay: 900, symbol: '✧' },
  { left: '55%', top: '6%', size: 6, delay: 1600, symbol: '✦' },
  { left: '78%', top: '10%', size: 16, delay: 400, symbol: '✧' },
  { left: '90%', top: '16%', size: 7, delay: 2200, symbol: '✦' },
  { left: '14%', top: '20%', size: 6, delay: 1200, symbol: '✧' },
] as const;

function Star({ left, top, size, delay, symbol }: (typeof STARS)[number]) {
  const t = useTheme();
  const v = useSharedValue(0);

  React.useEffect(() => {
    v.value = withDelay(delay, pingPong(1, 2000));
  }, [v, delay]);

  const twinkle = useAnimatedStyle(() => ({
    opacity: 0.15 + v.value * 0.5,
    transform: [{ scale: 0.8 + v.value * 0.3 }],
  }));

  return (
    <Animated.Text style={[{ position: 'absolute', left, top, fontSize: size, color: t.accent }, twinkle]}>
      {symbol}
    </Animated.Text>
  );
}

export function ScreenBg() {
  const t = useTheme();
  return (
    <>
      <LinearGradient
        colors={[t.bgTop, t.bg, t.bgBottom]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      {t.mode === 'dark' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {STARS.map((s) => (
            <Star key={`${s.left}-${s.top}`} {...s} />
          ))}
        </View>
      )}
    </>
  );
}
