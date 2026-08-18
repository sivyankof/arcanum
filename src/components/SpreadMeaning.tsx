/** Панель значения позиции / состава расклада (`.posmean` эталона, спека 36): panel/line radius 13,
 *  паддинг 11×13, заголовок 8.5px ls 2 accent, текст Cormorant 13.5/21. Появление — opacity 0→1
 *  и сдвиг 8→0 за 450 мс при монтировании (`.posmean.show`). accentBorder — рамка frame для
 *  «СОСТАВА РАСКЛАДА» (`#s3comp`). Панель монтируется в момент открытия карты, поэтому анимация
 *  висит на монтировании, а не на фокусе. */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

const ENTER_MS = 450;
const SHIFT = 8;

export function MeaningPanel({
  title,
  paragraphs,
  todo,
  accentBorder,
  style,
}: {
  title: string;
  paragraphs: string[];
  /** блок карты со статусом todo — «Текст готовится» курсивом цветом muted */
  todo?: boolean;
  accentBorder?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const v = useSharedValue(0);

  React.useEffect(() => {
    v.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [v]);

  const anim = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * SHIFT }],
  }));

  return (
    <Animated.View style={[st.panel, { backgroundColor: t.panel, borderColor: accentBorder ? t.frame : t.line }, anim, style]}>
      <Txt style={[st.title, { color: t.accent }]}>{title}</Txt>
      {paragraphs.map((p, i) => (
        <Txt key={i} style={[st.p, { color: todo ? t.muted : t.text }, todo && st.todo, i > 0 && st.gap]}>
          {p}
        </Txt>
      ))}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 13, marginTop: 9 },
  title: { fontSize: 8.5, letterSpacing: 2 },
  p: { fontFamily: fonts.display, fontSize: 13.5, lineHeight: 21, marginTop: 4 },
  gap: { marginTop: 6 },
  todo: { fontStyle: 'italic' },
});
