/** Пилюля уровня рядом с серией: «Уровень 1 · Любопытная» и полоса прогресса
 *  до следующего уровня (классы .pill и .xline эталона).
 *
 *  Полоса заполняется один раз при появлении экрана: задержка 500 мс, ход 1.5 с,
 *  кривая cubic-bezier(.25,1.2,.4,1) — лёгкий перелёт за цель, как в эталоне.
 *  Перелёт срезается обрезкой дорожки. При progress 0 движения не видно — так и задумано.
 *  Уровень и progress считаются по-настоящему (levelFromXp, src/lib/xp.ts, задача 08). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';
import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { levelTitleKey } from '../lib/xp';
import { useTheme } from '../theme/useTheme';
import { Pill } from './Pill';
import { PROGRESS_EASE, ProgressBar } from './ProgressBar';
import { Txt } from './Txt';

const FILL_DELAY = 500;
const FILL_MS = 1500;

export function XpPill({
  level,
  progress,
  style,
}: {
  level: number;
  /** Доля пути до следующего уровня, 0..1. */
  progress: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const fill = useSharedValue(0);

  React.useEffect(() => {
    fill.value = withDelay(
      FILL_DELAY,
      withTiming(progress, {
        duration: FILL_MS,
        easing: PROGRESS_EASE,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [fill, progress]);

  const title = tr(levelTitleKey(level));

  return (
    <Pill style={style}>
      <View style={st.col}>
        <Txt style={[st.level, { color: t.head }]}>{tr('level.line', { n: level, title })}</Txt>
        <ProgressBar progress={fill} radius={3} style={st.track} />
      </View>
    </Pill>
  );
}

const st = StyleSheet.create({
  col: { flex: 1 },
  level: { fontSize: 11, fontWeight: '700' },
  track: { height: 6, marginTop: 5 },
});
