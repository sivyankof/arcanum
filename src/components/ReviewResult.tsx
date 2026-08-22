/** Финал сессии повторения (спека 45, раздел В): ResultPanel (въезд, Success, катящийся «+X XP») +
 *  строка «ПОВТОРЕНО N · С ПЕРВОГО РАЗА K» + CTA «ГОТОВО» (назад в курс) + ссылка «Ещё N», если
 *  после сессии есть что повторять (новая порция на том же экране, N = nextSessionSize).
 *  Дневной лимит бесплатного тренажёра (спека 53): при `moreLocked` рядом с «Ещё N» в ряд встаёт
 *  плашка «✦ ПРЕМИУМ» (эталон `#tragain` — плашка ВНУТРИ ссылки), `onMore` тот же — экран решает,
 *  что открыть заново, а что увести на пейвол.
 *  Конфетти нет: акцентная анимация экрана одна — переворот (motion-spec: 1–2 на экран). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PremiumBadge } from './PremiumBadge';
import { ResultPanel } from './ResultPanel';
import { Txt } from './Txt';

export function ReviewResult({
  gained,
  cards,
  firstTry,
  more,
  moreLocked,
  onDone,
  onMore,
}: {
  gained: number;
  cards: number;
  firstTry: number;
  /** размер следующей порции; 0 — ссылки «Ещё» нет */
  more: number;
  /** дневной лимит бесплатного тренажёра исчерпан (спека 53) — рядом с «Ещё N» плашка «ПРЕМИУМ» */
  moreLocked?: boolean;
  onDone: () => void;
  onMore: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <ResultPanel
      gained={gained}
      title={tr('review.panelTitle')}
      line={tr('review.resultLine', { n: cards, k: firstTry })}
      // `#trres` эталона: строка «ПОВТОРЕНО N · С ПЕРВОГО РАЗА K» стоит НАД счётчиком «+X XP»
      // (у урока — наоборот, там дефолт ResultPanel)
      lineFirst
      cta={{ label: tr('review.done'), onPress: onDone }}
      footer={
        more > 0 ? (
          <Pressable onPress={onMore} hitSlop={8} style={[st.more, moreLocked && st.moreRow]}>
            <Txt style={[st.moreTxt, { color: t.accent }]}>{tr('review.more', { n: more })}</Txt>
            {moreLocked && <PremiumBadge label={tr('course.premiumChip')} />}
          </Pressable>
        ) : undefined
      }
    />
  );
}

const st = StyleSheet.create({
  // `.trlink` эталона: 10.5/ls1 accent по центру, отступ 10
  more: { marginTop: 10 },
  // `#tragain`: плашка ВНУТРИ ссылки, в один ряд с текстом
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  moreTxt: { fontSize: 10.5, letterSpacing: 1, textAlign: 'center' }, // .trlink — веса эталон не задаёт
});
