/** Синхронизация права Premium с магазином (спека 53б). Живёт в корневом layout, один раз.
 *  Три точки: монтирование (старт), возврат из фона (правило 10: истечение подписки — тоже
 *  временнóе, useFocusEffect его не ловит) и push SDK (покупка, продление, отмена).
 *  Без магазина (Expo Go, веб, нет ключа) — no-op: адаптер отдаёт заглушки, стор не трогается,
 *  DEV-право тумблера живёт как жило. */
import React from 'react';
import { useApp } from '../store/useApp';
import { localDateISO } from './dates';
import type { PremiumState } from './premium';
import { init, onEntitlementChange, refreshEntitlement } from './purchases';
import { mergeEntitlement, samePremium } from './purchasesMap';
import { useAppActive } from './useAppActive';

/** Ответ магазина (или его отсутствие) → стор. Пишет только при реальной перемене: иначе каждый
 *  старт клал бы в persist одно и то же. */
export function applyEntitlement(fromStore: PremiumState | null): void {
  const { premium, setPremium } = useApp.getState();
  const next = mergeEntitlement(premium, fromStore, localDateISO());
  if (!samePremium(next, premium)) setPremium(next);
}

export function usePremiumSync(): void {
  React.useEffect(() => {
    let alive = true;
    let unsubscribe: () => void = () => undefined;
    (async () => {
      await init();
      if (!alive) return;
      unsubscribe = onEntitlementChange(applyEntitlement);
      applyEntitlement(await refreshEntitlement());
    })().catch((err) => console.warn('[purchases] синхронизация права не удалась:', err));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  useAppActive(() => {
    refreshEntitlement()
      .then(applyEntitlement)
      .catch((err) => console.warn('[purchases] синхронизация права не удалась:', err));
  });
}
