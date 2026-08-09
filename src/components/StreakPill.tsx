/** Плашка серии: огонёк «дышит» (пункт 10 motion-spec, параметры из .pill .ic эталона),
 *  а при росте серии один раз даёт салют из звёздочек. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { pingPong } from '../lib/loops';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Sparks } from './Sparks';
import { Txt } from './Txt';

const BREATH_MS = 650; // полный цикл 1.3 с

export function StreakPill({ streak, burst = 0 }: { streak: number; burst?: number }) {
  const t = useTheme();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en';

  const breath = useSharedValue(0);

  React.useEffect(() => {
    breath.value = pingPong(1, BREATH_MS);
  }, [breath]);

  const flame = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.18 * breath.value }, { rotate: `${3 * breath.value}deg` }],
  }));

  return (
    <View style={[st.pill, { backgroundColor: t.panel, borderColor: t.line }]}>
      {/* салют привязан к огоньку, поэтому лежит в его обёртке */}
      <View>
        <Animated.View style={[{ transformOrigin: 'bottom' }, flame]}>
          <Ionicons name="flame" size={16} color={t.accent} />
        </Animated.View>
        <Sparks burst={burst} />
      </View>
      <Txt style={{ color: t.head, fontWeight: '700', fontSize: 13 }}>
        {streak} {lang === 'ru' ? 'дн.' : 'days'}
      </Txt>
      <Txt style={{ color: t.muted, fontSize: 11 }}>{lang === 'ru' ? 'серия' : 'streak'}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.l,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
});
