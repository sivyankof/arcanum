/** Карточка «Повторение» в шапке таба «Курс» (спека 45, раздел В; design-system §5): панель как
 *  ModuleHeader над первым модулем — Overline «ПОВТОРЕНИЕ», строка состояния, справа иконка.
 *  Состояние считает чистая reviewCardState: 'hidden' — колода пуста, карточки нет вовсе; 'due' —
 *  «N карт ждут» и 'new' — «Новых карт: N» ведут в тренажёр; 'done' — «Всё повторено ✓ · завтра: M»
 *  цветом success и НЕ тап (при M = 0 хвост не печатается вовсе). Числительное due — через count
 *  (logic-spec §10). Каркас панели — общий `PanelRow` (задача 72, финальное ревью, находка F14):
 *  раньше вёрстка была продублирована с `FragmentPanel` почти дословно. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { reviewCardState, type ReviewSummary } from '../lib/review';
import { spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PanelRow } from './PanelRow';

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
        : // хвост «завтра: N» — только когда завтра действительно кто-то ждёт. Интервалы SM-2
          // быстро уезжают на 6+ дней, и тогда «завтра: 0» стояло бы неделями, ничего не сообщая
          // (хвост задачи 45б; макет этот случай не рисует — там демо-состояние «завтра: 4»)
          tr(summary.dueTomorrow > 0 ? 'review.allDone' : 'review.allDoneNoTomorrow', {
            n: summary.dueTomorrow,
          });

  return (
    <PanelRow
      overline={tr('review.panelTitle')}
      line={line}
      lineColor={tappable ? undefined : t.success}
      // `.revcard .ri` эталона: иконка muted во всех состояниях, тап-аффорданс несёт сама панель
      icon="sync-outline"
      tappable={tappable}
      onPress={onPress}
      // та же панель, что шапка модуля (design-system §5); отступ снизу — до шапки первого модуля
      style={{ marginBottom: spacing.m }}
    />
  );
}
