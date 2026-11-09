/** Шапка экрана верхнего уровня (оверлайн-дата заглавными + заголовок Display 30 + разделитель),
 *  в собственном FadeUp index=0 — первый шаг каскада экрана. Раньше «Учёба»
 *  (app/(tabs)/index.tsx) и «Карта дня» (app/daily.tsx) держали эту вёрстку каждый у себя
 *  дословно (задача 72, финальное ревью, находка F15). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { FadeUp } from './FadeUp';
import { Rule } from './Rule';
import { Txt } from './Txt';

export function ScreenHeader({
  overline,
  title,
  right,
}: {
  overline: string;
  title: string;
  /** кнопка у правого края строки заголовка (например, звук на «Учёбе»); заголовок остаётся по центру */
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const head = (
    <>
      <Txt style={[st.date, { color: t.muted }]}>{overline}</Txt>
      <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
    </>
  );
  return (
    <FadeUp index={0}>
      {right ? (
        <View style={st.wrap}>
          {head}
          <View style={st.right}>{right}</View>
        </View>
      ) : (
        head
      )}
      <Rule />
    </FadeUp>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'relative' },
  // строка заголовка: высота 36, прижата к низу обёртки
  right: { position: 'absolute', right: 0, bottom: 0, height: 36, justifyContent: 'center' },
  date: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
});
