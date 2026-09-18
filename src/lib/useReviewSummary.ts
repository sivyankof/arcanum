/** Сводка «Повторения» для карточки ReviewPanel — общая для табов «Курс» и «Учёба» (спека 72:
 *  второй потребитель). День пересчитывается по фокусу экрана И по возврату из фона: useFocusEffect
 *  не ловит ни полночь, ни сворачивание (урок 06а), а таб может остаться открытым с вечера. */
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { course } from './content';
import { localDateISO } from './dates';
import { deckOrder, reviewSummary, type ReviewSummary } from './review';
import { useAppActive } from './useAppActive';
import { useApp } from '../store/useApp';

export function useReviewSummary(): ReviewSummary {
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  const [today, setToday] = React.useState(() => localDateISO());
  useFocusEffect(React.useCallback(() => setToday(localDateISO()), []));
  useAppActive(() => setToday(localDateISO()));
  return React.useMemo(
    () => reviewSummary(deckOrder(course, lessonsProgress), srs, today, reviewDay),
    [lessonsProgress, srs, reviewDay, today],
  );
}
