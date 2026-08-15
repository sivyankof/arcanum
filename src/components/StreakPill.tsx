/** Плашка серии: огонёк «дышит» (пункт 10 motion-spec, параметры из .pill .ic эталона),
 *  а при росте серии один раз даёт салют из звёздочек. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { pingPong } from '../lib/loops';
import { useTheme } from '../theme/useTheme';
import { Pill } from './Pill';
import { Sparks } from './Sparks';
import { Txt } from './Txt';

const BREATH_MS = 650; // полный цикл 1.3 с

export function StreakPill({
  streak,
  burst = 0,
  style,
}: {
  streak: number;
  burst?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const breath = useSharedValue(0);

  React.useEffect(() => {
    breath.value = pingPong(1, BREATH_MS);
  }, [breath]);

  const flame = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.18 * breath.value }, { rotate: `${3 * breath.value}deg` }],
  }));

  return (
    <Pill style={style}>
      {/* салют привязан к огоньку, поэтому лежит в его обёртке */}
      <View>
        <Animated.View style={[{ transformOrigin: 'bottom' }, flame]}>
          <Ionicons name="flame" size={16} color={t.accent} />
        </Animated.View>
        <Sparks burst={burst} />
      </View>
      {/* счёт и подпись стоят друг под другом (.pill .tx эталона: b — блочный):
          в ряду из двух пилюль на строку они уже не помещаются */}
      <View style={st.tx}>
        <Txt style={[st.count, { color: t.head }]}>{tr('today.streakDays', { count: streak })}</Txt>
        {/* «СЕРИЯ» — тот же ключ, что у статы профиля: одно слово, один перевод */}
        <Txt style={[st.label, { color: t.muted }]}>{tr('profile.streak')}</Txt>
      </View>
    </Pill>
  );
}

const st = StyleSheet.create({
  tx: { flex: 1 },
  count: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 9, letterSpacing: 0.6 },
});
