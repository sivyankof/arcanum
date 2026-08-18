/** Маршрут игры в расклад (спека 36): вложенный стек таба «Расклады». Каждый вход из списка —
 *  новый экземпляр экрана, то есть всегда новый расклад с шага «Настрой» (product-spec §4). */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SpreadScreen } from '../../../src/components/SpreadScreen';
import { spreadById } from '../../../src/lib/content';

export default function SpreadPlayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spread = spreadById.get(id ?? '');
  // «Карта дня» раскладом не играется (список ведёт на «Сегодня»), чужой id — назад в список
  if (!spread || spread.id === 'card-of-day') return <Redirect href="/spreads" />;
  return <SpreadScreen key={spread.id} spread={spread} mode="play" />;
}
