/** Вложенный стек таба «Расклады» (спека 36): список → экран расклада. Таб-бар остаётся виден,
 *  между табами можно ходить — экран расклада не размонтируется, черновик живёт в его состоянии. */
import { Stack } from 'expo-router';
import React from 'react';
import { transparentHeader } from '../../../src/theme/navHeader';
import { useTheme } from '../../../src/theme/useTheme';

export const unstable_settings = { initialRouteName: 'index' };

export default function SpreadsLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="index" />
      {/* шапка расклада — нативная прозрачная, как у страницы карты: свой заголовок не нужен,
          имя расклада уже в теле экрана; подпись «назад» ставит сам экран. headerShown: true
          поверх общей фабрики — родительский Stack прячет шапку по умолчанию (headerShown: false
          в screenOptions выше), этому экрану её нужно вернуть */}
      <Stack.Screen name="[id]" options={{ headerShown: true, ...transparentHeader(t) }} />
    </Stack>
  );
}
