/** Общий градиентный фон всех экранов — эталон «Небесное золото».
 *  В эталоне фон радиальный; здесь вертикальный градиент с теми же стопами. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function ScreenBg() {
  const t = useTheme();
  return (
    <LinearGradient
      colors={[t.bgTop, t.bg, t.bgBottom]}
      locations={[0, 0.48, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}
