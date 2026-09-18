/** Шапка экрана верхнего уровня (оверлайн-дата заглавными + заголовок Display 30 + разделитель),
 *  в собственном FadeUp index=0 — первый шаг каскада экрана. Раньше «Учёба»
 *  (app/(tabs)/index.tsx) и «Карта дня» (app/daily.tsx) держали эту вёрстку каждый у себя
 *  дословно (задача 72, финальное ревью, находка F15). */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { FadeUp } from './FadeUp';
import { Rule } from './Rule';
import { Txt } from './Txt';

export function ScreenHeader({ overline, title }: { overline: string; title: string }) {
  const t = useTheme();
  return (
    <FadeUp index={0}>
      <Txt style={[st.date, { color: t.muted }]}>{overline}</Txt>
      <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
      <Rule />
    </FadeUp>
  );
}

const st = StyleSheet.create({
  date: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
});
