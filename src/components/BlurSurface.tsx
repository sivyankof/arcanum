/** Размытая подложка `backdrop-filter: blur(...)` из эталона: слой BlurView + слой navBg поверх.
 *  Одного BlurView мало — на всех платформах он даёт разную плотность, а нужный цвет и
 *  полупрозрачность задаёт именно navBg. Используется таб-баром и липкой панелью поиска. */
import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function BlurSurface({ intensity = 40 }: { intensity?: number }) {
  const t = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <BlurView
        intensity={intensity}
        tint={t.mode === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.navBg }]} />
    </View>
  );
}
