/** Сводка «Повторения» для карточки ReviewPanel — общая для табов «Курс» и «Учёба» (спека 72:
 *  второй потребитель). День пересчитывается общим `useNow` (фокус экрана И возврат из фона —
 *  useFocusEffect один не ловит ни полночь, ни сворачивание, урок 06а). */
import React from 'react';
import { course } from './content';
import { localDateISO } from './dates';
import { deckOrder, reviewSummary, type ReviewSummary } from './review';
import { useNow } from './useNow';
import { useApp } from '../store/useApp';

export function useReviewSummary(): ReviewSummary {
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  const today = localDateISO(useNow());
  return React.useMemo(
    () => reviewSummary(deckOrder(course, lessonsProgress), srs, today, reviewDay),
    [lessonsProgress, srs, reviewDay, today],
  );
}
