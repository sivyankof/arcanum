/** Финал урока (motion-spec §16, `.lresult` эталона): общая панель ResultPanel (въезд 500мс → хаптика
 *  Success → катящийся «+N XP») и по её onCounted — полоса прогресса модуля пружинной кривой (та же,
 *  что у XpPill) + конфетти вверх веером. Конфетти живёт ТОЛЬКО здесь (и позже в коллекции, этап 3+) —
 *  редкость сохраняет праздник. gained = 0 (повтор, +2 сегодня уже получены): счётчика нет —
 *  заголовок «Повторение пройдено». Reduce motion: конфетти не запускается (motion-spec §16). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { ReduceMotion, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { PROGRESS_EASE, ProgressBar } from './ProgressBar';
import { ResultPanel } from './ResultPanel';
import { Sparks } from './Sparks';

const BAR_MS = 800; // полоса модуля
// конфетти по motion-spec §16: ~22 частицы, вверх веером, 1.1с
const CONFETTI_COUNT = 22;
const CONFETTI_MS = 1100;
const CONFETTI_GLYPHS = ['✦', '✧', '❖', '·'];

export function LessonResult({
  gained,
  done,
  total,
  prevDone,
  onNext,
}: {
  gained: number;
  done: number;
  total: number;
  prevDone: number;
  onNext: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();

  const [burst, setBurst] = React.useState(0);
  const bar = useSharedValue(total ? prevDone / total : 0);

  // счётчик докатился (ResultPanel.onCounted) → полоса + конфетти: шаги §16 после счётчика.
  // Колбэк берётся панелью один раз при монтировании — как раньше брались значения в эффекте
  const onCounted = () => {
    bar.value = withTiming(total ? done / total : 0, {
      duration: BAR_MS,
      easing: PROGRESS_EASE, // перелёт за цель, как полоса XpPill (общий модуль ProgressBar)
      reduceMotion: ReduceMotion.System,
    });
    if (!reduced) setBurst((b) => b + 1);
  };

  return (
    <ResultPanel
      gained={gained}
      zeroTitle={tr('lesson.repeatDone')}
      line={tr('lesson.passedOf', { done, count: total })}
      cta={{ label: tr('lesson.nextOnPath'), onPress: onNext }}
      onCounted={onCounted}
      footer={
        // конфетти из-за панели: верхняя полуокружность + подброс, цвета через один
        <Sparks
          burst={burst}
          count={CONFETTI_COUNT}
          duration={CONFETTI_MS}
          distance={[90, 220]}
          size={[8, 18]}
          glyphs={CONFETTI_GLYPHS}
          angleJitter={0.5}
          angleRange={[Math.PI, Math.PI * 2]}
          lift={-60}
          colors={[t.accent, t.accent2]}
        />
      }
    >
      <ProgressBar progress={bar} radius={3} style={st.bar} />
    </ResultPanel>
  );
}

const st = StyleSheet.create({
  bar: { height: 6, alignSelf: 'stretch', marginTop: 12, marginHorizontal: 30 },
});
