/** Вложенный стек таба «Расклады» (спека 36): список → экран расклада. Таб-бар остаётся виден,
 *  между табами можно ходить — экран расклада не размонтируется, черновик живёт в его состоянии. */
import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../src/theme/useTheme';

export const unstable_settings = { initialRouteName: 'index' };

export default function SpreadsLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="index" />
      {/* шапка расклада — нативная прозрачная, как у страницы карты: свой заголовок не нужен,
          имя расклада уже в теле экрана; подпись «назад» ставит сам экран */}
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTintColor: t.accent,
        }}
      />
    </Stack>
  );
}
