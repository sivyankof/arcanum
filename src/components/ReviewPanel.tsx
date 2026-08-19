/** Карточка «Повторение» в шапке таба «Курс» (спека 45, раздел В; design-system §5): панель как
 *  ModuleHeader над первым модулем — Overline «ПОВТОРЕНИЕ», строка состояния, справа иконка.
 *  Состояние считает чистая reviewCardState: 'hidden' — колода пуста, карточки нет вовсе; 'due' —
 *  «N карт ждут» и 'new' — «Новых карт: N» ведут в тренажёр; 'done' — «Всё повторено ✓ · завтра: M»
 *  цветом success и НЕ тап. Числительное due — через count (logic-spec §10). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { reviewCardState, type ReviewSummary } from '../lib/review';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function ReviewPanel({ summary, onPress }: { summary: ReviewSummary; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const state = reviewCardState(summary);
  if (state === 'hidden') return null;

  const tappable = state !== 'done';
  const line =
    state === 'due'
      ? tr('review.due', { count: summary.due })
      : state === 'new'
        ? tr('review.new', { n: summary.newAvailable })
        : tr('review.allDone', { n: summary.dueTomorrow });

  const body = (
    <>
      <View style={{ flex: 1 }}>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('review.panelTitle')}</Txt>
        <Txt style={[st.line, { color: tappable ? t.head : t.success }]}>{line}</Txt>
      </View>
      {/* `.revcard .ri` эталона: иконка muted во всех состояниях, тап-аффорданс несёт сама панель */}
      <Ionicons name="sync-outline" size={18} color={t.muted} />
    </>
  );
  const box = [st.box, { backgroundColor: t.panel, borderColor: t.line }];

  // «всё повторено» — не кнопка: без PressableScale, иначе пружина обещала бы переход, которого нет
  return tappable ? (
    <PressableScale onPress={onPress} style={box}>
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  // та же панель, что шапка модуля (design-system §5); отступ снизу — до шапки первого модуля
  box: { ...moduleBox, marginBottom: spacing.m },
  // `.revcard small` / `.revcard b` эталона: Overline 8.5/ls2 accent, строка Cormorant 600 15 (меньше
  // названия модуля намеренно — карточка не спорит с шапками модулей)
  overline: { fontSize: 8.5, letterSpacing: 2, fontWeight: '600' },
  line: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
});
