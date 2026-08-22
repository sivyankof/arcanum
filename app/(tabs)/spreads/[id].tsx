/** Маршрут игры в расклад (спека 36): вложенный стек таба «Расклады». Каждый вход из списка —
 *  новый экземпляр экрана, то есть всегда новый расклад с шага «Настрой» (product-spec §4). */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SpreadScreen } from '../../../src/components/SpreadScreen';
import { spreadById } from '../../../src/lib/content';
import { moonSpreadState } from '../../../src/lib/moonSpread';
import { spreadLocked } from '../../../src/lib/premium';
import { useDevMoonNow } from '../../../src/lib/useDevMoonNow';
import { useApp } from '../../../src/store/useApp';

export default function SpreadPlayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spread = spreadById.get(id ?? '');
  const devNow = useDevMoonNow();
  const premium = useApp((s) => s.premium);
  // «Карта дня» раскладом не играется (список ведёт на «Сегодня»), чужой id — назад в список
  if (!spread || spread.id === 'card-of-day') return <Redirect href="/spreads" />;
  // вне окна события лунный расклад не играется — прямая ссылка не должна обходить блокировку
  // списка (тот же приём, что у 'card-of-day' и чужого id)
  if (spread.moon && !moonSpreadState(spread.moon, devNow ?? new Date())?.open) return <Redirect href="/spreads" />;
  // premium-расклад без права — на пейвол (спека 53); лунный гейт окна проверен ПЕРВЫМ выше
  // (прецедент: гейт урока `/lesson/[id]`)
  if (spreadLocked(spread, premium)) return <Redirect href="/paywall?from=spreads" />;
  return <SpreadScreen key={spread.id} spread={spread} mode="play" />;
}
